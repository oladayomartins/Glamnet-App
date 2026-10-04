import { describe, expect, it } from "vitest";
import {
  WORKSPACE_FILTERS,
  parseWorkspaceFilter,
  workspaceWhere,
} from "@/lib/domain/workspace-filter";

describe("parseWorkspaceFilter", () => {
  it("reads every slug it offers", () => {
    for (const filter of WORKSPACE_FILTERS) {
      expect(parseWorkspaceFilter(filter.slug)).toBe(filter);
    }
  });

  it("tolerates case and whitespace from a hand-typed URL", () => {
    expect(parseWorkspaceFilter("  Home-Salon ")?.workspaceType).toBe("HOME_SALON");
  });

  it("ignores anything unknown rather than emptying the directory", () => {
    expect(parseWorkspaceFilter("castle")).toBeNull();
    expect(parseWorkspaceFilter("")).toBeNull();
    expect(parseWorkspaceFilter(undefined)).toBeNull();
  });
});

describe("workspaceWhere", () => {
  it("matches a workspace type exactly", () => {
    expect(workspaceWhere(parseWorkspaceFilter("chair")!)).toEqual({ workspaceType: "CHAIR" });
  });

  it("counts mobile pros and pros who also travel as coming to you", () => {
    expect(workspaceWhere(parseWorkspaceFilter("comes-to-you")!)).toEqual({
      OR: [{ workspaceType: "MOBILE" }, { travelsToClients: true }],
    });
  });
});
