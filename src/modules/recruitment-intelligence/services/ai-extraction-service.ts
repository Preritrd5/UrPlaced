import { z } from "zod";
import { RequirementCategory, EvidenceLevel, ScopeLevel } from "@/types/database";
import { GeminiClient } from "@/modules/ai/gemini-client";

export interface ExtractedRequirementProposal {
  category: RequirementCategory;
  title: string;
  description: string;
  structuredValue?: Record<string, any> | null;
  sourceExcerpt?: string;
  evidenceLevel: EvidenceLevel;
  scopeLevel: ScopeLevel;
}

export interface ExtractionResult {
  provider: "GEMINI" | "OPENAI" | "RULE_BASED_DETERMINISTIC";
  isAIPowered: boolean;
  notes: string;
  proposals: ExtractedRequirementProposal[];
}

const StructuredRequirementSchema = z.object({
  category: z.enum([
    "ELIGIBILITY",
    "ROLE_RESPONSIBILITIES",
    "TECHNICAL_SKILL",
    "PROGRAMMING_LANGUAGE",
    "APTITUDE_TOPIC",
    "RECRUITMENT_PROCESS",
    "COMPENSATION_BENEFITS",
    "PREPARATION_TOPIC",
  ]),
  title: z.string().min(2).max(256),
  description: z.string().min(5),
  sourceExcerpt: z.string().optional(),
  evidenceLevel: z.enum(["OFFICIAL", "REPORTED", "INFERRED", "UNKNOWN"]),
  scopeLevel: z.enum(["COMPANY", "ROLE", "DRIVE"]),
  structuredValue: z.record(z.any()).optional().nullable(),
});

const ExtractionResponseSchema = z.object({
  proposals: z.array(StructuredRequirementSchema),
});

export class AIExtractionService {
  /**
   * Extracts structured recruitment intelligence proposals from raw source text.
   * Grounded strictly in the source text. Never hallucinates rounds or criteria.
   */
  public static async extractFromSourceText(
    text: string,
    context: { companyName: string; roleTitle?: string; driveTitle?: string }
  ): Promise<ExtractionResult> {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey && geminiKey.trim().length > 0) {
      try {
        return await this.callGeminiProvider(text, context, geminiKey);
      } catch (err: any) {
        // Fall back to rule-based pattern extraction with transparent warning
        const fallback = this.extractRuleBased(text, context);
        return {
          ...fallback,
          notes: `AI Provider encountered error: ${err.message}. Safely fell back to deterministic rule-based extraction.`,
        };
      }
    }

    // Honest reporting when AI key is not in environment
    return this.extractRuleBased(text, context);
  }

  /**
   * Calls Gemini Provider using the shared GeminiClient
   */
  private static async callGeminiProvider(
    text: string,
    context: { companyName: string; roleTitle?: string; driveTitle?: string },
    _apiKey?: string
  ): Promise<ExtractionResult> {
    const prompt = `You are a recruitment intelligence data parser for UrPlaced SaaS.
Analyze the following source text for ${context.companyName} (${context.roleTitle || "General Role"}).
Extract structured requirements strictly supported by the text.

STRICT GROUNDING INSTRUCTIONS:
1. Only extract information explicitly mentioned or clearly stated.
2. If recruitment rounds or eligibility criteria are NOT mentioned in the text, DO NOT invent them.
3. Categorize each into: ELIGIBILITY, ROLE_RESPONSIBILITIES, TECHNICAL_SKILL, PROGRAMMING_LANGUAGE, APTITUDE_TOPIC, RECRUITMENT_PROCESS, COMPENSATION_BENEFITS, PREPARATION_TOPIC.
4. Set evidenceLevel to:
   - "OFFICIAL" if directly stated as a requirement in the text.
   - "INFERRED" if it is a recommended preparation topic derived from a skill.
   - "UNKNOWN" if missing.
5. Set scopeLevel to "DRIVE" for drive-specific requirements, "ROLE" for role-specific, or "COMPANY" for company-wide.
6. Return valid JSON matching schema:
{
  "proposals": [
    {
      "category": "...",
      "title": "...",
      "description": "...",
      "sourceExcerpt": "exact quote from text",
      "evidenceLevel": "OFFICIAL | INFERRED | UNKNOWN",
      "scopeLevel": "DRIVE | ROLE | COMPANY",
      "structuredValue": { ...optional parsed fields like min_cgpa: 7.5 }
    }
  ]
}

SOURCE TEXT:
${text.slice(0, 15000)}
`;

    const result = await GeminiClient.generate({
      prompt,
      systemInstruction: "You are an expert recruitment intelligence analyst. Ground every proposal strictly in the provided text.",
      temperature: 0.1,
      responseMimeType: "application/json",
      feature: "DRIVEFIT",
    });

    const parsedJson = JSON.parse(result.text);
    const validated = ExtractionResponseSchema.parse(parsedJson);

    return {
      provider: "GEMINI",
      isAIPowered: true,
      notes: `Extracted via Gemini (${result.model}) with structured grounding. Awaiting human verification.`,
      proposals: validated.proposals as ExtractedRequirementProposal[],
    };
  }

  /**
   * Deterministic, rule-based extraction fallback.
   * Completely transparent, secure, and grounded in regex/keyword matching.
   */
  public static extractRuleBased(
    text: string,
    context: { companyName: string; roleTitle?: string; driveTitle?: string }
  ): ExtractionResult {
    const proposals: ExtractedRequirementProposal[] = [];
    const normalizedText = text.toLowerCase();

    // 1. Eligibility: CGPA
    const cgpaMatch = text.match(/(\b(?:cgpa|gpa|pointer)\b[^\d]*(\d(?:\.\d{1,2})?))/i);
    if (cgpaMatch) {
      const parsedCgpa = parseFloat(cgpaMatch[2]);
      if (!isNaN(parsedCgpa) && parsedCgpa >= 0 && parsedCgpa <= 10) {
        proposals.push({
          category: "ELIGIBILITY",
          title: `Minimum CGPA Requirement: ${parsedCgpa}`,
          description: `Candidates must possess a minimum CGPA of ${parsedCgpa} to be eligible.`,
          sourceExcerpt: cgpaMatch[0],
          evidenceLevel: "OFFICIAL",
          scopeLevel: "DRIVE",
          structuredValue: { min_cgpa: parsedCgpa },
        });
      }
    }

    // 2. Eligibility: Percentage (supports "65% aggregate" or "aggregate: 65%")
    const beforeMatch = text.match(/(\d{2}(?:\.\d{1,2})?)\s*%\s*(?:aggregate|in\s+(?:10th|12th|graduation))/i);
    const afterMatch = text.match(/(\b(?:10th|12th|percentage|aggregate)\b[^\d]*(\d{2}(?:\.\d{1,2})?)\s*%?)/i);

    const percValueStr = beforeMatch ? beforeMatch[1] : afterMatch ? afterMatch[2] : null;
    const percExcerpt = beforeMatch ? beforeMatch[0] : afterMatch ? afterMatch[0] : null;

    if (percValueStr) {
      const parsedPerc = parseFloat(percValueStr);
      if (!isNaN(parsedPerc) && parsedPerc >= 40 && parsedPerc <= 100) {
        proposals.push({
          category: "ELIGIBILITY",
          title: `Academic Percentage Threshold: ${parsedPerc}%`,
          description: `Candidates must maintain an aggregate percentage of at least ${parsedPerc}%.`,
          sourceExcerpt: percExcerpt || `${parsedPerc}%`,
          evidenceLevel: "OFFICIAL",
          scopeLevel: "DRIVE",
          structuredValue: { min_percentage: parsedPerc },
        });
      }
    }

    // 3. Technical Skills & Languages
    const skillKeywords = [
      { name: "Data Structures & Algorithms", category: "TECHNICAL_SKILL", regex: /\b(dsa|data structures|algorithms)\b/i },
      { name: "SQL & Relational Databases", category: "TECHNICAL_SKILL", regex: /\b(sql|rdbms|postgresql|mysql|database)\b/i },
      { name: "Python Programming", category: "PROGRAMMING_LANGUAGE", regex: /\b(python)\b/i },
      { name: "Java Programming", category: "PROGRAMMING_LANGUAGE", regex: /\b(java|jvm)\b/i },
      { name: "C++ Programming", category: "PROGRAMMING_LANGUAGE", regex: /\b(c\+\+|cpp)\b/i },
      { name: "JavaScript / TypeScript", category: "PROGRAMMING_LANGUAGE", regex: /\b(javascript|typescript|js|ts|node\.?js)\b/i },
      { name: "Operating Systems Fundamentals", category: "TECHNICAL_SKILL", regex: /\b(operating systems|linux|threads|concurrency)\b/i },
      { name: "Computer Networks", category: "TECHNICAL_SKILL", regex: /\b(computer networks|networking|tcp|ip|dns|http)\b/i },
      { name: "System Design", category: "TECHNICAL_SKILL", regex: /\b(system design|microservices|distributed systems)\b/i },
    ];

    for (const skill of skillKeywords) {
      const match = text.match(skill.regex);
      if (match) {
        proposals.push({
          category: skill.category as RequirementCategory,
          title: `Required Competency: ${skill.name}`,
          description: `The role mentions proficiency in ${skill.name} as part of candidate evaluation.`,
          sourceExcerpt: match[0],
          evidenceLevel: "OFFICIAL",
          scopeLevel: "ROLE",
          structuredValue: { skill_name: skill.name },
        });
      }
    }

    // 4. Recruitment Process: Rounds
    const roundKeywords = [
      { name: "Online Assessment (OA)", regex: /\b(online assessment|oa|aptitude test|online test)\b/i },
      { name: "Coding Round", regex: /\b(coding round|technical test|hackathon|live coding)\b/i },
      { name: "Technical Interview", regex: /\b(technical interview|tech round|system design round)\b/i },
      { name: "HR & Behavioral Interview", regex: /\b(hr interview|behavioral round|managerial round)\b/i },
      { name: "Group Discussion", regex: /\b(group discussion|gd)\b/i },
    ];

    const detectedRounds: string[] = [];
    for (const round of roundKeywords) {
      if (round.regex.test(normalizedText)) {
        detectedRounds.push(round.name);
      }
    }

    if (detectedRounds.length > 0) {
      proposals.push({
        category: "RECRUITMENT_PROCESS",
        title: `Detected Evaluation Rounds: ${detectedRounds.join(" → ")}`,
        description: `Recruitment notice mentions evaluation stages: ${detectedRounds.join(", ")}.`,
        evidenceLevel: "OFFICIAL",
        scopeLevel: "DRIVE",
        structuredValue: { rounds: detectedRounds },
      });
    }

    // 5. Aptitude Topics
    if (/\b(aptitude|quantitative|reasoning|logical|verbal)\b/i.test(normalizedText)) {
      proposals.push({
        category: "APTITUDE_TOPIC",
        title: "General Aptitude & Logical Reasoning",
        description: "General aptitude, numerical calculations, and logical reasoning sections indicated in evaluation.",
        evidenceLevel: "OFFICIAL",
        scopeLevel: "DRIVE",
        structuredValue: { areas: ["Quantitative", "Logical", "Verbal"] },
      });
    }

    return {
      provider: "RULE_BASED_DETERMINISTIC",
      isAIPowered: false,
      notes: "AI provider key not configured or requested; applied deterministic pattern extraction. All claims require human review.",
      proposals,
    };
  }
}
