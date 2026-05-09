"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// ─── Voice Task Extraction: Groq Whisper → Groq/OpenAI LLM ───────────────────



const TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
const EXTRACTION_MODEL = "openai/gpt-oss-20b";

// ─── Groq Whisper Transcription ──────────────────────────────────────────────

async function transcribeWithGroq(audioBase64: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  // Convert base64 to Buffer for the form data
  const buffer = Buffer.from(audioBase64, "base64");
  const blob = new Blob([buffer], { type: "audio/wav" });

  const formData = new FormData();
  formData.append("file", blob, "audio.wav");
  formData.append("model", TRANSCRIPTION_MODEL);

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq Transcription error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.text || "";
}

// ─── LLM Extraction (Groq/OpenAI Compatible) ─────────────────────────────────

async function callLLM(prompt: string, content: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  // We use the Groq endpoint as it is OpenAI-compatible
  // Note: if EXTRACTION_MODEL is an OpenRouter or specific OpenAI model, 
  // this may need a different endpoint/key, but using Groq as requested with the key provided.
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: content }
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No content returned from LLM");
  return text;
}

// ─── Shared validators ────────────────────────────────────────────────────────

const familyMemberValidator = v.object({
  id: v.string(),
  name: v.string(),
});

const categoryValidator = v.object({
  id: v.string(),
  name: v.string(),
});

function buildAssigneeList(
  familyId: string,

  familyMembers: { id: string; name: string }[]
): string {
  return [
    `- Family pool (shared, not assigned to anyone specific) — id: ${familyId}`,
    ...familyMembers.map((m) => `- ${m.name} — id: ${m.id}`),
  ].join("\n");
}

function resolveAssigneeId(
  rawId: string | null,
  familyId: string,
  familyMembers: { id: string; name: string }[]
): string | null {
  if (!rawId) return null;
  if (rawId === familyId) return familyId;
  const member = familyMembers.find((m) => m.id === rawId);
  return member ? member.id : null;
}

// ─── Extract tasks from audio ─────────────────────────────────────────────────

export const extractTasksFromAudio = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
    familyMembers: v.array(familyMemberValidator),
    familyId: v.string(),
    familyName: v.string(),
    currentUserId: v.string(),
    currentUserName: v.string(),
    categories: v.array(categoryValidator),
    today: v.string(),
  },
  handler: async (_ctx, args) => {
    // ── Step 1: Transcribe with Groq Whisper ─────────────────────────────────
    const transcript = await transcribeWithGroq(args.audioBase64);
    if (!transcript) throw new Error("Transcription returned an empty transcript");

    // ── Step 2: Extract tasks with LLM ───────────────────────────────────────
    const assigneeList = buildAssigneeList(args.familyId, args.familyMembers);
    const categoryList = args.categories.length > 0
      ? args.categories.map((c) => `- ${c.name} — id: ${c.id}`).join("\n")
      : "(no categories defined)";

    const systemPrompt = `You are a task extraction assistant for a family task management app. Extract all tasks mentioned in the transcript and return them as a JSON array.

Today's date is: ${args.today}
The current user is: ${args.currentUserName} (id: ${args.currentUserId})

Valid assignees:
${assigneeList}

Valid categories:
${categoryList}

Rules:
- Task titles should be concise but follow the original wording as much as possible.
- Extra context, details, or notes belong in the "details" field.
- "assigneeId" must be one of the valid assignee IDs above, or null to default to the current user.
  - Use the family pool ID (${args.familyId}) when the task is shared/for everyone/no specific person.
  - Only assign to a specific person if they are clearly mentioned by name.
  - Default (null) means the current user (${args.currentUserName}).
- "date" should be a YYYY-MM-DD string if a date was mentioned. Otherwise null.
- "time" should be an HH:MM string in 24-hour format if a specific time was mentioned. Otherwise null.
- "categoryId" must be one of the valid category IDs above if mentioned, otherwise null.
- "recurrence" should be an object if the task is mentioned as recurring (e.g., "every day", "weekly", "every Tuesday"). Otherwise null.
  - "strategy": "fixed" for tasks scheduled on specific dates (e.g., "every Monday") or "completion" for tasks that should recur after they are finished (e.g., "every 3 days after I finish it"). Default to "fixed" if not specified.
  - "frequency": "daily", "weekly", "monthly", or "yearly".
  - "interval": The number of frequency units between occurrences (e.g., "every 2 weeks" has frequency "weekly" and interval 2). Default is 1.
- Return ONLY a valid JSON array.

Schema:
[
  {
    "title": "string (required)",
    "details": "string | null",
    "assigneeId": "string | null",
    "date": "string | null",
    "time": "string | null",
    "categoryId": "string | null",
    "recurrence": {
      "strategy": "fixed | completion",
      "frequency": "daily | weekly | monthly | yearly",
      "interval": number
    } | null
  }
]`;

    const text = await callLLM(systemPrompt, `Voice transcript:\n${transcript}`);

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Could not parse tasks from LLM response");
    }

    // Normalize to array
    const taskArray: any[] = Array.isArray(parsed) 
      ? parsed 
      : (parsed?.tasks && Array.isArray(parsed.tasks)) 
        ? parsed.tasks 
        : [parsed];

    return taskArray.map((task) => ({
      title: task?.title || "Untitled Task",
      details: task?.details ?? null,
      assigneeId: resolveAssigneeId(task?.assigneeId, args.familyId, args.familyMembers),
      date: task?.date ?? null,
      time: task?.time ?? null,
      categoryId: task?.categoryId ?? null,
      recurrence: task?.recurrence ? {
        strategy: task.recurrence.strategy === "completion" ? "completion" : "fixed",
        frequency: task.recurrence.frequency || "daily",
        interval: typeof task.recurrence.interval === "number" ? task.recurrence.interval : 1,
      } : null,
    }));
  },
});

// ─── Consolidate tasks ───────────────────────────────────────────────────────

export const consolidateTasks = action({
  args: {
    tasks: v.array(
      v.object({
        title: v.string(),
        details: v.optional(v.string()),
        assigneeId: v.optional(v.string()),
        date: v.optional(v.string()),
        time: v.optional(v.string()),
        categoryId: v.optional(v.string()),
        recurrence: v.optional(v.union(v.null(), v.object({
          strategy: v.union(v.literal("fixed"), v.literal("completion")),
          frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("yearly")),
          interval: v.number(),
        }))),
      })
    ),
    familyMembers: v.array(familyMemberValidator),
    familyId: v.string(),
    familyName: v.string(),
    currentUserId: v.string(),
    currentUserName: v.string(),
    categories: v.array(categoryValidator),
    today: v.string(),
  },
  handler: async (_ctx, args) => {
    const assigneeList = buildAssigneeList(args.familyId, args.familyMembers);
    const categoryList = args.categories.length > 0
      ? args.categories.map((c) => `- ${c.name} — id: ${c.id}`).join("\n")
      : "(no categories defined)";

    const taskList = args.tasks
      .map((t, i) => {
        let text = `${i + 1}. "${t.title}"${t.details ? ` — ${t.details}` : ""}`;
        if (t.recurrence) {
          text += ` (Recurrence: ${t.recurrence.frequency} every ${t.recurrence.interval} units, strategy: ${t.recurrence.strategy})`;
        }
        return text;
      })
      .join("\n");

    const systemPrompt = `You are a task consolidation assistant. Merge all the following tasks into a single coherent task.
Return ONLY a JSON array with exactly one task object. No markdown, no explanation.

Today's date is: ${args.today}
Current user: ${args.currentUserName} (id: ${args.currentUserId})
Valid assignees: ${assigneeList}
Valid categories: ${categoryList}

Schema: [{ 
  "title": "string", 
  "details": "string | null", 
  "assigneeId": "string | null", 
  "date": "string | null", 
  "time": "string | null", 
  "categoryId": "string | null",
  "recurrence": {
    "strategy": "fixed | completion",
    "frequency": "daily | weekly | monthly | yearly",
    "interval": number
  } | null
}]`;

    const text = await callLLM(systemPrompt, `Tasks to consolidate:\n${taskList}`);

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Could not parse consolidated task");
    }

    const taskArray: any[] = Array.isArray(parsed) 
      ? parsed 
      : (parsed?.tasks && Array.isArray(parsed.tasks)) 
        ? parsed.tasks 
        : [parsed];

    return taskArray.slice(0, 1).map((task) => ({
      title: task?.title || "Untitled Task",
      details: task?.details ?? null,
      assigneeId: resolveAssigneeId(task?.assigneeId, args.familyId, args.familyMembers),
      date: task?.date ?? null,
      time: task?.time ?? null,
      categoryId: task?.categoryId ?? null,
      recurrence: task?.recurrence ? {
        strategy: task.recurrence.strategy === "completion" ? "completion" : "fixed",
        frequency: task.recurrence.frequency || "daily",
        interval: typeof task.recurrence.interval === "number" ? task.recurrence.interval : 1,
      } : null,
    }));
  },
});

// ─── Split a single task into multiple ───────────────────────────────────────

export const splitTask = action({
  args: {
    task: v.object({
      title: v.string(),
      details: v.optional(v.string()),
      checklist: v.optional(v.array(v.object({
        text: v.string(),
        completed: v.boolean(),
      }))),
      assigneeId: v.optional(v.string()),
      date: v.optional(v.string()),
      time: v.optional(v.string()),
      categoryId: v.optional(v.string()),
      recurrence: v.optional(v.union(v.null(), v.object({
        strategy: v.union(v.literal("fixed"), v.literal("completion")),
        frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"), v.literal("yearly")),
        interval: v.number(),
      }))),
    }),
    familyMembers: v.array(familyMemberValidator),
    familyId: v.string(),
    familyName: v.string(),
    currentUserId: v.string(),
    currentUserName: v.string(),
    categories: v.array(categoryValidator),
    today: v.string(),
  },
  handler: async (_ctx, args) => {
    const assigneeList = buildAssigneeList(args.familyId, args.familyMembers);
    const categoryList = args.categories.length > 0
      ? args.categories.map((c) => `- ${c.name} — id: ${c.id}`).join("\n")
      : "(no categories defined)";

    const systemPrompt = `You are a task breakdown assistant. Split the following task into multiple smaller, actionable sub-tasks.
Return ONLY a JSON array of task objects.

Today's date is: ${args.today}
Current user: ${args.currentUserName} (id: ${args.currentUserId})
Valid assignees: ${assigneeList}
Valid categories: ${categoryList}

Schema: [{ 
  "title": "string", 
  "details": "string | null", 
  "checklist": ["string"], 
  "assigneeId": "string | null", 
  "date": "string | null", 
  "time": "string | null", 
  "categoryId": "string | null",
  "recurrence": {
    "strategy": "fixed | completion",
    "frequency": "daily | weekly | monthly | yearly",
    "interval": number
  } | null
}]`;

    let taskText = `Task: "${args.task.title}"${args.task.details ? `\nDetails: ${args.task.details}` : ""}`;
    if (args.task.checklist && args.task.checklist.length > 0) {
      taskText += `\nChecklist:\n${args.task.checklist.map(c => `- ${c.text}`).join("\n")}`;
    }
    if (args.task.recurrence) {
      taskText += `\nRecurrence: ${args.task.recurrence.frequency} every ${args.task.recurrence.interval} units, strategy: ${args.task.recurrence.strategy}`;
    }

    const text = await callLLM(systemPrompt, taskText);

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Could not parse split tasks");
    }

    const taskArray: any[] = Array.isArray(parsed) 
      ? parsed 
      : (parsed?.tasks && Array.isArray(parsed.tasks)) 
        ? parsed.tasks 
        : [parsed];

    const parentAssigneeId = args.task.assigneeId ?? null;
    const parentCategoryId = args.task.categoryId ?? null;
    const parentDate = args.task.date ?? null;
    const parentRecurrence = args.task.recurrence ?? null;

    return taskArray.map((task) => ({
      title: task?.title || "Untitled Task",
      details: task?.details ?? null,
      checklist: Array.isArray(task?.checklist) ? task.checklist.map((text: string) => ({ text, completed: false })) : undefined,
      assigneeId: resolveAssigneeId(
        task?.assigneeId ?? parentAssigneeId,
        args.familyId,
        args.familyMembers
      ),
      date: task?.date ?? parentDate,
      time: task?.time ?? null,
      categoryId: task?.categoryId ?? parentCategoryId,
      recurrence: task?.recurrence ? {
        strategy: task.recurrence.strategy === "completion" ? "completion" : "fixed",
        frequency: task.recurrence.frequency || "daily",
        interval: typeof task.recurrence.interval === "number" ? task.recurrence.interval : 1,
      } : parentRecurrence,
    }));
  },
});
