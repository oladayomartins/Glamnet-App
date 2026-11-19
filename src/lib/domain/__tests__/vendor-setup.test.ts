import { describe, expect, it } from "vitest";
import { setupProgress, type SetupFacts } from "../vendor-setup";

const basics: SetupFacts = {
  name: "Ada Braids",
  avatarUrl: "",
  slug: "ada",
  bio: "",
  workspaceType: "MOBILE",
  workspaceSector: "S10",
  workspaceAddress: "",
  serviceCount: 1,
  availabilityCount: 3,
  lookbookCount: 0,
  documentCount: 0,
  payoutsEnabled: false,
  approvalStatus: "PENDING",
};

const everything: SetupFacts = {
  ...basics,
  avatarUrl: "https://ik.example/ada.jpg",
  bio: "Knotless braids and twists in Sheffield.",
  lookbookCount: 2,
  documentCount: 1,
  payoutsEnabled: true,
};

describe("setupProgress", () => {
  it("starts at zero and is not listable", () => {
    const progress = setupProgress({ ...basics, name: "", slug: null, serviceCount: 0, availabilityCount: 0, workspaceSector: "" });
    expect(progress.percent).toBe(0);
    expect(progress.listable).toBe(false);
  });

  it("lists a vendor once the bookable basics are done, unverified", () => {
    const progress = setupProgress(basics);
    expect(progress.listable).toBe(true);
    expect(progress.verified).toBe(false);
    expect(progress.percent).toBe(45); // 5 of 11
  });

  it("needs a street address unless the vendor is mobile", () => {
    expect(setupProgress({ ...basics, workspaceType: "HOME_SALON" }).listable).toBe(false);
    expect(setupProgress({ ...basics, workspaceType: "HOME_SALON", workspaceAddress: "1 High St" }).listable).toBe(true);
  });

  it("is ready for approval with everything but approval, and never shows 100% before it", () => {
    const progress = setupProgress(everything);
    expect(progress.readyForApproval).toBe(true);
    expect(progress.percent).toBe(90);
    expect(progress.verified).toBe(false);
  });

  it("reaches 100% and verified once approved", () => {
    const progress = setupProgress({ ...everything, approvalStatus: "APPROVED" });
    expect(progress.percent).toBe(100);
    expect(progress.verified).toBe(true);
  });

  it("is not ready for approval while anything is missing", () => {
    expect(setupProgress({ ...everything, payoutsEnabled: false }).readyForApproval).toBe(false);
    expect(setupProgress({ ...everything, documentCount: 0 }).readyForApproval).toBe(false);
  });
});
