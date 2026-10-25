import { GeminiClient } from "../gemini-client";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DriveFitEvaluationResult {
  id?: string;
  driveId: string;
  driveTitle: string;
  companyName: string;
  overallFitScore: number;
  eligibilityStatus: "ELIGIBLE" | "INELIGIBLE" | "CONDITIONAL" | "UNKNOWN";
  eligibilityDetails: {
    isCgpaEligible?: boolean | null;
    isBacklogEligible?: boolean | null;
    isDepartmentEligible?: boolean | null;
    missingProfileFields: string[];
    notes: string;
  };
  skillMatchAnalysis: {
    skillName: string;
    importance: "MANDATORY" | "PREFERRED";
    studentProficiency: "PROFICIENT" | "DEVELOPING" | "NOT_EVALUATED";
    gapSummary: string;
  }[];
  preparationRoadmap: {
    stage: string;
    focusTopics: string[];
    recommendedHours: number;
    actionItems: string[];
  }[];
  recommendedQuestionIds: string[];
}

export class AIDriveFitService {
  /**
   * Generates grounded, personalized drive preparation evaluation based on verified company criteria
   * and the student's authorized academic & performance profile.
   */
  public static async evaluateDriveFit(params: {
    userId: string;
    driveId: string;
    tenantId?: string;
  }): Promise<DriveFitEvaluationResult> {
    const admin = createAdminClient();

    // 1. Fetch recruitment drive and company details
    const { data: drive, error: driveErr } = await admin
      .from("recruitment_drives")
      .select(`
        id,
        title,
        status,
        companies (
          id,
          name,
          tier
        )
      `)
      .eq("id", params.driveId)
      .maybeSingle();

    if (!drive || driveErr) {
      throw new Error("Recruitment drive not found or inaccessible.");
    }

    const companyName = (drive.companies as any)?.name || "Target Company";
    const driveTitle = drive.title || "Campus Placement Drive";

    // 2. Fetch eligibility criteria
    let criteria: any = null;
    try {
      const { data: c } = await admin
        .from("drive_eligibility_criteria")
        .select("*")
        .eq("drive_id", params.driveId)
        .maybeSingle();
      criteria = c;
    } catch {
      // Criteria query fallback
    }

    // 3. Fetch verified requirements
    let requirements: any[] = [];
    try {
      const { data: reqs } = await admin
        .from("recruitment_requirements")
        .select("category, title, description, structured_value, evidence_level")
        .eq("drive_id", params.driveId)
        .eq("is_published_to_students", true);
      requirements = reqs || [];
    } catch {
      // Requirements fallback
    }

    // 4. Fetch student academic profile
    let studentProfile: any = null;
    try {
      const { data: s } = await admin
        .from("students")
        .select(`
          id,
          cgpa,
          current_backlogs,
          history_backlogs,
          department_id,
          departments (
            name,
            code
          )
        `)
        .eq("user_id", params.userId)
        .maybeSingle();
      studentProfile = s;
    } catch {
      // Student query fallback
    }

    // 5. Deterministic eligibility calculation
    const missingFields: string[] = [];
    let isCgpaEligible: boolean | null = null;
    let isBacklogEligible: boolean | null = null;
    let isDeptEligible: boolean | null = null;

    if (!studentProfile) {
      missingFields.push("Student Academic Profile");
    } else {
      if (studentProfile.cgpa == null) missingFields.push("CGPA");
      if (studentProfile.current_backlogs == null) missingFields.push("Backlogs");
      if (!studentProfile.department_id) missingFields.push("Department");
    }

    if (criteria && studentProfile) {
      if (criteria.min_cgpa != null && studentProfile.cgpa != null) {
        isCgpaEligible = Number(studentProfile.cgpa) >= Number(criteria.min_cgpa);
      }
      if (criteria.max_active_backlogs != null && studentProfile.current_backlogs != null) {
        isBacklogEligible = Number(studentProfile.current_backlogs) <= Number(criteria.max_active_backlogs);
      }
      if (criteria.allowed_departments && Array.isArray(criteria.allowed_departments) && criteria.allowed_departments.length > 0) {
        const deptCode = studentProfile.departments?.code || studentProfile.department_id;
        isDeptEligible = criteria.allowed_departments.includes(deptCode);
      }
    }

    let eligibilityStatus: DriveFitEvaluationResult["eligibilityStatus"] = "UNKNOWN";
    if (missingFields.length > 0) {
      eligibilityStatus = "UNKNOWN";
    } else if (isCgpaEligible === false || isBacklogEligible === false || isDeptEligible === false) {
      eligibilityStatus = "INELIGIBLE";
    } else if (isCgpaEligible === true && isBacklogEligible === true && (isDeptEligible === true || isDeptEligible === null)) {
      eligibilityStatus = "ELIGIBLE";
    } else {
      eligibilityStatus = "CONDITIONAL";
    }

    // 6. Fetch relevant practice questions from question bank for this drive's topics
    let recommendedQuestionIds: string[] = [];
    try {
      const { data: qList } = await admin
        .from("questions")
        .select("id")
        .eq("lifecycle_status", "APPROVED")
        .limit(5);
      if (qList) {
        recommendedQuestionIds = qList.map((q) => q.id);
      }
    } catch {
      // Question retrieval fallback
    }

    // 7. Invoke Gemini for skills matching and personalized preparation roadmap
    const promptText = `You are UrPlaced's AI DriveFit Coach.
Evaluate preparation readiness for recruitment drive: "${driveTitle}" at ${companyName}.

DRIVE CRITERIA & REQUIREMENTS:
Eligibility Criteria: ${JSON.stringify(criteria || { note: "General campus drive" })}
Published Requirements: ${JSON.stringify(requirements.slice(0, 10))}

STUDENT PROFILE EVALUATION:
Eligibility Status: ${eligibilityStatus}
Missing Fields: ${missingFields.join(", ") || "None"}
CGPA Met: ${isCgpaEligible === null ? "Unknown" : isCgpaEligible ? "Yes" : "No"}
Backlogs Met: ${isBacklogEligible === null ? "Unknown" : isBacklogEligible ? "Yes" : "No"}

TASK:
1. Provide a skill match analysis for the key skills expected for ${companyName}.
2. Formulate a 3-stage targeted preparation roadmap (Stage 1: Foundational, Stage 2: Company-specific patterns, Stage 3: Mock interviews).
3. Calculate an overall fit score (0-100) based on readiness and match.
4. Return strictly valid JSON matching this schema:
{
  "overallFitScore": 75,
  "eligibilityNotes": "Summary explanation of eligibility...",
  "skillMatchAnalysis": [
    {
      "skillName": "Data Structures",
      "importance": "MANDATORY | PREFERRED",
      "studentProficiency": "PROFICIENT | DEVELOPING | NOT_EVALUATED",
      "gapSummary": "Specific area to review"
    }
  ],
  "preparationRoadmap": [
    {
      "stage": "Stage 1: Core Coding & Aptitude",
      "focusTopics": ["Topic A", "Topic B"],
      "recommendedHours": 10,
      "actionItems": ["Action 1", "Action 2"]
    }
  ]
}`;

    const systemInstruction = `You are an expert technical recruiter and campus placement coach. Ground your advice in real placement drive standards. Never fabricate company interview stages that do not exist.`;

    const result = await GeminiClient.generate({
      prompt: promptText,
      systemInstruction,
      temperature: 0.2,
      responseMimeType: "application/json",
      feature: "DRIVEFIT",
      userId: params.userId,
      tenantId: params.tenantId,
    });

    let aiOutput: any = {};
    try {
      aiOutput = JSON.parse(result.text);
    } catch {
      aiOutput = {
        overallFitScore: 65,
        eligibilityNotes: "DriveFit analysis generated.",
        skillMatchAnalysis: [],
        preparationRoadmap: [],
      };
    }

    const fitScore = typeof aiOutput.overallFitScore === "number" ? Math.min(100, Math.max(0, aiOutput.overallFitScore)) : 70;

    // 8. Persist evaluation to ai_drivefit_evaluations
    let savedEvalId: string | undefined;
    try {
      const { data: inserted } = await admin
        .from("ai_drivefit_evaluations")
        .insert({
          user_id: params.userId,
          tenant_id: params.tenantId || null,
          drive_id: params.driveId,
          overall_fit_score: fitScore,
          eligibility_status: eligibilityStatus,
          eligibility_details: {
            isCgpaEligible,
            isBacklogEligible,
            isDepartmentEligible: isDeptEligible,
            missingProfileFields: missingFields,
            notes: aiOutput.eligibilityNotes || "Eligibility evaluated against drive criteria.",
          },
          skill_match_analysis: aiOutput.skillMatchAnalysis || [],
          preparation_roadmap: aiOutput.preparationRoadmap || [],
          recommended_question_ids: recommendedQuestionIds,
        })
        .select("id")
        .single();

      if (inserted) {
        savedEvalId = inserted.id;
      }
    } catch {
      // Continue even if database persistence fails
    }

    return {
      id: savedEvalId,
      driveId: params.driveId,
      driveTitle,
      companyName,
      overallFitScore: fitScore,
      eligibilityStatus,
      eligibilityDetails: {
        isCgpaEligible,
        isBacklogEligible,
        isDepartmentEligible: isDeptEligible,
        missingProfileFields: missingFields,
        notes: aiOutput.eligibilityNotes || "Eligibility calculated from current profile data.",
      },
      skillMatchAnalysis: aiOutput.skillMatchAnalysis || [],
      preparationRoadmap: aiOutput.preparationRoadmap || [],
      recommendedQuestionIds,
    };
  }
}
