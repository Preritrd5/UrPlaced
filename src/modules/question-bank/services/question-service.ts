/**
-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- QuestionBank Sentinel: Core Question & Versioning Service
-- ==============================================================================
*/

import {
  QuestionType,
  QuestionDifficulty,
  QuestionLifecycleStatus,
  QuestionSourceType,
  QuestionLicenseType,
  AnswerKeyReviewStatus,
  BankCategory,
  BankSharingPolicy,
} from "@/types/database";
import { QuestionValidator, McqOption, CodingAnswerKey } from "./question-validator";
import { DuplicateDetector } from "./duplicate-detector";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CreateQuestionInput {
  bank_id: string;
  question_type: QuestionType;
  prompt: string;
  difficulty?: QuestionDifficulty;
  options?: McqOption[];
  answer_key: Record<string, unknown>;
  explanation?: string | null;
  skill_id?: string | null;
  topic_tags?: string[];
  source_type?: QuestionSourceType;
  source_reference?: string | null;
  license_type?: QuestionLicenseType;
}

export interface UpdateQuestionInput {
  prompt?: string;
  difficulty?: QuestionDifficulty;
  options?: McqOption[];
  answer_key?: Record<string, unknown>;
  explanation?: string | null;
  skill_id?: string | null;
  topic_tags?: string[];
  source_type?: QuestionSourceType;
  source_reference?: string | null;
  license_type?: QuestionLicenseType;
  change_summary?: string;
}

export class QuestionService {
  /**
   * Sanitizes question content for student consumption (hides answer keys & hidden test cases).
   */
  public static sanitizeForStudent<T extends { answer_key?: unknown; explanation?: string | null }>(
    version: T,
    questionType?: QuestionType
  ): Omit<T, "answer_key" | "explanation"> & {
    answer_key?: unknown;
    explanation?: string | null;
  } {
    const copy = { ...version };
    // Completely omit explanation for unattempted questions
    delete copy.explanation;

    if (questionType === "CODING" && copy.answer_key && typeof copy.answer_key === "object") {
      const codingKey = copy.answer_key as CodingAnswerKey;
      // Keep only public test cases and starter templates
      copy.answer_key = {
        language_templates: codingKey.language_templates || {},
        test_cases: (codingKey.test_cases || [])
          .filter((tc) => !tc.is_hidden)
          .map((tc) => ({
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: false,
            explanation: tc.explanation,
          })),
      };
    } else {
      // For all choice, numeric, short answer: completely remove answer key
      delete copy.answer_key;
    }

    return copy;
  }

  /**
   * Creates a new question container and its initial immutable version 1.
   */
  public static async createQuestion(
    tenantId: string,
    userId: string,
    input: CreateQuestionInput
  ): Promise<{
    success: boolean;
    questionId?: string;
    versionId?: string;
    warnings?: string[];
    duplicateAlertCount?: number;
    error?: string;
  }> {
    // 1. Structural Validation
    const validation = QuestionValidator.validate({
      question_type: input.question_type,
      prompt: input.prompt,
      difficulty: input.difficulty,
      options: input.options,
      answer_key: input.answer_key,
      explanation: input.explanation,
    });

    if (!validation.isValid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join("; ")}`,
      };
    }

    const supabase = await createServerSupabaseClient();

    // 2. Compute Content Fingerprint & Scan for Duplicates
    const fingerprint = DuplicateDetector.generateFingerprint(
      input.prompt,
      input.options
    );

    const { data: existingVersions } = await supabase
      .from("question_versions")
      .select("question_id, id, prompt, fingerprint")
      .eq("tenant_id", tenantId)
      .limit(200);

    const dupCheck = DuplicateDetector.detectDuplicates(
      input.prompt,
      fingerprint,
      (existingVersions || []).map((v: any) => ({
        questionId: v.question_id,
        versionId: v.id,
        prompt: v.prompt,
        fingerprint: v.fingerprint,
      }))
    );

    // 3. Insert Question Identity
    const { data: qData, error: qErr } = await supabase
      .from("questions")
      .insert({
        tenant_id: tenantId,
        bank_id: input.bank_id,
        question_type: input.question_type,
        lifecycle_status: "DRAFT",
      })
      .select("id")
      .single();

    if (qErr || !qData) {
      return { success: false, error: qErr?.message || "Failed to create question." };
    }

    // 4. Insert Question Version 1
    const { data: vData, error: vErr } = await supabase
      .from("question_versions")
      .insert({
        tenant_id: tenantId,
        question_id: qData.id,
        version_number: 1,
        prompt: input.prompt,
        content_format: "MARKDOWN",
        options: (input.options || []) as unknown as Record<string, unknown>[],
        answer_key: input.answer_key,
        explanation: input.explanation || null,
        difficulty: input.difficulty || "MEDIUM",
        skill_id: input.skill_id || null,
        topic_tags: input.topic_tags || [],
        source_type: input.source_type || "COLLEGE_AUTHORED",
        source_reference: input.source_reference || null,
        license_type: input.license_type || "PROPRIETARY",
        review_status: "UNREVIEWED",
        fingerprint,
        change_summary: "Initial version created",
        created_by: userId,
      })
      .select("id")
      .single();

    if (vErr || !vData) {
      return { success: false, error: vErr?.message || "Failed to create question version." };
    }

    // 5. Connect circular pointer
    await supabase
      .from("questions")
      .update({ current_version_id: vData.id })
      .eq("id", qData.id);

    // 6. Record duplicate candidate matches if found
    let duplicateAlertCount = 0;
    if (dupCheck.candidates.length > 0) {
      for (const cand of dupCheck.candidates) {
        if (cand.questionId !== qData.id) {
          duplicateAlertCount++;
          await supabase.from("question_duplicate_candidates").insert({
            tenant_id: tenantId,
            source_question_id: qData.id,
            matched_question_id: cand.questionId,
            similarity_score: cand.similarityScore,
            detection_method: cand.detectionMethod,
            status: "PENDING_REVIEW",
          });
        }
      }
    }

    return {
      success: true,
      questionId: qData.id,
      versionId: vData.id,
      warnings: [
        ...validation.warnings,
        ...(dupCheck.isExactDuplicate ? ["Warning: An exact duplicate already exists in this college bank!"] : []),
        ...(dupCheck.highestSimilarity >= 0.85 && !dupCheck.isExactDuplicate
          ? [`Warning: Highly similar question found (${Math.round(dupCheck.highestSimilarity * 100)}% match).`]
          : []),
      ],
      duplicateAlertCount,
    };
  }

  /**
   * Updates an existing question.
   * If published or referenced in an assessment, an immutable new version is spawned!
   */
  public static async updateQuestion(
    tenantId: string,
    userId: string,
    questionId: string,
    input: UpdateQuestionInput
  ): Promise<{
    success: boolean;
    versionId?: string;
    versionNumber?: number;
    error?: string;
  }> {
    const supabase = await createServerSupabaseClient();

    // Fetch question and current version
    const { data: question, error: qErr } = await supabase
      .from("questions")
      .select("id, question_type, lifecycle_status, current_version_id")
      .eq("tenant_id", tenantId)
      .eq("id", questionId)
      .single();

    if (qErr || !question) {
      return { success: false, error: "Question not found." };
    }

    const { data: currentVersion, error: vErr } = await supabase
      .from("question_versions")
      .select("*")
      .eq("id", question.current_version_id || "")
      .single();

    if (vErr || !currentVersion) {
      return { success: false, error: "Current version not found." };
    }

    // Merge updated fields with existing version
    const updatedPrompt = input.prompt !== undefined ? input.prompt : currentVersion.prompt;
    const updatedDifficulty = input.difficulty !== undefined ? input.difficulty : currentVersion.difficulty;
    const updatedOptions = input.options !== undefined ? input.options : (currentVersion.options as McqOption[]);
    const updatedAnswerKey = input.answer_key !== undefined ? input.answer_key : (currentVersion.answer_key as Record<string, unknown>);
    const updatedExplanation = input.explanation !== undefined ? input.explanation : currentVersion.explanation;
    const updatedSkillId = input.skill_id !== undefined ? input.skill_id : currentVersion.skill_id;
    const updatedTags = input.topic_tags !== undefined ? input.topic_tags : currentVersion.topic_tags;
    const updatedSourceType = input.source_type !== undefined ? input.source_type : currentVersion.source_type;
    const updatedSourceRef = input.source_reference !== undefined ? input.source_reference : currentVersion.source_reference;
    const updatedLicense = input.license_type !== undefined ? input.license_type : currentVersion.license_type;

    // Validate
    const validation = QuestionValidator.validate({
      question_type: question.question_type,
      prompt: updatedPrompt,
      difficulty: updatedDifficulty,
      options: updatedOptions,
      answer_key: updatedAnswerKey,
      explanation: updatedExplanation,
    });

    if (!validation.isValid) {
      return { success: false, error: `Validation failed: ${validation.errors.join("; ")}` };
    }

    // Check if referenced in any question sets
    const { count: refCount } = await supabase
      .from("question_set_items")
      .select("id", { count: "exact", head: true })
      .eq("version_id", currentVersion.id);

    const isLockedOrPublished = question.lifecycle_status === "PUBLISHED" || (refCount || 0) > 0;

    const newFingerprint = DuplicateDetector.generateFingerprint(updatedPrompt, updatedOptions);

    if (isLockedOrPublished) {
      // Invariant: MUST create a new version to guarantee immutability for existing assessments!
      const newVersionNum = currentVersion.version_number + 1;

      const { data: newV, error: insErr } = await supabase
        .from("question_versions")
        .insert({
          tenant_id: tenantId,
          question_id: questionId,
          version_number: newVersionNum,
          prompt: updatedPrompt,
          content_format: "MARKDOWN",
          options: updatedOptions as unknown as Record<string, unknown>[],
          answer_key: updatedAnswerKey,
          explanation: updatedExplanation,
          difficulty: updatedDifficulty,
          skill_id: updatedSkillId,
          topic_tags: updatedTags,
          source_type: updatedSourceType,
          source_reference: updatedSourceRef,
          license_type: updatedLicense,
          review_status: "UNREVIEWED", // Re-review required for modified questions
          fingerprint: newFingerprint,
          change_summary: input.change_summary || `Revision created (v${newVersionNum})`,
          created_by: userId,
        })
        .select("id")
        .single();

      if (insErr || !newV) {
        return { success: false, error: insErr?.message || "Failed to create new version." };
      }

      // Update question's current version and set status to PENDING_REVIEW
      await supabase
        .from("questions")
        .update({
          current_version_id: newV.id,
          lifecycle_status: "PENDING_REVIEW",
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionId);

      return {
        success: true,
        versionId: newV.id,
        versionNumber: newVersionNum,
      };
    } else {
      // Draft question not yet published or referenced: update in place
      const { error: upErr } = await supabase
        .from("question_versions")
        .update({
          prompt: updatedPrompt,
          difficulty: updatedDifficulty,
          options: updatedOptions as unknown as Record<string, unknown>[],
          answer_key: updatedAnswerKey,
          explanation: updatedExplanation,
          skill_id: updatedSkillId,
          topic_tags: updatedTags,
          source_type: updatedSourceType,
          source_reference: updatedSourceRef,
          license_type: updatedLicense,
          fingerprint: newFingerprint,
          change_summary: input.change_summary || "Updated draft version",
        })
        .eq("id", currentVersion.id);

      if (upErr) {
        return { success: false, error: upErr.message };
      }

      await supabase
        .from("questions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", questionId);

      return {
        success: true,
        versionId: currentVersion.id,
        versionNumber: currentVersion.version_number,
      };
    }
  }

  /**
   * Submits or reviews an answer key with full audit trail.
   */
  public static async verifyAnswerKey(
    tenantId: string,
    userId: string,
    questionId: string,
    versionId: string,
    status: AnswerKeyReviewStatus,
    reviewNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { error: upErr } = await supabase
      .from("question_versions")
      .update({
        review_status: status,
        review_notes: reviewNotes || null,
        reviewed_by: userId,
      })
      .eq("tenant_id", tenantId)
      .eq("id", versionId)
      .eq("question_id", questionId);

    if (upErr) {
      return { success: false, error: upErr.message };
    }

    // If verified correct, promote question lifecycle to APPROVED
    if (status === "VERIFIED_CORRECT") {
      await supabase
        .from("questions")
        .update({
          lifecycle_status: "APPROVED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionId)
        .eq("tenant_id", tenantId);
    } else if (status === "NEEDS_REVISION" || status === "REJECTED") {
      await supabase
        .from("questions")
        .update({
          lifecycle_status: "DRAFT",
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionId)
        .eq("tenant_id", tenantId);
    }

    return { success: true };
  }

  /**
   * Publishes an approved question making it usable in assessments.
   * Invariant: Requires verified answer key!
   */
  public static async publishQuestion(
    tenantId: string,
    userId: string,
    questionId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data: qData, error: qErr } = await supabase
      .from("questions")
      .select("id, current_version_id, lifecycle_status")
      .eq("tenant_id", tenantId)
      .eq("id", questionId)
      .single();

    if (qErr || !qData) {
      return { success: false, error: "Question not found." };
    }

    if (!qData.current_version_id) {
      return { success: false, error: "Question has no version to publish." };
    }

    const { data: vData, error: vErr } = await supabase
      .from("question_versions")
      .select("review_status")
      .eq("id", qData.current_version_id)
      .single();

    if (vErr || !vData) {
      return { success: false, error: "Current version not found." };
    }

    if (vData.review_status !== "VERIFIED_CORRECT") {
      return {
        success: false,
        error: `Cannot publish question: Answer key has review status '${vData.review_status}'. It must be 'VERIFIED_CORRECT' before publishing.`,
      };
    }

    const now = new Date().toISOString();
    await supabase
      .from("question_versions")
      .update({ published_at: now })
      .eq("id", qData.current_version_id);

    const { error: pErr } = await supabase
      .from("questions")
      .update({
        lifecycle_status: "PUBLISHED",
        updated_at: now,
      })
      .eq("id", questionId);

    if (pErr) {
      return { success: false, error: pErr.message };
    }

    return { success: true };
  }

  /**
   * Withdraws or Archives a question without destroying historical assessment references.
   */
  public static async updateLifecycle(
    tenantId: string,
    questionId: string,
    newStatus: "WITHDRAWN" | "ARCHIVED" | "PENDING_REVIEW"
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from("questions")
      .update({
        lifecycle_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", questionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Permanently deletes an unreferenced draft question and its versions.
   * Invariant: Approved and Published questions cannot be deleted to protect historical tests.
   */
  public static async deleteQuestion(
    tenantId: string,
    questionId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch question to verify tenant and lifecycle
    const { data: q, error: qErr } = await supabase
      .from("questions")
      .select("id, lifecycle_status")
      .eq("tenant_id", tenantId)
      .eq("id", questionId)
      .single();

    if (qErr || !q) {
      return { success: false, error: "Question not found." };
    }

    // 2. Invariant: Only DRAFT questions can be permanently removed
    if (q.lifecycle_status !== "DRAFT") {
      return {
        success: false,
        error: "Only draft questions can be permanently deleted. Use Archive or Withdraw for approved or published questions to preserve assessment audit integrity.",
      };
    }

    // 3. Invariant: Cannot delete if referenced in any Question Set
    const { count: setRefCount } = await supabase
      .from("question_set_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("question_id", questionId);

    if (setRefCount && setRefCount > 0) {
      return {
        success: false,
        error: "Cannot delete question because it is referenced in one or more question sets.",
      };
    }

    // 4. Clean up duplicates index if present
    try {
      await supabase
        .from("question_duplicates")
        .delete()
        .eq("tenant_id", tenantId)
        .or(`original_question_id.eq.${questionId},duplicate_question_id.eq.${questionId}`);
    } catch {
      // Ignore if table/index not active
    }

    // 5. Delete versions first
    const { error: vErr } = await supabase
      .from("question_versions")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("question_id", questionId);

    if (vErr) {
      return { success: false, error: vErr.message };
    }

    // 6. Delete question row
    const { error: delErr } = await supabase
      .from("questions")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", questionId);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    return { success: true };
  }

  /**
   * Retrieves a question by ID with its bank and all versions.
   * Performs unambiguous multi-query fetching to prevent PostgREST embedding errors.
   */
  public static async getQuestionById(
    tenantId: string,
    userRole: string,
    questionId: string,
    isPlatformAdmin: boolean = false
  ): Promise<{ data: any | null; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const admin = createAdminClient();

    // 1. Fetch Question Identity
    let { data: question } = await supabase
      .from("questions")
      .select("id, tenant_id, bank_id, question_type, current_version_id, lifecycle_status, created_at, updated_at")
      .eq("id", questionId)
      .maybeSingle();

    // Fallback to admin client if RLS or session timing causes maybeSingle to be empty
    if (!question && admin) {
      const { data: adminQ } = await admin
        .from("questions")
        .select("id, tenant_id, bank_id, question_type, current_version_id, lifecycle_status, created_at, updated_at")
        .eq("id", questionId)
        .maybeSingle();

      if (adminQ) {
        question = adminQ;
      }
    }

    if (!question) {
      return { data: null, error: "Question not found." };
    }

    // Tenant boundary check: unless platform admin, must match tenantId
    if (!isPlatformAdmin && tenantId && question.tenant_id !== tenantId) {
      return { data: null, error: "Question not found." };
    }

    // Role check: Students can only view published questions
    if (userRole === "STUDENT" && question.lifecycle_status !== "PUBLISHED") {
      return { data: null, error: "Access denied." };
    }

    // 2. Fetch Bank
    let bank = null;
    if (question.bank_id) {
      let bRes = await supabase
        .from("question_banks")
        .select("id, name, category, sharing_policy")
        .eq("id", question.bank_id)
        .maybeSingle();

      if (!bRes?.data && admin) {
        bRes = await admin
          .from("question_banks")
          .select("id, name, category, sharing_policy")
          .eq("id", question.bank_id)
          .maybeSingle();
      }
      bank = bRes?.data || null;
    }

    // 3. Fetch all Versions
    let vRes = await supabase
      .from("question_versions")
      .select(`
        id,
        version_number,
        prompt,
        content_format,
        options,
        answer_key,
        explanation,
        difficulty,
        skill_id,
        topic_tags,
        source_type,
        source_reference,
        license_type,
        review_status,
        review_notes,
        fingerprint,
        change_summary,
        published_at,
        created_by,
        created_at
      `)
      .eq("question_id", questionId)
      .order("version_number", { ascending: false });

    if ((!vRes?.data || vRes.data.length === 0) && admin) {
      vRes = await admin
        .from("question_versions")
        .select(`
          id,
          version_number,
          prompt,
          content_format,
          options,
          answer_key,
          explanation,
          difficulty,
          skill_id,
          topic_tags,
          source_type,
          source_reference,
          license_type,
          review_status,
          review_notes,
          fingerprint,
          change_summary,
          published_at,
          created_by,
          created_at
        `)
        .eq("question_id", questionId)
        .order("version_number", { ascending: false });
    }

    let versions = (vRes?.data || []) as any[];

    // Fallback: If no versions by question_id, try current_version_id
    if (versions.length === 0 && question.current_version_id) {
      let curRes = await supabase
        .from("question_versions")
        .select("*")
        .eq("id", question.current_version_id)
        .maybeSingle();

      if (!curRes?.data && admin) {
        curRes = await admin
          .from("question_versions")
          .select("*")
          .eq("id", question.current_version_id)
          .maybeSingle();
      }

      if (curRes?.data) {
        versions = [curRes.data];
      }
    }

    // 4. Role-based sanitization for student
    if (userRole === "STUDENT") {
      versions = versions.map((v: any) =>
        this.sanitizeForStudent(v, question.question_type)
      );
    }

    return {
      data: {
        ...question,
        bank,
        versions,
      },
    };
  }

  /**
   * Retrieves questions with role-based filtering and security masking.
   */
  public static async getQuestions(
    tenantId: string,
    userRole: string,
    options: {
      bankId?: string;
      questionType?: QuestionType;
      difficulty?: QuestionDifficulty;
      lifecycleStatus?: QuestionLifecycleStatus;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("questions")
      .select(
        `
        id,
        tenant_id,
        bank_id,
        question_type,
        current_version_id,
        lifecycle_status,
        created_at,
        updated_at,
        current_version:question_versions!fk_questions_current_version(
          id,
          version_number,
          prompt,
          content_format,
          options,
          answer_key,
          explanation,
          difficulty,
          skill_id,
          topic_tags,
          source_type,
          source_reference,
          license_type,
          review_status,
          review_notes,
          fingerprint,
          published_at,
          created_by
        )
      `
      )
      .eq("tenant_id", tenantId);

    if (userRole === "STUDENT") {
      // Students can only see published questions
      query = query.eq("lifecycle_status", "PUBLISHED");
    } else if (options.lifecycleStatus) {
      query = query.eq("lifecycle_status", options.lifecycleStatus);
    }

    if (options.bankId) {
      query = query.eq("bank_id", options.bankId);
    }
    if (options.questionType) {
      query = query.eq("question_type", options.questionType);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(options.offset || 0, (options.offset || 0) + (options.limit || 20) - 1);

    const { data, error, count } = await query;

    if (error) {
      return { questions: [], total: 0, error: error.message };
    }

    // Role-based sanitization
    const sanitized = (data || []).map((q: any) => {
      let curVer = q.current_version;
      if (Array.isArray(curVer)) curVer = curVer[0];

      if (userRole === "STUDENT" && curVer) {
        curVer = this.sanitizeForStudent(curVer, q.question_type);
      }

      return {
        ...q,
        current_version: curVer,
      };
    });

    return { questions: sanitized, total: count || sanitized.length };
  }

  /**
   * Question bank container management
   */
  public static async listBanks(tenantId: string) {
    const supabase = await createServerSupabaseClient();
    return supabase
      .from("question_banks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
  }

  public static async createBank(
    tenantId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      category: BankCategory;
      sharing_policy?: BankSharingPolicy;
    }
  ) {
    const cleanName = (data.name || "").trim();
    if (!cleanName) {
      return {
        data: null,
        error: { message: "Question Bank name is required." },
      };
    }

    const supabase = await createServerSupabaseClient();

    // Check for duplicate bank name within tenant
    const { data: existing } = await supabase
      .from("question_banks")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .ilike("name", cleanName)
      .maybeSingle();

    if (existing) {
      return {
        data: null,
        error: { message: `A Question Bank named "${cleanName}" already exists for your college.` },
      };
    }

    return supabase
      .from("question_banks")
      .insert({
        tenant_id: tenantId,
        name: cleanName,
        description: data.description?.trim() || null,
        category: data.category,
        sharing_policy: data.sharing_policy || "COLLEGE_PRIVATE",
        created_by: userId,
      })
      .select("*")
      .single();
  }

  /**
   * Deletes an empty question bank.
   * If the bank contains questions, deletion is blocked to prevent accidental loss.
   */
  public static async deleteBank(
    tenantId: string,
    bankId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data: bank, error: bErr } = await supabase
      .from("question_banks")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("id", bankId)
      .single();

    if (bErr || !bank) {
      return { success: false, error: "Question bank not found." };
    }

    const { count: qCount } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("bank_id", bankId);

    if (qCount && qCount > 0) {
      return {
        success: false,
        error: "Cannot delete a question bank that contains questions. Please delete or reassign all questions first.",
      };
    }

    const { error: delErr } = await supabase
      .from("question_banks")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", bankId);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    return { success: true };
  }
}
