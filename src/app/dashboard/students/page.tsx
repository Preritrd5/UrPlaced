import Link from "next/link";
import { redirect } from "next/navigation";
import {
  GraduationCap,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { StudentService } from "@/modules/students/services/student-service";
import { DepartmentService } from "@/modules/academic/services/department-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudentRowActions } from "@/components/students/student-row-actions";
import { BulkDeleteModal } from "@/components/students/bulk-delete-modal";
import { ClientAuthGate } from "@/components/auth/client-auth-gate";

export const dynamic = "force-dynamic";

interface StudentsPageProps {
  searchParams: Promise<{
    search?: string;
    departmentId?: string;
    graduationYear?: string;
    page?: string;
    statusView?: string;
  }>;
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const profile = await getCurrentUserProfile();
  if (!profile) return <ClientAuthGate redirectTo="/auth/college/signin" />;
  if (!profile.isVerifiedMembership) redirect("/auth/access-denied");

  const userRole = profile.activeMembership?.role || "STUDENT";

  // Strict role guard: Students cannot access the college student directory
  if (userRole === "STUDENT") {
    redirect("/dashboard/student");
  }

  const isPlacementHead = userRole === "PLACEMENT_HEAD" || profile.isPlatformAdmin;
  const canManageStudents =
    userRole === "PLACEMENT_HEAD" || userRole === "PLACEMENT_STAFF" || profile.isPlatformAdmin;

  const activeTenant = profile.activeMembership?.tenants;
  if (!activeTenant) {
    return (
      <div className="p-8 text-center text-text-secondary">
        No active college workspace found.
      </div>
    );
  }

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const departmentId = resolvedParams.departmentId || "";
  const statusView = resolvedParams.statusView || "active";
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const [studentsResult, departments] = await Promise.all([
    StudentService.list({
      tenantId: activeTenant.id,
      search: search || undefined,
      departmentId: departmentId || undefined,
      archivedOnly: statusView === "archived",
      includeArchived: statusView === "all",
      page,
      pageSize: 15,
    }),
    DepartmentService.listByTenant(activeTenant.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-heading text-text-primary">
            Student Directory
          </h1>
          <p className="text-xs text-text-secondary">
            Manage student academic profiles, eligibility parameters, and placement readiness.
          </p>
        </div>

        {canManageStudents && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Feature B: College-Scoped Bulk Deletion (Placement Head only) */}
            {isPlacementHead && (
              <BulkDeleteModal collegeName={activeTenant.name} />
            )}

            <Button asChild variant="outline" size="sm">
              <a href="/api/placement/students/export" download>
                <Download className="h-4 w-4 mr-1.5" /> Export CSV
              </a>
            </Button>

            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/students/import">
                <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Bulk Import
              </Link>
            </Button>

            <Button asChild variant="primary" size="sm">
              <Link href="/dashboard/students/new">
                <PlusCircle className="h-4 w-4 mr-1.5" /> Add Student
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <form method="GET" className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                name="search"
                defaultValue={search}
                placeholder="Search by name, enrollment ID, or email..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="w-full sm:w-48">
              <select
                name="departmentId"
                defaultValue={departmentId}
                className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-44">
              <select
                name="statusView"
                defaultValue={statusView}
                className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <option value="active">Active Directory</option>
                <option value="archived">Deactivated / Archived</option>
                <option value="all">All Records</option>
              </select>
            </div>

            <Button type="submit" variant="outline" size="sm" className="h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5" /> Apply Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader className="py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <span>Roster ({studentsResult.total} Total)</span>
              {statusView === "archived" && (
                <Badge variant="secondary" className="text-[10px]">
                  Archived View
                </Badge>
              )}
            </CardTitle>
            <span className="text-xs text-text-secondary font-mono">
              Page {studentsResult.page} of {studentsResult.totalPages}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {studentsResult.students.length === 0 ? (
            <div className="text-center py-12 text-text-muted space-y-3">
              <GraduationCap className="h-10 w-10 mx-auto opacity-40" />
              <p className="text-sm">No students match the selected filters.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/students">Reset Filters</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-input text-text-secondary font-mono border-b border-border uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Enrollment ID</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">CGPA</th>
                    <th className="py-3 px-4">Backlogs</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {studentsResult.students.map((student) => (
                    <tr key={student.id} className="hover:bg-input/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-text-primary">
                        <Link
                          href={`/dashboard/students/${student.id}`}
                          className="hover:text-primary transition-colors hover:underline"
                        >
                          {student.enrollment_number}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-text-primary">
                          <Link
                            href={`/dashboard/students/${student.id}`}
                            className="hover:text-primary transition-colors"
                          >
                            {student.full_name}
                          </Link>
                        </div>
                        <div className="text-[11px] text-text-muted truncate max-w-[200px]">
                          {student.email}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {student.department?.code || "—"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono">{student.graduation_year}</td>
                      <td className="py-3 px-4 font-mono font-bold text-text-primary">
                        {student.cgpa.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {student.active_backlogs > 0 ? (
                          <span className="text-red-600 font-semibold">
                            {student.active_backlogs} Active
                          </span>
                        ) : (
                          <span className="text-secondary">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {student.is_archived ? (
                          <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                            ARCHIVED
                          </Badge>
                        ) : (
                          <Badge
                            variant={
                              student.academic_status === "ACTIVE"
                                ? "success"
                                : student.academic_status === "GRADUATED"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {student.academic_status}
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {/* Feature A: Individual Student Actions Dropdown Menu */}
                        <StudentRowActions
                          student={{
                            id: student.id,
                            enrollment_number: student.enrollment_number,
                            full_name: student.full_name,
                            email: student.email,
                            is_archived: student.is_archived,
                            academic_status: student.academic_status,
                          }}
                          canDelete={isPlacementHead}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {studentsResult.totalPages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-between">
              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={studentsResult.page <= 1}
              >
                <Link
                  href={`/dashboard/students?search=${search}&departmentId=${departmentId}&statusView=${statusView}&page=${studentsResult.page - 1}`}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Link>
              </Button>

              <span className="text-xs text-text-secondary">
                Page {studentsResult.page} of {studentsResult.totalPages}
              </span>

              <Button
                asChild
                variant="outline"
                size="sm"
                disabled={studentsResult.page >= studentsResult.totalPages}
              >
                <Link
                  href={`/dashboard/students?search=${search}&departmentId=${departmentId}&statusView=${statusView}&page=${studentsResult.page + 1}`}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
