/**
 * User Preferences & Placement Preparation Settings API Route
 * GET /api/profile/preferences
 * PATCH /api/profile/preferences
 *
 * Supports atomic, independent updates for:
 * 1. Notification Toggles (Practice Reminders, Recruitment Alerts, Assessment Notifications, AI Remediation Tips)
 * 2. Weekly Practice Goal (1-40 Hours)
 * 3. Daily Study Cadence (30 minutes, 1-2 hours, 2-3 hours, 3-4 hours, 5+ hours)
 * 4. Target Hiring Roles (Multi-selection & Custom Roles)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_TARGET_ROLES = [
  "Software Development Engineer (SDE)",
  "Frontend Engineer",
  "Full Stack Developer",
  "Data Analyst",
  "Cloud & DevOps Engineer",
];

const VALID_CADENCES = [
  "30 minutes",
  "1-2 hours",
  "1–2 hours",
  "2-3 hours",
  "2–3 hours",
  "3-4 hours",
  "3–4 hours",
  "5+ hours",
];

interface UserPreferencesPayload {
  studyReminders?: boolean;
  driveAlerts?: boolean;
  testUpdates?: boolean;
  aiMistakeTips?: boolean;
  weeklyGoalHours?: number;
  dailyStudyTime?: string;
  targetRoles?: string[];
  customRoles?: string[];
  practiceMode?: string;
  difficulty?: string;
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const profile = await getCurrentUserProfile(undefined, token);
    if (!profile) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: dbProfile } = await admin
      .from("profiles")
      .select("preferences")
      .eq("id", profile.id)
      .maybeSingle();

    const rawPref = (dbProfile?.preferences || profile.preferences || {}) as UserPreferencesPayload;

    const preferences = {
      studyReminders: rawPref.studyReminders !== false,
      driveAlerts: rawPref.driveAlerts !== false,
      testUpdates: rawPref.testUpdates !== false,
      aiMistakeTips: rawPref.aiMistakeTips !== false,
      weeklyGoalHours: typeof rawPref.weeklyGoalHours === "number" && rawPref.weeklyGoalHours >= 1 && rawPref.weeklyGoalHours <= 40
        ? rawPref.weeklyGoalHours
        : 10,
      dailyStudyTime: rawPref.dailyStudyTime || "1-2 hours",
      practiceMode: rawPref.practiceMode || "Adaptive (Recommended)",
      difficulty: rawPref.difficulty || "Adaptive",
      targetRoles: Array.isArray(rawPref.targetRoles) && rawPref.targetRoles.length > 0
        ? rawPref.targetRoles
        : DEFAULT_TARGET_ROLES,
      customRoles: Array.isArray(rawPref.customRoles) ? rawPref.customRoles : [],
    };

    return NextResponse.json({ preferences });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch user preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const profile = await getCurrentUserProfile(undefined, token);
    if (!profile) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await request.json()) as UserPreferencesPayload;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid preferences payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: dbProfile } = await admin
      .from("profiles")
      .select("preferences")
      .eq("id", profile.id)
      .maybeSingle();

    const currentPref = (dbProfile?.preferences || profile.preferences || {}) as UserPreferencesPayload;
    const updatedPref: Record<string, unknown> = {
      studyReminders: currentPref.studyReminders !== false,
      driveAlerts: currentPref.driveAlerts !== false,
      testUpdates: currentPref.testUpdates !== false,
      aiMistakeTips: currentPref.aiMistakeTips !== false,
      weeklyGoalHours:
        typeof currentPref.weeklyGoalHours === "number" && currentPref.weeklyGoalHours >= 1 && currentPref.weeklyGoalHours <= 40
          ? currentPref.weeklyGoalHours
          : 10,
      dailyStudyTime: currentPref.dailyStudyTime || "1–2 hours",
      targetRoles:
        Array.isArray(currentPref.targetRoles) && currentPref.targetRoles.length > 0
          ? currentPref.targetRoles
          : DEFAULT_TARGET_ROLES,
      customRoles: Array.isArray(currentPref.customRoles) ? currentPref.customRoles : [],
      ...currentPref,
    };

    // 1. Notification Toggles validation
    if (body.studyReminders !== undefined) {
      updatedPref.studyReminders = Boolean(body.studyReminders);
    }
    if (body.driveAlerts !== undefined) {
      updatedPref.driveAlerts = Boolean(body.driveAlerts);
    }
    if (body.testUpdates !== undefined) {
      updatedPref.testUpdates = Boolean(body.testUpdates);
    }
    if (body.aiMistakeTips !== undefined) {
      updatedPref.aiMistakeTips = Boolean(body.aiMistakeTips);
    }

    // 2. Weekly Practice Goal validation (1-40 hours)
    if (body.weeklyGoalHours !== undefined) {
      const hours = Number(body.weeklyGoalHours);
      if (isNaN(hours) || hours < 1 || hours > 40) {
        return NextResponse.json(
          { error: "Weekly Practice Goal must be a number between 1 and 40 hours." },
          { status: 400 }
        );
      }
      updatedPref.weeklyGoalHours = Math.round(hours);
    }

    // 3. Daily Study Cadence validation
    if (body.dailyStudyTime !== undefined) {
      const cadence = String(body.dailyStudyTime).trim();
      const isValidCadence = VALID_CADENCES.some(
        (c) => c.toLowerCase().replace(/–/g, "-") === cadence.toLowerCase().replace(/–/g, "-")
      );
      if (!isValidCadence) {
        return NextResponse.json(
          {
            error:
              "Invalid daily study cadence. Supported options: 30 minutes, 1-2 hours, 2-3 hours, 3-4 hours, 5+ hours.",
          },
          { status: 400 }
        );
      }
      // Standardize display formatting
      updatedPref.dailyStudyTime = cadence.replace(/-/g, "–");
    }

    // 4. Target Hiring Roles validation
    if (body.targetRoles !== undefined) {
      if (!Array.isArray(body.targetRoles)) {
        return NextResponse.json({ error: "targetRoles must be an array of strings." }, { status: 400 });
      }

      const cleanedRoles: string[] = [];
      const seen = new Set<string>();

      for (const rawRole of body.targetRoles) {
        const role = String(rawRole).trim();
        if (role.length < 2 || role.length > 60) {
          return NextResponse.json(
            { error: `Role '${role}' must be between 2 and 60 characters long.` },
            { status: 400 }
          );
        }
        const lower = role.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          cleanedRoles.push(role);
        }
      }

      if (cleanedRoles.length > 30) {
        return NextResponse.json({ error: "Cannot select more than 30 target roles." }, { status: 400 });
      }

      updatedPref.targetRoles = cleanedRoles;
    }

    // 5. Custom Roles validation
    if (body.customRoles !== undefined) {
      if (!Array.isArray(body.customRoles)) {
        return NextResponse.json({ error: "customRoles must be an array of strings." }, { status: 400 });
      }

      const cleanedCustom: string[] = [];
      const seenCustom = new Set<string>();

      for (const rawRole of body.customRoles) {
        const role = String(rawRole).trim();
        if (role.length < 2 || role.length > 60) {
          return NextResponse.json(
            { error: `Custom role '${role}' must be between 2 and 60 characters long.` },
            { status: 400 }
          );
        }
        const lower = role.toLowerCase();
        if (!seenCustom.has(lower)) {
          seenCustom.add(lower);
          cleanedCustom.push(role);
        }
      }

      if (cleanedCustom.length > 20) {
        return NextResponse.json({ error: "Cannot create more than 20 custom roles." }, { status: 400 });
      }

      updatedPref.customRoles = cleanedCustom;
    }

    // Optional fields
    if (body.practiceMode !== undefined) {
      updatedPref.practiceMode = String(body.practiceMode).trim();
    }
    if (body.difficulty !== undefined) {
      updatedPref.difficulty = String(body.difficulty).trim();
    }

    // 6. Persist to Auth user_metadata
    try {
      await admin.auth.admin.updateUserById(profile.id, {
        user_metadata: {
          preferences: updatedPref,
        },
      });
    } catch (authErr) {
      console.warn("[Preferences API] Failed to update user_metadata:", authErr);
    }

    // 7. Persist to profiles table
    const { error: dbError } = await admin
      .from("profiles")
      .upsert({
        id: profile.id,
        email: profile.email,
        full_name: profile.fullName,
        preferences: updatedPref,
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      return NextResponse.json(
        { error: `Database error saving preferences: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Preferences updated successfully.",
      preferences: updatedPref,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update preferences.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
