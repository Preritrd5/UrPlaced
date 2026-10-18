/**
 * Companies API Route
 * GET /api/placement/companies — List companies with search and pagination
 * POST /api/placement/companies — Create a new hiring company
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { CompanyService } from "@/modules/companies/services/company-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.COMPANIES_READ);

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : 10;

    const result = await CompanyService.list({
      tenantId: ctx.tenantId,
      search,
      page,
      pageSize,
    });

    return NextResponse.json(result);
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

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.COMPANIES_MANAGE);
    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }

    const company = await CompanyService.create({
      tenantId: ctx.tenantId,
      name: body.name,
      website: body.website,
      industry: body.industry,
      contactPerson: body.contactPerson,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      internalNotes: body.internalNotes,
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "COMPANY_CREATED",
      resourceType: "company",
      resourceId: company.id,
      afterState: { name: company.name, industry: company.industry },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
