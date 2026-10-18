/**
 * Single Company API Route
 * GET /api/placement/companies/[id] — Retrieve company profile
 * PATCH /api/placement/companies/[id] — Update company profile
 * DELETE /api/placement/companies/[id] — Archive company
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { CompanyService } from "@/modules/companies/services/company-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.COMPANIES_READ);

    const company = await CompanyService.getById(ctx.tenantId, id);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.COMPANIES_MANAGE);
    const body = await request.json();

    const existing = await CompanyService.getById(ctx.tenantId, id);
    if (!existing) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const updated = await CompanyService.update(ctx.tenantId, id, body);

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "COMPANY_UPDATED",
      resourceType: "company",
      resourceId: id,
      afterState: { name: updated.name, industry: updated.industry },
    });

    return NextResponse.json(updated);
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.COMPANIES_MANAGE);

    const archived = await CompanyService.archive(ctx.tenantId, id);

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "COMPANY_ARCHIVED",
      resourceType: "company",
      resourceId: id,
    });

    return NextResponse.json({ success: true, company: archived });
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
