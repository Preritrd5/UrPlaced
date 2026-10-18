import { describe, it, expect } from "vitest";
import { SourceService } from "@/modules/recruitment-intelligence/services/source-service";
import { RecruitmentSourceRow } from "@/types/database";

describe("SourceService Freshness & Staleness Rules", () => {
  const baseSource: RecruitmentSourceRow = {
    id: "source-123",
    tenant_id: "tenant-1",
    company_id: "company-1",
    drive_id: "drive-1",
    title: "Official Campus Circular",
    publisher: "Placement Cell",
    source_type: "PLACEMENT_NOTICE",
    canonical_url: null,
    document_ref: null,
    published_at: null,
    effective_at: null,
    collected_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    verification_status: "VERIFIED",
    access_classification: "TENANT_CONFIDENTIAL",
    raw_content: null,
    excerpt: null,
    created_by: null,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("marks recently verified source as not stale", () => {
    const freshSource = {
      ...baseSource,
      last_checked_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    };
    const check = SourceService.isSourceStale(freshSource);
    expect(check.isStale).toBe(false);
  });

  it("flags sources verified over 180 days ago as stale", () => {
    const oldSource = {
      ...baseSource,
      last_checked_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(), // 200 days ago
    };
    const check = SourceService.isSourceStale(oldSource);
    expect(check.isStale).toBe(true);
    expect(check.reason).toContain("180 days limit");
  });

  it("flags superseded sources as stale regardless of verification date", () => {
    const supersededSource = {
      ...baseSource,
      verification_status: "SUPERSEDED" as const,
      last_checked_at: new Date().toISOString(),
    };
    const check = SourceService.isSourceStale(supersededSource);
    expect(check.isStale).toBe(true);
    expect(check.reason).toContain("superseded");
  });
});
