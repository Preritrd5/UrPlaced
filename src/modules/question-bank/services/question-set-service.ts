/**
-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- QuestionBank Sentinel: Question Set & Snapshot Service
-- ==============================================================================
*/

import { QuestionSetPurpose, QuestionType, QuestionDifficulty } from "@/types/database";
import { QuestionService } from "./question-service";
import { normalizeSubjectName } from "./subject-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CreateQuestionSetInput {
  name: string;
  description?: string;
  purpose?: QuestionSetPurpose;
}

export interface QuestionSetItemInput {
  question_id: string;
  version_id?: string;
  sequence_order?: number;
  points?: number;
  negative_points?: number;
}

export interface AutoBuildCriteria {
  mode: "SINGLE" | "MIXED";
  subjects: Array<{
    subject: string;
    count: number;
    percentage?: number;
  }>;
  bankId?: string;
  topic?: string;
  questionType?: QuestionType | "ALL";
  difficultyDistribution?: {
    EASY?: number;
    MEDIUM?: number;
    HARD?: number;
  };
  distributionMode?: "COUNT" | "PERCENTAGE";
  defaultPoints?: number;
  excludeSetId?: string;
  excludeQuestionIds?: string[];
}

export interface SubjectAvailabilityResult {
  subject: string;
  requested: number;
  available: number;
  shortage: number;
  byDifficulty: {
    EASY: number;
    MEDIUM: number;
    HARD: number;
  };
  requestedByDifficulty?: {
    EASY: number;
    MEDIUM: number;
    HARD: number;
  };
  difficultyShortage?: {
    EASY: number;
    MEDIUM: number;
    HARD: number;
  };
}

export interface AutoBuildAvailabilityResult {
  isSatisfiable: boolean;
  totalRequested: number;
  totalAvailable: number;
  totalShortage: number;
  subjects: SubjectAvailabilityResult[];
  shortageMessages: string[];
  error?: string;
}

export interface CalculatedDifficultyCounts {
  EASY: number;
  MEDIUM: number;
  HARD: number;
}

/**
 * Converts difficulty percentages or counts into deterministic integer counts
 * using the Largest Remainder Method (Hare-Niemeyer method).
 *
 * Invariants enforced:
 * 1. Output EASY + MEDIUM + HARD === targetCount exactly.
 * 2. Percentages must not be negative and must sum to 100%.
 * 3. Consistent deterministic tie-breaking order: MEDIUM, then EASY, then HARD.
 * 4. Never produces fractional questions.
 */
export function calculateDifficultyCounts(
  targetCount: number,
  distribution: { EASY?: number; MEDIUM?: number; HARD?: number },
  distributionMode: "PERCENTAGE" | "COUNT" = "PERCENTAGE"
): { counts?: CalculatedDifficultyCounts; error?: string } {
  const easyVal = distribution.EASY ?? 0;
  const medVal = distribution.MEDIUM ?? 0;
  const hardVal = distribution.HARD ?? 0;

  if (easyVal < 0 || medVal < 0 || hardVal < 0) {
    return { error: "Difficulty distribution values cannot be negative." };
  }

  if (targetCount <= 0) {
    return { counts: { EASY: 0, MEDIUM: 0, HARD: 0 } };
  }

  if (distributionMode === "COUNT") {
    const sum = easyVal + medVal + hardVal;
    if (sum !== targetCount) {
      return {
        error: `Difficulty counts (${sum}) must sum to the requested total count (${targetCount}).`,
      };
    }
    return {
      counts: {
        EASY: Math.round(easyVal),
        MEDIUM: Math.round(medVal),
        HARD: Math.round(hardVal),
      },
    };
  }

  // PERCENTAGE MODE
  const totalPercent = easyVal + medVal + hardVal;
  if (Math.abs(totalPercent - 100) > 0.01) {
    return {
      error: `Difficulty distribution percentages must sum to 100% (current sum: ${totalPercent}%).`,
    };
  }

  // Hare-Niemeyer Largest Remainder Method
  const exactEasy = (easyVal / 100) * targetCount;
  const exactMed = (medVal / 100) * targetCount;
  const exactHard = (hardVal / 100) * targetCount;

  const floorEasy = Math.floor(exactEasy);
  const floorMed = Math.floor(exactMed);
  const floorHard = Math.floor(exactHard);

  const remEasy = exactEasy - floorEasy;
  const remMed = exactMed - floorMed;
  const remHard = exactHard - floorHard;

  let assignedEasy = floorEasy;
  let assignedMed = floorMed;
  let assignedHard = floorHard;

  const shortfall = targetCount - (assignedEasy + assignedMed + assignedHard);

  // Sort by remainder descending, tie-break: MEDIUM (3) -> EASY (2) -> HARD (1)
  const remainders = [
    { difficulty: "MEDIUM" as const, remainder: remMed, priority: 3 },
    { difficulty: "EASY" as const, remainder: remEasy, priority: 2 },
    { difficulty: "HARD" as const, remainder: remHard, priority: 1 },
  ].sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 0.00001) {
      return b.remainder - a.remainder;
    }
    return b.priority - a.priority;
  });

  for (let i = 0; i < shortfall; i++) {
    const target = remainders[i % remainders.length].difficulty;
    if (target === "EASY") assignedEasy++;
    else if (target === "MEDIUM") assignedMed++;
    else if (target === "HARD") assignedHard++;
  }

  return {
    counts: {
      EASY: assignedEasy,
      MEDIUM: assignedMed,
      HARD: assignedHard,
    },
  };
}

export interface AutoBuildPreviewItem {
  question_id: string;
  version_id: string;
  prompt: string;
  bank_id: string;
  bank_name: string;
  subject: string;
  topic_tags: string[];
  question_type: QuestionType;
  difficulty: QuestionDifficulty;
  points: number;
}

export interface AutoBuildPreviewResult {
  success: boolean;
  previewItems: AutoBuildPreviewItem[];
  summary: {
    totalQuestions: number;
    totalPoints: number;
    subjectCounts: Record<string, number>;
    difficultyCounts: Record<string, number>;
    typeCounts: Record<string, number>;
  };
  availability?: AutoBuildAvailabilityResult;
  error?: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class QuestionSetService {
  /**
   * Creates a new question set container.
   */
  public static async createSet(
    tenantId: string,
    userId: string,
    input: CreateQuestionSetInput
  ) {
    const supabase = await createServerSupabaseClient();

    return supabase
      .from("question_sets")
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description || null,
        purpose: input.purpose || "ASSESSMENT",
        status: "DRAFT",
        created_by: userId,
      })
      .select("*")
      .single();
  }

  /**
   * Binds questions to a question set using immutable version IDs.
   * Invariant: Only reviewed questions with verified answer keys (VERIFIED_CORRECT)
   * or approved lifecycle status can be added to question sets.
   */
  public static async addItemsToSet(
    tenantId: string,
    setId: string,
    items: QuestionSetItemInput[]
  ): Promise<{ success: boolean; addedCount: number; skippedCount?: number; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Verify set is not locked
    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("is_locked, status")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { success: false, addedCount: 0, error: "Question set not found." };
    }

    if (set.is_locked) {
      return {
        success: false,
        addedCount: 0,
        error: "Question set is locked. Create a new revision to alter items.",
      };
    }

    // Query existing items in set to skip duplicates
    const { data: existingItems } = await supabase
      .from("question_set_items")
      .select("question_id, sequence_order")
      .eq("tenant_id", tenantId)
      .eq("set_id", setId);

    const existingQIds = new Set((existingItems || []).map((it: any) => it.question_id));
    let maxSeq = (existingItems || []).reduce(
      (max: number, it: any) => Math.max(max, it.sequence_order || 0),
      0
    );
    let skippedCount = 0;

    // Validate all items before inserting to preserve integrity
    const itemsToInsert: Array<{
      tenant_id: string;
      set_id: string;
      question_id: string;
      version_id: string;
      sequence_order: number;
      points: number;
      negative_points: number;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // If already in set, skip duplicate
      if (existingQIds.has(item.question_id)) {
        skippedCount++;
        continue;
      }

      const { data: q, error: qErr } = await supabase
        .from("questions")
        .select("id, current_version_id, lifecycle_status")
        .eq("tenant_id", tenantId)
        .eq("id", item.question_id)
        .single();

      if (qErr || !q) {
        return {
          success: false,
          addedCount: 0,
          error: `Question ${item.question_id} not found or does not belong to this institution.`,
        };
      }

      const versionId = item.version_id || q.current_version_id;
      if (!versionId) {
        return {
          success: false,
          addedCount: 0,
          error: `Question ${item.question_id} has no valid version.`,
        };
      }

      // Check version review eligibility
      const { data: ver, error: vErr } = await supabase
        .from("question_versions")
        .select("id, review_status")
        .eq("tenant_id", tenantId)
        .eq("id", versionId)
        .single();

      if (vErr || !ver) {
        return {
          success: false,
          addedCount: 0,
          error: `Question version not found for question ${item.question_id}.`,
        };
      }

      const isEligible =
        ver.review_status === "VERIFIED_CORRECT" &&
        ["APPROVED", "PUBLISHED"].includes(q.lifecycle_status);

      if (!isEligible) {
        return {
          success: false,
          addedCount: 0,
          error: `Cannot add question to set: Question ${item.question_id} is not eligible. Questions must have a verified answer key ('VERIFIED_CORRECT') and an approved or published lifecycle status ('APPROVED' or 'PUBLISHED'). Current review status: '${ver.review_status}', lifecycle: '${q.lifecycle_status}'.`,
        };
      }

      maxSeq++;
      itemsToInsert.push({
        tenant_id: tenantId,
        set_id: setId,
        question_id: item.question_id,
        version_id: versionId,
        sequence_order: item.sequence_order || maxSeq,
        points: item.points || 1.0,
        negative_points: item.negative_points || 0.0,
      });
      existingQIds.add(item.question_id); // Prevent intra-batch duplicates
    }

    let addedCount = 0;
    for (const row of itemsToInsert) {
      const { error: insErr } = await supabase
        .from("question_set_items")
        .insert(row);

      if (!insErr) {
        addedCount++;
      }
    }

    return { success: true, addedCount, skippedCount };
  }

  /**
   * Locks and publishes the question set, creating an immutable snapshot for assessments.
   * Invariant: Requires at least 1 question, and all questions must have verified answer keys.
   */
  public static async lockAndPublishSet(
    tenantId: string,
    setId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Verify set exists and belongs to tenant
    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("id, is_locked, status")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { success: false, error: "Question set not found." };
    }

    // Check item count
    const { data: items, error: itemsErr } = await supabase
      .from("question_set_items")
      .select(`
        id,
        question_id,
        version_id,
        question:questions!inner(id, lifecycle_status),
        version:question_versions!inner(id, review_status)
      `)
      .eq("tenant_id", tenantId)
      .eq("set_id", setId);

    if (itemsErr || !items || items.length === 0) {
      return {
        success: false,
        error: "Cannot publish an empty question set. Please add at least one question.",
      };
    }

    // Verify all items are verified/approved
    for (const item of items) {
      const q = item.question as any;
      const v = item.version as any;
      const isEligible =
        v?.review_status === "VERIFIED_CORRECT" &&
        ["APPROVED", "PUBLISHED"].includes(q?.lifecycle_status);

      if (!isEligible) {
        return {
          success: false,
          error: `Cannot publish question set: Included question ${item.question_id} is not eligible. All questions must have a verified answer key ('VERIFIED_CORRECT') and an approved or published lifecycle status ('APPROVED' or 'PUBLISHED'). Current review status: '${v?.review_status}', lifecycle: '${q?.lifecycle_status}'.`,
        };
      }
    }

    const { error: upErr } = await supabase
      .from("question_sets")
      .update({
        status: "PUBLISHED",
        is_locked: true,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", setId);

    if (upErr) {
      return { success: false, error: upErr.message };
    }

    return { success: true };
  }

  /**
   * Retrieves a question set with its questions and role-based security sanitization.
   */
  public static async getSetById(
    tenantId: string,
    userRole: string,
    setId: string
  ) {
    const supabase = await createServerSupabaseClient();

    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { set: null, items: [], error: "Question set not found." };
    }

    const { data: items, error: itemsErr } = await supabase
      .from("question_set_items")
      .select(`
        id,
        sequence_order,
        points,
        negative_points,
        question_id,
        version_id,
        question:questions!inner(
          id,
          question_type,
          lifecycle_status
        ),
        version:question_versions!inner(
          id,
          version_number,
          prompt,
          content_format,
          options,
          answer_key,
          explanation,
          difficulty,
          topic_tags,
          published_at
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("set_id", setId)
      .order("sequence_order", { ascending: true });

    if (itemsErr) {
      return { set, items: [], error: itemsErr.message };
    }

    const sanitizedItems = (items || []).map((item: any) => {
      let ver = item.version;
      const qType = item.question?.question_type;

      if (userRole === "STUDENT" && ver) {
        ver = QuestionService.sanitizeForStudent(ver, qType);
      }

      return {
        ...item,
        version: ver,
      };
    });

    return { set, items: sanitizedItems };
  }

  /**
   * Lists question sets for a tenant.
   */
  public static async listSets(
    tenantId: string,
    userRole: string,
    purpose?: QuestionSetPurpose,
    status?: string
  ) {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("question_sets")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    } else if (userRole === "STUDENT") {
      query = query.eq("status", "PUBLISHED");
    } else {
      query = query.neq("status", "ARCHIVED");
    }

    if (purpose) {
      query = query.eq("purpose", purpose);
    }

    return query;
  }

  /**
   * Deletes or safely archives a question set.
   * If the question set is an unreferenced draft set, it and its items are permanently deleted.
   * If the question set is locked/published (such as "Demo Test") or referenced by assessments,
   * it is safely archived (status = 'ARCHIVED') to protect immutable snapshots and historical assessments.
   */
  public static async deleteSet(
    tenantId: string,
    setId: string
  ): Promise<{ success: boolean; error?: string; deleted?: boolean; archived?: boolean; message?: string }> {
    const supabase = await createServerSupabaseClient();

    // 1. Check if set exists and belongs to tenant
    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("id, is_locked, status, name")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { success: false, error: "Question set not found." };
    }

    // 2. Check if referenced by assessments
    const { count: assessmentCount } = await supabase
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("question_set_id", setId);

    const isReferenced = Boolean(assessmentCount && assessmentCount > 0);
    const isLockedOrPublished = set.is_locked || set.status === "PUBLISHED";

    // Invariant: Locked, published, or assessment-referenced question sets must be safely archived
    // to preserve immutable snapshots and historical assessment execution integrity.
    if (isReferenced || isLockedOrPublished) {
      const { error: archErr } = await supabase
        .from("question_sets")
        .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("id", setId);

      if (archErr) {
        return { success: false, error: archErr.message };
      }

      return {
        success: true,
        archived: true,
        message: isReferenced
          ? "Question set is referenced by assessments and has been safely archived from active blueprints."
          : "Question set snapshot has been safely retired and archived from active blueprints.",
      };
    }

    // 3. Unreferenced draft question set can be permanently deleted:
    // Delete items first
    const { error: itemsDelErr } = await supabase
      .from("question_set_items")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("set_id", setId);

    if (itemsDelErr) {
      return { success: false, error: itemsDelErr.message };
    }

    // Delete set
    const { error: setDelErr } = await supabase
      .from("question_sets")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", setId);

    if (setDelErr) {
      return { success: false, error: setDelErr.message };
    }

    return {
      success: true,
      deleted: true,
      message: "Question set permanently deleted.",
    };
  }

  /**
   * Removes an individual question item from an unlocked draft question set.
   */
  public static async removeItemFromSet(
    tenantId: string,
    setId: string,
    itemId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Check set lock status
    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("id, is_locked")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { success: false, error: "Question set not found." };
    }

    if (set.is_locked) {
      return {
        success: false,
        error: "Cannot remove items from a locked question set snapshot.",
      };
    }

    const { error: delErr } = await supabase
      .from("question_set_items")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("set_id", setId)
      .eq("id", itemId);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    return { success: true };
  }

  /**
   * Helper to fetch candidate eligible questions and their current versions for a tenant.
   */
  private static async getEligibleCandidatePool(
    tenantId: string,
    options: {
      bankId?: string;
      topic?: string;
      questionType?: QuestionType | "ALL";
      excludeSetId?: string;
      excludeQuestionIds?: string[];
    } = {}
  ): Promise<{
    error?: string;
    eligibleCandidates: Array<{
      question: any;
      version: any;
      bank: any;
      normalizedSubject: string;
    }>;
  }> {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch Question Banks
    let bankQuery = supabase
      .from("question_banks")
      .select("id, name, category")
      .eq("tenant_id", tenantId);

    if (options.bankId) {
      bankQuery = bankQuery.eq("id", options.bankId);
    }

    const { data: banks, error: bErr } = await bankQuery;
    if (bErr || !banks || banks.length === 0) {
      return { eligibleCandidates: [] };
    }

    const bankMap = new Map<string, any>();
    banks.forEach((b: any) =>
      bankMap.set(b.id, {
        ...b,
        subject: b.subject || b.name || b.category,
      })
    );
    const bankIds = banks.map((b: any) => b.id);

    // 2. Fetch questions in these banks with APPROVED or PUBLISHED lifecycle
    let qQuery = supabase
      .from("questions")
      .select("id, bank_id, question_type, current_version_id, lifecycle_status")
      .eq("tenant_id", tenantId)
      .in("bank_id", bankIds)
      .in("lifecycle_status", ["APPROVED", "PUBLISHED"]);

    if (options.questionType && options.questionType !== "ALL") {
      qQuery = qQuery.eq("question_type", options.questionType);
    }

    const { data: questions, error: qErr } = await qQuery;
    if (qErr || !questions || questions.length === 0) {
      return { eligibleCandidates: [] };
    }

    // 3. Exclude IDs if requested
    const excludedIds = new Set<string>(options.excludeQuestionIds || []);
    if (options.excludeSetId) {
      const { data: setItems } = await supabase
        .from("question_set_items")
        .select("question_id")
        .eq("tenant_id", tenantId)
        .eq("set_id", options.excludeSetId);

      (setItems || []).forEach((it: any) => excludedIds.add(it.question_id));
    }

    const unexcludedQuestions = questions.filter((q: any) => !excludedIds.has(q.id));
    if (unexcludedQuestions.length === 0) {
      return { eligibleCandidates: [] };
    }

    // 4. Fetch current versions and verify review_status === "VERIFIED_CORRECT"
    const versionIds = unexcludedQuestions
      .map((q: any) => q.current_version_id)
      .filter((id: string): id is string => Boolean(id));

    if (versionIds.length === 0) {
      return { eligibleCandidates: [] };
    }

    const { data: versions, error: vErr } = await supabase
      .from("question_versions")
      .select("id, question_id, prompt, difficulty, topic_tags, review_status")
      .eq("tenant_id", tenantId)
      .in("id", versionIds)
      .eq("review_status", "VERIFIED_CORRECT");

    if (vErr || !versions) {
      return { eligibleCandidates: [] };
    }

    const versionMap = new Map<string, any>();
    versions.forEach((v: any) => versionMap.set(v.id, v));

    const eligibleCandidates: Array<{
      question: any;
      version: any;
      bank: any;
      normalizedSubject: string;
    }> = [];

    for (const q of unexcludedQuestions) {
      const v = q.current_version_id ? versionMap.get(q.current_version_id) : null;
      if (!v) continue; // Must be verified correct

      if (options.topic) {
        const topicClean = options.topic.trim().toLowerCase();
        const tags = (v.topic_tags || []).map((t: string) => String(t).toLowerCase());
        if (!tags.includes(topicClean)) continue;
      }

      const bank = bankMap.get(q.bank_id);
      if (!bank) continue;

      const normSub = normalizeSubjectName(bank.subject || bank.name);
      eligibleCandidates.push({
        question: q,
        version: v,
        bank,
        normalizedSubject: normSub,
      });
    }

    return { eligibleCandidates };
  }

  /**
   * Pre-flight availability check for Auto-Build.
   * Compares requested question criteria against the real eligible inventory.
   * Enforces exact difficulty and subject compositions without silent substitution.
   */
  public static async checkAutoBuildAvailability(
    tenantId: string,
    criteria: AutoBuildCriteria
  ): Promise<AutoBuildAvailabilityResult> {
    if (!criteria.subjects || !Array.isArray(criteria.subjects) || criteria.subjects.length === 0) {
      return {
        isSatisfiable: false,
        totalRequested: 0,
        totalAvailable: 0,
        totalShortage: 0,
        subjects: [],
        shortageMessages: ["At least one subject with a question count is required."],
        error: "At least one subject with a question count is required.",
      };
    }

    // Validate subject counts
    for (const sub of criteria.subjects) {
      if (typeof sub.count !== "number" || sub.count <= 0) {
        return {
          isSatisfiable: false,
          totalRequested: 0,
          totalAvailable: 0,
          totalShortage: 0,
          subjects: [],
          shortageMessages: [
            `Subject '${sub.subject}' must have a positive question count requested.`,
          ],
          error: `Subject '${sub.subject}' must have a positive question count requested.`,
        };
      }
    }

    const totalSubjectCount = criteria.subjects.reduce((acc, s) => acc + (s.count || 0), 0);
    if (
      typeof (criteria as any).totalCount === "number" &&
      (criteria as any).totalCount !== totalSubjectCount
    ) {
      return {
        isSatisfiable: false,
        totalRequested: totalSubjectCount,
        totalAvailable: 0,
        totalShortage: 0,
        subjects: [],
        shortageMessages: [
          `Subject question counts (${totalSubjectCount}) do not add up to the requested total of ${(criteria as any).totalCount}.`,
        ],
        error: `Subject question counts (${totalSubjectCount}) do not add up to the requested total of ${(criteria as any).totalCount}.`,
      };
    }

    // Pre-validate difficulty distribution
    if (criteria.difficultyDistribution) {
      const valRes = calculateDifficultyCounts(
        100,
        criteria.difficultyDistribution,
        criteria.distributionMode || "PERCENTAGE"
      );
      if (valRes.error) {
        return {
          isSatisfiable: false,
          totalRequested: totalSubjectCount,
          totalAvailable: 0,
          totalShortage: 0,
          subjects: [],
          shortageMessages: [valRes.error],
          error: valRes.error,
        };
      }
    }

    const { eligibleCandidates } = await this.getEligibleCandidatePool(tenantId, {
      bankId: criteria.bankId,
      topic: criteria.topic,
      questionType: criteria.questionType,
      excludeSetId: criteria.excludeSetId,
      excludeQuestionIds: criteria.excludeQuestionIds,
    });

    const subjectResults: SubjectAvailabilityResult[] = [];
    const shortageMessages: string[] = [];
    let totalRequested = 0;
    let totalAvailable = 0;
    let totalShortage = 0;

    for (const reqSub of criteria.subjects) {
      const normReq = normalizeSubjectName(reqSub.subject);
      const matching = eligibleCandidates.filter(
        (c) => c.normalizedSubject.toLowerCase() === normReq.toLowerCase()
      );

      const byDifficulty = {
        EASY: matching.filter((c) => c.version.difficulty === "EASY").length,
        MEDIUM: matching.filter((c) => c.version.difficulty === "MEDIUM").length,
        HARD: matching.filter((c) => c.version.difficulty === "HARD").length,
      };

      const requested = reqSub.count || 0;
      totalRequested += requested;
      totalAvailable += matching.length;

      let subjectShortage = 0;
      let requestedByDifficulty: { EASY: number; MEDIUM: number; HARD: number } | undefined;
      let difficultyShortage: { EASY: number; MEDIUM: number; HARD: number } | undefined;

      if (criteria.difficultyDistribution) {
        const diffCalc = calculateDifficultyCounts(
          requested,
          criteria.difficultyDistribution,
          criteria.distributionMode || "PERCENTAGE"
        );

        if (diffCalc.counts) {
          requestedByDifficulty = diffCalc.counts;
          const sEasy = Math.max(0, diffCalc.counts.EASY - byDifficulty.EASY);
          const sMed = Math.max(0, diffCalc.counts.MEDIUM - byDifficulty.MEDIUM);
          const sHard = Math.max(0, diffCalc.counts.HARD - byDifficulty.HARD);
          difficultyShortage = { EASY: sEasy, MEDIUM: sMed, HARD: sHard };

          const diffShortageSum = sEasy + sMed + sHard;
          const countShortage = Math.max(0, requested - matching.length);
          subjectShortage = Math.max(diffShortageSum, countShortage);

          if (sHard > 0) {
            shortageMessages.push(
              `Your requested test needs ${diffCalc.counts.HARD} Hard questions for ${normReq}, but only ${byDifficulty.HARD} eligible questions are available. You need ${sHard} more Hard question${sHard === 1 ? "" : "s"} or must adjust the composition.`
            );
          }
          if (sMed > 0) {
            shortageMessages.push(
              `Your requested test needs ${diffCalc.counts.MEDIUM} Medium questions for ${normReq}, but only ${byDifficulty.MEDIUM} eligible questions are available. You need ${sMed} more Medium question${sMed === 1 ? "" : "s"} or must adjust the composition.`
            );
          }
          if (sEasy > 0) {
            shortageMessages.push(
              `Your requested test needs ${diffCalc.counts.EASY} Easy questions for ${normReq}, but only ${byDifficulty.EASY} eligible questions are available. You need ${sEasy} more Easy question${sEasy === 1 ? "" : "s"} or must adjust the composition.`
            );
          }
        }
      } else {
        subjectShortage = Math.max(0, requested - matching.length);
        if (subjectShortage > 0) {
          shortageMessages.push(
            `Not enough eligible questions for ${normReq}: requested ${requested}, available ${matching.length} (shortage of ${subjectShortage} question${subjectShortage === 1 ? "" : "s"}).`
          );
        }
      }

      totalShortage += subjectShortage;

      subjectResults.push({
        subject: normReq,
        requested,
        available: matching.length,
        shortage: subjectShortage,
        byDifficulty,
        requestedByDifficulty,
        difficultyShortage,
      });
    }

    const isSatisfiable = totalShortage === 0;

    return {
      isSatisfiable,
      totalRequested,
      totalAvailable,
      totalShortage,
      subjects: subjectResults,
      shortageMessages,
    };
  }

  /**
   * Generates a randomized preview of questions matching criteria using bounded sampling.
   * Strictly enforces exact difficulty and subject quotas without silent backfill or substitutions.
   */
  public static async generateAutoBuildPreview(
    tenantId: string,
    criteria: AutoBuildCriteria
  ): Promise<AutoBuildPreviewResult> {
    const availability = await this.checkAutoBuildAvailability(tenantId, criteria);

    if (!availability.isSatisfiable) {
      return {
        success: false,
        previewItems: [],
        summary: {
          totalQuestions: 0,
          totalPoints: 0,
          subjectCounts: {},
          difficultyCounts: {},
          typeCounts: {},
        },
        availability,
        error: `Insufficient eligible question inventory: ${availability.shortageMessages.join(" ")}`,
      };
    }

    const { eligibleCandidates } = await this.getEligibleCandidatePool(tenantId, {
      bankId: criteria.bankId,
      topic: criteria.topic,
      questionType: criteria.questionType,
      excludeSetId: criteria.excludeSetId,
      excludeQuestionIds: criteria.excludeQuestionIds,
    });

    const previewItems: AutoBuildPreviewItem[] = [];
    const defaultPts =
      typeof criteria.defaultPoints === "number" && criteria.defaultPoints > 0
        ? criteria.defaultPoints
        : 1.0;

    for (const reqSub of criteria.subjects) {
      const normReq = normalizeSubjectName(reqSub.subject);
      const matching = eligibleCandidates.filter(
        (c) => c.normalizedSubject.toLowerCase() === normReq.toLowerCase()
      );

      const targetCount = reqSub.count || 0;
      let selectedForSubject: typeof matching = [];

      if (criteria.difficultyDistribution) {
        const diffCalc = calculateDifficultyCounts(
          targetCount,
          criteria.difficultyDistribution,
          criteria.distributionMode || "PERCENTAGE"
        );

        if (!diffCalc.counts) {
          return {
            success: false,
            previewItems: [],
            summary: {
              totalQuestions: 0,
              totalPoints: 0,
              subjectCounts: {},
              difficultyCounts: {},
              typeCounts: {},
            },
            availability,
            error: diffCalc.error || "Invalid difficulty distribution.",
          };
        }

        const reqCounts = diffCalc.counts;
        const easyPool = shuffleArray(matching.filter((c) => c.version.difficulty === "EASY"));
        const medPool = shuffleArray(matching.filter((c) => c.version.difficulty === "MEDIUM"));
        const hardPool = shuffleArray(matching.filter((c) => c.version.difficulty === "HARD"));

        const chosenEasy = easyPool.slice(0, reqCounts.EASY);
        const chosenMed = medPool.slice(0, reqCounts.MEDIUM);
        const chosenHard = hardPool.slice(0, reqCounts.HARD);

        if (
          chosenEasy.length !== reqCounts.EASY ||
          chosenMed.length !== reqCounts.MEDIUM ||
          chosenHard.length !== reqCounts.HARD
        ) {
          return {
            success: false,
            previewItems: [],
            summary: {
              totalQuestions: 0,
              totalPoints: 0,
              subjectCounts: {},
              difficultyCounts: {},
              typeCounts: {},
            },
            availability,
            error: `Cannot satisfy exact difficulty distribution for ${normReq}. Missing questions without silent substitution.`,
          };
        }

        selectedForSubject = [...chosenEasy, ...chosenMed, ...chosenHard];
        // Composition invariant: NO SILENT SUBSTITUTION OR PROPORTIONAL FALLBACK
      } else {
        selectedForSubject = shuffleArray(matching).slice(0, targetCount);
        if (selectedForSubject.length < targetCount) {
          return {
            success: false,
            previewItems: [],
            summary: {
              totalQuestions: 0,
              totalPoints: 0,
              subjectCounts: {},
              difficultyCounts: {},
              typeCounts: {},
            },
            availability,
            error: `Insufficient eligible questions for ${normReq}: requested ${targetCount}, got ${selectedForSubject.length}.`,
          };
        }
      }

      for (const item of selectedForSubject) {
        previewItems.push({
          question_id: item.question.id,
          version_id: item.version.id,
          prompt: item.version.prompt,
          bank_id: item.bank.id,
          bank_name: item.bank.name,
          subject: item.normalizedSubject,
          topic_tags: item.version.topic_tags || [],
          question_type: item.question.question_type,
          difficulty: item.version.difficulty,
          points: defaultPts,
        });
      }
    }

    const subjectCounts: Record<string, number> = {};
    const difficultyCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    let totalPoints = 0;

    for (const item of previewItems) {
      subjectCounts[item.subject] = (subjectCounts[item.subject] || 0) + 1;
      difficultyCounts[item.difficulty] = (difficultyCounts[item.difficulty] || 0) + 1;
      typeCounts[item.question_type] = (typeCounts[item.question_type] || 0) + 1;
      totalPoints += item.points;
    }

    return {
      success: true,
      previewItems,
      summary: {
        totalQuestions: previewItems.length,
        totalPoints,
        subjectCounts,
        difficultyCounts,
        typeCounts,
      },
      availability,
    };
  }

  /**
   * Replaces an unwanted question in the Auto-Build preview with another eligible question.
   * Strictly preserves question difficulty so test balance is never altered.
   */
  public static async swapPreviewItem(
    tenantId: string,
    params: {
      currentQuestionId: string;
      subject: string;
      difficulty?: QuestionDifficulty;
      questionType?: QuestionType;
      alreadySelectedIds: string[];
    }
  ): Promise<{ success: boolean; replacement?: AutoBuildPreviewItem; error?: string }> {
    const { eligibleCandidates } = await this.getEligibleCandidatePool(tenantId, {
      questionType: params.questionType,
      excludeQuestionIds: params.alreadySelectedIds,
    });

    const normSub = normalizeSubjectName(params.subject);
    const matching = eligibleCandidates.filter(
      (c) =>
        c.normalizedSubject.toLowerCase() === normSub.toLowerCase() &&
        c.question.id !== params.currentQuestionId
    );

    if (matching.length === 0) {
      return {
        success: false,
        error: `No alternative eligible questions found for subject '${normSub}'.`,
      };
    }

    // Match exact difficulty if specified — never silently substitute a different difficulty
    let candidates = matching;
    if (params.difficulty) {
      candidates = matching.filter((c) => c.version.difficulty === params.difficulty);
      if (candidates.length === 0) {
        return {
          success: false,
          error: `No alternative eligible questions found for subject '${normSub}' with difficulty '${params.difficulty}'. Swap cancelled to preserve exact test difficulty distribution.`,
        };
      }
    }

    const replacementChoice = shuffleArray(candidates)[0];

    return {
      success: true,
      replacement: {
        question_id: replacementChoice.question.id,
        version_id: replacementChoice.version.id,
        prompt: replacementChoice.version.prompt,
        bank_id: replacementChoice.bank.id,
        bank_name: replacementChoice.bank.name,
        subject: replacementChoice.normalizedSubject,
        topic_tags: replacementChoice.version.topic_tags || [],
        question_type: replacementChoice.question.question_type,
        difficulty: replacementChoice.version.difficulty,
        points: 1.0,
      },
    };
  }

  /**
   * Commits the reviewed Auto-Build question selection into a new or existing Question Set.
   */
  public static async commitAutoBuildSet(
    tenantId: string,
    userId: string,
    params: {
      targetType: "NEW_SET" | "EXISTING_SET";
      setId?: string;
      setName?: string;
      setDescription?: string;
      purpose?: QuestionSetPurpose;
      items: Array<{
        question_id: string;
        version_id: string;
        points: number;
        sequence_order?: number;
      }>;
    }
  ): Promise<{
    success: boolean;
    set?: any;
    addedCount: number;
    skippedCount: number;
    error?: string;
  }> {
    let targetSetId = params.setId;
    let targetSet: any = null;

    if (params.targetType === "NEW_SET") {
      const cleanName = (params.setName || "").trim();
      if (!cleanName) {
        return {
          success: false,
          addedCount: 0,
          skippedCount: 0,
          error: "Question Set name is required.",
        };
      }

      const { data: newSet, error: cErr } = await this.createSet(tenantId, userId, {
        name: cleanName,
        description: params.setDescription,
        purpose: params.purpose || "ASSESSMENT",
      });

      if (cErr || !newSet) {
        return {
          success: false,
          addedCount: 0,
          skippedCount: 0,
          error: cErr?.message || "Failed to create Question Set.",
        };
      }

      targetSetId = newSet.id;
      targetSet = newSet;
    } else {
      if (!targetSetId) {
        return {
          success: false,
          addedCount: 0,
          skippedCount: 0,
          error: "Existing Question Set ID is required.",
        };
      }

      const supabase = await createServerSupabaseClient();
      const { data: existingSet, error: sErr } = await supabase
        .from("question_sets")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", targetSetId)
        .single();

      if (sErr || !existingSet) {
        return {
          success: false,
          addedCount: 0,
          skippedCount: 0,
          error: "Target Question Set not found or does not belong to your institution.",
        };
      }

      if (existingSet.is_locked) {
        return {
          success: false,
          addedCount: 0,
          skippedCount: 0,
          error: "Cannot add questions to a locked Question Set snapshot.",
        };
      }

      targetSet = existingSet;
    }

    const addRes = await this.addItemsToSet(
      tenantId,
      targetSetId!,
      params.items.map((item, idx) => ({
        question_id: item.question_id,
        version_id: item.version_id,
        points: item.points,
        sequence_order: item.sequence_order || idx + 1,
      }))
    );

    if (!addRes.success) {
      return {
        success: false,
        addedCount: 0,
        skippedCount: 0,
        error: addRes.error || "Failed to add previewed questions to set.",
      };
    }

    return {
      success: true,
      set: targetSet,
      addedCount: addRes.addedCount,
      skippedCount: addRes.skippedCount || 0,
    };
  }

  /**
   * Retrieves eligible questions with bank/subject metadata and already-in-set detection for Bulk Add.
   */
  public static async getEligibleQuestionsForBulkAdd(
    tenantId: string,
    options: {
      bankId?: string;
      subject?: string;
      topic?: string;
      questionType?: QuestionType;
      difficulty?: QuestionDifficulty;
      search?: string;
      excludeSetId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    questions: Array<{
      id: string;
      bank_id: string;
      bank_name: string;
      subject: string;
      question_type: QuestionType;
      difficulty: QuestionDifficulty;
      prompt: string;
      topic_tags: string[];
      version_id: string;
      alreadyInSet: boolean;
    }>;
    total: number;
    alreadyInSetCount: number;
  }> {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch Banks
    let bankQuery = supabase
      .from("question_banks")
      .select("id, name, category")
      .eq("tenant_id", tenantId);

    if (options.bankId) {
      bankQuery = bankQuery.eq("id", options.bankId);
    }

    const { data: banks } = await bankQuery;
    const bankMap = new Map<string, any>();
    (banks || []).forEach((b: any) =>
      bankMap.set(b.id, {
        ...b,
        subject: b.subject || b.name || b.category,
      })
    );
    const bankIds = (banks || []).map((b: any) => b.id);

    if (bankIds.length === 0) {
      return { questions: [], total: 0, alreadyInSetCount: 0 };
    }

    // 2. Fetch existing question IDs in current set if excludeSetId is provided
    const setQuestionIds = new Set<string>();
    if (options.excludeSetId) {
      const { data: setItems } = await supabase
        .from("question_set_items")
        .select("question_id")
        .eq("tenant_id", tenantId)
        .eq("set_id", options.excludeSetId);

      (setItems || []).forEach((it: any) => setQuestionIds.add(it.question_id));
    }

    // 3. Query questions with APPROVED or PUBLISHED lifecycle
    let qQuery = supabase
      .from("questions")
      .select("id, bank_id, question_type, current_version_id, lifecycle_status, created_at")
      .eq("tenant_id", tenantId)
      .in("bank_id", bankIds)
      .in("lifecycle_status", ["APPROVED", "PUBLISHED"]);

    if (options.questionType) {
      qQuery = qQuery.eq("question_type", options.questionType);
    }

    const { data: questions } = await qQuery;
    const candidateQuestions = questions || [];
    if (candidateQuestions.length === 0) {
      return { questions: [], total: 0, alreadyInSetCount: 0 };
    }

    // 4. Fetch versions where review_status === "VERIFIED_CORRECT"
    const versionIds = candidateQuestions
      .map((q: any) => q.current_version_id)
      .filter((id: string): id is string => Boolean(id));

    let vQuery = supabase
      .from("question_versions")
      .select("id, question_id, prompt, difficulty, topic_tags, review_status")
      .eq("tenant_id", tenantId)
      .in("id", versionIds)
      .eq("review_status", "VERIFIED_CORRECT");

    if (options.difficulty) {
      vQuery = vQuery.eq("difficulty", options.difficulty);
    }
    if (options.search) {
      vQuery = vQuery.ilike("prompt", `%${options.search.trim()}%`);
    }

    const { data: versions } = await vQuery;
    const versionMap = new Map<string, any>();
    (versions || []).forEach((v: any) => versionMap.set(v.id, v));

    let formatted: Array<{
      id: string;
      bank_id: string;
      bank_name: string;
      subject: string;
      question_type: QuestionType;
      difficulty: QuestionDifficulty;
      prompt: string;
      topic_tags: string[];
      version_id: string;
      alreadyInSet: boolean;
    }> = [];

    let alreadyInSetCount = 0;

    for (const q of candidateQuestions) {
      const v = q.current_version_id ? versionMap.get(q.current_version_id) : null;
      if (!v) continue; // Not verified or didn't match difficulty/search

      const bank = bankMap.get(q.bank_id);
      if (!bank) continue;

      const normSub = normalizeSubjectName(bank.subject || bank.name);

      // Subject filter
      if (options.subject) {
        const normFilter = normalizeSubjectName(options.subject);
        if (normSub.toLowerCase() !== normFilter.toLowerCase()) {
          continue;
        }
      }

      // Topic tag filter
      if (options.topic) {
        const cleanTopic = options.topic.trim().toLowerCase();
        const tags = (v.topic_tags || []).map((t: string) => String(t).toLowerCase());
        if (!tags.includes(cleanTopic)) {
          continue;
        }
      }

      const alreadyIn = setQuestionIds.has(q.id);
      if (alreadyIn) alreadyInSetCount++;

      formatted.push({
        id: q.id,
        bank_id: bank.id,
        bank_name: bank.name,
        subject: normSub,
        question_type: q.question_type,
        difficulty: v.difficulty,
        prompt: v.prompt,
        topic_tags: v.topic_tags || [],
        version_id: v.id,
        alreadyInSet: alreadyIn,
      });
    }

    const total = formatted.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const paginated = formatted.slice(offset, offset + limit);

    return {
      questions: paginated,
      total,
      alreadyInSetCount,
    };
  }
}
