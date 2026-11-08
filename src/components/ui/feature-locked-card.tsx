"use client";

import React from "react";
import Link from "next/link";
import { Lock, ArrowLeft, ArrowUpRight, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/lib/auth/auth-context-provider";

interface FeatureLockedCardProps {
  featureName: string;
  featureKey?: string;
  description?: string;
  recommendedPlan?: "Campus Growth" | "University Enterprise";
  backHref?: string;
}

export function FeatureLockedCard({
  featureName,
  featureKey,
  description,
  recommendedPlan = "Campus Growth",
  backHref,
}: FeatureLockedCardProps) {
  const { role, tenant } = useAuthContext();
  const isPlacementHead = role === "PLACEMENT_HEAD";
  const defaultBack = role === "STUDENT" ? "/dashboard/student" : "/dashboard";
  const backTarget = backHref || defaultBack;
  const planName = tenant?.planName || "Current Plan";

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-[#F8F7F3] border-[#B8B6AC] shadow-md rounded-2xl overflow-hidden text-center">
        <div className="h-2 w-full bg-gradient-to-r from-[#7779D8] to-[#5052C9]" />
        <CardContent className="pt-8 pb-8 px-6 space-y-5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#5052C9]/10 border border-[#5052C9]/25 flex items-center justify-center text-[#5052C9] shadow-inner">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-300 font-medium text-[11px] px-2.5 py-0.5"
            >
              <ShieldAlert className="w-3 h-3 mr-1 inline text-amber-600" />
              Subscription Entitlement Required
            </Badge>

            <h2 className="text-xl font-bold text-[#24283A] font-outfit tracking-tight">
              {featureName} Locked
            </h2>

            <p className="text-sm text-[#747683] font-inter leading-relaxed">
              {description ||
                `This advanced module is not included in ${tenant?.name || "your institution"}'s assigned subscription plan (${planName}).`}
            </p>
          </div>

          <div className="bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl p-3 text-xs text-[#292D40] space-y-1">
            <div className="font-semibold text-[#24283A] flex items-center justify-center gap-1">
              <span>Required Tier:</span>
              <span className="text-[#5052C9] font-bold">{recommendedPlan}</span>
            </div>
            {featureKey && (
              <div className="text-[11px] text-[#747683] font-mono">
                key: {featureKey}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <Link href={backTarget} className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs border-[#B8B6AC] text-[#24283A] hover:bg-[#EDECE7]"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to Dashboard
              </Button>
            </Link>

            {isPlacementHead && (
              <Link href="/dashboard/billing" className="w-full sm:w-auto">
                <Button
                  size="sm"
                  className="w-full sm:w-auto text-xs bg-[#5052C9] hover:bg-[#4345B0] text-white font-semibold shadow-sm"
                >
                  Upgrade Plan
                  <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
