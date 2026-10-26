import { redirect } from "next/navigation";
import { Megaphone, Send, Bell } from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { DepartmentService } from "@/modules/academic/services/department-service";
import { StudentService } from "@/modules/students/services/student-service";
import { AnnouncementsPageClient } from "@/components/announcements/announcements-page-client";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/signin");
  }

  if (!profile.isVerifiedMembership) {
    redirect("/auth/access-denied");
  }

  const userRole = profile.activeMembership?.role || "STUDENT";

  // Strict role guard: Students have their own workspace; trainers focus on targeted training
  if (userRole === "STUDENT") {
    redirect("/dashboard/student");
  }

  if (userRole === "TRAINER") {
    redirect("/dashboard/training");
  }

  const activeTenant = profile.activeMembership?.tenants;
  const tenantId = profile.activeMembership?.tenant_id;

  if (!tenantId) {
    return (
      <div className="p-8 text-center text-xs text-[#292D40]">
        No active college institution associated with your account.
      </div>
    );
  }

  const canCompose = userRole === "PLACEMENT_HEAD" || profile.isPlatformAdmin;

  // Fetch departments and student counts safely
  let departments: any[] = [];
  try {
    departments = await DepartmentService.listByTenant(tenantId);
  } catch (err) {
    console.error("Failed to load departments for announcements", err);
  }

  let totalStudents = 0;
  try {
    const studentRes = await StudentService.list({
      tenantId,
      pageSize: 1,
    });
    totalStudents = studentRes.total || 0;
  } catch (err) {
    console.error("Failed to count students for announcements", err);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDDCD5]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#5052C9]/10 text-[#5052C9]">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold font-['Outfit'] text-[#24283A] tracking-tight">
              Announcements & Alerts
            </h1>
            <Badge variant="outline" className="text-xs bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30">
              Real-time In-App Push
            </Badge>
          </div>
          <p className="text-xs text-[#292D40]">
            Broadcast institutional notices, drive alerts, and academic updates directly to your students&apos; notification centers.
          </p>
        </div>

        {activeTenant?.name && (
          <div className="text-right self-start sm:self-center">
            <span className="text-[11px] text-[#292D40]/60 uppercase tracking-wider block">
              Active College
            </span>
            <span className="font-semibold text-xs text-[#24283A]">
              {activeTenant.name}
            </span>
          </div>
        )}
      </div>

      {/* Main Client Shell */}
      <AnnouncementsPageClient
        collegeId={tenantId}
        collegeName={activeTenant?.name || "College Placement Cell"}
        canCompose={canCompose}
        departments={departments.map((d: any) => ({
          id: d.id,
          name: d.name,
          code: d.code,
        }))}
        allStudentsCount={totalStudents}
      />
    </div>
  );
}
