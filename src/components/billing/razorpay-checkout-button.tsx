"use client";

import * as React from "react";
import { CreditCard, CheckCircle2, AlertCircle, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/common/brand-loader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
 * Dynamically loads the official Razorpay Standard Checkout SDK from the CDN
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
  const [isOpen, setIsOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingStep, setProcessingStep] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Pre-load checkout script on component mount for instantaneous checkout experience
  React.useEffect(() => {
    loadRazorpayCheckoutScript().catch(() => {});
  }, []);

  const handleOpenModal = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setProcessingStep(null);
    setIsOpen(true);
  };

  /**
   * Authoritative Razorpay Standard Web Checkout Execution
   */
  const handleInitiatePayment = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setProcessingStep("Initializing secure checkout order...");

      // 1. Ensure Razorpay Standard Checkout script is ready
      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error(
          "Unable to load Razorpay payment gateway script. Please verify your internet connection and try again."
        );
      }

      // 2. Request server-authoritative checkout order (verified server-side from database)
      const createRes = await fetch("/api/billing/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to initialize payment order.");
      }

      setProcessingStep("Opening Razorpay Standard Checkout...");

      // 3. Configure Razorpay Standard Checkout Options
      const options = {
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: orderData.currency || "INR",
        name: "UrPlaced",
        description: `Institutional Subscription — ${invoiceNumber}`,
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

            setSuccessMessage("Payment verified and captured! Subscription and institutional entitlements are now active.");
            setProcessingStep(null);

            setTimeout(async () => {
              setIsProcessing(false);
              setIsOpen(false);
              if (onPaymentSuccess) {
                await onPaymentSuccess();
              }
            }, 1200);
          } catch (verifyErr: any) {
            console.error("[Razorpay Checkout Verify Error]:", verifyErr);
            setErrorMessage(verifyErr.message || "Failed to verify payment with server.");
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
        const desc =
          failResponse.error?.description ||
          failResponse.error?.reason ||
          "Payment was declined or failed by the gateway.";
        setErrorMessage(desc);
      });

      rzpInstance.open();
    } catch (err: any) {
      console.error("[Razorpay Gateway Error]:", err);
      setErrorMessage(err.message || "An unexpected error occurred during checkout initialization.");
      setIsProcessing(false);
      setProcessingStep(null);
    }
  };

  return (
    <>
      <Button
        onClick={handleOpenModal}
        className="w-full sm:w-auto bg-[#5052C9] hover:bg-[#4345B0] text-white font-medium text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <CreditCard className="h-4 w-4 text-white" />
        <span>
          Pay ₹{totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} via Razorpay
        </span>
      </Button>

      {/* Razorpay Standard Checkout Review & Launch Modal */}
      <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && setIsOpen(open)}>
        <DialogContent className="max-w-md bg-[#F8F7F3] border-[#B8B6AC] p-6 rounded-2xl shadow-xl">
          <DialogHeader className="space-y-1 pb-3 border-b border-[#DDDCD5]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-[#5052C9] tracking-wider">
                Razorpay Standard Checkout
              </span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[9px]">
                TEST MODE
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold font-heading text-[#24283A]">
              Pay Institutional Subscription
            </DialogTitle>
            <DialogDescription className="text-xs text-[#747683]">
              Review your registration invoice details before proceeding to the official Razorpay Checkout gateway.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Invoice & College Summary */}
            <div className="p-4 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[#DDDCD5]/60">
                <span className="text-[#747683]">Invoice Reference:</span>
                <span className="font-mono font-bold text-[#24283A]">{invoiceNumber}</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[#DDDCD5]/60">
                <span className="text-[#747683]">Institution Contact:</span>
                <span className="font-medium text-[#24283A] truncate max-w-[200px]">
                  {contactName || "Placement Head"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[#DDDCD5]/60">
                <span className="text-[#747683]">Billing Email:</span>
                <span className="font-mono text-[#24283A] truncate max-w-[200px]">
                  {officialEmail || "billing@institution.edu"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-[#24283A]">Total Amount Due (incl. GST):</span>
                <span className="text-base font-extrabold font-mono text-[#5052C9]">
                  ₹{totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Test Sandbox Environment Notice */}
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-700 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Razorpay Test Sandbox:</strong> Standard Web Checkout will open. You can use any test UPI, NetBanking, or card credentials to verify settlement without moving real funds.
              </div>
            </div>

            {/* Processing Step Notice */}
            {processingStep && (
              <div className="p-3 rounded-xl bg-[#5052C9]/10 border border-[#5052C9]/30 text-xs text-[#5052C9] flex items-center gap-2.5">
                <BrandLoader size="button" />
                <span className="font-medium text-[11px]">{processingStep}</span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <div className="flex-1 font-medium">{successMessage}</div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-[#DDDCD5] flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isProcessing}
              className="text-xs h-9 border-[#DDDCD5] cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInitiatePayment}
              disabled={isProcessing}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9 font-medium px-4 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <BrandLoader size="button" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Open Razorpay Checkout</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
