"use node";
import { action, internalAction, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ─── Internal Helper: refresh an expired access token ────────────────────────

async function refreshAccessTokenInternal(
  ctx: ActionCtx,
  googleAccountId: Id<"googleAccounts">
): Promise<string> {
  const account: any = await ctx.runQuery(internal.google.getGoogleAccountById, {
    id: googleAccountId,
  });
  if (!account?.refreshToken) throw new Error("No refresh token available");

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh token: " + (await res.text()));
  const data: any = await res.json();

  await ctx.runMutation(internal.google.saveGoogleAccount, {
    userId: account.userId,
    email: account.email,
    accessToken: data.access_token,
    refreshToken: account.refreshToken,
    expiresIn: data.expires_in,
  });

  return data.access_token as string;
}

export const refreshAccessToken = internalAction({
  args: { googleAccountId: v.id("googleAccounts") },
  handler: async (ctx, args): Promise<string> => {
    return await refreshAccessTokenInternal(ctx, args.googleAccountId);
  },
});

// ─── Public: exchange OAuth code → save tokens + bulk import calendars ────────

export const exchangeCode = action({
  args: { code: v.string(), redirectUri: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const user: any = await ctx.runQuery(api.users.getCurrentUser);
    if (!user) throw new Error("User not found");
    if (!user.familyId)
      throw new Error("You must be in a family workspace before syncing calendars.");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret)
      throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET on the server.");

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: args.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: args.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) throw new Error("Token exchange failed: " + (await tokenRes.text()));
    const tokenData: any = await tokenRes.json();

    // 2. Fetch Google userinfo (to get Google email)
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo: any = await userInfoRes.json();

    // 3. Persist the account record
    const accountId: Id<"googleAccounts"> = await ctx.runMutation(internal.google.saveGoogleAccount, {
      userId: user._id,
      email: userInfo.email,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    });

    // 4. Fetch and save the user's Google Calendar list
    const calListRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    if (calListRes.ok) {
      const calListData: any = await calListRes.json();
      for (const cal of calListData.items ?? []) {
        const calendarId = await ctx.runMutation(internal.calendars.upsertCalendar, {
          googleAccountId: accountId,
          googleCalendarId: cal.id,
          name: cal.summary ?? cal.id,
          ownerId: user._id,
          familyId: user.familyId!,
          assigneeId: user._id,
        });

        // Trigger immediate sync for each newly imported calendar
        await ctx.scheduler.runAfter(0, internal.googleActions.syncCalendar, {
          calendarId,
        });
      }
    }

    return accountId;
  },
});


// ─── Internal: Sync a calendar (Incremental or Full) ─────────────────────────

async function syncCalendarLogic(
  ctx: ActionCtx,
  args: { calendarId: Id<"calendars"> }
): Promise<void> {
  const calendar: any = await ctx.runQuery(internal.google.getCalendarById, {
    calendarId: args.calendarId,
  });
  if (!calendar) return;

  const account: any = await ctx.runQuery(internal.google.getGoogleAccountById, {
    id: calendar.googleAccountId,
  });
  if (!account) return;

  let accessToken = account.accessToken;
  if (account.expiresAt && Date.now() > account.expiresAt - 60_000) {
    accessToken = await refreshAccessTokenInternal(ctx, account._id);
  }

  const params = new URLSearchParams({
    singleEvents: "true",
    maxResults: "250",
  });

  // If we have a sync token, use it for incremental sync
  if (calendar.syncToken) {
    params.append("syncToken", calendar.syncToken);
  } else {
    // First sync: Define a default window (e.g., -1 month to +1 year)
    const now = new Date();
    const timeMin = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
    const timeMax = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString();
    params.append("timeMin", timeMin);
    params.append("timeMax", timeMax);
  }

  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendar.googleCalendarId
      )}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (res.status === 410) {
      // Sync token expired: clear it and retry a full sync
      await ctx.runMutation(internal.calendars.updateSyncToken, {
        calendarId: args.calendarId,
        syncToken: "",
      });
      // Call the logic directly to avoid another action hop if possible, or use scheduler
      return await syncCalendarLogic(ctx, { calendarId: args.calendarId });
    }

    if (!res.ok) throw new Error(`Google API error: ${await res.text()}`);

    const data: any = await res.json();
    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken;

    for (const item of data.items ?? []) {
      await ctx.runMutation(internal.calendars.upsertCalendarEvent, {
        calendarId: args.calendarId,
        googleEventId: item.id,
        title: item.summary ?? "(No title)",
        description: item.description,
        start: item.start?.dateTime ?? item.start?.date,
        end: item.end?.dateTime ?? item.end?.date,
        isAllDay: !item.start?.dateTime,
        status: item.status,
      });
    }
  } while (pageToken);

  if (nextSyncToken) {
    await ctx.runMutation(internal.calendars.updateSyncToken, {
      calendarId: args.calendarId,
      syncToken: nextSyncToken,
    });
  }
}

export const syncCalendar = internalAction({
  args: { calendarId: v.id("calendars") },
  handler: async (ctx, args) => {
    await syncCalendarLogic(ctx, args);
  },
});

// ─── Public: Fetch events from local database (triggers sync in background) ───

async function fetchCalendarEventsLogic(
  ctx: ActionCtx,
  args: { calendarId: Id<"calendars"> }
): Promise<any[]> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const calendar: any = await ctx.runQuery(internal.google.getCalendarById, {
    calendarId: args.calendarId,
  });

  // Trigger a sync in the background so the next visit is up to date, if enabled
  if (calendar && calendar.syncEnabled !== false) {
    await ctx.scheduler.runAfter(0, internal.googleActions.syncCalendar, {
      calendarId: args.calendarId,
    });
  }

  // Query the local database via a query (needs to be defined in calendars.ts)
  return await ctx.runQuery(api.calendars.getEventsByCalendar, {
    calendarId: args.calendarId,
  });
}

export const fetchCalendarEvents = action({
  args: {
    calendarId: v.id("calendars"),
  },
  handler: async (ctx, args) => {
    return await fetchCalendarEventsLogic(ctx, args);
  },
});

// ─── Internal: Sync all calendars in the system ──────────────────────────────

export const syncAll = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const calendars = await ctx.runQuery(internal.calendars.getAllCalendars);
    for (const calendar of calendars) {
      await ctx.scheduler.runAfter(0, internal.googleActions.syncCalendar, {
        calendarId: calendar._id,
      });
    }
  },
});
