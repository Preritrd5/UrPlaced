"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Award,
  CheckCircle2,
  AlertTriangle,
  Brain,
  ArrowLeft,
  ChevronRight,
  BookOpen,
  Filter,
  Search,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/ui/skeleton";

export default function StudentMasteryPage() {
  const [loading, setLoading] = useState(true);
  const [skillsMastery, setSkillsMastery] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{
    totalSkillsAssessed: number;
    masteredCount: number;
    provisionalCount: number;
    improvingCount: number;
    needsReviewCount: number;
    averageAccuracy: number;
  }>({
    totalSkillsAssessed: 0,
    masteredCount: 0,
    provisionalCount: 0,
    improvingCount: 0,
    needsReviewCount: 0,
    averageAccuracy: 0,
  });

  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadMasteryOverview();
  }, []);

  async function loadMasteryOverview() {
    try {
      setLoading(true);
      const res = await fetch("/api/student/mastery");
      if (res.ok) {
        const json = await res.json();
        setSkillsMastery(json.skillsMastery || []);
        if (json.metrics) setMetrics(json.metrics);
      }
    } finally {
      setLoading(false);
    }
  }

  const filteredSkills = skillsMastery.filter((s) => {
    const matchCategory = categoryFilter === "ALL" || s.category === categoryFilter;
    const matchStatus = statusFilter === "ALL" || s.mastery_status === statusFilter;
    const matchSearch =
      !searchQuery.trim() ||
      s.skill_name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return matchCategory && matchStatus && matchSearch;
  });

  function getMasteryBadge(status: string) {
    switch (status) {
      case "MASTERY_DEMONSTRATED":
        return <Badge className="bg-[#2E8F86] text-white">Mastery Demonstrated</Badge>;
      case "PROVISIONAL_MASTERY":
        return <Badge className="bg-[#2E8F86]/80 text-white">Provisional Mastery</Badge>;
      case "IMPROVING":
        return <Badge className="bg-[#5052C9] text-white">Improving</Badge>;
      case "PRACTISING":
        return <Badge variant="secondary">Practising</Badge>;
      case "NEEDS_REVIEW":
        return <Badge variant="outline" className="text-amber-700 border-amber-300">Needs Review</Badge>;
      case "NEEDS_REASSESSMENT":
        return <Badge variant="danger">Reassessment Due</Badge>;
      default:
        return <Badge variant="outline">Unassessed</Badge>;
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
              Skill Mastery Radar
            </h1>
            <Badge variant="secondary">Evidence-Based</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Proven proficiency computed solely from independent correct responses on new, unrevealed questions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/student/mistakes" className="flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              <span>Mistake Bank</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-text-secondary">Skills Evaluated</span>
            <div className="text-2xl font-extrabold text-text-primary mt-2">
              {metrics.totalSkillsAssessed}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">Canonical skills</span>
          </CardContent>
        </Card>

        <Card className="bg-[#2E8F86]/10 border-[#2E8F86]/30">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-[#2E8F86]">Mastery Verified</span>
            <div className="text-2xl font-extrabold text-[#2E8F86] mt-2">
              {metrics.masteredCount}
            </div>
            <span className="text-[11px] text-[#2E8F86]/80 mt-1 block">&gt;= 80% on &gt;= 3 questions</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-text-secondary">Provisional</span>
            <div className="text-2xl font-extrabold text-text-primary mt-2">
              {metrics.provisionalCount}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">&gt;= 80% on 2 questions</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-[#5052C9]">Improving</span>
            <div className="text-2xl font-extrabold text-[#5052C9] mt-2">
              {metrics.improvingCount}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">50% - 79% accuracy</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-amber-700">Needs Review</span>
            <div className="text-2xl font-extrabold text-amber-700 mt-2">
              {metrics.needsReviewCount}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">&lt; 50% or active errors</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-text-secondary">Average Accuracy</span>
            <div className="text-2xl font-extrabold text-text-primary mt-2">
              {metrics.averageAccuracy}%
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">Across all trials</span>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by skill name or category..."
              className="pl-9 bg-input text-text-primary text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-md border border-border bg-input px-3 py-2 text-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">All Mastery Statuses</option>
            <option value="MASTERY_DEMONSTRATED">Mastery Demonstrated</option>
            <option value="PROVISIONAL_MASTERY">Provisional Mastery</option>
            <option value="IMPROVING">Improving</option>
            <option value="PRACTISING">Practising</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs rounded-md border border-border bg-input px-3 py-2 text-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">All Categories</option>
            <option value="QUANTITATIVE_APTITUDE">Quantitative Aptitude</option>
            <option value="LOGICAL_REASONING">Logical Reasoning</option>
            <option value="VERBAL_ABILITY">Verbal Ability</option>
            <option value="PROGRAMMING_FUNDAMENTALS">Programming Fundamentals</option>
            <option value="DATA_STRUCTURES_ALGORITHMS">Data Structures & Algorithms</option>
            <option value="DATABASE_MANAGEMENT">Database Management</option>
            <option value="OPERATING_SYSTEMS">Operating Systems</option>
            <option value="COMPUTER_NETWORKS">Computer Networks</option>
            <option value="SYSTEM_DESIGN">System Design</option>
            <option value="BEHAVIORAL_HR">Behavioral & HR</option>
          </select>
        </CardContent>
      </Card>

      {/* Skill List Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid gap-3" role="status" aria-busy="true">
            <span className="sr-only">Loading skill mastery records...</span>
            <SkeletonCard className="p-4" />
            <SkeletonCard className="p-4" />
            <SkeletonCard className="p-4" />
          </div>
        ) : filteredSkills.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Brain className="h-10 w-10 text-secondary mx-auto mb-3" />
              <h3 className="text-base font-semibold text-text-primary">No Skill Mastery Records Found</h3>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                Take assessments or complete retest practice drills in your Mistake Bank to establish your verified skill ratings.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredSkills.map((item) => (
              <Card key={item.id} className="hover:border-primary/50 transition-all">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-text-primary">{item.skill_name}</span>
                      <Badge variant="outline" className="text-text-muted text-[11px] font-mono">
                        {item.category.replace(/_/g, " ")}
                      </Badge>
                      {getMasteryBadge(item.mastery_status)}
                    </div>

                    {/* Accuracy Progress Bar */}
                    <div className="space-y-1 max-w-md pt-1">
                      <div className="flex justify-between text-xs text-text-muted">
                        <span>
                          Accuracy: <strong className="text-text-primary">{item.accuracy_percentage}%</strong>
                        </span>
                        <span>
                          {item.independent_correct_count} of {item.independent_attempts_count} new questions correct
                        </span>
                      </div>
                      <div className="w-full bg-[#EDECE7] rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            item.accuracy_percentage >= 80
                              ? "bg-[#2E8F86]"
                              : item.accuracy_percentage >= 50
                              ? "bg-[#5052C9]"
                              : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, item.accuracy_percentage))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {item.active_review_count > 0 && (
                      <Badge variant="danger" className="text-[11px]">
                        {item.active_review_count} Due for Review
                      </Badge>
                    )}

                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`/dashboard/student/mistakes?skillId=${item.skill_id}`}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <span>Drill Questions</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
