/**
 * Billing Cron Runner (SA-05 Workstream 06 & Correction H)
 * Standardized execution harness for scheduled billing cron jobs.
 * Enforces:
 * 1. Bearer authorization (CRON_SECRET) or authenticated Super Admin session.
 * 2. Concurrency deduplication (prevents overlapping job executions).
 * 3. Execution telemetry in public.billing_job_runs.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export type BillingJobName =
  | "RECONCILE_15MIN"
  | "DAILY_SWEEP"
  | "RENEWAL_REMINDERS"
  | "RENEWAL_RETRIES";

export interface BillingCronContext {
  admin: ReturnType<typeof createAdminClient>;
  jobName: BillingJobName;
  jobRunId: string;
}

export class BillingCronRunner {
  /**
   * Verifies authorization from either Vercel Cron header or Platform Super Admin session.
   */
  static async verifyCronAuth(req: NextRequest): Promise<{ authorized: boolean; caller: string; error?: string }> {
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;

    // 1. Check Bearer CRON_SECRET if configured
    if (cronSecret && authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && match[1] === cronSecret) {
        return { authorized: true, caller: "CRON_SCHEDULER" };
      }
    }

    // 2. Allow Super Admin session (e.g. manual trigger from Platform Admin dashboard)
    try {
      const adminAuth = await PlatformAuthService.requireSuperAdmin();
      if (adminAuth && adminAuth.id) {
        return { authorized: true, caller: `SUPER_ADMIN:${adminAuth.id}` };
      }
    } catch {
      // Not an admin session
    }

    // 3. In non-production testing environment, if no CRON_SECRET is set, allow test runs with header
    if (!cronSecret && process.env.NODE_ENV !== "production") {
      return { authorized: true, caller: "DEV_TEST_HARNESS" };
    }

    return {
      authorized: false,
      caller: "UNAUTHORIZED",
      error: "Unauthorized: Invalid or missing CRON_SECRET bearer token.",
    };
  }

  /**
   * Executes a scheduled billing job within an atomic tracking and lock wrapper.
   */
  static async runJob(
    req: NextRequest,
    jobName: BillingJobName,
    taskFn: (ctx: BillingCronContext) => Promise<{ recordsProcessed?: number; summary?: any }>,
    adminOverride?: ReturnType<typeof createAdminClient>
  ): Promise<NextResponse> {
    const authCheck = await this.verifyCronAuth(req);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const admin = adminOverride || createAdminClient();
    const startTime = Date.now();
    const startedAtIso = new Date(startTime).toISOString();

    // Concurrency Lock: Check if another instance of this job is currently RUNNING
    // (with a timeout cutoff of 15 minutes to clear stale orphaned runs)
    const fifteenMinutesAgo = new Date(startTime - 15 * 60 * 1000).toISOString();
    const { data: runningJobs } = await admin
      .from("billing_job_runs")
      .select("id, started_at")
      .eq("job_name", jobName)
      .eq("status", "RUNNING")
      .gte("started_at", fifteenMinutesAgo);

    if (runningJobs && runningJobs.length > 0) {
      return NextResponse.json(
        {
          success: false,
          skipped: true,
          message: `Job ${jobName} is already running (started at ${runningJobs[0].started_at}). Execution skipped to prevent duplicate concurrent runs.`,
        },
        { status: 409 }
      );
    }

    // Insert RUNNING record in public.billing_job_runs
    const { data: jobRun, error: insertErr } = await admin
      .from("billing_job_runs")
      .insert({
        job_name: jobName,
        status: "RUNNING",
        started_at: startedAtIso,
        triggered_by: authCheck.caller,
        records_processed: 0,
      })
      .select("id")
      .single();

    const jobRunId = jobRun?.id || `fallback_${Date.now()}`;

    try {
      // Execute the business job
      const result = await taskFn({ admin, jobName, jobRunId });
      const completedAt = Date.now();
      const durationMs = completedAt - startTime;

      // Update to SUCCESS
      await admin
        .from("billing_job_runs")
        .update({
          status: "SUCCESS",
          completed_at: new Date(completedAt).toISOString(),
          duration_ms: durationMs,
          records_processed: result.recordsProcessed || 0,
          summary: result.summary || null,
        })
        .eq("id", jobRunId);

      return NextResponse.json({
        success: true,
        jobName,
        jobRunId,
        durationMs,
        recordsProcessed: result.recordsProcessed || 0,
        summary: result.summary,
      });
    } catch (err: any) {
      const completedAt = Date.now();
      const durationMs = completedAt - startTime;

      // Update to FAILED
      await admin
        .from("billing_job_runs")
        .update({
          status: "FAILED",
          completed_at: new Date(completedAt).toISOString(),
          duration_ms: durationMs,
          errors: {
            message: err?.message || "Unknown error",
            stack: err?.stack || null,
          },
        })
        .eq("id", jobRunId);

      return NextResponse.json(
        {
          success: false,
          jobName,
          jobRunId,
          durationMs,
          error: err?.message || "Job execution failed",
        },
        { status: 500 }
      );
    }
  }
}
