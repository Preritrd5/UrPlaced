/**
 * Drive Stage Service
 * Configures multi-stage recruitment pipelines per drive (e.g., Online Test, Technical, HR).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, StageType } from "@/types/database";

export type DriveStageRow = Database["public"]["Tables"]["drive_stages"]["Row"];
export type DriveStageInsert = Database["public"]["Tables"]["drive_stages"]["Insert"];

export class StageService {
  /**
   * List stages for a drive in execution order
   */
  static async listByDrive(tenantId: string, driveId: string): Promise<DriveStageRow[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("drive_stages")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("drive_id", driveId)
      .order("stage_order", { ascending: true });

    if (error) {
      throw new Error(`Failed to list drive stages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Add a stage to a recruitment drive
   */
  static async create(stage: {
    tenantId: string;
    driveId: string;
    name: string;
    stageType: StageType;
    stageOrder: number;
    description?: string | null;
    scheduledAt?: string | null;
    isStudentVisible?: boolean;
  }): Promise<DriveStageRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("drive_stages")
      .insert({
        tenant_id: stage.tenantId,
        drive_id: stage.driveId,
        name: stage.name.trim(),
        stage_type: stage.stageType,
        stage_order: stage.stageOrder,
        description: stage.description || null,
        scheduled_at: stage.scheduledAt || null,
        is_student_visible: stage.isStudentVisible ?? true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`A stage with order number ${stage.stageOrder} already exists for this drive.`);
      }
      throw new Error(`Failed to create drive stage: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a stage
   */
  static async update(
    tenantId: string,
    id: string,
    updates: Partial<{
      name: string;
      stageType: StageType;
      stageOrder: number;
      description: string | null;
      scheduledAt: string | null;
      isStudentVisible: boolean;
    }>
  ): Promise<DriveStageRow> {
    const supabase = createAdminClient();
    const payload: any = { updated_at: new Date().toISOString() };

    if (updates.name) payload.name = updates.name.trim();
    if (updates.stageType) payload.stage_type = updates.stageType;
    if (updates.stageOrder !== undefined) payload.stage_order = updates.stageOrder;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.scheduledAt !== undefined) payload.scheduled_at = updates.scheduledAt;
    if (updates.isStudentVisible !== undefined) payload.is_student_visible = updates.isStudentVisible;

    const { data, error } = await supabase
      .from("drive_stages")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update stage: ${error.message}`);
    }

    return data;
  }
}
