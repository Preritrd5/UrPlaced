import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Briefcase,
  PlusCircle,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  Building2,
} from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { DriveService } from "@/modules/recruitment-drives/services/drive-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

interface DrivesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function DrivesPage({ searchParams }: DrivesPageProps) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/signin");

  const activeTenant = profile.activeMembership?.tenants;
  if (!activeTenant) redirect("/auth/signin");

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const status = resolvedParams.status || "";
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const result = await DriveService.list({
    tenantId: activeTenant.id,
    search: search || undefined,
    status: (status as any) || undefined,
    page,
    pageSize: 12,
  });

  const isStaff = profile.activeMembership?.role !== "STUDENT";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-heading text-text-primary">
            Recruitment Drives
          </h1>
          <p className="text-xs text-text-secondary">
            Configure campus hiring drives, recruitment stages, eligibility criteria, and candidate tracking.
          </p>
        </div>

        {isStaff && (
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard/drives/new">
              <PlusCircle className="h-4 w-4 mr-1.5" /> Launch Drive
            </Link>
          </Button>
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
                placeholder="Search drives by title, role, or company..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="w-full sm:w-48">
              <select
                name="status"
                defaultValue={status}
                className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="REGISTRATION_OPEN">Registration Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <Button type="submit" variant="outline" size="sm" className="h-9">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Drives Grid */}
      {result.drives.length === 0 ? (
        <Card className="text-center py-12 text-text-muted space-y-3">
          <Briefcase className="h-10 w-10 mx-auto opacity-40" />
          <p className="text-sm">No recruitment drives found.</p>
          {isStaff && (
            <Button asChild variant="primary" size="sm">
              <Link href="/dashboard/drives/new">Launch Drive</Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.drives.map((drive) => (
            <Card key={drive.id} className="hover:border-primary/40 transition-colors flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      <Link
                        href={`/dashboard/drives/${drive.id}`}
                        className="hover:text-primary transition-colors hover:underline"
                      >
                        {drive.title}
                      </Link>
                    </CardTitle>
                    <p className="text-xs text-text-secondary flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-text-muted shrink-0" />
                      <span>{drive.company?.name}</span>
                    </p>
                  </div>
                  <Badge
                    variant={
                      drive.status === "REGISTRATION_OPEN"
                        ? "success"
                        : drive.status === "IN_PROGRESS"
                        ? "default"
                        : drive.status === "DRAFT"
                        ? "secondary"
                        : "outline"
                    }
                    className="text-[10px]"
                  >
                    {drive.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="space-y-1.5 text-xs text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Role:</span>
                    <span className="font-semibold text-text-primary">{drive.role_title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Type:</span>
                    <span>{drive.recruitment_type}</span>
                  </div>
                  {drive.compensation_range && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Package:</span>
                      <span className="font-mono font-semibold text-secondary">
                        {drive.compensation_range}
                      </span>
                    </div>
                  )}
                  {drive.registration_deadline && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Deadline:</span>
                      <span className="font-mono text-[11px]">
                        {new Date(drive.registration_deadline).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-text-muted">
                    <Users className="h-3.5 w-3.5" />
                    <span>{drive.applicants_count || 0} Registered</span>
                  </div>

                  <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                    <Link href={`/dashboard/drives/${drive.id}`}>
                      Manage <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={result.page <= 1}
          >
            <Link href={`/dashboard/drives?search=${search}&status=${status}&page=${result.page - 1}`}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Link>
          </Button>

          <span className="text-xs text-text-secondary">
            Page {result.page} of {result.totalPages}
          </span>

          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={result.page >= result.totalPages}
          >
            <Link href={`/dashboard/drives?search=${search}&status=${status}&page=${result.page + 1}`}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
