/**
 * Placement Dashboard & Operational Metrics Service
 * Aggregates accurate, tenant-scoped operational data for placement cell operations.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface PlacementDashboardMetrics {
  totalActiveStudents: number;
  totalCompanies: number;
  activeDrivesCount: number;
  totalApplicationsCount: number;
  totalOffersExtended: number;
  uniquePlacedStudents: number;
  placementPercentage: number;
  studentsByDepartment: { departmentCode: string; departmentName: string; count: number }[];
  studentsByBatch: { graduationYear: number; count: number }[];
  recentDrives: any[];
  recentOffers: any[];
}

export class PlacementMetricsService {
  /**
   * Fetch aggregate placement dashboard metrics for a college tenant
   */
  static async getDashboardMetrics(
    tenantId: string,
    academicYearId?: string
  ): Promise<PlacementDashboardMetrics> {
    const supabase = createAdminClient();

    // 1. Total Active Students
    const { count: totalActiveStudents } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_archived", false)
      .eq("academic_status", "ACTIVE");

    // 2. Total Registered Companies
    const { count: totalCompanies } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_archived", false);

    // 3. Active Recruitment Drives (PUBLISHED, REGISTRATION_OPEN, IN_PROGRESS)
    let driveQuery = supabase
      .from("recruitment_drives")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["PUBLISHED", "REGISTRATION_OPEN", "IN_PROGRESS"]);

    if (academicYearId) {
      driveQuery = driveQuery.eq("academic_year_id", academicYearId);
    }
    const { count: activeDrivesCount } = await driveQuery;

    // 4. Total Applications
    const { count: totalApplicationsCount } = await supabase
      .from("drive_applications")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    // 5. Total Offers & Unique Placed Students
    const { data: offers } = await supabase
      .from("placement_offers")
      .select("student_id, status")
      .eq("tenant_id", tenantId);

    const totalOffersExtended = offers?.length || 0;

    // A student is placed if they have at least one ACCEPTED offer
    const placedStudentIds = new Set<string>();
    offers?.forEach((o) => {
      if (o.status === "ACCEPTED") {
        placedStudentIds.add(o.student_id);
      }
    });

    const uniquePlacedStudents = placedStudentIds.size;
    const activeStudentCount = totalActiveStudents || 0;
    const placementPercentage =
      activeStudentCount > 0
        ? Math.round((uniquePlacedStudents / activeStudentCount) * 100 * 10) / 10
        : 0;

    // 6. Students by Department
    const { data: studentsWithDept } = await supabase
      .from("students")
      .select("department_id, department:departments(name, code)")
      .eq("tenant_id", tenantId)
      .eq("is_archived", false);

    const deptCounts = new Map<string, { code: string; name: string; count: number }>();
    studentsWithDept?.forEach((s: any) => {
      const code = s.department?.code || "UNK";
      const name = s.department?.name || "Unknown Department";
      if (!deptCounts.has(code)) {
        deptCounts.set(code, { code, name, count: 0 });
      }
      deptCounts.get(code)!.count += 1;
    });

    const studentsByDepartment = Array.from(deptCounts.values()).map((d) => ({
      departmentCode: d.code,
      departmentName: d.name,
      count: d.count,
    }));

    // 7. Students by Graduation Year
    const { data: studentsBatch } = await supabase
      .from("students")
      .select("graduation_year")
      .eq("tenant_id", tenantId)
      .eq("is_archived", false);

    const batchCounts = new Map<number, number>();
    studentsBatch?.forEach((s) => {
      batchCounts.set(s.graduation_year, (batchCounts.get(s.graduation_year) || 0) + 1);
    });

    const studentsByBatch = Array.from(batchCounts.entries())
      .map(([graduationYear, count]) => ({ graduationYear, count }))
      .sort((a, b) => a.graduationYear - b.graduationYear);

    // 8. Recent Drives
    const { data: recentDrives } = await supabase
      .from("recruitment_drives")
      .select("id, title, role_title, status, created_at, company:companies(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(5);

    // 9. Recent Offers
    const { data: recentOffers } = await supabase
      .from("placement_offers")
      .select(
        "id, compensation_amount, status, offered_at, student:students(full_name, enrollment_number), drive:recruitment_drives(role_title, company:companies(name))"
      )
      .eq("tenant_id", tenantId)
      .order("offered_at", { ascending: false })
      .limit(5);

    return {
      totalActiveStudents: activeStudentCount,
      totalCompanies: totalCompanies || 0,
      activeDrivesCount: activeDrivesCount || 0,
      totalApplicationsCount: totalApplicationsCount || 0,
      totalOffersExtended,
      uniquePlacedStudents,
      placementPercentage,
      studentsByDepartment,
      studentsByBatch,
      recentDrives: (recentDrives as any) || [],
      recentOffers: (recentOffers as any) || [],
    };
  }
}
