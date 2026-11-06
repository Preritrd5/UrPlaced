"use client";

import * as React from "react";
import { CreditCard, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/common/brand-loader";
import { toast } from "@/components/ui/dialog-system";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayCheckoutButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  totalInr: number;
  contactName?: string;
  officialEmail?: string;
  onPaymentSuccess?: () => void;
}

/**
 * Dynamically loads the official Razorpay Standard Checkout script from Razorpay CDN
 */
function loadRazorpayCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      if (window.Razorpay) return resolve(true);
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("[Razorpay Checkout] Failed to load https://checkout.razorpay.com/v1/checkout.js");
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export function RazorpayCheckoutButton({
  invoiceId,
  invoiceNumber,
  totalInr,
  contactName,
  officialEmail,
  onPaymentSuccess,
}: RazorpayCheckoutButtonProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingStep, setProcessingStep] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Pre-load checkout script on component mount for instantaneous modal presentation
  React.useEffect(() => {
    loadRazorpayCheckoutScript().catch(() => {});
  }, []);

  /**
   * Authoritative Razorpay Standard Web Checkout Execution
   */
  const handleInitiatePayment = async () => {
    // Double-click prevention
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setProcessingStep("Initializing secure order...");

      // 1. Ensure Razorpay Standard Checkout SDK is available
      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error(
          "Unable to load Razorpay Checkout gateway. Please check your network connection and try again."
        );
      }

      // 2. Request server-authoritative checkout order (verified server-side from database records)
      const createRes = await fetch("/api/billing/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to initialize payment order.");
      }

      setProcessingStep("Opening Razorpay Checkout...");

      // Resolve a safe, publicly accessible logo URL for Razorpay Standard Checkout
      // In local development (localhost / 127.0.0.1 / non-HTTPS), do NOT pass loopback URLs
      // to Razorpay's public iframe, preventing browser Private Network Access (PNA) / CORS blocks.
      let safeLogoUrl: string | undefined = undefined;
      if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        const isLoopback =
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname.endsWith(".localhost") ||
          window.location.protocol !== "https:";

        const envLogo = process.env.NEXT_PUBLIC_LOGO_URL;
        if (envLogo && envLogo.startsWith("https://")) {
          safeLogoUrl = envLogo;
        } else if (!isLoopback && window.location.origin.startsWith("https://")) {
          safeLogoUrl = `${window.location.origin}/assets/logo.png`;
        }
      }

      // 3. Configure genuine Razorpay Standard Checkout Options
      const options = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: orderData.currency || "INR",
        name: "UrPlaced",
        description: `Institutional Subscription — ${invoiceNumber}`,
        image: safeLogoUrl,
        order_id: orderData.orderId,
        prefill: {
          name: contactName || "",
          email: officialEmail || "",
        },
        notes: {
          invoiceId: orderData.invoiceId || invoiceId,
          invoiceNumber: orderData.invoiceNumber || invoiceNumber,
        },
        theme: {
          color: "#5052C9", // Strict UrPlaced Primary Brand Token (GEMINI.md)
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
            setProcessingStep(null);
            setErrorMessage("Payment was not completed. You can re-open checkout whenever you are ready.");
          },
          escape: true,
          backdropclose: false,
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // 4. On successful checkout callback, perform server-authoritative cryptographic verification
          setIsProcessing(true);
          setProcessingStep("Verifying cryptographic signature & settling invoice...");

          try {
            const verifyRes = await fetch("/api/billing/checkout/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Cryptographic payment verification failed.");
            }

            setSuccessMessage("Payment verified and captured! Institutional subscription is now active.");
            setProcessingStep(null);
            toast.success("Payment verified! Subscription and institutional entitlements are now active.");

            if (onPaymentSuccess) {
              await onPaymentSuccess();
            }
          } catch (verifyErr: any) {
            console.warn("[Razorpay Checkout Verify Notice]:", verifyErr?.message || verifyErr);
            const msg = verifyErr.message || "Failed to verify payment with server.";
            setErrorMessage(msg);
            toast.error(msg);
          } finally {
            setIsProcessing(false);
            setProcessingStep(null);
          }
        },
      };

      // 4. Open Razorpay Standard Checkout Modal
      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on("payment.failed", function (failResponse: any) {
        setIsProcessing(false);
        setProcessingStep(null);
        let desc =
          failResponse.error?.description ||
          failResponse.error?.reason ||
          "Payment was declined or failed by the gateway.";

        if (typeof desc === "string" && desc.toLowerCase().includes("maximum amount")) {
          if (totalInr > 50000) {
            desc = `Transaction limit reached for ₹${totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}:
1. UPI Payment Rails (Google Pay, PhonePe, UPI ID) have a strict single-transaction ceiling of ₹50,000 enforced by NPCI and partner banks. Please select Cards (Test Card: 4100 2800 0000 1007, Exp 12/26, CVV 123) or Net Banking.
2. If Cards also report this error, your Razorpay merchant account has a ₹50,000 default threshold in Razorpay Dashboard. Navigate to Dashboard → Account & Settings → Transaction limits, and increase your per-transaction limit to ₹2,00,000.`;
          } else {
            desc = `Amount exceeds Razorpay Test Mode limit (₹1,00,000 max per test transaction). Please test with an amount under ₹1,00,000 or adjust transaction limits in your Razorpay Dashboard.`;
          }
        }
        setErrorMessage(desc);
        toast.error(desc);
      });

      rzpInstance.open();
    } catch (err: any) {
      console.warn("[Razorpay Gateway Notice]:", err?.message || err);
      const msg = err.message || "An unexpected error occurred during checkout initialization.";
      setErrorMessage(msg);
      toast.error(msg);
      setIsProcessing(false);
      setProcessingStep(null);
    }
  };

  const isTestMode =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.startsWith("rzp_test_") ?? false)
      : false;

  return (
    <div className="flex flex-col gap-2.5">
      <Button
        type="button"
        onClick={handleInitiatePayment}
        disabled={isProcessing}
        className="w-full sm:w-auto bg-[#5052C9] hover:bg-[#4345B0] text-white font-medium text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <BrandLoader size="button" />
            <span>{processingStep || "Opening Razorpay..."}</span>
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 text-white" />
            <span>
              Pay ₹{totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} via Razorpay
            </span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </>
        )}
      </Button>

      {/* Test Mode Simulation Credentials & Payment Rails Guidance */}
      {isTestMode && (
        <div className="p-2.5 rounded-xl bg-[#F8F7F3] border border-[#B8B6AC]/40 text-[11px] text-[#292D40] space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-[#5052C9]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E8F86]" />
            Razorpay Test Mode Helper
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10.5px]">
            <div>
              <span className="text-[#747683]">Test Card: </span>
              <code className="font-mono bg-[#FBFAF7] px-1 py-0.5 rounded border border-[#B8B6AC]/30 font-medium">
                4100 2800 0000 1007
              </code>{" "}
              <span className="text-[#747683]">(CVV 123, Exp 12/26)</span>
            </div>
            <div>
              <span className="text-[#747683]">UPI ID: </span>
              <code className="font-mono bg-[#FBFAF7] px-1 py-0.5 rounded border border-[#B8B6AC]/30 font-medium">
                test@razorpay
              </code>{" "}
              <span className="text-[#747683]">(NPCI cap: &le;₹50,000)</span>
            </div>
          </div>
          {totalInr > 50000 && (
            <div className="pt-1 border-t border-[#B8B6AC]/20 text-[10.5px] text-[#292D40] leading-relaxed">
              <span className="font-semibold text-amber-800">Notice for ₹{totalInr.toLocaleString("en-IN")}: </span>
              NPCI caps single UPI payments at ₹50,000. Please select <span className="font-semibold text-[#5052C9]">Cards</span> or <span className="font-semibold text-[#5052C9]">Netbanking</span> in the Razorpay modal.
            </div>
          )}
        </div>
      )}

      {/* Error Message Notice */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Success Message Notice */}
      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{successMessage}</div>
        </div>
      )}
    </div>
  );
}
