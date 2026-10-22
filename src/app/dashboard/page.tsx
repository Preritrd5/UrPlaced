import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users,
  GraduationCap,
  Briefcase,
  Award,
  ChevronRight,
  PlusCircle,
  FileSpreadsheet,
  ArrowUpRight,
  Percent,
  CheckCircle2,
  Clock,
  LogOut,
  AlertCircle,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { PlacementMetricsService } from "@/modules/placement/services/placement-metrics-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/signin");
  }

  const activeMembership = profile.activeMembership;

  // 1. Strict category redirection: Students are routed to their personal preparation dashboard
  if (profile.accountCategory === "STUDENT") {
    redirect("/dashboard/student");
  }

  // 2. Suspended or revoked college members are redirected to the membership suspended notice
  if (profile.membershipStatus === "SUSPENDED" || profile.membershipStatus === "REVOKED") {
    redirect("/auth/membership-suspended");
  }

  // 3. Trainers are routed to their assigned training operations hub
  if (profile.role === "TRAINER") {
    redirect("/dashboard/training");
  }

  const canManageDrives = ["PLACEMENT_HEAD", "PLACEMENT_STAFF"].includes(profile.role);

  async function handleSignOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/signin");
  }
  const activeTenant = activeMembership?.tenants;

  let metrics = {
    totalActiveStudents: 0,
    totalCompanies: 0,
    activeDrivesCount: 0,
    totalApplicationsCount: 0,
    totalOffersExtended: 0,
    uniquePlacedStudents: 0,
    placementPercentage: 0,
    studentsByDepartment: [] as any[],
    studentsByBatch: [] as any[],
    recentDrives: [] as any[],
    recentOffers: [] as any[],
  };

  if (activeTenant) {
    try {
      metrics = await PlacementMetricsService.getDashboardMetrics(activeTenant.id);
    } catch {
      // Handle gracefully if database tables haven't been seeded yet
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
              Placement Command Center
            </h1>
            {activeMembership && (
              <Badge variant="secondary">
                {activeMembership.role}
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            &bull; {activeTenant ? activeTenant.name : "Institutional Workspace"} 
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {profile.memberships.length > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/select-tenant">Switch College</Link>
            </Button>
          )}
          <form action={handleSignOut}>
            <Button type="submit" variant="ghost" size="sm" className="text-text-secondary">
              <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
            </Button>
          </form>
        </div>
      </div>

      {/* Operational KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Students */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-text-secondary font-mono uppercase tracking-wider">
              Active Students
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {metrics.totalActiveStudents}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Enrolled across all departments</p>
          </CardContent>
        </Card>

        {/* Active Drives */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-text-secondary font-mono uppercase tracking-wider">
              Active Drives
            </CardTitle>
            <Briefcase className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {metrics.activeDrivesCount}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Accepting registrations or in-process</p>
          </CardContent>
        </Card>

        {/* Total Applications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-text-secondary font-mono uppercase tracking-wider">
              Applications
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {metrics.totalApplicationsCount}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Candidate participations recorded</p>
          </CardContent>
        </Card>

        {/* Placement Rate */}
        <Card className="border-secondary/30 bg-[rgba(46,143,134,0.03)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-text-secondary font-mono uppercase tracking-wider">
              Placed Students
            </CardTitle>
            <Award className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-heading text-text-primary">
                {metrics.uniquePlacedStudents}
              </span>
              <span className="text-xs font-semibold text-secondary flex items-center">
                <Percent className="h-3 w-3 mr-0.5" /> {metrics.placementPercentage}%
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              {metrics.totalOffersExtended} total offers extended
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Placement Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Button asChild variant="primary" className="h-auto py-3 px-4 justify-between">
          <Link href="/dashboard/assessments">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>Assessments Engine</span>
            </div>
            <ArrowUpRight className="h-4 w-4 opacity-75" />
          </Link>
        </Button>

        <Button asChild variant="secondary" className="h-auto py-3 px-4 justify-between">
          <Link href="/dashboard/students">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              <span>Student Directory</span>
            </div>
            <ArrowUpRight className="h-4 w-4 opacity-75" />
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto py-3 px-4 justify-between">
          <Link href="/dashboard/mistakes">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span>Cohort Error Analytics</span>
            </div>
            <ArrowUpRight className="h-4 w-4 opacity-75" />
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto py-3 px-4 justify-between">
          <Link href="/dashboard/questions">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Question Bank</span>
            </div>
            <ArrowUpRight className="h-4 w-4 opacity-75" />
          </Link>
        </Button>
      </div>

      {/* Phase 09: Placement Memory, Analytics & Training Hub */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Button asChild variant="outline" className="h-auto py-3 px-4 justify-between border-primary/20 hover:bg-card">
          <Link href="/dashboard/analytics">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="font-semibold text-text-primary">Institutional Analytics</span>
            </div>
            <ArrowUpRight className="h-4 w-4 opacity-75 text-primary" />
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto py-3 px-4 justify-between border-secondary/20 hover:bg-card">
          <Link href="/dashboard/memory">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-secondary" />
              <span className="font-semibold text-text-primary">Placement Memory & Debriefs</span>
            </div>
            <ArrowUpRight className="h-4 w-4 opacity-75 text-secondary" />
          </Link>
        </Button>

        <Button asChild variant="outline" className="h-auto py-3 px-4 justify-between border-primary/20 hover:bg-card">
          <Link href="/dashboard/training">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span className="font-semibold text-text-primary">Training & Workshops</span>
            </div>
            <ArrowUpRight className="h-4 w-4 opacity-75 text-primary" />
          </Link>
        </Button>
      </div>

      {/* Main Grid: Active Drives & Recent Offers */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Drives Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Active Recruitment Drives</CardTitle>
              <CardDescription>Current campus opportunities and ongoing hiring rounds</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/drives">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {metrics.recentDrives.length === 0 ? (
              <div className="text-center py-8 text-text-muted space-y-3">
                <Briefcase className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm">No active recruitment drives scheduled yet.</p>
                {canManageDrives && (
                  <Button asChild variant="primary" size="sm">
                    <Link href="/dashboard/drives/new">Create First Drive</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {metrics.recentDrives.map((drive: any) => (
                  <div key={drive.id} className="py-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Link
                        href={`/dashboard/drives/${drive.id}`}
                        className="text-sm font-semibold text-text-primary hover:text-primary hover:underline flex items-center gap-1.5"
                      >
                        {drive.title}
                        <ChevronRight className="h-3 w-3 text-text-muted" />
                      </Link>
                      <p className="text-xs text-text-secondary">
                        {drive.company?.name} &bull; {drive.role_title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          drive.status === "REGISTRATION_OPEN"
                            ? "success"
                            : drive.status === "IN_PROGRESS"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {drive.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Offers Feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Latest Placement Offers</CardTitle>
            <CardDescription>Recently extended and verified offers</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.recentOffers.length === 0 ? (
              <div className="text-center py-8 text-text-muted space-y-2">
                <Award className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm">No offers recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.recentOffers.map((offer: any) => (
                  <div key={offer.id} className="p-3 rounded-lg border border-border bg-input space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary">
                        {offer.student?.full_name}
                      </span>
                      <Badge variant="success" className="text-[10px] py-0">
                        {offer.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-text-secondary">
                      {offer.drive?.company?.name} &bull; {offer.drive?.role_title}
                    </p>
                    {offer.compensation_amount && (
                      <p className="text-[11px] font-mono text-secondary font-semibold">
                        ₹{(offer.compensation_amount / 100000).toFixed(1)} LPA CTC
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown */}
      {metrics.studentsByDepartment.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Student Roster by Department</CardTitle>
            <CardDescription>Enrollment distribution across academic departments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.studentsByDepartment.map((dept) => (
                <div key={dept.departmentCode} className="p-3 rounded-lg border border-border bg-input">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-primary">{dept.departmentCode}</span>
                    <span className="text-xs font-semibold text-text-primary">{dept.count} students</span>
                  </div>
                  <p className="text-[11px] text-text-secondary truncate">{dept.departmentName}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
