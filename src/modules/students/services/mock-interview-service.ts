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
      throw new Error(`Cannot submit answer. Session is already ${session.status.toLowerCase()} and cannot be modified.`);
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

    // Idempotency & Fault Recovery:
    // If answer already evaluated, verify whether next turn or completion is missing, and recover!
    if (currentTurnMsg.evaluation && currentTurnMsg.student_answer) {
      const isCompleted = params.questionIndex >= session.totalQuestions;
      if (isCompleted) {
        if ((session.status as string) !== "COMPLETED") {
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
        }
        const refreshed = await this.getSession(params.tenantId, params.studentId, params.sessionId);
        return {
          evaluation: currentTurnMsg.evaluation as any,
          isCompleted: true,
          session: refreshed!,
        };
      }

      // Check if next turn message was already created
      const nextQIndex = params.questionIndex + 1;
      const { data: existingNextTurn } = await admin
        .from("student_mock_interview_messages")
        .select("*")
        .eq("session_id", params.sessionId)
        .eq("tenant_id", params.tenantId)
        .eq("student_id", params.studentId)
        .eq("question_index", nextQIndex)
        .maybeSingle();

      if (existingNextTurn) {
        return {
          evaluation: currentTurnMsg.evaluation as any,
          isCompleted: false,
          nextTurn: {
            id: existingNextTurn.id,
            questionIndex: existingNextTurn.question_index,
            questionText: existingNextTurn.question_text,
            questionCategory: existingNextTurn.question_category,
            isFollowUp: existingNextTurn.is_follow_up,
            studentAnswer: existingNextTurn.student_answer,
            answerSubmittedAt: existingNextTurn.answer_submitted_at,
            evaluation: existingNextTurn.evaluation,
            createdAt: existingNextTurn.created_at,
          },
          session,
        };
      }

      // RECOVERY: Next turn was never created despite evaluation being saved.
      // Generate and insert the missing next question turn to heal the session.
      const profile = await StudentCareerProfileService.getProfile(params.tenantId, params.studentId);
      const primaryResume = await ResumeStorageService.getPrimaryResume(params.tenantId, params.studentId);
      const nextQ = await this.generateNextQuestion({
        session,
        questionIndex: nextQIndex,
        profile,
        primaryResume,
        driveInfo: null,
        previousTurns: session.turns,
        userId: params.userId,
      });

      const { data: recoveredTurnMsg } = await admin
        .from("student_mock_interview_messages")
        .insert({
          tenant_id: params.tenantId,
          session_id: params.sessionId,
          student_id: params.studentId,
          question_index: nextQIndex,
          question_text: nextQ.questionText,
          question_category: nextQ.category,
          is_follow_up: false,
        })
        .select("*")
        .single();

      await admin
        .from("student_mock_interview_sessions")
        .update({
          current_question_index: nextQIndex,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.sessionId);

      const refreshed = await this.getSession(params.tenantId, params.studentId, params.sessionId);
      return {
        evaluation: currentTurnMsg.evaluation as any,
        isCompleted: false,
        nextTurn: {
          id: recoveredTurnMsg?.id || `msg-${nextQIndex}`,
          questionIndex: nextQIndex,
          questionText: nextQ.questionText,
          questionCategory: nextQ.category,
          isFollowUp: false,
          studentAnswer: null,
          answerSubmittedAt: null,
          evaluation: null,
          createdAt: recoveredTurnMsg?.created_at || new Date().toISOString(),
        },
        session: refreshed!,
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
    const interviewType: InterviewType = inputs.session.interview_type || "TECHNICAL";
    const systemInstruction = `You are UrPlaced's AI Placement Interviewer.
You are conducting a collegiate practice interview in the ${interviewType} category for the role of ${inputs.session.target_role}.
Generate ONE realistic, collegiate-level interview question for Question #${inputs.questionIndex} of ${inputs.session.total_questions}.
Output MUST be valid JSON:
{
  "questionText": string,
  "category": "TECHNICAL" | "PROJECT_ARCHITECTURE" | "BEHAVIOURAL" | "SYSTEM_DESIGN" | "HR"
}`;

    const prompt = `<interview_config>
Type: ${interviewType}
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
          category: parsed.category || interviewType,
        };
      }
    } catch {
      // Fallback
    }

    return this.getFallbackQuestion(interviewType, inputs.questionIndex, inputs.session.target_role);
  }

  /**
   * Returns mode-specific rubric guidance and system instruction.
   */
  private static getModeSpecificRubric(
    interviewType: InterviewType,
    targetRole: string
  ): { systemInstruction: string; dimensionPrompt: string } {
    switch (interviewType) {
      case "HR":
        return {
          systemInstruction: `You are UrPlaced's AI Placement HR Interview Evaluation Engine.
Evaluate the student's HR interview response using the official collegiate HR rubric.
DIMENSIONS:
1. relevanceScore: Directly addressed career aspirations, motivation, or personal context asked.
2. technicalScore: Self-awareness & authenticity — grounded, honest reflection on strengths, growth areas, and work style.
3. depthScore: Depth of reflection and genuine alignment with role and corporate culture.
4. structureScore: Cohesive narrative flow without rambling or filler.
5. practicalReasoningScore: Professional maturity, emotional intelligence, and college-to-corporate readiness.
6. communicationScore: Professional poise, clarity, respectful tone, and articulation.
Score each dimension from 0 to 100 based strictly on candidate's actual words. Do not award high scores to vague or empty responses.`,
          dimensionPrompt: `Evaluate HR competencies: Self-awareness, cultural fit, authentic reflection, and professional communication for a collegiate ${targetRole} candidate.`,
        };

      case "BEHAVIOURAL":
        return {
          systemInstruction: `You are UrPlaced's AI Placement Behavioural Interview Evaluation Engine.
Evaluate the candidate's situational/behavioural response strictly using the STAR methodology (Situation, Task, Action, Result).
DIMENSIONS:
1. relevanceScore: Relevance of the chosen example to the prompt.
2. technicalScore: Situation & Task clarity — well-defined context, constraints, and individual responsibility.
3. depthScore: Action — specific, concrete engineering or leadership actions taken personally by candidate.
4. structureScore: Structured adherence to the STAR framework (Situation -> Task -> Action -> Result).
5. practicalReasoningScore: Result & Reflection — measurable outcome, impact, and engineering lessons learned.
6. communicationScore: Clarity, storytelling effectiveness, empathy, and professional delivery.
Score each dimension from 0 to 100 based strictly on candidate's actual words. Do not award high scores if the STAR method is absent or results are unmentioned.`,
          dimensionPrompt: `Evaluate against STAR framework (Situation, Task, Action, Result) with emphasis on personal ownership and tangible impact.`,
        };

      case "PROJECT_BASED":
        return {
          systemInstruction: `You are UrPlaced's AI Placement Technical Project Evaluation Engine.
Evaluate the candidate's response regarding their technical project portfolio and architecture.
DIMENSIONS:
1. relevanceScore: Directly explains actual architecture and implementation of the project in question.
2. technicalScore: Technical accuracy of stack, protocols, database schema, APIs, and algorithms described.
3. depthScore: Architectural depth — understanding components, scaling boundaries, and individual contribution vs team.
4. structureScore: System walkthrough structure: Problem -> Architecture -> Implementation -> Challenges.
5. practicalReasoningScore: Technical trade-offs justified (e.g. why SQL vs NoSQL, why specific libraries, cost vs latency).
6. communicationScore: Technical articulation — ability to convey complex architectural patterns clearly to another engineer.
Score each dimension from 0 to 100. Penalize heavily for buzzword dropping without concrete implementation details.`,
          dimensionPrompt: `Evaluate project implementation depth, system architecture understanding, and justification of technical trade-offs.`,
        };

      case "COMPANY_SPECIFIC":
        return {
          systemInstruction: `You are UrPlaced's AI Placement Company-Specific Practice Evaluation Engine.
Evaluate the candidate's response against company hiring standards, engineering domain demands, and role specifications.
DIMENSIONS:
1. relevanceScore: Alignment with company domain, production expectations, and target role responsibilities.
2. technicalScore: Domain technical precision (e.g. distributed systems, financial latency, e-commerce concurrency).
3. depthScore: Depth in solving real-world domain engineering challenges and enterprise constraints.
4. structureScore: Well-organized engineering proposal or diagnostic approach.
5. practicalReasoningScore: Realistic business trade-offs, uptime considerations, security, and edge-case mitigation.
6. communicationScore: Executive/engineering communication clarity and confidence.
Score each dimension from 0 to 100 based on realistic corporate expectations for an entry-level ${targetRole}.`,
          dimensionPrompt: `Evaluate role-specific fit, enterprise engineering rigor, and domain-aware problem solving.`,
        };

      case "TECHNICAL":
      default:
        return {
          systemInstruction: `You are UrPlaced's AI Placement Technical Interview Evaluation Engine.
Evaluate the student's technical interview response against a strict 6-dimension computer science rubric.
DIMENSIONS:
1. relevanceScore: Did the candidate directly answer the technical question asked?
2. technicalScore: Technical accuracy and conceptual correctness (algorithms, data structures, runtime complexity).
3. depthScore: Depth beyond textbook definitions — awareness of edge cases, memory limits, and internals.
4. structureScore: Organized logical flow: problem breakdown -> strategy -> solution -> complexity analysis.
5. practicalReasoningScore: Practical engineering trade-offs and decision justifications in production contexts.
6. communicationScore: Precision of technical vocabulary, clarity, and conciseness.
Score each dimension from 0 to 100. Do not invent passing scores for trivial or incorrect answers.`,
          dimensionPrompt: `Evaluate algorithmic correctness, complexity analysis, technical depth, and practical reasoning.`,
        };
    }
  }

  /**
   * Deterministic heuristic evaluator when LLM is unavailable or for ultra-short answers.
   * Completely avoids fabricating passing scores for empty or trivial answers.
   */
  public static evaluateHeuristically(
    studentAnswer: string,
    interviewType: InterviewType,
    questionCategory: string
  ): AnswerEvaluation {
    const trimmed = studentAnswer.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Trivial or empty answers (< 10 words)
    if (wordCount < 10) {
      return {
        overallScore: Math.max(10, Math.min(25, wordCount * 2)),
        relevanceScore: 20,
        technicalScore: 15,
        depthScore: 10,
        structureScore: 15,
        practicalReasoningScore: 10,
        communicationScore: 25,
        whatWentWell: ["Submitted an initial response."],
        whatWasMissing: [
          `Answer is too brief (${wordCount} words) to evaluate competence. Collegiate interviews require detailed explanations.`,
          "Structure your response with clear definitions, approach, examples, and trade-offs.",
        ],
        conceptualErrors: ["Insufficient technical evidence provided for meaningful assessment."],
        improvedAnswerExample: `A competitive interview response should provide 100-250 words outlining the core definition, key mechanisms, concrete examples, and trade-offs.`,
        followUpRecommendation: "Elaborate with concrete technical examples and avoid one-sentence answers.",
      };
    }

    // Heuristic scoring based on length, structural markers, and technical keywords
    const starMatches = (trimmed.match(/\b(situation|task|action|result|because|therefore|specifically|for example|trade-off|complexity|architecture)\b/gi) || []).length;
    const structureBonus = Math.min(25, starMatches * 5);
    const lengthScore = Math.min(55, Math.round(wordCount * 0.6));
    const baseScore = Math.min(85, Math.max(35, lengthScore + structureBonus));

    const rel = Math.min(85, Math.max(35, baseScore + 5));
    const tech = Math.min(80, Math.max(30, baseScore));
    const depth = Math.min(75, Math.max(25, baseScore - 5));
    const struct = Math.min(85, Math.max(30, baseScore + (starMatches > 2 ? 8 : -5)));
    const pract = Math.min(75, Math.max(25, baseScore - 5));
    const comm = Math.min(85, Math.max(40, baseScore + 5));
    const overall = Math.round((rel * 0.2) + (tech * 0.25) + (depth * 0.15) + (struct * 0.15) + (pract * 0.15) + (comm * 0.1));

    return {
      overallScore: overall,
      relevanceScore: rel,
      technicalScore: tech,
      depthScore: depth,
      structureScore: struct,
      practicalReasoningScore: pract,
      communicationScore: comm,
      whatWentWell: [
        `Addressed the topic with ${wordCount} words.`,
        starMatches > 0 ? "Utilized structured reasoning indicators." : "Clear communication flow.",
      ],
      whatWasMissing: [
        "[Deterministic Evaluation Notice] Evaluation generated via content heuristics.",
        "Deepen articulation of edge cases, system trade-offs, and concrete technical metrics.",
      ],
      conceptualErrors: [],
      improvedAnswerExample: `Begin with a concise thesis, walk through architectural or procedural details, and conclude with observable outcomes or complexity bounds.`,
      followUpRecommendation: "Practice answering under time constraints while covering both high-level architecture and implementation edge cases.",
    };
  }

  /**
   * Evaluates student's answer across 6 documented criteria using mode-specific rubrics.
   */
  private static async evaluateAnswer(inputs: {
    session: any;
    questionText: string;
    questionCategory: string;
    studentAnswer: string;
    userId?: string;
  }): Promise<AnswerEvaluation> {
    const interviewType: InterviewType = inputs.session.interview_type || "TECHNICAL";
    const targetRole: string = inputs.session.target_role || "Software Engineer";
    const cleanAnswer = inputs.studentAnswer.trim();

    // Fast-path: If answer is trivial or empty, use deterministic heuristic evaluator directly
    if (cleanAnswer.split(/\s+/).filter(Boolean).length < 10) {
      return this.evaluateHeuristically(cleanAnswer, interviewType, inputs.questionCategory);
    }

    const { systemInstruction, dimensionPrompt } = this.getModeSpecificRubric(interviewType, targetRole);

    const fullSystemInstruction = `${systemInstruction}

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
  "improvedAnswerExample": string (Clearly formulated model answer illustrative of a top collegiate interview response),
  "followUpRecommendation": string
}`;

    const prompt = `<question_context>
Role: ${targetRole}
Interview Type: ${interviewType}
Question: ${inputs.questionText}
Category: ${inputs.questionCategory}
Guidance: ${dimensionPrompt}
</question_context>

<student_answer>
${cleanAnswer.slice(0, 3000)}
</student_answer>

Evaluate this answer against the mode-specific rubric. Be constructive, precise, and objective.`;

    try {
      const result = await GeminiClient.generate({
        prompt,
        systemInstruction: fullSystemInstruction,
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
      const rel = Math.min(100, Math.max(0, Number(parsed.relevanceScore) || 50));
      const tech = Math.min(100, Math.max(0, Number(parsed.technicalScore) || 50));
      const depth = Math.min(100, Math.max(0, Number(parsed.depthScore) || 45));
      const struct = Math.min(100, Math.max(0, Number(parsed.structureScore) || 50));
      const pract = Math.min(100, Math.max(0, Number(parsed.practicalReasoningScore) || 45));
      const comm = Math.min(100, Math.max(0, Number(parsed.communicationScore) || 50));
      const weightedOverall = Math.round((rel * 0.2) + (tech * 0.25) + (depth * 0.15) + (struct * 0.15) + (pract * 0.15) + (comm * 0.1));

      return {
        overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || weightedOverall)),
        relevanceScore: rel,
        technicalScore: tech,
        depthScore: depth,
        structureScore: struct,
        practicalReasoningScore: pract,
        communicationScore: comm,
        whatWentWell: Array.isArray(parsed.whatWentWell) && parsed.whatWentWell.length > 0 ? parsed.whatWentWell : ["Addressed the question topic."],
        whatWasMissing: Array.isArray(parsed.whatWasMissing) && parsed.whatWasMissing.length > 0 ? parsed.whatWasMissing : ["Elaborate further on trade-offs and concrete implementation details."],
        conceptualErrors: Array.isArray(parsed.conceptualErrors) ? parsed.conceptualErrors : [],
        improvedAnswerExample: parsed.improvedAnswerExample || "Structure your answer with problem context, architectural approach, and observable trade-offs.",
        followUpRecommendation: parsed.followUpRecommendation || "Review algorithmic trade-offs and practical code examples for this concept.",
      };
    } catch {
      // Deterministic evaluation fallback grounded in real answer heuristics
      return this.evaluateHeuristically(cleanAnswer, interviewType, inputs.questionCategory);
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
        overallScore: 0,
        relevanceScore: 0,
        technicalAccuracyScore: 0,
        depthScore: 0,
        structureScore: 0,
        practicalReasoningScore: 0,
        communicationScore: 0,
        summary: "Session completed without any evaluated turns.",
        strongAnswers: [],
        weakAnswers: [],
        technicalGaps: [],
        recommendedExercises: ["Review placement preparation topics and complete practice turns."],
        suggestedNextLevel: "BEGINNER",
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
      return this.evaluateHeuristically(clean, "TECHNICAL", "EVALUATION");
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
        overallScore: 0,
        relevanceScore: 0,
        technicalAccuracyScore: 0,
        depthScore: 0,
        structureScore: 0,
        practicalReasoningScore: 0,
        communicationScore: 0,
        finalFeedbackSummary: "Practice session completed without any evaluated turns.",
        strongAnswers: [],
        weakAnswers: [],
        technicalGaps: [],
        recommendedExercises: ["Practice problem formulation under time constraints and complete interactive turns."],
        suggestedNextLevel: "BEGINNER",
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
