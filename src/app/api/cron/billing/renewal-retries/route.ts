import { NextRequest } from "next/server";
import { BillingCronRunner } from "@/modules/billing/services/billing-cron-runner";
import { SubscriptionLifecycleBillingService } from "@/modules/billing/services/subscription-lifecycle-billing-service";

export async function GET(req: NextRequest) {
  return BillingCronRunner.runJob(req, "RENEWAL_RETRIES", async ({ admin }) => {
    const summary = await SubscriptionLifecycleBillingService.processRenewalRetries(admin);
    return {
      recordsProcessed: summary.processed,
      summary,
    };
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
