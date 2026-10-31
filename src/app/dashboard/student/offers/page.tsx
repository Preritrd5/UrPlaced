"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Briefcase,
  DollarSign,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { confirmDialog, toast } from "@/components/ui/dialog-system";

export default function StudentOffersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isLoadingAuth, role } = useAuthContext();

  const [offers, setOffers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!isAuthenticated) {
        router.push("/auth/signin");
      } else if (role !== "STUDENT") {
        router.push("/dashboard/offers");
      }
    }
  }, [isAuthenticated, isLoadingAuth, role, router]);

  const loadOffers = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/offers");
      if (!res.ok) {
        throw new Error("Failed to load your placement offers.");
      }
      const data = await res.json();
      setOffers(data.offers || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && role === "STUDENT") {
      loadOffers();
    }
  }, [loadOffers, isAuthenticated, role]);

  async function handleRespond(offerId: string, action: "ACCEPT" | "DECLINE", companyName: string) {
    const actionText = action === "ACCEPT" ? "ACCEPT" : "DECLINE";
    const confirmed = await confirmDialog({
      title: `${actionText} Placement Offer`,
      description: `Are you sure you want to ${actionText} the offer from ${companyName}? Please ensure your decision is final.`,
      confirmText: action === "ACCEPT" ? "Accept Offer" : "Decline Offer",
      variant: action === "ACCEPT" ? "primary" : "destructive",
    });
    if (!confirmed) {
      return;
    }

    setRespondingId(offerId);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/student/offers/${offerId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action.toLowerCase()} offer.`);
      }

      setActionSuccess(
        action === "ACCEPT"
          ? "Congratulations! You have accepted the placement offer."
          : "You have declined the placement offer."
      );
      await loadOffers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRespondingId(null);
    }
  }

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return "Competitive";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-secondary/10 text-secondary">
              <Award className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold font-heading text-text-primary tracking-tight">
              Placement Offers &amp; Outcomes
            </h1>
          </div>
          <p className="text-xs text-text-secondary">
            Formal job and internship offers extended to you through campus recruitment drives.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/student/applications">
            View Application History <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>

      {actionSuccess && (
        <Alert variant="success" className="bg-[rgba(46,143,134,0.08)] border-secondary/30">
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          <AlertTitle className="text-secondary font-semibold">Offer Updated</AlertTitle>
          <AlertDescription className="text-xs text-text-primary">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Offers Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="h-48 animate-pulse bg-card/60" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <Card className="text-center py-12 text-text-muted space-y-3">
          <Award className="h-10 w-10 mx-auto opacity-30" />
          <div className="space-y-1">
            <p className="font-semibold text-text-primary text-sm">No placement offers yet</p>
            <p className="text-xs text-text-secondary">
              Once you clear recruitment interview rounds and receive an offer, it will appear here for your review and formal response.
            </p>
          </div>
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard/student/drives">Browse Recruitment Drives</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => {
            const companyName = offer.drive?.company?.name || "Corporate Partner";
            const roleTitle = offer.drive?.role_title || offer.drive?.title || "Job Offer";
            const isPending = offer.status === "OFFERED";
            const isAccepted = offer.status === "ACCEPTED";
            const isDeclined = offer.status === "DECLINED";

            return (
              <Card
                key={offer.id}
                className={`overflow-hidden shadow-sm transition-all ${
                  isAccepted
                    ? "border-secondary/50 bg-[rgba(46,143,134,0.03)]"
                    : isPending
                    ? "border-primary/40"
                    : "border-border opacity-75"
                }`}
              >
                {/* Celebratory Banner if Accepted */}
                {isAccepted && (
                  <div className="bg-secondary text-white text-xs px-4 py-2 flex items-center gap-2 font-medium">
                    <Sparkles className="h-4 w-4" />
                    <span>Official Campus Placement Confirmed! Your college placement cell has verified this outcome.</span>
                  </div>
                )}

                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-text-primary text-sm">{companyName}</span>
                      </div>
                      <h3 className="text-xl font-bold font-heading text-text-primary">
                        {roleTitle}
                      </h3>
                      <div className="flex items-center gap-2 pt-0.5">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {offer.offer_type}
                        </Badge>
                        <span className="text-xs text-text-muted">
                          Offered on {new Date(offer.offered_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right space-y-1">
                      <span className="text-[10px] font-mono uppercase text-text-muted block">
                        Annual Compensation / CTC
                      </span>
                      <div className="text-2xl font-bold font-mono text-secondary">
                        {formatCurrency(offer.compensation_amount)}
                      </div>
                    </div>
                  </div>

                  {/* Compensation Breakdown and Joining Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-input p-3 rounded-lg border border-border">
                    {offer.compensation_details && (
                      <div>
                        <span className="text-[10px] font-mono uppercase text-text-muted block mb-0.5">
                          Package Breakdown
                        </span>
                        <span className="font-medium text-text-primary">{offer.compensation_details}</span>
                      </div>
                    )}
                    {offer.joining_date && (
                      <div>
                        <span className="text-[10px] font-mono uppercase text-text-muted block mb-0.5">
                          Expected Joining Date
                        </span>
                        <span className="font-mono text-text-primary">
                          {new Date(offer.joining_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Decision Actions Bar */}
                  <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted">Decision Status:</span>
                      {isAccepted ? (
                        <Badge variant="success" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Accepted
                        </Badge>
                      ) : isDeclined ? (
                        <Badge variant="danger" className="text-xs">
                          <XCircle className="h-3 w-3 mr-1" /> Declined
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" /> Response Pending
                        </Badge>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={respondingId === offer.id}
                          onClick={() => handleRespond(offer.id, "DECLINE", companyName)}
                          className="text-xs text-text-muted hover:text-red-600 hover:bg-red-50"
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Decline Offer
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={respondingId === offer.id}
                          onClick={() => handleRespond(offer.id, "ACCEPT", companyName)}
                          className="text-xs font-semibold px-4"
                        >
                          {respondingId === offer.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Processing...
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1" /> Accept Offer
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
