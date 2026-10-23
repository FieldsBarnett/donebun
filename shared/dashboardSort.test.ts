import { describe, expect, it } from "vitest";
import {
  sortTasksInDashboardGroup,
  sortCategoryContainerKeys,
  buildDashboardContainers,
} from "./dashboardSort";

describe("sortTasksInDashboardGroup", () => {
  it("orders by dashboardOrder then due time then title", () => {
    const tasks = [
      { _id: "b", title: "B", dueDate: "2026-01-02T10:00:00", dashboardOrder: 1 },
      { _id: "a", title: "A", dueDate: "2026-01-02T09:00:00", dashboardOrder: 0 },
      { _id: "c", title: "C", dueDate: "2026-01-02T08:00:00" },
    ];
    expect(sortTasksInDashboardGroup(tasks).map((t) => t._id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("buildDashboardContainers", () => {
  it("puts unlabeled tasks in __none__ and ensures empty category buckets exist", () => {
    const containers = buildDashboardContainers(
      [{ _id: "1", categoryId: undefined }],
      [{ _id: "cat1", name: "Work" }],
    );
    expect(containers.__none__.map((t) => t._id)).toEqual(["1"]);
    expect(containers.cat1).toEqual([]);
  });
});

describe("sortCategoryContainerKeys", () => {
  it("places __none__ first then alphabetical category names", () => {
    const keys = sortCategoryContainerKeys(
      ["cat2", "__none__", "cat1"],
      [
        { _id: "cat1", name: "Alpha" },
        { _id: "cat2", name: "Beta" },
      ],
    );
    expect(keys).toEqual(["__none__", "cat1", "cat2"]);
  });
});
