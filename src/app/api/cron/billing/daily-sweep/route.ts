import { NextRequest } from "next/server";
import { BillingCronRunner } from "@/modules/billing/services/billing-cron-runner";
import { ReconciliationEngine } from "@/modules/billing/services/reconciliation-engine";

export async function GET(req: NextRequest) {
  return BillingCronRunner.runJob(req, "DAILY_SWEEP", async ({ admin }) => {
    const summary = await ReconciliationEngine.runDailySweep(admin);
    return {
      recordsProcessed: summary.scannedOrders,
      summary,
    };
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
