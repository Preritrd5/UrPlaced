import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  Mail,
  Phone,
  Building2,
  Calendar,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { StudentService } from "@/modules/students/services/student-service";
import { CandidateService } from "@/modules/placement/services/candidate-service";
import { OutcomeService } from "@/modules/placement/services/outcome-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StudentRowActions } from "@/components/students/student-row-actions";
import { ClientAuthGate } from "@/components/auth/client-auth-gate";

export const dynamic = "force-dynamic";

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentDetailPage({ params }: StudentDetailPageProps) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();
  if (!profile) return <ClientAuthGate redirectTo="/auth/college/signin" />;

  const activeTenant = profile.activeMembership?.tenants;
  if (!activeTenant) redirect("/auth/signin");

  const role = profile.activeMembership?.role;

  // Students cannot view institutional student records
  if (role === "STUDENT") {
    redirect("/dashboard/student");
  }

  const [student, applications, offers] = await Promise.all([
    StudentService.getById(activeTenant.id, id),
    CandidateService.listByStudent(activeTenant.id, id),
    OutcomeService.listByStudent(activeTenant.id, id),
  ]);

  if (!student) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href="/dashboard/students">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight font-heading text-text-primary">
                {student.full_name}
              </h1>
              <Badge
                variant={
                  student.academic_status === "ACTIVE"
                    ? "success"
                    : student.academic_status === "GRADUATED"
                    ? "default"
                    : "secondary"
                }
              >
                {student.academic_status}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary font-mono">
              Roll ID: {student.enrollment_number} &bull; {student.department?.name} ({student.department?.code})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {student.resume_url && (
            <Button asChild variant="outline" size="sm">
              <a href={student.resume_url} target="_blank" rel="noopener noreferrer">
                View Resume
              </a>
            </Button>
          )}

          <StudentRowActions
            student={{
              id: student.id,
              enrollment_number: student.enrollment_number,
              full_name: student.full_name,
              email: student.email,
              is_archived: student.is_archived,
              academic_status: student.academic_status,
            }}
            canDelete={role === "PLACEMENT_HEAD" || profile.isPlatformAdmin}
          />
        </div>
      </div>

      {/* Grid: Academic Highlights & Contact */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Academic Performance Card */}
        <Card className="sm:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Academic Performance &amp; Standing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border border-border bg-input">
                <span className="text-[10px] font-mono uppercase text-text-muted">CGPA</span>
                <div className="text-xl font-bold font-heading text-primary">
                  {student.cgpa.toFixed(2)}
                </div>
                <span className="text-[10px] text-text-secondary">Scale: 10.0</span>
              </div>

              <div className="p-3 rounded-lg border border-border bg-input">
                <span className="text-[10px] font-mono uppercase text-text-muted">Active Backlogs</span>
                <div className="text-xl font-bold font-heading text-text-primary">
                  {student.active_backlogs}
                </div>
                <span className="text-[10px] text-text-secondary">
                  Total: {student.total_backlogs}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-border bg-input">
                <span className="text-[10px] font-mono uppercase text-text-muted">10th Grade</span>
                <div className="text-xl font-bold font-heading text-text-primary">
                  {student.tenth_percentage ? `${student.tenth_percentage}%` : "—"}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-input">
                <span className="text-[10px] font-mono uppercase text-text-muted">12th Grade</span>
                <div className="text-xl font-bold font-heading text-text-primary">
                  {student.twelfth_percentage ? `${student.twelfth_percentage}%` : "—"}
                </div>
              </div>
            </div>

            {/* Skills Badges */}
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-xs font-semibold text-text-secondary block mb-2">
                Demonstrated Skills &amp; Stack
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(student.skills || []).length === 0 ? (
                  <span className="text-xs text-text-muted">No skills logged yet.</span>
                ) : (
                  (student.skills || []).map((skill: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Identity & Metadata Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-secondary" />
              Cohort Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-2 text-text-secondary">
              <Mail className="h-4 w-4 text-text-muted shrink-0" />
              <span className="truncate">{student.email}</span>
            </div>

            {student.phone && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Phone className="h-4 w-4 text-text-muted shrink-0" />
                <span>{student.phone}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-text-secondary">
              <Building2 className="h-4 w-4 text-text-muted shrink-0" />
              <span>{student.degree} &bull; {student.department?.code}</span>
            </div>

            <div className="flex items-center gap-2 text-text-secondary">
              <Calendar className="h-4 w-4 text-text-muted shrink-0" />
              <span>Graduation Batch {student.graduation_year}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Offers & Placements Section */}
      {offers.length > 0 && (
        <Card className="border-secondary/30 bg-[rgba(46,143,134,0.02)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-secondary" />
              Placement Offers Extended ({offers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {offers.map((offer: any) => (
                <div
                  key={offer.id}
                  className="p-3.5 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-text-primary text-sm">
                      {offer.drive?.company?.name} &bull; {offer.drive?.role_title}
                    </div>
                    <p className="text-xs text-text-secondary">
                      Offer Type: {offer.offer_type} &bull; Offered on: {new Date(offer.offered_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {offer.compensation_amount && (
                      <span className="font-mono font-bold text-sm text-secondary">
                        ₹{(offer.compensation_amount / 100000).toFixed(1)} LPA
                      </span>
                    )}
                    <Badge variant={offer.status === "ACCEPTED" ? "success" : "secondary"}>
                      {offer.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recruitment Drive Applications Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Recruitment Drive Applications ({applications.length})
          </CardTitle>
          <CardDescription>
            History of student participation and stage advancement in campus recruitment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-xs">
              Candidate has not registered for any recruitment drives yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {applications.map((app: any) => (
                <div key={app.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs text-text-primary">
                      {app.drive?.company?.name} &bull; {app.drive?.title}
                    </div>
                    <p className="text-[11px] text-text-secondary">
                      Registered on {new Date(app.registration_date).toLocaleDateString()} &bull; Current Stage: {app.current_stage?.name || "Initial"}
                    </p>
                  </div>
                  <Badge variant={app.status === "OFFER_EXTENDED" ? "success" : "default"}>
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
