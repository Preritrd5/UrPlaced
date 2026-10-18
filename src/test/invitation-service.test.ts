import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  hashInvitationToken,
  generateInvitationToken,
} from "@/modules/identity-access/services/invitation-service";

describe("Invitation Service Cryptography & Validation", () => {
  it("normalizes emails properly to lowercase and trimmed", () => {
    expect(normalizeEmail("  Candidate.One@Campus.EDU  ")).toBe("candidate.one@campus.edu");
    expect(normalizeEmail("STUDENT@Apex.EDU")).toBe("student@apex.edu");
  });

  it("produces deterministic SHA-256 token hashes", () => {
    const rawToken = "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5";
    const hash1 = hashInvitationToken(rawToken);
    const hash2 = hashInvitationToken(rawToken);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("generates unpredictable 64-char hex tokens with matching hashes", () => {
    const pair1 = generateInvitationToken();
    const pair2 = generateInvitationToken();

    expect(pair1.rawToken).toHaveLength(64);
    expect(pair1.tokenHash).toHaveLength(64);
    expect(pair1.rawToken).not.toBe(pair2.rawToken);
    expect(pair1.tokenHash).toBe(hashInvitationToken(pair1.rawToken));
  });
});
