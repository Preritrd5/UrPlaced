/**
 * Student Announcements API
 * GET /api/student/announcements
 * 
 * Returns institutional announcements broadcast by the student's college,
 * filtered to notices targeted to the student (college-wide or student's department).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.ANNOUNCEMENTS_READ);

    const student = await StudentService.getByUserId(ctx.tenantId, ctx.userId);
    const departmentId = student?.department_id;

    const supabase = createAdminClient();

    // Fetch sent announcements for this college
    const { data: announcements, error } = await supabase
      .from("notification_announcements")
      .select("*")
      .eq("college_id", ctx.tenantId)
      .eq("status", "SENT")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list announcements: ${error.message}`);
    }

    // Filter to announcements targeted to this student
    const relevant = (announcements || []).filter((ann: any) => {
      if (ann.audience_type === "ALL_STUDENTS") return true;

      if (ann.audience_type === "DEPARTMENT") {
        const targetDept = ann.audience_filter?.department_id || ann.audience_filter?.departmentId;
        return departmentId && targetDept === departmentId;
      }

      if (ann.audience_type === "SELECTED_STUDENTS") {
        const studentIds = ann.audience_filter?.student_ids || ann.audience_filter?.selectedStudentIds || [];
        return student && studentIds.includes(student.id);
      }

      return false;
    });

    return NextResponse.json({
      announcements: relevant,
      total: relevant.length,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
