import { NextRequest } from "next/server";
import { BillingCronRunner } from "@/modules/billing/services/billing-cron-runner";
import { BillingNotificationService } from "@/modules/billing/services/billing-notification-service";

export async function GET(req: NextRequest) {
  return BillingCronRunner.runJob(req, "RENEWAL_REMINDERS", async ({ admin }) => {
    const summary = await BillingNotificationService.processRenewalReminders(admin);
    return {
      recordsProcessed: summary.processed,
      summary,
    };
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
