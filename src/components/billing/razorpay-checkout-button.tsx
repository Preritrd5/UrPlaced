"use client";

import * as React from "react";
import Script from "next/script";
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RazorpayCheckoutButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  totalInr: number;
  contactName?: string;
  officialEmail?: string;
  onPaymentSuccess?: () => void;
}

export function RazorpayCheckoutButton({
  invoiceId,
  invoiceNumber,
  totalInr,
  contactName,
  officialEmail,
  onPaymentSuccess,
}: RazorpayCheckoutButtonProps) {
  const [scriptLoaded, setScriptLoaded] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const handleCheckout = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      // Check if script is loaded
      if (typeof window === "undefined" || !(window as any).Razorpay) {
        throw new Error("Razorpay checkout engine is still loading. Please try again in a few seconds.");
      }

      // 1. Create Order on server
      const createRes = await fetch("/api/billing/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to initialize payment order.");
      }

      // 2. Open Razorpay Checkout modal
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
        theme: {
          color: "#5052C9",
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 3. Server-side payment verification
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
              throw new Error(verifyData.error || "Payment verification failed.");
            }

            setSuccessMessage("Payment verified successfully! Activating placement entitlements...");
            setIsProcessing(false);

            if (onPaymentSuccess) {
              setTimeout(() => {
                onPaymentSuccess();
              }, 1200);
            }
          } catch (verifyErr: any) {
            setErrorMessage(verifyErr.message || "Payment verification failed. Please contact platform support.");
            setIsProcessing(false);
          }
        },
      };

      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.on("payment.failed", (failRes: any) => {
        setErrorMessage(
          failRes.error?.description || "Payment attempt failed or was canceled by user."
        );
        setIsProcessing(false);
      });

      rzpInstance.open();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during checkout.");
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Razorpay Standard Web Checkout Script */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="space-y-3">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        <Button
          onClick={handleCheckout}
          disabled={isProcessing}
          className="w-full sm:w-auto bg-[#5052C9] hover:bg-[#4345B0] text-white font-medium text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>Processing Payment...</span>
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 text-white" />
              <span>
                Pay ₹{totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} via Razorpay (Test Mode)
              </span>
            </>
          )}
        </Button>
      </div>
    </>
  );
}
