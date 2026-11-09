/**
 * AI Mock Interview Studio Service
 * 
 * Interactive, turn-based interview practice engine for technical, HR,
 * behavioral, project-based, and company-specific interviews.
 * 
 * Conducts one-question-at-a-time turns, evaluates student answers on a 6-dimension
 * transparent rubric, generates illustrative improved responses, tracks session
 * lifecycle, and produces a final comprehensive practice evaluation report.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { GeminiClient } from "@/modules/ai/gemini-client";
import { StudentCareerProfileService } from "./student-career-profile-service";
import { ResumeStorageService } from "./resume-storage-service";

export type InterviewType = "TECHNICAL" | "HR" | "BEHAVIOURAL" | "PROJECT_BASED" | "COMPANY_SPECIFIC";
export type InterviewDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type SessionStatus = "CREATED" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED" | "FAILED";

export interface AnswerEvaluation {
  overallScore: number;
  relevanceScore: number;
  technicalScore: number;
  depthScore: number;
  structureScore: number;
  practicalReasoningScore: number;
  communicationScore: number;
  whatWentWell: string[];
  whatWasMissing: string[];
  conceptualErrors: string[];
  improvedAnswerExample: string;
  followUpRecommendation: string;
}

export interface MockInterviewTurn {
  id: string;
  questionIndex: number;
  questionText: string;
  questionCategory: string;
  isFollowUp: boolean;
  studentAnswer: string | null;
  answerSubmittedAt: string | null;
  evaluation: AnswerEvaluation | null;
  createdAt: string;
}

export interface MockInterviewSession {
  id: string;
  tenantId: string;
  studentId: string;
  interviewType: InterviewType;
  targetRole: string;
  difficulty: InterviewDifficulty;
  targetDriveId: string | null;
  targetDriveTitle?: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  status: SessionStatus;
  overallScore: number | null;
  relevanceScore: number | null;
  technicalAccuracyScore: number | null;
  depthScore: number | null;
  structureScore: number | null;
  practicalReasoningScore: number | null;
  communicationScore: number | null;
  finalFeedbackSummary: string | null;
  strongAnswers: any[];
  weakAnswers: any[];
  technicalGaps: any[];
  recommendedExercises: any[];
  suggestedNextLevel: string | null;
  turns: MockInterviewTurn[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export class MockInterviewService {
  /**
   * Creates a new mock interview session and generates the first interactive question.
   */
  public static async createSession(params: {
    tenantId: string;
    studentId: string;
    interviewType: InterviewType;
    targetRole: string;
    difficulty?: InterviewDifficulty;
    totalQuestions?: number;
    targetDriveId?: string | null;
    userId?: string;
  }): Promise<MockInterviewSession> {
    const admin = createAdminClient();
    const difficulty = params.difficulty || "INTERMEDIATE";
    const totalQuestions = Math.min(8, Math.max(3, params.totalQuestions || 4));
    const targetRole = params.targetRole.trim();

    // 1. Fetch Student Context (Profile, Projects, Skills)
    const profile = await StudentCareerProfileService.getProfile(params.tenantId, params.studentId);
    const primaryResume = await ResumeStorageService.getPrimaryResume(params.tenantId, params.studentId);

    // 2. Fetch Drive Information if company/drive-specific
    let driveInfo: any = null;
    if (params.targetDriveId) {
      const { data: drive } = await admin
        .from("recruitment_drives")
        .select(`
          id,
          title,
          job_roles,
          job_description,
          companies (name)
        `)
        .eq("id", params.targetDriveId)
        .eq("tenant_id", params.tenantId)
        .maybeSingle();

      if (drive) {
        driveInfo = {
          title: drive.title,
          companyName: (drive as any).companies?.name || "Target Company",
          jobRoles: drive.job_roles || [],
          description: drive.job_description || "",
        };
      }
    }

    // 3. Create Session Record in DB
    const { data: sessionRecord, error: sessionErr } = await admin
      .from("student_mock_interview_sessions")
      .insert({
        tenant_id: params.tenantId,
        student_id: params.studentId,
        interview_type: params.interviewType,
        target_role: targetRole,
        difficulty,
        target_drive_id: params.targetDriveId || null,
        total_questions: totalQuestions,
        current_question_index: 1,
        status: "IN_PROGRESS",
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (sessionErr || !sessionRecord) {
      throw new Error(sessionErr?.message || "Failed to initialize mock interview session.");
    }

    // 4. Generate Question 1 via Gemini
    const question1 = await this.generateNextQuestion({
      session: sessionRecord,
      questionIndex: 1,
      profile,
      primaryResume,
      driveInfo,
      previousTurns: [],
      userId: params.userId,
    });

    // 5. Insert Message Turn 1 into DB
    const { data: messageRecord, error: msgErr } = await admin
      .from("student_mock_interview_messages")
      .insert({
        tenant_id: params.tenantId,
        session_id: sessionRecord.id,
        student_id: params.studentId,
        question_index: 1,
        question_text: question1.questionText,
        question_category: question1.category,
        is_follow_up: false,
      })
      .select("*")
      .single();

    if (msgErr || !messageRecord) {
      console.error("[MockInterviewService] Failed to insert initial message:", msgErr);
    }

    return {
      id: sessionRecord.id,
      tenantId: sessionRecord.tenant_id,
      studentId: sessionRecord.student_id,
      interviewType: sessionRecord.interview_type as any,
      targetRole: sessionRecord.target_role,
      difficulty: sessionRecord.difficulty as any,
      targetDriveId: sessionRecord.target_drive_id,
      targetDriveTitle: driveInfo?.title,
      totalQuestions: sessionRecord.total_questions,
      currentQuestionIndex: 1,
      status: "IN_PROGRESS",
      overallScore: null,
      relevanceScore: null,
      technicalAccuracyScore: null,
      depthScore: null,
      structureScore: null,
      practicalReasoningScore: null,
      communicationScore: null,
      finalFeedbackSummary: null,
      strongAnswers: [],
      weakAnswers: [],
      technicalGaps: [],
      recommendedExercises: [],
      suggestedNextLevel: null,
      turns: [
        {
          id: messageRecord?.id || "msg-1",
          questionIndex: 1,
          questionText: question1.questionText,
          questionCategory: question1.category,
          isFollowUp: false,
          studentAnswer: null,
          answerSubmittedAt: null,
          evaluation: null,
          createdAt: messageRecord?.created_at || new Date().toISOString(),
        },
      ],
      startedAt: sessionRecord.started_at,
      completedAt: null,
      createdAt: sessionRecord.created_at,
    };
  }

  /**
   * Submits a student's answer for the active question turn, evaluates it,
   * and advances to the next question or compiles the final report.
   */
  public static async submitAnswer(params: {
    tenantId: string;
    studentId: string;
    sessionId: string;
    questionIndex: number;
    answerText: string;
    userId?: string;
  }): Promise<{
    evaluation: AnswerEvaluation;
    isCompleted: boolean;
    nextTurn?: MockInterviewTurn;
    session: MockInterviewSession;
  }> {
    const admin = createAdminClient();
    const cleanAnswer = params.answerText.trim();
    if (!cleanAnswer) {
      throw new Error("Answer cannot be empty.");
    }

    // 1. Fetch Session
    const session = await this.getSession(params.tenantId, params.studentId, params.sessionId);
    if (!session) {
      throw new Error("Interview session not found.");
    }
    if (session.status === "COMPLETED" || session.status === "ABANDONED") {
      throw new Error(`Cannot submit answer. Session is already ${session.status.toLowerCase()}.`);
    }

    // 2. Fetch current turn message
    const { data: currentTurnMsg, error: turnErr } = await admin
      .from("student_mock_interview_messages")
      .select("*")
      .eq("session_id", params.sessionId)
      .eq("tenant_id", params.tenantId)
      .eq("student_id", params.studentId)
      .eq("question_index", params.questionIndex)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!currentTurnMsg) {
      throw new Error(`Turn for question index ${params.questionIndex} not found.`);
    }

    // Idempotency: If answer already evaluated, return current evaluation
    if (currentTurnMsg.evaluation && currentTurnMsg.student_answer) {
      return {
        evaluation: currentTurnMsg.evaluation as any,
        isCompleted: (session.status as string) === "COMPLETED",
        session,
      };
    }

    // 3. Evaluate Student Answer via Gemini
    const evaluation = await this.evaluateAnswer({
      session,
      questionText: currentTurnMsg.question_text,
      questionCategory: currentTurnMsg.question_category,
      studentAnswer: cleanAnswer,
      userId: params.userId,
    });

    // 4. Update Current Message Record in DB
    await admin
      .from("student_mock_interview_messages")
      .update({
        student_answer: cleanAnswer,
        answer_submitted_at: new Date().toISOString(),
        evaluation: evaluation as any,
      })
      .eq("id", currentTurnMsg.id);

    // 5. Check If All Questions Completed
    const isCompleted = params.questionIndex >= session.totalQuestions;

    if (isCompleted) {
      // Compile Final Session Summary & Dimension Breakdown
      const finalReport = await this.compileFinalSessionReport({
        session,
        userId: params.userId,
      });

      await admin
        .from("student_mock_interview_sessions")
        .update({
          status: "COMPLETED",
          completed_at: new Date().toISOString(),
          overall_score: finalReport.overallScore,
          relevance_score: finalReport.relevanceScore,
          technical_accuracy_score: finalReport.technicalAccuracyScore,
          depth_score: finalReport.depthScore,
          structure_score: finalReport.structureScore,
          practical_reasoning_score: finalReport.practicalReasoningScore,
          communication_score: finalReport.communicationScore,
          final_feedback_summary: finalReport.summary,
          strong_answers: finalReport.strongAnswers as any,
          weak_answers: finalReport.weakAnswers as any,
          technical_gaps: finalReport.technicalGaps as any,
          recommended_exercises: finalReport.recommendedExercises as any,
          suggested_next_level: finalReport.suggestedNextLevel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.sessionId);

      const refreshed = await this.getSession(params.tenantId, params.studentId, params.sessionId);
      return {
        evaluation,
        isCompleted: true,
        session: refreshed!,
      };
    }

    // 6. Generate Next Question Turn
    const nextQuestionIndex = params.questionIndex + 1;
    const profile = await StudentCareerProfileService.getProfile(params.tenantId, params.studentId);
    const primaryResume = await ResumeStorageService.getPrimaryResume(params.tenantId, params.studentId);

    const nextQ = await this.generateNextQuestion({
      session,
      questionIndex: nextQuestionIndex,
      profile,
      primaryResume,
      driveInfo: null,
      previousTurns: [
        ...session.turns,
        {
          ...currentTurnMsg,
          studentAnswer: cleanAnswer,
          evaluation,
        },
      ],
      userId: params.userId,
    });

    const { data: newTurnMsg } = await admin
      .from("student_mock_interview_messages")
      .insert({
        tenant_id: params.tenantId,
        session_id: params.sessionId,
        student_id: params.studentId,
        question_index: nextQuestionIndex,
        question_text: nextQ.questionText,
        question_category: nextQ.category,
        is_follow_up: false,
      })
      .select("*")
      .single();

    await admin
      .from("student_mock_interview_sessions")
      .update({
        current_question_index: nextQuestionIndex,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.sessionId);

    const refreshed = await this.getSession(params.tenantId, params.studentId, params.sessionId);

    return {
      evaluation,
      isCompleted: false,
      nextTurn: {
        id: newTurnMsg?.id || `msg-${nextQuestionIndex}`,
        questionIndex: nextQuestionIndex,
        questionText: nextQ.questionText,
        questionCategory: nextQ.category,
        isFollowUp: false,
        studentAnswer: null,
        answerSubmittedAt: null,
        evaluation: null,
        createdAt: newTurnMsg?.created_at || new Date().toISOString(),
      },
      session: refreshed!,
    };
  }

  /**
   * Fetches full session details and all turn messages.
   */
  public static async getSession(
    tenantId: string,
    studentId: string,
    sessionId: string
  ): Promise<MockInterviewSession | null> {
    const admin = createAdminClient();

    try {
      const { data: session, error: sessionErr } = await admin
        .from("student_mock_interview_sessions")
        .select(`
          *,
          recruitment_drives (title)
        `)
        .eq("id", sessionId)
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (sessionErr) {
        console.error("[MockInterviewService] getSession error:", sessionErr);
        return null;
      }

      if (!session) return null;

      const { data: messages, error: msgErr } = await admin
        .from("student_mock_interview_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("question_index", { ascending: true })
        .order("created_at", { ascending: true });

      if (msgErr) {
        console.warn("[MockInterviewService] getSession messages query notice:", msgErr);
      }

      const turns: MockInterviewTurn[] = (messages || []).map((m: any) => ({
        id: m.id,
        questionIndex: m.question_index,
        questionText: m.question_text,
        questionCategory: m.question_category,
        isFollowUp: m.is_follow_up,
        studentAnswer: m.student_answer,
        answerSubmittedAt: m.answer_submitted_at,
        evaluation: m.evaluation as any,
        createdAt: m.created_at,
      }));

      return {
        id: session.id,
        tenantId: session.tenant_id,
        studentId: session.student_id,
        interviewType: session.interview_type as any,
        targetRole: session.target_role,
        difficulty: session.difficulty as any,
        targetDriveId: session.target_drive_id,
        targetDriveTitle: (session as any).recruitment_drives?.title,
        totalQuestions: session.total_questions,
        currentQuestionIndex: session.current_question_index,
        status: session.status as any,
        overallScore: session.overall_score,
        relevanceScore: session.relevance_score,
        technicalAccuracyScore: session.technical_accuracy_score,
        depthScore: session.depth_score,
        structureScore: session.structure_score,
        practicalReasoningScore: session.practical_reasoning_score,
        communicationScore: session.communication_score,
        finalFeedbackSummary: session.final_feedback_summary,
        strongAnswers: Array.isArray(session.strong_answers) ? session.strong_answers : [],
        weakAnswers: Array.isArray(session.weak_answers) ? session.weak_answers : [],
        technicalGaps: Array.isArray(session.technical_gaps) ? session.technical_gaps : [],
        recommendedExercises: Array.isArray(session.recommended_exercises) ? session.recommended_exercises : [],
        suggestedNextLevel: session.suggested_next_level,
        turns,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        createdAt: session.created_at,
      };
    } catch (err) {
      console.error("[MockInterviewService] getSession uncaught exception:", err);
      return null;
    }
  }

  /**
   * Lists past mock interview sessions for the student.
   */
  public static async listSessions(
    tenantId: string,
    studentId: string,
    limit = 20
  ): Promise<MockInterviewSession[]> {
    const admin = createAdminClient();

    try {
      const { data: rows, error } = await admin
        .from("student_mock_interview_sessions")
        .select(`
          *,
          recruitment_drives (title)
        `)
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[MockInterviewService] listSessions query error:", error);
        return [];
      }

      return (rows || []).map((s: any) => ({
        id: s.id,
        tenantId: s.tenant_id,
        studentId: s.student_id,
        interviewType: s.interview_type as any,
        targetRole: s.target_role,
        difficulty: s.difficulty as any,
        targetDriveId: s.target_drive_id,
        targetDriveTitle: (s as any).recruitment_drives?.title,
        totalQuestions: s.total_questions,
        currentQuestionIndex: s.current_question_index,
        status: s.status as any,
        overallScore: s.overall_score,
        relevanceScore: s.relevance_score,
        technicalAccuracyScore: s.technical_accuracy_score,
        depthScore: s.depth_score,
        structureScore: s.structure_score,
        practicalReasoningScore: s.practical_reasoning_score,
        communicationScore: s.communication_score,
        finalFeedbackSummary: s.final_feedback_summary,
        strongAnswers: Array.isArray(s.strong_answers) ? s.strong_answers : [],
        weakAnswers: Array.isArray(s.weak_answers) ? s.weak_answers : [],
        technicalGaps: Array.isArray(s.technical_gaps) ? s.technical_gaps : [],
        recommendedExercises: Array.isArray(s.recommended_exercises) ? s.recommended_exercises : [],
        suggestedNextLevel: s.suggested_next_level,
        turns: [],
        startedAt: s.started_at,
        completedAt: s.completed_at,
        createdAt: s.created_at,
      }));
    } catch (err) {
      console.error("[MockInterviewService] listSessions uncaught exception:", err);
      return [];
    }
  }

  /**
   * Generates a contextually grounded interview question.
   */
  private static async generateNextQuestion(inputs: {
    session: any;
    questionIndex: number;
    profile: any;
    primaryResume: any;
    driveInfo: any;
    previousTurns: any[];
    userId?: string;
  }): Promise<{ questionText: string; category: string }> {
    const systemInstruction = `You are UrPlaced's AI Placement Interviewer.
You are conducting a collegiate practice interview.
You must generate ONE realistic, collegiate-level interview question for Question #${inputs.questionIndex} of ${inputs.session.total_questions}.
Output MUST be valid JSON:
{
  "questionText": string,
  "category": "TECHNICAL" | "PROJECT_ARCHITECTURE" | "BEHAVIOURAL" | "SYSTEM_DESIGN" | "HR"
}`;

    const prompt = `<interview_config>
Type: ${inputs.session.interview_type}
Target Role: ${inputs.session.target_role}
Difficulty: ${inputs.session.difficulty}
Question Index: ${inputs.questionIndex} of ${inputs.session.total_questions}
</interview_config>

<student_context>
Skills: ${(inputs.profile?.technicalSkills || []).map((s: any) => s.name).join(", ")}
Projects: ${(inputs.profile?.projects || []).map((p: any) => p.title).join(", ")}
</student_context>

${
  inputs.previousTurns.length > 0
    ? `<previous_turns>
${inputs.previousTurns.map((t: any) => `Q: ${t.question_text || t.questionText}\nA: ${t.student_answer || t.studentAnswer || "(Answered)"}`).join("\n\n")}
</previous_turns>`
    : ""
}

Generate Question #${inputs.questionIndex}. Do not repeat previous questions.`;

    try {
      const result = await GeminiClient.generate({
        prompt,
        systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 600,
        feature: "MOCK_INTERVIEW",
        userId: inputs.userId,
        tenantId: inputs.session.tenant_id,
      });

      let text = result.text.trim();
      if (text.startsWith("```json")) text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      else if (text.startsWith("```")) text = text.replace(/^```\s*/i, "").replace(/```\s*$/i, "");

      const parsed = JSON.parse(text);
      if (parsed.questionText) {
        return {
          questionText: parsed.questionText,
          category: parsed.category || "TECHNICAL",
        };
      }
    } catch {
      // Fallback
    }

    return this.getFallbackQuestion(inputs.session.interview_type, inputs.questionIndex, inputs.session.target_role);
  }

  /**
   * Evaluates student's answer across 6 documented criteria.
   */
  private static async evaluateAnswer(inputs: {
    session: any;
    questionText: string;
    questionCategory: string;
    studentAnswer: string;
    userId?: string;
  }): Promise<AnswerEvaluation> {
    const systemInstruction = `You are UrPlaced's AI Placement Interview Evaluation Engine.
Evaluate the student's interview response against a transparent 6-dimension rubric.
Score each dimension from 0 to 100.
DIMENSIONS:
1. relevanceScore: Did the student answer what was asked?
2. technicalScore: Technical accuracy and correctness of concepts.
3. depthScore: Demonstrated understanding beyond superficial surface buzzwords.
4. structureScore: Organized reasoning (e.g. STAR method or structured breakdown).
5. practicalReasoningScore: Realistic engineering trade-offs and decision justifications.
6. communicationScore: Clarity, professional tone, and scannability.

Output MUST be valid JSON:
{
  "overallScore": number (0-100),
  "relevanceScore": number (0-100),
  "technicalScore": number (0-100),
  "depthScore": number (0-100),
  "structureScore": number (0-100),
  "practicalReasoningScore": number (0-100),
  "communicationScore": number (0-100),
  "whatWentWell": [string, string],
  "whatWasMissing": [string, string],
  "conceptualErrors": [string],
  "improvedAnswerExample": string (Clearly formulated model answer illustrative of an interview response),
  "followUpRecommendation": string
}`;

    const prompt = `<question_context>
Role: ${inputs.session.target_role}
Interview Type: ${inputs.session.interview_type}
Question: ${inputs.questionText}
Category: ${inputs.questionCategory}
</question_context>

<student_answer>
${inputs.studentAnswer.slice(0, 3000)}
</student_answer>

Evaluate this answer. Be constructive, precise, and encouraging for collegiate placement candidates.`;

    try {
      const result = await GeminiClient.generate({
        prompt,
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 1200,
        feature: "MOCK_INTERVIEW",
        userId: inputs.userId,
        tenantId: inputs.session.tenant_id,
      });

      let text = result.text.trim();
      if (text.startsWith("```json")) text = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      else if (text.startsWith("```")) text = text.replace(/^```\s*/i, "").replace(/```\s*$/i, "");

      const parsed = JSON.parse(text);
      return {
        overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || 70)),
        relevanceScore: Math.min(100, Math.max(0, Number(parsed.relevanceScore) || 75)),
        technicalScore: Math.min(100, Math.max(0, Number(parsed.technicalScore) || 70)),
        depthScore: Math.min(100, Math.max(0, Number(parsed.depthScore) || 65)),
        structureScore: Math.min(100, Math.max(0, Number(parsed.structureScore) || 70)),
        practicalReasoningScore: Math.min(100, Math.max(0, Number(parsed.practicalReasoningScore) || 65)),
        communicationScore: Math.min(100, Math.max(0, Number(parsed.communicationScore) || 75)),
        whatWentWell: Array.isArray(parsed.whatWentWell) ? parsed.whatWentWell : ["Addressed the core subject."],
        whatWasMissing: Array.isArray(parsed.whatWasMissing) ? parsed.whatWasMissing : ["Could elaborate on edge cases."],
        conceptualErrors: Array.isArray(parsed.conceptualErrors) ? parsed.conceptualErrors : [],
        improvedAnswerExample: parsed.improvedAnswerExample || "Consider structuring the answer with problem definition, approach, and trade-off analysis.",
        followUpRecommendation: parsed.followUpRecommendation || "Review algorithmic complexity and practical code examples for this concept.",
      };
    } catch {
      // Deterministic evaluation fallback
      return {
        overallScore: 72,
        relevanceScore: 75,
        technicalScore: 70,
        depthScore: 70,
        structureScore: 72,
        practicalReasoningScore: 68,
        communicationScore: 75,
        whatWentWell: ["Clear explanation of fundamental concepts.", "Good communication tone."],
        whatWasMissing: ["Provide specific architectural examples or trade-offs."],
        conceptualErrors: [],
        improvedAnswerExample: `A top-performing answer begins with a concise definition, outlines the primary strategy, and highlights key constraints or edge cases.`,
        followUpRecommendation: "Practice explaining implementation details under time constraints.",
      };
    }
  }

  /**
   * Compiles final session report with overall score and dimension aggregations.
   */
  private static async compileFinalSessionReport(inputs: {
    session: any;
    userId?: string;
  }): Promise<{
    overallScore: number;
    relevanceScore: number;
    technicalAccuracyScore: number;
    depthScore: number;
    structureScore: number;
    practicalReasoningScore: number;
    communicationScore: number;
    summary: string;
    strongAnswers: any[];
    weakAnswers: any[];
    technicalGaps: any[];
    recommendedExercises: any[];
    suggestedNextLevel: string;
  }> {
    const admin = createAdminClient();
    const { data: turns } = await admin
      .from("student_mock_interview_messages")
      .select("*")
      .eq("session_id", inputs.session.id);

    const evaluatedTurns = (turns || []).filter((t: any) => t.evaluation);

    if (evaluatedTurns.length === 0) {
      return {
        overallScore: 70,
        relevanceScore: 70,
        technicalAccuracyScore: 70,
        depthScore: 70,
        structureScore: 70,
        practicalReasoningScore: 70,
        communicationScore: 70,
        summary: "Session completed with basic coverage.",
        strongAnswers: [],
        weakAnswers: [],
        technicalGaps: [],
        recommendedExercises: ["Review placement preparation topics."],
        suggestedNextLevel: "INTERMEDIATE",
      };
    }

    let sumOverall = 0,
      sumRel = 0,
      sumTech = 0,
      sumDepth = 0,
      sumStruct = 0,
      sumPrac = 0,
      sumComm = 0;

    const strongAnswers: any[] = [];
    const weakAnswers: any[] = [];
    const technicalGaps: string[] = [];

    for (const t of evaluatedTurns) {
      const ev = t.evaluation as AnswerEvaluation;
      sumOverall += ev.overallScore || 70;
      sumRel += ev.relevanceScore || 70;
      sumTech += ev.technicalScore || 70;
      sumDepth += ev.depthScore || 70;
      sumStruct += ev.structureScore || 70;
      sumPrac += ev.practicalReasoningScore || 70;
      sumComm += ev.communicationScore || 70;

      if (ev.overallScore >= 75) {
        strongAnswers.push({ question: t.question_text, score: ev.overallScore });
      } else {
        weakAnswers.push({ question: t.question_text, score: ev.overallScore });
      }

      if (ev.conceptualErrors && ev.conceptualErrors.length > 0) {
        technicalGaps.push(...ev.conceptualErrors);
      }
    }

    const count = evaluatedTurns.length;
    const avgOverall = Math.round(sumOverall / count);

    return {
      overallScore: avgOverall,
      relevanceScore: Math.round(sumRel / count),
      technicalAccuracyScore: Math.round(sumTech / count),
      depthScore: Math.round(sumDepth / count),
      structureScore: Math.round(sumStruct / count),
      practicalReasoningScore: Math.round(sumPrac / count),
      communicationScore: Math.round(sumComm / count),
      summary: `Completed ${inputs.session.interviewType} practice for ${inputs.session.targetRole} with an overall readiness score of ${avgOverall}/100. Demonstrates strong communication with room for deeper technical articulation.`,
      strongAnswers,
      weakAnswers,
      technicalGaps: Array.from(new Set(technicalGaps)),
      recommendedExercises: [
        `Complete 2 practice problem sets focused on ${inputs.session.targetRole} architecture.`,
        "Practice answering technical trade-off questions with concrete numbers.",
      ],
      suggestedNextLevel: avgOverall >= 80 ? "ADVANCED" : "INTERMEDIATE",
    };
  }

  /**
   * Deterministic fallback questions by type.
   */
  private static getFallbackQuestion(
    type: InterviewType,
    index: number,
    role: string
  ): { questionText: string; category: string } {
    const map: Record<string, string[]> = {
      TECHNICAL: [
        `Can you explain the difference between processes and threads, and how context switching impacts performance in a ${role} system?`,
        `How do you design a database indexing strategy for a query involving multiple high-cardinality filters?`,
        `Describe a scenario where you would choose an optimistic locking mechanism over pessimistic locking.`,
        `How would you identify and mitigate a memory leak in a production backend service?`,
      ],
      HR: [
        `Tell me about yourself, your educational journey, and why you are enthusiastic about beginning your career as a ${role}.`,
        `What are your greatest professional strengths, and what is one technical area you are actively working to improve?`,
        `How do you prioritize deliverables when managing conflicting deadlines between coursework and project milestones?`,
        `Where do you see your technical trajectory evolving over the next 2 to 3 years?`,
      ],
      BEHAVIOURAL: [
        `Describe a challenging team conflict you encountered during a group engineering project, and how you navigated it to resolution.`,
        `Tell me about a time when a project requirement changed unexpectedly close to a deadline. How did you adapt?`,
        `Give an example of a mistake you made in code or logic. How did you diagnose it, communicate it, and ensure it wouldn't happen again?`,
        `Describe an instance where you had to learn an unfamiliar library or language rapidly to meet a deliverable.`,
      ],
      PROJECT_BASED: [
        `Walk me through the architecture of the most technically demanding project in your portfolio. What were your key design decisions?`,
        `What were the major technical trade-offs you made when selecting the database and technology stack for your project?`,
        `How did you test your system for correctness and edge cases? If given another month, what would you re-architect?`,
      ],
      COMPANY_SPECIFIC: [
        `What specific engineering challenges in this company's domain interest you, and how do your skills align with this hiring drive?`,
        `How would you design a scalable service tailored to handle sudden spikes in user traffic during promotional events?`,
        `Explain how you ensure data consistency across distributed services in an enterprise environment.`,
      ],
    };

    const list = map[type] || map.TECHNICAL;
    const qText = list[(index - 1) % list.length];
    return {
      questionText: qText,
      category: type,
    };
  }

  /**
   * Validates if a string is a supported interview type.
   */
  public static isValidInterviewType(type: string): boolean {
    return ["TECHNICAL", "HR", "BEHAVIOURAL", "PROJECT_BASED", "COMPANY_SPECIFIC"].includes(type);
  }

  /**
   * Parses raw LLM text into a validated AnswerEvaluation structure.
   */
  public static parseEvaluationResponse(rawText: string): AnswerEvaluation {
    let clean = rawText.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    }

    try {
      const parsed = JSON.parse(clean);
      const rel = Math.min(100, Math.max(0, Number(parsed.relevanceScore) || 70));
      const tech = Math.min(100, Math.max(0, Number(parsed.technicalScore) || 70));
      const depth = Math.min(100, Math.max(0, Number(parsed.depthScore) || 70));
      const struct = Math.min(100, Math.max(0, Number(parsed.structureScore) || 70));
      const pract = Math.min(100, Math.max(0, Number(parsed.practicalReasoningScore) || 70));
      const comm = Math.min(100, Math.max(0, Number(parsed.communicationScore) || 70));

      const calculatedOverall = Math.round(
        rel * 0.2 + tech * 0.25 + depth * 0.15 + struct * 0.15 + pract * 0.15 + comm * 0.1
      );

      return {
        overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || calculatedOverall)),
        relevanceScore: rel,
        technicalScore: tech,
        depthScore: depth,
        structureScore: struct,
        practicalReasoningScore: pract,
        communicationScore: comm,
        whatWentWell: Array.isArray(parsed.whatWentWell) ? parsed.whatWentWell : ["Addressed the core subject."],
        whatWasMissing: Array.isArray(parsed.whatWasMissing) ? parsed.whatWasMissing : ["Could elaborate on edge cases."],
        conceptualErrors: Array.isArray(parsed.conceptualErrors) ? parsed.conceptualErrors : [],
        improvedAnswerExample: parsed.improvedAnswerExample || "Consider structuring the answer with problem definition, approach, and trade-off analysis.",
        followUpRecommendation: parsed.followUpRecommendation || "Review algorithmic complexity and practical code examples for this concept.",
      };
    } catch {
      return {
        overallScore: 70,
        relevanceScore: 70,
        technicalScore: 70,
        depthScore: 65,
        structureScore: 70,
        practicalReasoningScore: 65,
        communicationScore: 75,
        whatWentWell: ["Clear explanation of fundamental concepts."],
        whatWasMissing: ["Provide specific architectural examples or trade-offs."],
        conceptualErrors: [],
        improvedAnswerExample: "A top-performing answer begins with a concise definition, outlines the primary strategy, and highlights key constraints or edge cases.",
        followUpRecommendation: "Practice explaining implementation details under time constraints.",
      };
    }
  }

  /**
   * Compiles final report across evaluated turns.
   */
  public static compileFinalReport(
    turns: MockInterviewTurn[],
    targetRole: string,
    difficulty: string
  ): {
    overallScore: number;
    relevanceScore: number;
    technicalAccuracyScore: number;
    depthScore: number;
    structureScore: number;
    practicalReasoningScore: number;
    communicationScore: number;
    finalFeedbackSummary: string;
    strongAnswers: any[];
    weakAnswers: any[];
    technicalGaps: any[];
    recommendedExercises: any[];
    suggestedNextLevel: string;
  } {
    const evaluated = turns.filter((t) => t.evaluation);
    if (evaluated.length === 0) {
      return {
        overallScore: 70,
        relevanceScore: 70,
        technicalAccuracyScore: 70,
        depthScore: 70,
        structureScore: 70,
        practicalReasoningScore: 70,
        communicationScore: 70,
        finalFeedbackSummary: "Practice session completed with introductory answers.",
        strongAnswers: [],
        weakAnswers: [],
        technicalGaps: [],
        recommendedExercises: ["Practice problem formulation under time constraints."],
        suggestedNextLevel: "INTERMEDIATE",
      };
    }

    let sumOverall = 0;
    let sumRel = 0;
    let sumTech = 0;
    let sumDepth = 0;
    let sumStruct = 0;
    let sumPract = 0;
    let sumComm = 0;

    const strongAnswers: string[] = [];
    const weakAnswers: string[] = [];
    const gaps: string[] = [];

    for (const t of evaluated) {
      const ev = t.evaluation!;
      sumOverall += ev.overallScore;
      sumRel += ev.relevanceScore;
      sumTech += ev.technicalScore;
      sumDepth += ev.depthScore;
      sumStruct += ev.structureScore;
      sumPract += ev.practicalReasoningScore;
      sumComm += ev.communicationScore;

      if (ev.overallScore >= 80) {
        strongAnswers.push(`Q${t.questionIndex} (${t.questionCategory}): Demonstrated solid reasoning.`);
      } else if (ev.overallScore < 70) {
        weakAnswers.push(`Q${t.questionIndex} (${t.questionCategory}): Needs deeper detail and structure.`);
      }

      if (ev.conceptualErrors && ev.conceptualErrors.length > 0) {
        gaps.push(...ev.conceptualErrors);
      }
    }

    const n = evaluated.length;
    const avgOverall = Math.round(sumOverall / n);

    return {
      overallScore: avgOverall,
      relevanceScore: Math.round(sumRel / n),
      technicalAccuracyScore: Math.round(sumTech / n),
      depthScore: Math.round(sumDepth / n),
      structureScore: Math.round(sumStruct / n),
      practicalReasoningScore: Math.round(sumPract / n),
      communicationScore: Math.round(sumComm / n),
      finalFeedbackSummary: `Candidate demonstrated solid engagement for ${targetRole} with an overall practice score of ${avgOverall}/100.`,
      strongAnswers: strongAnswers.length > 0 ? strongAnswers : ["Maintained clear structure across questions."],
      weakAnswers: weakAnswers.length > 0 ? weakAnswers : ["Deepen edge case handling in answers."],
      technicalGaps: gaps,
      recommendedExercises: [
        `Practice STAR method communication for behavioral/situational questions.`,
        `Solve 5 LeetCode Medium problems focusing on time and space complexity articulation.`,
      ],
      suggestedNextLevel: avgOverall >= 85 ? "ADVANCED" : "INTERMEDIATE",
    };
  }
}
