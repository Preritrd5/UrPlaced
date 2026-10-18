import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  PlusCircle,
  Search,
  ExternalLink,
  Briefcase,
  Globe,
  Mail,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { CompanyService } from "@/modules/companies/services/company-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

interface CompaniesPageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/signin");

  const activeTenant = profile.activeMembership?.tenants;
  if (!activeTenant) redirect("/auth/signin");

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const result = await CompanyService.list({
    tenantId: activeTenant.id,
    search: search || undefined,
    page,
    pageSize: 12,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-heading text-text-primary">
            Hiring Partners &amp; Companies
          </h1>
          <p className="text-xs text-text-secondary">
            Manage recruiting organizations, enterprise contacts, and corporate placement relationships.
          </p>
        </div>

        <Button asChild variant="primary" size="sm">
          <Link href="/dashboard/companies/new">
            <PlusCircle className="h-4 w-4 mr-1.5" /> Add Company
          </Link>
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <form method="GET" className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                name="search"
                defaultValue={search}
                placeholder="Search companies by name or industry sector..."
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" className="h-9">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Companies Grid */}
      {result.companies.length === 0 ? (
        <Card className="text-center py-12 text-text-muted space-y-3">
          <Building2 className="h-10 w-10 mx-auto opacity-40" />
          <p className="text-sm">No companies registered yet.</p>
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard/companies/new">Add First Company</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.companies.map((company) => (
            <Card key={company.id} className="hover:border-primary/40 transition-colors flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      <Link
                        href={`/dashboard/companies/${company.id}`}
                        className="hover:text-primary transition-colors hover:underline"
                      >
                        {company.name}
                      </Link>
                    </CardTitle>
                    {company.industry && (
                      <Badge variant="secondary" className="text-[10px]">
                        {company.industry}
                      </Badge>
                    )}
                  </div>
                  <div className="h-8 w-8 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="space-y-1.5 text-xs text-text-secondary">
                  {company.website && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Globe className="h-3.5 w-3.5 text-text-muted shrink-0" />
                      <a
                        href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-text-secondary truncate text-[11px]"
                      >
                        {company.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}

                  {company.contact_email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 text-text-muted shrink-0" />
                      <span className="text-[11px] truncate">{company.contact_email}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-text-muted">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>{company.drives_count || 0} Drives</span>
                  </div>

                  <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                    <Link href={`/dashboard/companies/${company.id}`}>
                      Details <ExternalLink className="h-3 w-3 ml-1" />
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
            <Link href={`/dashboard/companies?search=${search}&page=${result.page - 1}`}>
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
            <Link href={`/dashboard/companies?search=${search}&page=${result.page + 1}`}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
