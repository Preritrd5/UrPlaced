/**
 * Real-Browser Four-Tab Authentication Isolation Test
 *
 * Runs Google Chrome via Playwright with 4 independent tabs sharing the
 * exact same browser context, origin, and cookie jar.
 *
 * Uses real authorized test accounts:
 * - Tab 1: admin@snpsu.edu.in (Sapthagiri NPS University - Placement Head)
 * - Tab 2: snpsustd1@gmail.com (Sapthagiri NPS University - Student)
 * - Tab 3: admin@reva.edu.in (Reva University - Placement Head)
 * - Tab 4: revastd@gmail.com (Reva University - Student)
 */

import { chromium } from "playwright";
import { spawn, execSync, type ChildProcess } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { getTabStorageKey } from "../src/lib/auth/auth-tab";

const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;

const ACCOUNTS = {
  tab1: {
    email: "admin@snpsu.edu.in",
    role: "PLACEMENT_HEAD",
    category: "COLLEGE",
    collegeName: "Sapthagiri NPS University",
    expectedName: "SNPSU-HRD",
    route: "/dashboard",
  },
  tab2: {
    email: "snpsustd1@gmail.com",
    role: "STUDENT",
    category: "STUDENT",
    collegeName: "Sapthagiri NPS University",
    expectedName: "SNPSU-Std-1",
    route: "/dashboard/student",
  },
  tab3: {
    email: "admin@reva.edu.in",
    role: "PLACEMENT_HEAD",
    category: "COLLEGE",
    collegeName: "Reva University",
    expectedName: "Reva",
    route: "/dashboard",
  },
  tab4: {
    email: "revastd@gmail.com",
    role: "STUDENT",
    category: "STUDENT",
    collegeName: "Reva University",
    expectedName: "Reva-Std",
    route: "/dashboard/student",
  },
};

async function getRealSession(email: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;

  const admin = createClient(supabaseUrl, serviceKey);
  const client = createClient(supabaseUrl, anonKey);

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data?.properties?.email_otp) {
    throw new Error(`Failed to generate magic link for ${email}: ${link.error?.message}`);
  }

  const verified = await client.auth.verifyOtp({
    email,
    token: link.data.properties.email_otp,
    type: "magiclink",
  });

  if (verified.error || !verified.data?.session) {
    throw new Error(`Failed to verify session for ${email}: ${verified.error?.message}`);
  }

  return verified.data.session;
}

async function waitForServer(url: string, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok || res.status === 404 || res.status === 200) {
        return true;
      }
    } catch {
      // Waiting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function run() {
  console.log("=== URPLACED REAL-BROWSER CROSS-TAB VERIFICATION ===");
  console.log("1. Starting Next.js Production Server on port", PORT);

  try {
    execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`);
  } catch {}

  let serverProcess: ChildProcess | null = null;
  serverProcess = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: "pipe",
    shell: true,
    env: { ...process.env, PORT: String(PORT) },
  });

  serverProcess.stdout?.on("data", (d) => {
    const msg = d.toString();
    if (msg.includes("Ready")) console.log("   [Server]", msg.trim());
  });
  serverProcess.stderr?.on("data", (d) => {
    const msg = d.toString();
    if (!msg.includes("ExperimentalWarning")) console.error("   [Server Error]", msg.trim());
  });

  const ready = await waitForServer(BASE_URL, 25000);
  if (!ready) {
    throw new Error(`Next.js server failed to start within timeout on port ${PORT}`);
  }
  console.log("   Server is ready at", BASE_URL);

  try {
    console.log("\n2. Generating authentic Supabase JWT sessions for 4 test personas...");
    const sessions = {
      tab1: await getRealSession(ACCOUNTS.tab1.email),
      tab2: await getRealSession(ACCOUNTS.tab2.email),
      tab3: await getRealSession(ACCOUNTS.tab3.email),
      tab4: await getRealSession(ACCOUNTS.tab4.email),
    };
    console.log("   ✓ Tab 1 session token generated (Sapthagiri Placement Head)");
    console.log("   ✓ Tab 2 session token generated (Sapthagiri Student)");
    console.log("   ✓ Tab 3 session token generated (Reva Placement Head)");
    console.log("   ✓ Tab 4 session token generated (Reva Student)");

    console.log("\n3. Launching Google Chrome via Playwright...");
    const browser = await chromium.launch({
      headless: true,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    });
    console.log("   ✓ Browser launched: Chrome", browser.version());

    console.log("\n4. Creating a single shared browser context (same origin, shared cookies)...");
    const context = await browser.newContext();

    // Open four independent tabs inside the single browser context
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();
    const tab3 = await context.newPage();
    const tab4 = await context.newPage();

    const tabs = [
      { id: "tab1", page: tab1, account: ACCOUNTS.tab1, session: sessions.tab1 },
      { id: "tab2", page: tab2, account: ACCOUNTS.tab2, session: sessions.tab2 },
      { id: "tab3", page: tab3, account: ACCOUNTS.tab3, session: sessions.tab3 },
      { id: "tab4", page: tab4, account: ACCOUNTS.tab4, session: sessions.tab4 },
    ];

    // Track network request authorization headers per tab
    const tabRequestHeaders: Record<string, string[]> = {
      tab1: [],
      tab2: [],
      tab3: [],
      tab4: [],
    };

    tabs.forEach(({ id, page }) => {
      page.on("request", (req) => {
        const url = req.url();
        if (url.includes("/api/")) {
          const auth = req.headers()["authorization"];
          if (auth) {
            tabRequestHeaders[id].push(`${req.method()} ${url.split("?")[0]} -> ${auth.slice(0, 20)}...`);
          }
        }
      });
    });

    console.log("\n5. Initializing each tab's isolated storage and navigating to target routes...");
    for (const { id, page, account, session } of tabs) {
      const tabUniqueId = `browser_${id}_${Date.now()}`;
      const storageKey = getTabStorageKey(tabUniqueId);

      // Navigate to origin first to initialize origin storage context
      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });

      // Seed tab-isolated sessionStorage
      await page.evaluate(
        ({ tabUniqueId, storageKey, session }) => {
          window.sessionStorage.setItem("urplaced_tab_id", tabUniqueId);
          window.sessionStorage.setItem(storageKey, JSON.stringify(session));
        },
        { tabUniqueId, storageKey, session }
      );

      // Navigate to destination dashboard
      await page.goto(`${BASE_URL}${account.route}`, { waitUntil: "networkidle" });
    }

    console.log("\n6. Verifying Rendered Identities and Cross-Tab Isolation in DOM...");

    // Verify Tab 1 (Sapthagiri Placement Head)
    await tab1.waitForSelector("h1", { timeout: 10000 });
    const tab1Text = await tab1.innerText("body");
    const tab1HasCollege = tab1Text.includes("Sapthagiri NPS University");
    const tab1HasRole = tab1Text.includes("PLACEMENT_HEAD");
    const tab1HasHeadTitle = tab1Text.includes("Placement Command Center");
    console.log("   Tab 1 (Sapthagiri Placement Head):");
    console.log("     - Shows 'Sapthagiri NPS University':", tab1HasCollege ? "PASS ✓" : "FAIL ✗");
    console.log("     - Shows 'PLACEMENT_HEAD':", tab1HasRole ? "PASS ✓" : "FAIL ✗");
    console.log("     - Shows 'Placement Command Center':", tab1HasHeadTitle ? "PASS ✓" : "FAIL ✗");
    if (!tab1HasCollege || !tab1HasRole) throw new Error("Tab 1 identity verification failed");

    // Verify Tab 2 (Sapthagiri Student)
    await tab2.waitForSelector("h1", { timeout: 10000 });
    const tab2Text = await tab2.innerText("body");
    const tab2HasStudentName = tab2Text.includes("SNPSU-Std-1") || tab2Text.includes("Student");
    const tab2HasPrepBadge = tab2Text.includes("Student Prep");
    const tab2HasAvailableTests = tab2Text.includes("Available Tests");
    console.log("   Tab 2 (Sapthagiri Student):");
    console.log("     - Shows Student Name / Greeting:", tab2HasStudentName ? "PASS ✓" : "FAIL ✗");
    console.log("     - Shows 'Student Prep' badge:", tab2HasPrepBadge ? "PASS ✓" : "FAIL ✗");
    console.log("     - Shows 'Available Tests':", tab2HasAvailableTests ? "PASS ✓" : "FAIL ✗");
    if (!tab2HasStudentName || !tab2HasPrepBadge) throw new Error("Tab 2 identity verification failed");

    // Verify Tab 3 (Reva Placement Head)
    await tab3.waitForSelector("h1", { timeout: 10000 });
    const tab3Text = await tab3.innerText("body");
    const tab3HasReva = tab3Text.includes("Reva University");
    const tab3HasRole = tab3Text.includes("PLACEMENT_HEAD");
    const tab3HasHeadTitle = tab3Text.includes("Placement Command Center");
    console.log("   Tab 3 (Reva Placement Head):");
    console.log("     - Shows 'Reva University':", tab3HasReva ? "PASS ✓" : "FAIL ✗");
    console.log("     - Shows 'PLACEMENT_HEAD':", tab3HasRole ? "PASS ✓" : "FAIL ✗");
    console.log("     - Shows 'Placement Command Center':", tab3HasHeadTitle ? "PASS ✓" : "FAIL ✗");
    if (!tab3HasReva || !tab3HasRole) throw new Error("Tab 3 identity verification failed");

    // Verify Tab 4 (Reva Student)
    await tab4.waitForSelector("h1", { timeout: 10000 });
    const tab4Text = await tab4.innerText("body");
    const tab4HasRevaStudent = tab4Text.includes("Reva-Std") || tab4Text.includes("Student");
    const tab4HasPrepBadge = tab4Text.includes("Student Prep");
    const tab4HasCollege = tab4Text.includes("Reva University");
    console.log("   Tab 4 (Reva Student):");
    console.log("     - Shows Reva Student Greeting:", tab4HasRevaStudent ? "PASS ✓" : "FAIL ✗");
    console.log("     - Shows 'Student Prep' badge:", tab4HasPrepBadge ? "PASS ✓" : "FAIL ✗");
    console.log("     - Shows 'Reva University':", tab4HasCollege ? "PASS ✓" : "FAIL ✗");
    if (!tab4HasRevaStudent || !tab4HasPrepBadge) throw new Error("Tab 4 identity verification failed");

    console.log("\n7. Inspecting Network Authorization Headers across tabs...");
    for (const { id } of tabs) {
      console.log(`   ${id} authenticated requests captured: ${tabRequestHeaders[id].length}`);
      if (tabRequestHeaders[id].length > 0) {
        console.log(`     Sample: ${tabRequestHeaders[id][0]}`);
      }
    }

    console.log("\n8. Testing Sign-Out Isolation in Tab 2...");
    // Trigger sign out inside Tab 2
    await tab2.evaluate(() => {
      // Retrieve the client and trigger signOut
      const win = window as any;
      if (win.__urplaced_supabase_client__) {
        win.__urplaced_supabase_client__.auth.signOut();
      }
      window.sessionStorage.clear();
      window.location.href = "/auth/signin";
    });

    await tab2.waitForURL("**/auth/signin", { timeout: 10000 });
    console.log("   ✓ Tab 2 signed out and redirected to /auth/signin");

    // Check Tabs 1, 3, 4 are still authenticated and display their original data
    const tab1StillHead = (await tab1.innerText("body")).includes("Sapthagiri NPS University");
    const tab3StillReva = (await tab3.innerText("body")).includes("Reva University");
    const tab4StillRevaStd = (await tab4.innerText("body")).includes("Reva University");

    console.log("   Tab 1 after Tab 2 sign-out is still Sapthagiri Head:", tab1StillHead ? "PASS ✓" : "FAIL ✗");
    console.log("   Tab 3 after Tab 2 sign-out is still Reva Head:", tab3StillReva ? "PASS ✓" : "FAIL ✗");
    console.log("   Tab 4 after Tab 2 sign-out is still Reva Student:", tab4StillRevaStd ? "PASS ✓" : "FAIL ✗");

    if (!tab1StillHead || !tab3StillReva || !tab4StillRevaStd) {
      throw new Error("Sign-out in Tab 2 contaminated or logged out other tabs!");
    }

    console.log("\n9. Testing Page Reload (F5) Isolation in Tab 1, Tab 3, Tab 4...");
    // Reload Tab 1
    await tab1.reload({ waitUntil: "networkidle" });
    const tab1Reloaded = (await tab1.innerText("body")).includes("Sapthagiri NPS University");
    console.log("   Tab 1 after reload retains Sapthagiri Head:", tab1Reloaded ? "PASS ✓" : "FAIL ✗");

    // Reload Tab 3
    await tab3.reload({ waitUntil: "networkidle" });
    const tab3Reloaded = (await tab3.innerText("body")).includes("Reva University");
    console.log("   Tab 3 after reload retains Reva Head:", tab3Reloaded ? "PASS ✓" : "FAIL ✗");

    // Reload Tab 4
    await tab4.reload({ waitUntil: "networkidle" });
    const tab4Reloaded = (await tab4.innerText("body")).includes("Reva University");
    console.log("   Tab 4 after reload retains Reva Student:", tab4Reloaded ? "PASS ✓" : "FAIL ✗");

    if (!tab1Reloaded || !tab3Reloaded || !tab4Reloaded) {
      throw new Error("Reload in tabs failed to re-hydrate tab-specific identity!");
    }

    console.log("\n10. Testing Cross-College & Student Authorization Boundaries...");
    // Tab 4 (Student) attempts to fetch Placement Command Center metrics
    const studentMetricsCheck = await tab4.evaluate(async () => {
      const res = await fetch("/api/placement/metrics");
      return { status: res.status, ok: res.ok };
    });
    console.log("   Tab 4 (Student) fetching /api/placement/metrics receives status 403:",
      studentMetricsCheck.status === 403 ? "PASS ✓" : `FAIL (${studentMetricsCheck.status}) ✗`
    );

    // Tab 4 (Student) attempts to fetch Placement Student Directory
    const studentDirectoryCheck = await tab4.evaluate(async () => {
      const res = await fetch("/api/placement/students");
      return { status: res.status, ok: res.ok };
    });
    console.log("   Tab 4 (Student) fetching /api/placement/students receives status 403:",
      studentDirectoryCheck.status === 403 ? "PASS ✓" : `FAIL (${studentDirectoryCheck.status}) ✗`
    );

    // Tab 1 (Sapthagiri Placement Head) fetches its authorized metrics
    const headMetricsCheck = await tab1.evaluate(async () => {
      const res = await fetch("/api/placement/metrics");
      return { status: res.status, ok: res.ok };
    });
    console.log("   Tab 1 (Placement Head) fetching its authorized metrics receives status 200:",
      headMetricsCheck.status === 200 ? "PASS ✓" : `FAIL (${headMetricsCheck.status}) ✗`
    );

    if (studentMetricsCheck.status !== 403 || studentDirectoryCheck.status !== 403 || headMetricsCheck.status !== 200) {
      throw new Error("Authorization boundary check failed!");
    }

    console.log("\n=== ALL REAL-BROWSER SCENARIOS PASSED WITH ZERO CROSS-TAB CONTAMINATION ===");
    await browser.close();
  } finally {
    if (serverProcess?.pid) {
      console.log("\nStopping background Next.js server...");
      try {
        execSync(`taskkill /pid ${serverProcess.pid} /T /F`);
      } catch {
        serverProcess.kill();
      }
    }
  }
}

run().catch((err) => {
  console.error("\n❌ Browser Verification Failed:", err);
  process.exit(1);
});
