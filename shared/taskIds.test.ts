import { describe, expect, it } from "vitest";
import { parseVirtualTaskId, formatVirtualTaskId } from "./taskIds";

describe("parseVirtualTaskId", () => {
  it("parses plain task ids", () => {
    expect(parseVirtualTaskId("jd7abc")).toEqual({
      taskId: "jd7abc",
      virtualDate: null,
      isVirtual: false,
    });
  });

  it("splits only on the first colon for timed occurrences", () => {
    const id = formatVirtualTaskId("jd7abc", "2026-07-10T09:00:00");
    expect(parseVirtualTaskId(id)).toEqual({
      taskId: "jd7abc",
      virtualDate: "2026-07-10T09:00:00",
      isVirtual: true,
    });
  });
});
