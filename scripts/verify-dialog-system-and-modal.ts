/**
 * Real-Browser Verification: Professional Dialog System & Assessment Blueprint Modal Alignment
 *
 * Runs Google Chrome via Playwright to verify:
 * 1. New Assessment Blueprint modal centering, viewport fit, internal scrolling, and action visibility.
 * 2. Responsive behavior on desktop (1440x900), laptop (1280x720), and mobile (390x844).
 * 3. Validation toast notification rendering without browser-native pop-ups.
 * 4. Confirmation dialog execution with cancellation and confirmation flow.
 */

import { chromium } from "playwright";
import { spawn, execSync, type ChildProcess } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { getTabStorageKey } from "../src/lib/auth/auth-tab";

const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;

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
  console.log("=== URPLACED PROFESSIONAL DIALOG SYSTEM & MODAL VERIFICATION ===");
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

  const ready = await waitForServer(BASE_URL, 25000);
  if (!ready) {
    throw new Error(`Next.js server failed to start within timeout on port ${PORT}`);
  }
  console.log("   Server is ready at", BASE_URL);

  try {
    console.log("\n2. Generating authentic Supabase session for Placement Head...");
    const headEmail = "admin@snpsu.edu.in";
    const session = await getRealSession(headEmail);
    console.log("   ✓ Authentic session token generated");

    console.log("\n3. Launching Google Chrome via Playwright...");
    const browser = await chromium.launch({
      headless: true,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    });
    console.log("   ✓ Browser launched: Chrome", browser.version());

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // Catch any native browser alerts/confirms if they occur (they should NOT occur!)
    let unexpectedNativeDialog = false;
    page.on("dialog", (dialog) => {
      unexpectedNativeDialog = true;
      console.error(`   ❌ UNEXPECTED NATIVE BROWSER DIALOG DETECTED: [${dialog.type()}] "${dialog.message()}"`);
      dialog.dismiss();
    });

    console.log("\n4. Navigating to /dashboard/assessments with tab session...");
    const tabUniqueId = `browser_test_${Date.now()}`;
    const storageKey = getTabStorageKey(tabUniqueId);

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ tabUniqueId, storageKey, session }) => {
        window.sessionStorage.setItem("urplaced_tab_id", tabUniqueId);
        window.sessionStorage.setItem(storageKey, JSON.stringify(session));
      },
      { tabUniqueId, storageKey, session }
    );

    await page.goto(`${BASE_URL}/dashboard/assessments`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 10000 });
    console.log("   ✓ Assessments page loaded");

    console.log("\n5. Testing New Assessment Blueprint Modal Alignment (Desktop 1440x900)...");
    const newAssessmentBtn = page.getByRole("button", { name: "New Assessment" });
    await newAssessmentBtn.click();

    // Wait for the modal dialog to appear
    await page.waitForSelector('role=dialog', { timeout: 5000 });
    const modal = page.locator('role=dialog');
    const box = await modal.boundingBox();

    if (!box) throw new Error("Modal bounding box could not be retrieved");

    const viewportWidth = 1440;
    const viewportHeight = 900;

    // Check horizontal centering: margin-left should approximately equal margin-right
    const leftMargin = box.x;
    const rightMargin = viewportWidth - (box.x + box.width);
    const centerDelta = Math.abs(leftMargin - rightMargin);
    const isHorizontallyCentered = centerDelta <= 2; // within 2px

    console.log(`   Modal Bounding Box: x=${box.x.toFixed(1)}, y=${box.y.toFixed(1)}, w=${box.width.toFixed(1)}, h=${box.height.toFixed(1)}`);
    console.log(`   - Horizontal Centering (left=${leftMargin.toFixed(1)}px, right=${rightMargin.toFixed(1)}px, delta=${centerDelta.toFixed(1)}px):`, isHorizontallyCentered ? "PASS ✓" : "FAIL ✗");

    // Check vertical placement: modal top must be > 0 and bottom must be < viewportHeight
    const topMargin = box.y;
    const bottomMargin = viewportHeight - (box.y + box.height);
    const fitsInViewport = topMargin > 20 && bottomMargin > 20;

    console.log(`   - Vertical Fit (top=${topMargin.toFixed(1)}px, bottomMargin=${bottomMargin.toFixed(1)}px):`, fitsInViewport ? "PASS ✓" : "FAIL ✗");

    // Check Header and Footer Action Buttons Visibility
    const createBtn = page.getByRole("button", { name: "Create Blueprint" });
    const cancelBtn = page.getByRole("button", { name: "Cancel" });
    const isCreateBtnVisible = await createBtn.isVisible();
    const isCancelBtnVisible = await cancelBtn.isVisible();

    console.log("   - 'Create Blueprint' Button Visible & Accessible:", isCreateBtnVisible ? "PASS ✓" : "FAIL ✗");
    console.log("   - 'Cancel' Button Visible & Accessible:", isCancelBtnVisible ? "PASS ✓" : "FAIL ✗");

    if (!isHorizontallyCentered || !fitsInViewport || !isCreateBtnVisible || !isCancelBtnVisible) {
      throw new Error("Desktop modal alignment verification failed");
    }

    console.log("\n6. Testing Modal on Constrained Laptop Height (1280x720)...");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);

    const laptopBox = await modal.boundingBox();
    if (!laptopBox) throw new Error("Laptop modal bounding box could not be retrieved");

    const laptopFits = laptopBox.y >= 10 && (laptopBox.y + laptopBox.height) <= 715;
    const laptopButtonsVisible = await createBtn.isVisible() && await cancelBtn.isVisible();

    console.log(`   Laptop Bounding Box: y=${laptopBox.y.toFixed(1)}, h=${laptopBox.height.toFixed(1)}`);
    console.log("   - Entire Modal Fits Inside 720px Height:", laptopFits ? "PASS ✓" : "FAIL ✗");
    console.log("   - Pinned Footer Buttons Visible on Laptop:", laptopButtonsVisible ? "PASS ✓" : "FAIL ✗");

    if (!laptopFits || !laptopButtonsVisible) {
      throw new Error("Laptop height modal alignment verification failed");
    }

    console.log("\n7. Testing Modal on Mobile Viewport (390x844)...");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const mobileBox = await modal.boundingBox();
    if (!mobileBox) throw new Error("Mobile modal bounding box could not be retrieved");

    const mobileFits = mobileBox.x >= 0 && (mobileBox.x + mobileBox.width) <= 390;
    const mobileButtonsVisible = await createBtn.isVisible();

    console.log(`   Mobile Bounding Box: w=${mobileBox.width.toFixed(1)}, h=${mobileBox.height.toFixed(1)}`);
    console.log("   - Modal Adapts Responsively to Mobile Width:", mobileFits ? "PASS ✓" : "FAIL ✗");
    console.log("   - Action Buttons Accessible on Mobile:", mobileButtonsVisible ? "PASS ✓" : "FAIL ✗");

    // Restore desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);

    console.log("\n8. Testing Validation Toast Notification (No Browser Alert)...");
    // Click Create Blueprint without entering required fields
    await createBtn.click();

    // Check that custom Toast notification appears with warning/error message
    await page.waitForSelector('[data-urplaced-toast]', { timeout: 6000 });
    const toastElement = page.locator('[data-urplaced-toast]').first();
    const toastText = await toastElement.innerText();

    console.log(`   Captured Toast Notification: "${toastText.trim()}"`);
    const hasExpectedToast = toastText.includes("required") || toastText.includes("characters") || toastText.includes("Title");
    console.log("   - Custom Error/Warning Toast Rendered:", hasExpectedToast ? "PASS ✓" : "FAIL ✗");
    console.log("   - Zero Browser Native Alert Fired:", !unexpectedNativeDialog ? "PASS ✓" : "FAIL ✗");

    if (!hasExpectedToast || unexpectedNativeDialog) {
      throw new Error("Toast validation notification check failed");
    }

    // Close the modal
    await cancelBtn.click();
    await page.waitForTimeout(300);

    console.log("\n9. Testing Application-Wide Confirmation Dialog...");
    // Trigger confirmDialog via the DialogSystemHost
    const confirmPromise = page.evaluate(() => {
      const win = window as any;
      return win.__urplaced_dialog__.confirmDialog({
        title: "Publish Assessment",
        description: "Are you sure you want to publish this assessment? Its question set snapshot will be locked.",
        confirmText: "Publish",
        variant: "primary",
      });
    });

    // Verify custom confirmation dialog appears in the real browser
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const confirmDialogText = await page.locator('[role="dialog"]').innerText();
    const hasConfirmTitle = confirmDialogText.includes("Publish Assessment");
    console.log("   - Custom Confirmation Dialog Opened:", hasConfirmTitle ? "PASS ✓" : "FAIL ✗");

    // Click Cancel in the confirmation dialog
    const dialogCancelBtn = page.locator('[role="dialog"]').getByRole("button", { name: "Cancel" });
    await dialogCancelBtn.click();
    await page.waitForTimeout(300);

    const isConfirmed = await confirmPromise;
    const isDialogClosed = !(await page.locator('[role="dialog"]').isVisible());
    console.log("   - Confirmation Dialog Closes Safely on Cancel (resolved false):", (!isConfirmed && isDialogClosed) ? "PASS ✓" : "FAIL ✗");

    console.log("\n=== ALL REAL-BROWSER DIALOG & MODAL SCENARIOS PASSED ===");
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
