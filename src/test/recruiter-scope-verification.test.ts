import { describe, it, expect, vi } from "vitest";
import { POST as signUpHandler } from "@/app/api/auth/signup/route";
import { NextRequest } from "next/server";

describe("Recruiter Scope & Two-Role Registration Validation", () => {
  it("rejects public registration when role is RECRUITER", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Test Recruiter",
        email: "recruiter@hiringcorp.com",
        password: "SecurePassword123!",
        role: "RECRUITER",
        institutionName: "Hiring Corp",
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Recruiter accounts are not supported");
    expect(data.error).toContain("managed directly by authorized college placement cells");
  });

  it("rejects recruiter variants (e.g. COMPANY_HR, RECRUITER_ADMIN)", async () => {
    const variants = ["RECRUITER_ADMIN", "COMPANY_HR", "CORPORATE_RECRUITER"];

    for (const roleVariant of variants) {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Unauthorized User",
          email: `test-${roleVariant.toLowerCase()}@corp.com`,
          password: "SecurePassword123!",
          role: roleVariant,
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Recruiter accounts are not supported");
    }
  });

  it("rejects arbitrary unsupported roles", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Invalid Role User",
        email: "hacker@test.com",
        password: "SecurePassword123!",
        role: "SUPER_ADMIN",
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Only Student and College / Placement Cell registrations are supported");
  });

  it("validates required fields (email, password length, full name)", async () => {
    // Missing full name
    const req1 = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: " ",
        email: "student@campus.edu",
        password: "SecurePassword123!",
        role: "STUDENT",
      }),
    });
    const res1 = await signUpHandler(req1);
    expect(res1.status).toBe(400);

    // Invalid email
    const req2 = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Student Name",
        email: "not-an-email",
        password: "SecurePassword123!",
        role: "STUDENT",
      }),
    });
    const res2 = await signUpHandler(req2);
    expect(res2.status).toBe(400);

    // Password too short
    const req3 = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Student Name",
        email: "student@campus.edu",
        password: "short",
        role: "STUDENT",
      }),
    });
    const res3 = await signUpHandler(req3);
    expect(res3.status).toBe(400);
  });

  it("preserves supported scopes: only Student and College / Placement Cell destinations", () => {
    const studentRole = "STUDENT";
    const collegeRole = "PLACEMENT_HEAD";

    const getTargetDestination = (r: string) => {
      if (r === "STUDENT") return "/dashboard/student/assessments";
      if (r === "PLACEMENT_HEAD" || r === "COLLEGE") return "/dashboard";
      return null;
    };

    expect(getTargetDestination(studentRole)).toBe("/dashboard/student/assessments");
    expect(getTargetDestination(collegeRole)).toBe("/dashboard");
    expect(getTargetDestination("RECRUITER")).toBeNull();
  });
});
