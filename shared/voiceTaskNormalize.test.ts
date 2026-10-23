import { describe, expect, it } from "vitest";
import {
  sanitizeVoiceRecurrence,
  transcriptRequestsRecurrence,
} from "./voiceTaskNormalize";

describe("sanitizeVoiceRecurrence", () => {
  it("drops recurrence when transcript only mentions a deadline today", () => {
    const transcript = "Submit the report with a deadline today";
    const result = sanitizeVoiceRecurrence(
      { strategy: "fixed", frequency: "weekly", interval: 1 },
      transcript,
      "Submit report",
    );
    expect(result).toBeNull();
  });

  it("keeps recurrence when the user clearly asks for weekly", () => {
    const transcript = "Take out the bins every week on Thursday";
    const result = sanitizeVoiceRecurrence(
      { strategy: "fixed", frequency: "weekly", interval: 1 },
      transcript,
    );
    expect(result).toEqual({
      strategy: "fixed",
      frequency: "weekly",
      interval: 1,
    });
  });

  it("does not treat due today as weekly without repeat language", () => {
    expect(transcriptRequestsRecurrence("Pay rent due today")).toBe(false);
    expect(transcriptRequestsRecurrence("Pay rent every month")).toBe(true);
  });
});
