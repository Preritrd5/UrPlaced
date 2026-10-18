import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  Phone,
  Briefcase,
  PlusCircle,
  ExternalLink,
} from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { CompanyService } from "@/modules/companies/services/company-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/signin");

  const activeTenant = profile.activeMembership?.tenants;
  if (!activeTenant) redirect("/auth/signin");

  const company = await CompanyService.getById(activeTenant.id, id);
  if (!company) {
    notFound();
  }

  const isStaff = profile.activeMembership?.role !== "STUDENT";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href="/dashboard/companies">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight font-heading text-text-primary">
                {company.name}
              </h1>
              {company.industry && (
                <Badge variant="secondary">{company.industry}</Badge>
              )}
            </div>
            <p className="text-xs text-text-secondary">
              Hiring Partner Profile &bull; {company.drives?.length || 0} Recruitment Drives Associated
            </p>
          </div>
        </div>

        {isStaff && (
          <Button asChild variant="primary" size="sm">
            <Link href={`/dashboard/drives/new?companyId=${company.id}`}>
              <PlusCircle className="h-4 w-4 mr-1.5" /> Launch Drive
            </Link>
          </Button>
        )}
      </div>

      {/* Grid: Company Details */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Contact & Profile Card */}
        <Card className="sm:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Corporate Contact &amp; Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {company.website && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-text-muted block mb-1">
                    Website
                  </span>
                  <a
                    href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline font-mono"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>{company.website}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {company.contact_person && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-text-muted block mb-1">
                    Primary Recruiter Contact
                  </span>
                  <span className="font-semibold text-text-primary">{company.contact_person}</span>
                </div>
              )}

              {company.contact_email && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-text-muted block mb-1">
                    Contact Email
                  </span>
                  <div className="flex items-center gap-1.5 text-text-primary">
                    <Mail className="h-3.5 w-3.5 text-text-muted" />
                    <span>{company.contact_email}</span>
                  </div>
                </div>
              )}

              {company.contact_phone && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-text-muted block mb-1">
                    Contact Phone
                  </span>
                  <div className="flex items-center gap-1.5 text-text-primary font-mono">
                    <Phone className="h-3.5 w-3.5 text-text-muted" />
                    <span>{company.contact_phone}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Internal Placement Team Notes */}
            {isStaff && company.internal_notes && (
              <div className="pt-4 border-t border-border">
                <span className="text-xs font-semibold text-text-secondary block mb-1.5">
                  Restricted Internal Placement Notes (Confidential)
                </span>
                <p className="text-xs text-text-secondary bg-input p-3 rounded-lg border border-border leading-relaxed">
                  {company.internal_notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-secondary" />
              Recruitment Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg border border-border bg-input">
              <span className="text-[10px] font-mono uppercase text-text-muted">Total Campus Drives</span>
              <div className="text-2xl font-bold font-heading text-text-primary">
                {company.drives?.length || 0}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Associated Recruitment Drives */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Recruitment Drives ({company.drives?.length || 0})
          </CardTitle>
          <CardDescription>
            All past and active campus recruitment opportunities hosted with {company.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!company.drives || company.drives.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-xs space-y-2">
              <Briefcase className="h-6 w-6 mx-auto opacity-40" />
              <p>No recruitment drives launched for this company yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {company.drives.map((drive: any) => (
                <div key={drive.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Link
                      href={`/dashboard/drives/${drive.id}`}
                      className="font-semibold text-xs text-text-primary hover:text-primary hover:underline"
                    >
                      {drive.title}
                    </Link>
                    <p className="text-[11px] text-text-secondary">
                      Role: {drive.role_title} &bull; Type: {drive.recruitment_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={drive.status === "REGISTRATION_OPEN" ? "success" : "default"}>
                      {drive.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
