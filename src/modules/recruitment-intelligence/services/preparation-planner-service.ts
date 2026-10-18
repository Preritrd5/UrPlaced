import { createClient } from "@/lib/supabase/server";
import {
  StudentPreparationPlanRow,
  PreparationTaskRow,
  PreparationTaskStatus,
  PreparationActivityType,
  PreparationPriority,
} from "@/types/database";

export interface StudentPlanSummary {
  plan: StudentPreparationPlanRow;
  tasks: Array<PreparationTaskRow & { skillName?: string; resourceUrl?: string | null; stageName?: string | null }>;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    completionPercentage: number;
  };
}

export class PreparationPlannerService {
  /**
   * Generates or fetches an existing preparation plan for a student and recruitment drive
   */
  public static async getOrCreatePlan(
    tenantId: string,
    studentId: string,
    driveId: string
  ): Promise<StudentPlanSummary> {
    const supabase = await createClient();

    // 1. Check if plan already exists
    let { data: plan } = await supabase
      .from("student_preparation_plans")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("drive_id", driveId)
      .single();

    if (!plan) {
      // Create new preparation plan
      const { data: newPlan, error: createError } = await supabase
        .from("student_preparation_plans")
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          drive_id: driveId,
          status: "ACTIVE",
        })
        .select()
        .single();

      if (createError || !newPlan) {
        throw new Error(`Failed to create preparation plan: ${createError?.message || "Unknown error"}`);
      }

      plan = newPlan;

      // Populate initial tasks from drive stages and mapped skills
      await this.assembleInitialTasks(tenantId, plan.id, driveId);
    }

    return await this.getPlanDetails(tenantId, plan.id);
  }

  /**
   * Assembles initial preparation tasks based on confirmed stages and mapped skills
   */
  private static async assembleInitialTasks(
    tenantId: string,
    planId: string,
    driveId: string
  ): Promise<void> {
    const supabase = await createClient();

    // 1. Fetch drive stages
    const { data: stages } = await supabase
      .from("drive_stages")
      .select("id, name, stage_type, sequence_order")
      .eq("tenant_id", tenantId)
      .eq("drive_id", driveId)
      .order("sequence_order", { ascending: true });

    // 2. Fetch mapped skills
    const { data: mappings } = await supabase
      .from("requirement_skill_mappings")
      .select(`
        id,
        requirement_id,
        skill_id,
        importance,
        canonical_skills (id, name, category)
      `)
      .eq("tenant_id", tenantId)
      .eq("drive_id", driveId);

    // 3. Fetch resources
    const skillIds = Array.from(new Set((mappings || []).map((m: any) => m.skill_id)));
    let resourcesBySkill: Record<string, any[]> = {};
    if (skillIds.length > 0) {
      const { data: resources } = await supabase
        .from("practice_resources")
        .select("id, skill_id, title, url, estimated_minutes")
        .in("skill_id", skillIds)
        .eq("is_active", true);

      if (resources) {
        for (const res of resources) {
          if (!resourcesBySkill[res.skill_id]) {
            resourcesBySkill[res.skill_id] = [];
          }
          resourcesBySkill[res.skill_id].push(res);
        }
      }
    }

    const tasksToInsert: any[] = [];

    if (mappings && mappings.length > 0) {
      for (const mapping of mappings as any[]) {
        const skill = mapping.canonical_skills;
        const resources = resourcesBySkill[mapping.skill_id] || [];
        const primaryResource = resources[0];

        // Determine appropriate stage if possible
        let matchedStageId: string | null = null;
        if (stages && stages.length > 0) {
          if (
            skill?.category === "QUANTITATIVE_APTITUDE" ||
            skill?.category === "LOGICAL_REASONING" ||
            skill?.category === "VERBAL_ABILITY"
          ) {
            const oaStage = stages.find((s: any) => s.stage_type === "OA" || s.stage_type === "ONLINE_TEST");
            matchedStageId = oaStage?.id || stages[0].id;
          } else if (
            skill?.category === "DATA_STRUCTURES_ALGORITHMS" ||
            skill?.category === "PROGRAMMING_FUNDAMENTALS"
          ) {
            const codingStage = stages.find(
              (s: any) => s.stage_type === "CODING_TEST" || s.stage_type === "TECHNICAL_INTERVIEW"
            );
            matchedStageId = codingStage?.id || (stages.length > 1 ? stages[1].id : stages[0].id);
          } else if (skill?.category === "BEHAVIORAL_HR") {
            const hrStage = stages.find((s: any) => s.stage_type === "HR_INTERVIEW");
            matchedStageId = hrStage?.id || stages[stages.length - 1].id;
          }
        }

        const priority: PreparationPriority =
          mapping.importance === "MANDATORY" ? "HIGH" : mapping.importance === "PREFERRED" ? "MEDIUM" : "LOW";

        tasksToInsert.push({
          tenant_id: tenantId,
          plan_id: planId,
          requirement_id: mapping.requirement_id,
          skill_id: mapping.skill_id,
          resource_id: primaryResource?.id || null,
          stage_id: matchedStageId,
          title: `Master ${skill?.name || "Topic"} Core Concepts`,
          activity_type: "CONCEPT_REVIEW" as PreparationActivityType,
          priority,
          status: "PLANNED" as PreparationTaskStatus,
          recommendation_rationale: `Recommended based on drive requirements marked as ${mapping.importance}.`,
          estimated_minutes: primaryResource?.estimated_minutes || 45,
        });

        if (primaryResource) {
          tasksToInsert.push({
            tenant_id: tenantId,
            plan_id: planId,
            requirement_id: mapping.requirement_id,
            skill_id: mapping.skill_id,
            resource_id: primaryResource.id,
            stage_id: matchedStageId,
            title: `Practice Exercises: ${primaryResource.title}`,
            activity_type: "PRACTICE_DRILL" as PreparationActivityType,
            priority,
            status: "PLANNED" as PreparationTaskStatus,
            recommendation_rationale: "Hands-on problem sets to reinforce topic proficiency.",
            estimated_minutes: 60,
          });
        }
      }
    }

    if (tasksToInsert.length > 0) {
      await supabase.from("preparation_tasks").insert(tasksToInsert);
    }
  }

  /**
   * Retrieve full plan details, tasks, and completion metrics
   */
  public static async getPlanDetails(tenantId: string, planId: string): Promise<StudentPlanSummary> {
    const supabase = await createClient();

    const { data: plan, error: planError } = await supabase
      .from("student_preparation_plans")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      throw new Error("Preparation plan not found.");
    }

    const { data: tasks, error: taskError } = await supabase
      .from("preparation_tasks")
      .select(`
        *,
        canonical_skills (name),
        practice_resources (url),
        drive_stages (name)
      `)
      .eq("tenant_id", tenantId)
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });

    if (taskError) {
      throw new Error(`Failed to load preparation tasks: ${taskError.message}`);
    }

    const taskList = (tasks || []).map((t: any) => ({
      ...t,
      skillName: t.canonical_skills?.name,
      resourceUrl: t.practice_resources?.url,
      stageName: t.drive_stages?.name,
    }));

    const totalTasks = taskList.length;
    const completedTasks = taskList.filter((t) => t.status === "COMPLETED").length;
    const inProgressTasks = taskList.filter((t) => t.status === "IN_PROGRESS").length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      plan,
      tasks: taskList,
      metrics: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        completionPercentage,
      },
    };
  }

  /**
   * Update status of a preparation task
   */
  public static async updateTaskStatus(
    tenantId: string,
    taskId: string,
    status: PreparationTaskStatus
  ): Promise<PreparationTaskRow> {
    const supabase = await createClient();

    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "COMPLETED") {
      updatePayload.completed_at = new Date().toISOString();
    } else {
      updatePayload.completed_at = null;
    }

    const { data, error } = await supabase
      .from("preparation_tasks")
      .update(updatePayload)
      .eq("tenant_id", tenantId)
      .eq("id", taskId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update task status: ${error?.message || "Unknown error"}`);
    }

    return data as PreparationTaskRow;
  }
}
