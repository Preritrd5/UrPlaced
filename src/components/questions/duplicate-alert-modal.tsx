"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

interface DuplicateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DuplicateAlertModal({ isOpen, onClose }: DuplicateAlertModalProps) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/questions/duplicates");
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to load duplicate candidates.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCandidates();
    }
  }, [isOpen]);

  const handleResolve = async (id: string, newStatus: "CONFIRMED_DUPLICATE" | "FALSE_POSITIVE") => {
    try {
      const res = await fetch("/api/questions/duplicates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
        );
      }
    } catch (err) {
      console.error("Failed to resolve candidate", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-card w-full max-w-3xl rounded-xl shadow-xl border border-border max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-text-primary truncate">
              Sentinel Duplicate & Similarity Alerts
            </h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary shrink-0 p-1" aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {loading && <p className="text-sm text-text-secondary">Scanning for duplicate pairs...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && candidates.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-[#2E8F86] mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-text-primary">No Duplicate Alerts Detected</p>
              <p className="text-xs text-text-secondary mt-1">
                All authored and imported questions maintain unique fingerprints and low text similarity.
              </p>
            </div>
          )}

          {candidates.map((cand) => (
            <div
              key={cand.id}
              className="p-4 rounded-lg bg-input border border-border space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={cand.similarity_score === 1.0 ? "default" : "secondary"}>
                    {cand.similarity_score === 1.0 ? "Exact Match (100%)" : `${Math.round(cand.similarity_score * 100)}% Similarity`}
                  </Badge>
                  <span className="text-xs font-mono text-text-secondary">
                    Method: {cand.detection_method}
                  </span>
                </div>
                <Badge
                  variant={
                    cand.status === "PENDING_REVIEW"
                      ? "outline"
                      : cand.status === "CONFIRMED_DUPLICATE"
                      ? "outline"
                      : "secondary"
                  }
                >
                  {cand.status}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded bg-card border border-border space-y-1">
                  <span className="font-semibold text-text-secondary">Candidate Question:</span>
                  <p className="text-text-primary line-clamp-3">
                    {cand.source_question?.current_version?.prompt || "No prompt available"}
                  </p>
                </div>
                <div className="p-2.5 rounded bg-card border border-border space-y-1">
                  <span className="font-semibold text-text-secondary">Existing Match in Bank:</span>
                  <p className="text-text-primary line-clamp-3">
                    {cand.matched_question?.current_version?.prompt || "No prompt available"}
                  </p>
                </div>
              </div>

              {cand.status === "PENDING_REVIEW" && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolve(cand.id, "FALSE_POSITIVE")}
                    className="text-xs h-7"
                  >
                    Mark as False Positive
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleResolve(cand.id, "CONFIRMED_DUPLICATE")}
                    className="text-xs h-7 bg-amber-600 hover:bg-amber-700"
                  >
                    Confirm Duplicate
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border flex justify-end shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
