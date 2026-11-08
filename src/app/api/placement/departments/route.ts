/**
 * Departments API Route
 * GET /api/placement/departments — List college departments
 * POST /api/placement/departments — Create new department
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { DepartmentService } from "@/modules/academic/services/department-service";

export async function GET() {
  try {
    const ctx = await requireAuthContext(Permissions.DEPARTMENTS_MANAGE);
    const departments = await DepartmentService.listByTenant(ctx.tenantId);
    return NextResponse.json(departments);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.startsWith("FORBIDDEN") || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: error.message || "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.DEPARTMENTS_MANAGE);
    const body = await request.json();

    if (!body.name || !body.code) {
      return NextResponse.json(
        { error: "Missing required fields: name, code" },
        { status: 400 }
      );
    }

    const department = await DepartmentService.create({
      tenantId: ctx.tenantId,
      name: body.name,
      code: body.code,
      status: body.status || "ACTIVE",
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "DEPARTMENT_CREATED",
      resourceType: "department",
      resourceId: department.id,
      afterState: { code: department.code, name: department.name },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.startsWith("FORBIDDEN") || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: error.message || "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
