"use client";

import * as React from "react";
import { CreditCard, CheckCircle2, AlertCircle, ShieldCheck, Building2, Zap, ArrowRight } from "lucide-react";
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
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedChannel, setSelectedChannel] = React.useState<"netbanking" | "card" | "upi">("netbanking");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const handleOpenModal = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsOpen(true);
  };

  const handleCompletePayment = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      // 1. Initialize server-authoritative checkout order
      const createRes = await fetch("/api/billing/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to initialize payment order.");
      }

      const orderId = orderData.orderId;
      const paymentId = `pay_test_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const signature = "test_sig_verified";

      // 2. Perform atomic reconciliation & subscription entitlement activation
      const verifyRes = await fetch("/api/billing/checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentId,
          signature,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || "Payment verification failed.");
      }

      setSuccessMessage("Payment verified and captured! Activating institutional entitlements...");

      setTimeout(() => {
        setIsProcessing(false);
        setIsOpen(false);
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
      }, 1200);
    } catch (err: any) {
      console.error("[Razorpay Test Gateway Error]:", err);
      setErrorMessage(err.message || "An unexpected error occurred during test checkout.");
      setIsProcessing(false);
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
          Pay ₹{totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })} via Razorpay (Test Mode)
        </span>
      </Button>

      {/* Razorpay Test Gateway Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md bg-[#F8F7F3] border-[#B8B6AC] p-6 rounded-2xl shadow-xl">
          <DialogHeader className="space-y-1 pb-3 border-b border-[#DDDCD5]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-[#5052C9] tracking-wider">
                Razorpay Institutional Gateway
              </span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[9px]">
                TEST MODE ACTIVE
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold font-heading text-[#24283A]">
              Complete Subscription Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-[#747683]">
              Simulate an authoritative gateway payment to settle this institutional invoice and activate entitlements.
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
                <span className="text-[#747683]">Institution:</span>
                <span className="font-medium text-[#24283A] truncate max-w-[200px]">
                  {contactName || "Sapthagiri NPS University"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[#DDDCD5]/60">
                <span className="text-[#747683]">Official Email:</span>
                <span className="font-mono text-[#24283A] truncate max-w-[200px]">
                  {officialEmail || "placement@institution.edu.in"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-[#24283A]">Total Amount Due:</span>
                <span className="text-base font-extrabold font-mono text-[#5052C9]">
                  ₹{totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Simulated Payment Channel Options */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#24283A] block">
                Select Simulated Payment Channel:
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChannel("netbanking")}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    selectedChannel === "netbanking"
                      ? "bg-[#5052C9]/10 border-[#5052C9] text-[#24283A]"
                      : "bg-[#FBFAF7] border-[#DDDCD5] text-[#747683] hover:border-[#B8B6AC]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className={`h-4 w-4 ${selectedChannel === "netbanking" ? "text-[#5052C9]" : "text-[#747683]"}`} />
                    <div>
                      <div className="text-xs font-bold text-[#24283A]">Corporate NetBanking</div>
                      <div className="text-[10px] text-[#747683]">HDFC Bank / ICICI Corporate / SBI Corporate</div>
                    </div>
                  </div>
                  {selectedChannel === "netbanking" && <CheckCircle2 className="h-4 w-4 text-[#5052C9]" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel("card")}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    selectedChannel === "card"
                      ? "bg-[#5052C9]/10 border-[#5052C9] text-[#24283A]"
                      : "bg-[#FBFAF7] border-[#DDDCD5] text-[#747683] hover:border-[#B8B6AC]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className={`h-4 w-4 ${selectedChannel === "card" ? "text-[#5052C9]" : "text-[#747683]"}`} />
                    <div>
                      <div className="text-xs font-bold text-[#24283A]">Corporate Card</div>
                      <div className="text-[10px] text-[#747683]">Visa Commercial / Mastercard Corporate</div>
                    </div>
                  </div>
                  {selectedChannel === "card" && <CheckCircle2 className="h-4 w-4 text-[#5052C9]" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel("upi")}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    selectedChannel === "upi"
                      ? "bg-[#5052C9]/10 border-[#5052C9] text-[#24283A]"
                      : "bg-[#FBFAF7] border-[#DDDCD5] text-[#747683] hover:border-[#B8B6AC]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className={`h-4 w-4 ${selectedChannel === "upi" ? "text-[#5052C9]" : "text-[#747683]"}`} />
                    <div>
                      <div className="text-xs font-bold text-[#24283A]">Institutional UPI / QR</div>
                      <div className="text-[10px] text-[#747683]">Instant verified gateway settlement</div>
                    </div>
                  </div>
                  {selectedChannel === "upi" && <CheckCircle2 className="h-4 w-4 text-[#5052C9]" />}
                </button>
              </div>
            </div>

            {/* Sandbox Safety Notice */}
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-700 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Test Sandbox Environment:</strong> No real bank funds will be deducted. Settle this invoice to verify atomic ledger settlement and automatic entitlement activation.
              </div>
            </div>

            {/* Error & Success Messages */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

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
              onClick={handleCompletePayment}
              disabled={isProcessing}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9 font-medium px-4 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <BrandLoader size="button" />
                  <span>Authorizing Settlement...</span>
                </>
              ) : (
                <>
                  <span>Authorize &amp; Complete Settlement</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
