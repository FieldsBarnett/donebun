import { isTauri } from "@tauri-apps/api/core";
import {
  getItems,
  onWidgetAction,
  pollPendingWidgetActions,
  reloadAllTimelines,
  setItems,
  setWidgetConfig,
  type WidgetConfig,
  type WidgetElement,
} from "tauri-plugin-widgets-api";
import { authClient } from "./auth-client";
import type {
  CalendarMonthSnapshot,
  WidgetCalendarEventItem,
} from "./calendarMonth";
import { formatTaskTime, type TodayTaskItem } from "./todayTasks";

export const WIDGET_APP_GROUP = "group.app.donebun.ios";
const WIDGET_DEEP_LINK = "donebun://today";
export const WIDGET_VOICE_DEEP_LINK = "donebun://voice";
const WIDGET_OPEN_ACTION_KEY = "widget_open_action";
const WIDGET_VOICE_ACTION = "voice";
const WIDGET_CALENDAR_KEY = "widget_calendar_month";
const WIDGET_CALENDAR_EVENTS_KEY = "widget_calendar_events";
const WIDGET_TIMELINE_PREFIX = "timeline:";
const WIDGET_PENDING_STATUS_KEY = "widget_pending_status_updates";
const WIDGET_PENDING_COMPLETES_KEY = "widget_pending_completes";
const WIDGET_MOVE_TASKS_PREF_KEY = "widget_move_tasks_preference";

export const OPEN_VOICE_EVENT = "donebun:open-voice";
export const OPEN_TIMELINE_DAY_EVENT = "donebun:open-timeline-day";

export function dispatchOpenVoice(): void {
  window.dispatchEvent(new CustomEvent(OPEN_VOICE_EVENT));
}

export function dispatchOpenTimelineDay(dateKey: string): void {
  window.dispatchEvent(
    new CustomEvent(OPEN_TIMELINE_DAY_EVENT, { detail: { date: dateKey } })
  );
}

export type WidgetOpenActionHandlers = {
  onVoice: () => void;
  onTimelineDay: (dateKey: string) => void;
  onOpenTask: (taskId: string, dateKey?: string) => void;
};

export type WidgetStatusUpdate = {
  id: string;
  status: "completed" | "active";
};

/** Keep in sync with `src/index.css` and DoneBunWidgetTheme.swift */
const WIDGET_THEME = {
  canvas: "#ffffff",
  surfaceSoft: "#f2f2f7",
  primary: "#007aff",
  muted: "#8e8e93",
  yellow: "#ffcc00",
  ink: "#000000",
} as const;

const WIDGET_SURFACE = {
  padding: 12 as const,
  background: WIDGET_THEME.canvas,
};

export function parseCompleteTaskAction(
  action: string,
  payload?: string
): string | null {
  if (action.startsWith("complete:")) {
    return action.slice("complete:".length);
  }
  if (action === "complete" && payload) {
    return payload;
  }
  return null;
}

/** Always prefer the Better Auth → Convex JWT (not the session cookie token). */
async function syncWidgetCredentials(): Promise<void> {
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!siteUrl || !convexUrl) return;

  try {
    let token: string | undefined;

    const res = await fetch(`${siteUrl}/api/auth/convex/token`, {
      credentials: "include",
    });
    if (res.ok) {
      const body = (await res.json()) as { token?: string };
      token = body.token;
    }

    // Fallback for environments where the dedicated endpoint isn't available yet.
    if (!token) {
      const session = await authClient.getSession();
      token = session.data?.session?.token;
    }

    if (token) {
      await setItems("widget_auth_token", token, WIDGET_APP_GROUP);
    }
    await setItems("widget_convex_url", convexUrl, WIDGET_APP_GROUP);
  } catch (error) {
    console.warn("Widget credential sync failed:", error);
  }
}

function taskListItems(tasks: TodayTaskItem[]): WidgetElement {
  return {
    type: "list",
    spacing: 4,
    items: tasks.map((task) => {
      const time = task.dueDate ? formatTaskTime(task.dueDate) : null;
      const label = time ? `${time}  ${task.title}` : task.title;
      return {
        text: label,
        checked: task.completed,
        action: task.completed ? undefined : `complete:${task.id}`,
      };
    }),
  };
}

function buildTaskListContent(
  tasks: TodayTaskItem[],
  maxItems: number,
  signedIn: boolean
): WidgetElement {
  const header: WidgetElement = {
    type: "hstack",
    spacing: 6,
    alignment: "center",
    children: [
      { type: "text", content: "★", fontSize: 16, color: WIDGET_THEME.yellow },
      {
        type: "text",
        content: "Tasks",
        textStyle: "headline",
        fontWeight: "bold",
        color: WIDGET_THEME.ink,
      },
    ],
  };

  if (!signedIn) {
    return {
      type: "vstack",
      spacing: 8,
      alignment: "leading",
      ...WIDGET_SURFACE,
      children: [
        header,
        {
          type: "text",
          content: "Open DoneBun & sign in",
          fontSize: 13,
          color: WIDGET_THEME.muted,
        },
        {
          type: "text",
          content: "Your tasks sync when you're signed in.",
          fontSize: 11,
          color: WIDGET_THEME.muted,
        },
      ],
    };
  }

  if (tasks.length === 0) {
    return {
      type: "vstack",
      spacing: 8,
      alignment: "leading",
      ...WIDGET_SURFACE,
      children: [
        header,
        {
          type: "text",
          content: "All clear — no upcoming tasks",
          fontSize: 13,
          color: WIDGET_THEME.muted,
        },
      ],
    };
  }

  const visible = tasks.slice(0, maxItems);
  const children: WidgetElement[] = [header, taskListItems(visible)];

  if (tasks.length > maxItems) {
    children.push({
      type: "text",
      content: `+${tasks.length - maxItems} more`,
      fontSize: 12,
      color: WIDGET_THEME.muted,
    });
  }

  return {
    type: "vstack",
    spacing: 6,
    alignment: "leading",
    ...WIDGET_SURFACE,
    children,
  };
}

function wrapDeepLink(content: WidgetElement): WidgetElement {
  return {
    type: "link",
    url: WIDGET_DEEP_LINK,
    children: [content],
  };
}

function buildWidgetConfig(
  tasks: TodayTaskItem[],
  signedIn: boolean
): WidgetConfig {
  const activeCount = tasks.filter((t) => !t.completed).length;
  const nextTitles = tasks
    .filter((t) => !t.completed)
    .slice(0, 2)
    .map((t) => t.title)
    .join(" · ");

  const smallHeader: WidgetElement = {
    type: "hstack",
    spacing: 4,
    alignment: "center",
    children: [
      { type: "text", content: "★", fontSize: 14, color: WIDGET_THEME.yellow },
      {
        type: "text",
        content: "Tasks",
        textStyle: "headline",
        fontWeight: "bold",
        color: WIDGET_THEME.ink,
      },
    ],
  };

  const smallInner: WidgetElement = !signedIn
    ? {
        type: "vstack",
        spacing: 4,
        alignment: "leading",
        ...WIDGET_SURFACE,
        children: [
          smallHeader,
          {
            type: "text",
            content: "Open app & sign in",
            fontSize: 12,
            color: WIDGET_THEME.muted,
          },
        ],
      }
    : activeCount === 0
      ? {
          type: "vstack",
          spacing: 4,
          alignment: "leading",
          ...WIDGET_SURFACE,
          children: [
            smallHeader,
            {
              type: "text",
              content: "All clear",
              fontSize: 12,
              color: WIDGET_THEME.muted,
            },
          ],
        }
      : {
          type: "vstack",
          spacing: 4,
          alignment: "leading",
          ...WIDGET_SURFACE,
          children: [
            {
              type: "text",
              content: String(activeCount),
              fontSize: 28,
              fontWeight: "bold",
              color: WIDGET_THEME.primary,
            },
            {
              type: "text",
              content: activeCount === 1 ? "upcoming task" : "upcoming tasks",
              fontSize: 12,
              color: WIDGET_THEME.muted,
            },
            ...(nextTitles
              ? [
                  {
                    type: "text" as const,
                    content: nextTitles,
                    fontSize: 11,
                    color: WIDGET_THEME.muted,
                    lineLimit: 2,
                  },
                ]
              : []),
          ],
        };

  return {
    version: 1,
    small: wrapDeepLink(smallInner),
    medium: buildTaskListContent(tasks, 5, signedIn),
    large: buildTaskListContent(tasks, 8, signedIn),
  };
}

async function syncWidgetTaskPayload(tasks: TodayTaskItem[]): Promise<void> {
  const payload = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    time: task.dueDate ? formatTaskTime(task.dueDate) : null,
    dateKey: task.dateKey,
    isOverdue: task.isOverdue,
    completed: task.completed,
  }));
  await setItems("widget_tasks", JSON.stringify(payload), WIDGET_APP_GROUP);
}

async function syncCalendarMonthPayload(
  snapshot: CalendarMonthSnapshot
): Promise<void> {
  await setItems(WIDGET_CALENDAR_KEY, JSON.stringify(snapshot), WIDGET_APP_GROUP);
}

async function syncCalendarEventsPayload(
  events: WidgetCalendarEventItem[]
): Promise<void> {
  await setItems(
    WIDGET_CALENDAR_EVENTS_KEY,
    JSON.stringify(events),
    WIDGET_APP_GROUP
  );
}

async function syncMoveTasksPreference(preference: string): Promise<void> {
  await setItems(WIDGET_MOVE_TASKS_PREF_KEY, preference, WIDGET_APP_GROUP);
}

export type SyncTodayWidgetOptions = {
  calendar?: CalendarMonthSnapshot;
  /** Next upcoming calendar events for the large calendar widget list. */
  calendarEvents?: WidgetCalendarEventItem[];
  /** User preference: "immediately" | "next_day" */
  moveTasksPreference?: string;
};

/** Push task + calendar snapshots to native iOS widgets (no-op on web/PWA). */
export async function syncTodayWidget(
  tasks: TodayTaskItem[],
  signedIn: boolean,
  options: SyncTodayWidgetOptions = {}
): Promise<void> {
  if (!isTauri()) return;

  try {
    if (signedIn) {
      await syncWidgetCredentials();
    }
    await syncWidgetTaskPayload(tasks);
    if (options.moveTasksPreference) {
      await syncMoveTasksPreference(options.moveTasksPreference);
    }
    if (options.calendar) {
      await syncCalendarMonthPayload(options.calendar);
    }
    // Always write when provided (including []) so the widget clears stale events.
    if (options.calendarEvents !== undefined) {
      await syncCalendarEventsPayload(options.calendarEvents);
    }
    await setWidgetConfig(buildWidgetConfig(tasks, signedIn), WIDGET_APP_GROUP);
    // Ensure custom calendar widget (own TimelineProvider) reloads App Group data.
    await reloadAllTimelines();
  } catch (error) {
    console.warn("Widget sync failed:", error);
  }
}

function parseOpenAction(
  action: string | null
):
  | { kind: "voice" }
  | { kind: "timeline"; date: string }
  | { kind: "task"; taskId: string; dateKey?: string }
  | null {
  if (!action) return null;
  const trimmed = action.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as {
        kind?: string;
        taskId?: string;
        dateKey?: string;
        date?: string;
      };
      if (obj.kind === "voice") return { kind: "voice" };
      if (obj.kind === "timeline" && typeof obj.date === "string") {
        return { kind: "timeline", date: obj.date };
      }
      if (obj.kind === "task" && typeof obj.taskId === "string" && obj.taskId) {
        return {
          kind: "task",
          taskId: obj.taskId,
          dateKey:
            typeof obj.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.dateKey)
              ? obj.dateKey
              : undefined,
        };
      }
    } catch {
      // fall through to legacy string formats
    }
  }

  if (trimmed === WIDGET_VOICE_ACTION) return { kind: "voice" };
  if (trimmed.startsWith(WIDGET_TIMELINE_PREFIX)) {
    const date = trimmed.slice(WIDGET_TIMELINE_PREFIX.length);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { kind: "timeline", date };
    }
  }
  // Legacy: task:<id> (id may contain colons — take everything after prefix)
  if (trimmed.startsWith("task:")) {
    const taskId = trimmed.slice("task:".length);
    if (taskId) return { kind: "task", taskId };
  }
  return null;
}

async function readPendingStatusUpdates(): Promise<WidgetStatusUpdate[]> {
  const updates: WidgetStatusUpdate[] = [];

  try {
    const raw = await getItems(WIDGET_PENDING_STATUS_KEY, WIDGET_APP_GROUP);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            item &&
            typeof item === "object" &&
            typeof (item as WidgetStatusUpdate).id === "string" &&
            ((item as WidgetStatusUpdate).status === "completed" ||
              (item as WidgetStatusUpdate).status === "active")
          ) {
            updates.push({
              id: (item as WidgetStatusUpdate).id,
              status: (item as WidgetStatusUpdate).status,
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Legacy complete-only queue
  try {
    const raw = await getItems(WIDGET_PENDING_COMPLETES_KEY, WIDGET_APP_GROUP);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === "string" && id && !updates.some((u) => u.id === id)) {
            updates.push({ id, status: "completed" });
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return updates;
}

function dispatchParsedOpenAction(
  parsed: NonNullable<ReturnType<typeof parseOpenAction>>,
  handlers: WidgetOpenActionHandlers
): void {
  if (parsed.kind === "voice") {
    handlers.onVoice();
  } else if (parsed.kind === "timeline") {
    handlers.onTimelineDay(parsed.date);
  } else {
    handlers.onOpenTask(parsed.taskId, parsed.dateKey);
  }
}

/** Parse `donebun://…` URLs from widget Links (timeline / task / voice). */
export function parseDonebunUrl(
  raw: string
):
  | { kind: "voice" }
  | { kind: "timeline"; date: string }
  | { kind: "task"; taskId: string; dateKey?: string }
  | { kind: "today" }
  | null {
  const trimmed = raw.trim();
  // Fallback for odd custom-scheme parsing on some WebViews.
  const loose = trimmed.match(
    /^donebun:\/\/([^/?#]+)(?:\?([^#]*))?/i
  );
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "donebun:") return null;
    const host =
      url.hostname ||
      url.pathname.replace(/^\//, "").split("/")[0] ||
      loose?.[1] ||
      "";
    const params = url.searchParams;
    if (host === "voice") return { kind: "voice" };
    if (host === "today") return { kind: "today" };
    if (host === "timeline") {
      const date = params.get("date") ?? "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: "timeline", date };
      return null;
    }
    if (host === "task") {
      const taskId = params.get("id") ?? "";
      if (!taskId) return null;
      const dateKey = params.get("date") ?? undefined;
      return {
        kind: "task",
        taskId,
        dateKey:
          dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : undefined,
      };
    }
  } catch {
    if (loose) {
      const host = loose[1]?.toLowerCase() ?? "";
      const qs = new URLSearchParams(loose[2] ?? "");
      if (host === "voice") return { kind: "voice" };
      if (host === "today") return { kind: "today" };
      if (host === "timeline") {
        const date = qs.get("date") ?? "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: "timeline", date };
      }
      if (host === "task") {
        const taskId = qs.get("id") ?? "";
        if (taskId) {
          const dateKey = qs.get("date") ?? undefined;
          return {
            kind: "task",
            taskId,
            dateKey:
              dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
                ? dateKey
                : undefined,
          };
        }
      }
    }
  }
  return null;
}

/** Listen for widget `Link` deep links (donebun://…). */
export function setupDonebunDeepLinkHandlers(
  handlers: WidgetOpenActionHandlers
): () => void {
  if (!isTauri()) return () => {};

  let unlisten: (() => void) | undefined;
  let cancelled = false;

  const handleUrls = (urls: string[]) => {
    for (const raw of urls) {
      const parsed = parseDonebunUrl(raw);
      if (!parsed) continue;
      if (parsed.kind === "today") {
        // Open app only — no extra navigation.
        continue;
      }
      dispatchParsedOpenAction(parsed, handlers);
    }
  };

  void (async () => {
    try {
      const { getCurrent, onOpenUrl } = await import(
        "@tauri-apps/plugin-deep-link"
      );
      if (cancelled) return;
      // Register listener before reading current — Opened can race startup.
      unlisten = await onOpenUrl(handleUrls);
      if (cancelled) return;
      const initial = await getCurrent();
      if (initial?.length) handleUrls(initial);

      // Delayed Opened delivery (common on iOS cold start).
      for (let i = 0; i < 10 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;
        const again = await getCurrent();
        if (again?.length) handleUrls(again);
      }
    } catch (error) {
      console.warn("Deep link setup failed:", error);
    }
  })();

  return () => {
    cancelled = true;
    unlisten?.();
  };
}

/** Poll App Group for widget-triggered open actions (voice, timeline day, task). */
export function setupWidgetOpenActionHandlers(
  handlers: WidgetOpenActionHandlers
): () => void {
  if (!isTauri()) return () => {};

  let cancelled = false;

  const check = async () => {
    try {
      const action = await getItems(WIDGET_OPEN_ACTION_KEY, WIDGET_APP_GROUP);
      const parsed = parseOpenAction(action);
      if (!parsed) return;
      await setItems(WIDGET_OPEN_ACTION_KEY, "", WIDGET_APP_GROUP);
      dispatchParsedOpenAction(parsed, handlers);
    } catch {
      // App Group may be unavailable before entitlements are configured.
    }
  };

  void check();

  const onVisible = () => {
    if (document.visibilityState === "visible") void check();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  window.addEventListener("pageshow", onVisible);

  const poll = async () => {
    while (!cancelled) {
      await check();
      await new Promise((r) => setTimeout(r, 500));
    }
  };
  void poll();

  const stopDeepLinks = setupDonebunDeepLinkHandlers(handlers);

  return () => {
    cancelled = true;
    stopDeepLinks();
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.removeEventListener("pageshow", onVisible);
  };
}

/** Listen for widget status actions + drain App Group pending updates. */
export function setupWidgetActionHandlers(
  onUpdateStatus: (
    taskId: string,
    status: "completed" | "active"
  ) => Promise<void>,
  onAfterAction: () => void
): () => void {
  if (!isTauri()) return () => {};

  let cancelled = false;
  let unlisten: (() => void) | undefined;
  const inFlight = new Set<string>();

  const applyOne = async (taskId: string, status: "completed" | "active") => {
    const key = `${taskId}:${status}`;
    if (inFlight.has(key)) return;
    inFlight.add(key);
    try {
      await onUpdateStatus(taskId, status);
      onAfterAction();
    } finally {
      inFlight.delete(key);
    }
  };

  const handlePayload = async (action: string, payload?: string) => {
    const taskId = parseCompleteTaskAction(action, payload);
    if (!taskId) return;
    await applyOne(taskId, "completed");
  };

  const drainPendingStatus = async () => {
    try {
      const updates = await readPendingStatusUpdates();
      if (updates.length === 0) return;
      await setItems(WIDGET_PENDING_STATUS_KEY, "[]", WIDGET_APP_GROUP);
      await setItems(WIDGET_PENDING_COMPLETES_KEY, "[]", WIDGET_APP_GROUP);
      for (const update of updates) {
        await applyOne(update.id, update.status);
      }
    } catch {
      // ignore
    }
  };

  void onWidgetAction((data) => {
    void handlePayload(data.action, data.payload);
  }).then((stop) => {
    unlisten = stop;
  });

  void drainPendingStatus();

  const poll = async () => {
    while (!cancelled) {
      try {
        await drainPendingStatus();
        const pending = await pollPendingWidgetActions(WIDGET_APP_GROUP);
        for (const item of pending) {
          await handlePayload(item.action, item.payload);
        }
      } catch {
        // CompleteTaskIntent / ToggleTaskStatusIntent handle offline via pending queue.
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  void poll();

  const onVisible = () => {
    if (document.visibilityState === "visible") void drainPendingStatus();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);

  return () => {
    cancelled = true;
    unlisten?.();
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
  };
}
