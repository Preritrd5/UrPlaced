/**
-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- QuestionBank Sentinel: CSV Import & Pre-Commit Preview Service
-- ==============================================================================
*/

import {
  QuestionType,
  QuestionDifficulty,
  QuestionSourceType,
} from "@/types/database";
import { QuestionValidator, McqOption } from "./question-validator";
import { DuplicateDetector } from "./duplicate-detector";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ParsedCsvRow {
  rowNumber: number;
  question_type: QuestionType;
  prompt: string;
  difficulty: QuestionDifficulty;
  options: McqOption[];
  answer_key: Record<string, unknown>;
  explanation: string;
  skill_normalized_name?: string;
  topic_tags: string[];
  source_type: QuestionSourceType;
  source_reference?: string;
  isValid: boolean;
  isDuplicate: boolean;
  duplicateSource?: "DATABASE" | "FILE";
  errors: string[];
  warnings: string[];
  fingerprint: string;
  duplicateQuestionId?: string;
  similarityScore?: number;
}

export interface ImportPreviewResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  existingDuplicateRows: number;
  intraFileDuplicateRows: number;
  rows: ParsedCsvRow[];
  generalErrors: string[];
}

export class ImportService {
  /**
   * Generates a sample CSV template with formula-safe structure for questions.
   */
  public static generateCsvTemplate(): string {
    const headers = [
      "question_type",
      "prompt",
      "difficulty",
      "option_a",
      "option_b",
      "option_c",
      "option_d",
      "correct_answer",
      "explanation",
      "skill_normalized_name",
      "topic_tags",
    ].join(",");

    const sampleRows = [
      'SINGLE_CHOICE,"What is the time complexity of searching an element in a balanced Binary Search Tree (BST)?",EASY,"O(1)","O(log N)","O(N)","O(N log N)",opt_b,"In a balanced BST of N nodes, maximum tree height is log2(N).",dsa,"bst;trees;algorithms"',
      'MULTIPLE_SELECT,"Which of the following sorting algorithms exhibit O(N log N) worst-case time complexity?",MEDIUM,"Quick Sort","Merge Sort","Heap Sort","Bubble Sort","opt_b;opt_c","Merge sort and Heap sort always run in O(N log N) in all cases, whereas standard Quick Sort is O(N^2) worst case.",dsa,"sorting;divide-and-conquer"',
      'NUMERIC,"What is the total number of edges in a complete undirected graph with 6 vertices?",MEDIUM,,,,"15","Formula for complete graph Kn is n*(n-1)/2. For n=6, 6*5/2 = 15.",quantitative-aptitude,"graphs;combinatorics"',
      'SHORT_ANSWER,"Explain the ACID properties in relational database management systems.",MEDIUM,,,,"Atomicity, Consistency, Isolation, Durability guarantee valid state transitions.","A complete answer defines each letter with an example transaction rollback.",dbms,"transactions;acid"',
      'CODING,"Implement an in-place array reversal algorithm.",EASY,,,,,"[3, 2, 1]","Two pointers swapping towards middle.",dsa,"arrays;two-pointers"',
    ];

    return [headers, ...sampleRows].join("\n");
  }

  /**
   * Sanitizes cell values against Spreadsheet Formula Injection (CSV Injection).
   */
  public static sanitizeCell(value: string): string {
    if (!value) return "";

    // Check dangerous formula injection triggers: =, +, -, @, tab, carriage return
    const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];
    if (dangerousPrefixes.some((p) => value.startsWith(p))) {
      return "'" + value;
    }

    const trimmed = value.trim();
    if (dangerousPrefixes.some((p) => trimmed.startsWith(p))) {
      return "'" + trimmed;
    }

    return trimmed;
  }

  /**
   * Lightweight RFC 4180 compliant CSV parser that handles quotes, escaped quotes, and newlines.
   */
  public static parseCsvLines(csvContent: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = "";
    let insideQuotes = false;

    for (let i = 0; i < csvContent.length; i++) {
      const char = csvContent[i];
      const nextChar = csvContent[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        currentRow.push(this.sanitizeCell(currentCell));
        currentCell = "";
      } else if ((char === "\r" || char === "\n") && !insideQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i++; // handle CRLF
        }
        currentRow.push(this.sanitizeCell(currentCell));
        currentCell = "";
        if (currentRow.some((c) => c.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(this.sanitizeCell(currentCell));
      if (currentRow.some((c) => c.trim().length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Pre-commit validation and duplicate detection for an uploaded CSV string.
   */
  public static async previewImport(
    tenantId: string,
    fileName: string,
    csvContent: string,
    existingItems: Array<{
      questionId: string;
      versionId: string;
      prompt: string;
      fingerprint: string;
    }> = []
  ): Promise<ImportPreviewResult> {
    const rawRows = this.parseCsvLines(csvContent);
    const generalErrors: string[] = [];

    if (rawRows.length < 2) {
      return {
        fileName,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        existingDuplicateRows: 0,
        intraFileDuplicateRows: 0,
        rows: [],
        generalErrors: ["CSV file is empty or missing headers and data rows."],
      };
    }

    const headers = rawRows[0].map((h) => h.toLowerCase().trim().replace(/^'/, ""));
    const dataRows = rawRows.slice(1);

    const requiredHeaders = ["question_type", "prompt", "correct_answer"];
    const missingHeaders = requiredHeaders.filter((req) => !headers.includes(req));
    if (missingHeaders.length > 0) {
      generalErrors.push(`Missing mandatory CSV header columns: ${missingHeaders.join(", ")}`);
      return {
        fileName,
        totalRows: dataRows.length,
        validRows: 0,
        invalidRows: dataRows.length,
        duplicateRows: 0,
        existingDuplicateRows: 0,
        intraFileDuplicateRows: 0,
        rows: [],
        generalErrors,
      };
    }

    const colIndex = (col: string) => headers.indexOf(col);

    const parsedRows: ParsedCsvRow[] = [];
    const seenInFile: Array<{
      questionId: string;
      versionId: string;
      prompt: string;
      fingerprint: string;
    }> = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    let existingDuplicateCount = 0;
    let intraFileDuplicateCount = 0;

    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      const rowNum = r + 2; // +1 for 0-index, +1 for header line
      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];

      const qTypeRaw = (row[colIndex("question_type")] || "").trim().toUpperCase().replace(/^'/, "");
      const prompt = (row[colIndex("prompt")] || "").trim();
      const difficultyRaw = (row[colIndex("difficulty")] || "MEDIUM").trim().toUpperCase().replace(/^'/, "");
      const correctAnswer = (row[colIndex("correct_answer")] || "").trim().replace(/^'/, "");
      const explanation = (row[colIndex("explanation")] || "").trim().replace(/^'/, "");
      const skillName = (row[colIndex("skill_normalized_name")] || "").trim().replace(/^'/, "");
      const tagsRaw = (row[colIndex("topic_tags")] || "").trim().replace(/^'/, "");

      // Validate question type
      const validTypes: QuestionType[] = [
        "SINGLE_CHOICE",
        "MULTIPLE_SELECT",
        "NUMERIC",
        "SHORT_ANSWER",
        "CODING",
      ];
      const qType = validTypes.includes(qTypeRaw as QuestionType)
        ? (qTypeRaw as QuestionType)
        : null;

      if (!qType) {
        rowErrors.push(`Invalid question_type '${qTypeRaw}'. Must be one of: ${validTypes.join(", ")}`);
      }

      // Validate difficulty
      const validDifficulties: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];
      const difficulty = validDifficulties.includes(difficultyRaw as QuestionDifficulty)
        ? (difficultyRaw as QuestionDifficulty)
        : "MEDIUM";

      // Build options
      const options: McqOption[] = [];
      const optA = (row[colIndex("option_a")] || "").trim().replace(/^'/, "");
      const optB = (row[colIndex("option_b")] || "").trim().replace(/^'/, "");
      const optC = (row[colIndex("option_c")] || "").trim().replace(/^'/, "");
      const optD = (row[colIndex("option_d")] || "").trim().replace(/^'/, "");

      if (optA) options.push({ id: "opt_a", text: optA });
      if (optB) options.push({ id: "opt_b", text: optB });
      if (optC) options.push({ id: "opt_c", text: optC });
      if (optD) options.push({ id: "opt_d", text: optD });

      // Build answer key
      let answerKey: Record<string, unknown> = {};

      if (qType === "SINGLE_CHOICE") {
        const correctId = correctAnswer.toLowerCase().trim();
        answerKey = { correct_option_id: correctId };
      } else if (qType === "MULTIPLE_SELECT") {
        const correctIds = correctAnswer
          .split(/[,;]/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.length > 0);
        answerKey = { correct_option_ids: correctIds };
      } else if (qType === "NUMERIC") {
        const val = parseFloat(correctAnswer);
        if (isNaN(val)) {
          rowErrors.push(`Correct answer for NUMERIC question must be a number, received '${correctAnswer}'.`);
        }
        answerKey = { value: val, tolerance: 0 };
      } else if (qType === "SHORT_ANSWER") {
        answerKey = {
          rubric: correctAnswer || "Evaluate against standard conceptual points.",
          sample_answer: explanation || undefined,
        };
      } else if (qType === "CODING") {
        answerKey = {
          test_cases: [
            { input: "1", expected_output: correctAnswer, is_hidden: false },
          ],
        };
      }

      // Validate structural rules
      if (qType) {
        const structCheck = QuestionValidator.validate({
          question_type: qType,
          prompt,
          difficulty,
          options,
          answer_key: answerKey,
          explanation,
        });

        rowErrors.push(...structCheck.errors);
        rowWarnings.push(...structCheck.warnings);
      }

      // Fingerprint & Duplicate Detection
      const fingerprint = DuplicateDetector.generateFingerprint(prompt, options);
      const candidates = [...existingItems, ...seenInFile];
      const dupCheck = DuplicateDetector.detectDuplicates(
        prompt,
        fingerprint,
        candidates
      );

      const isDuplicate = dupCheck.isExactDuplicate || dupCheck.highestSimilarity >= 0.85;
      let duplicateSource: "DATABASE" | "FILE" | undefined;
      if (isDuplicate) {
        duplicateCount++;
        const isIntraFile = dupCheck.matchedQuestionId?.startsWith("row-");
        if (isIntraFile) {
          intraFileDuplicateCount++;
          duplicateSource = "FILE";
        } else {
          existingDuplicateCount++;
          duplicateSource = "DATABASE";
        }

        const targetDesc = isIntraFile
          ? `earlier ${dupCheck.matchedQuestionId}`
          : `existing question ${dupCheck.matchedQuestionId}`;
        rowWarnings.push(
          dupCheck.isExactDuplicate
            ? `Exact duplicate detected of ${targetDesc}`
            : `High similarity (${Math.round(dupCheck.highestSimilarity * 100)}%) to ${targetDesc}`
        );
      }

      // Add valid or formatted rows to seenInFile for subsequent intra-file duplicate detection
      if (prompt.length > 0) {
        seenInFile.push({
          questionId: `row-${rowNum}`,
          versionId: `v-row-${rowNum}`,
          prompt,
          fingerprint,
        });
      }

      const isValid = rowErrors.length === 0;
      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
      }

      const topicTags = tagsRaw
        ? tagsRaw
            .split(/[,;]/)
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0)
        : [];

      parsedRows.push({
        rowNumber: rowNum,
        question_type: qType || "SINGLE_CHOICE",
        prompt,
        difficulty,
        options,
        answer_key: answerKey,
        explanation,
        skill_normalized_name: skillName || undefined,
        topic_tags: topicTags,
        source_type: "COLLEGE_AUTHORED",
        isValid,
        isDuplicate,
        duplicateSource,
        errors: rowErrors,
        warnings: rowWarnings,
        fingerprint,
        duplicateQuestionId: dupCheck.matchedQuestionId,
        similarityScore: dupCheck.highestSimilarity,
      });
    }

    return {
      fileName,
      totalRows: dataRows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicateCount,
      existingDuplicateRows: existingDuplicateCount,
      intraFileDuplicateRows: intraFileDuplicateCount,
      rows: parsedRows,
      generalErrors,
    };
  }

  /**
   * Commits validated preview items into the database.
   * Invariant: Questions are committed as DRAFT or PENDING_REVIEW; NEVER auto-published.
   */
  public static async commitImport(
    tenantId: string,
    userId: string,
    bankId: string,
    fileName: string,
    itemsToCommit: ParsedCsvRow[]
  ): Promise<{
    success: boolean;
    jobId?: string;
    committedCount: number;
    duplicateAlertCount: number;
    error?: string;
  }> {
    const supabase = await createServerSupabaseClient();

    // 0. Verify Bank Ownership & Tenant Boundary
    const { data: bankRecord, error: bankErr } = await supabase
      .from("question_banks")
      .select("id, tenant_id, name, category")
      .eq("id", bankId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (bankErr || !bankRecord) {
      return {
        success: false,
        committedCount: 0,
        duplicateAlertCount: 0,
        error: "Target Question Bank not found or does not belong to your college.",
      };
    }

    // 1. Create Import Job Record
    const { data: job, error: jobErr } = await supabase
      .from("question_import_jobs")
      .insert({
        tenant_id: tenantId,
        bank_id: bankId,
        file_name: fileName,
        total_rows: itemsToCommit.length,
        valid_rows: itemsToCommit.filter((i) => i.isValid).length,
        invalid_rows: itemsToCommit.filter((i) => !i.isValid).length,
        duplicate_rows: itemsToCommit.filter((i) => i.isDuplicate).length,
        status: "COMMITTED",
        error_report: itemsToCommit
          .filter((i) => !i.isValid || i.warnings.length > 0)
          .map((i) => ({
            rowNumber: i.rowNumber,
            errors: i.errors,
            warnings: i.warnings,
          })),
        created_by: userId,
        committed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobErr) {
      return {
        success: false,
        committedCount: 0,
        duplicateAlertCount: 0,
        error: jobErr.message,
      };
    }

    // 2. Fetch skill map if any skill_normalized_name provided
    const skillNorms = itemsToCommit
      .map((i) => i.skill_normalized_name)
      .filter((s): s is string => !!s);

    const skillIdMap = new Map<string, string>();
    if (skillNorms.length > 0) {
      const { data: skills } = await supabase
        .from("canonical_skills")
        .select("id, normalized_name")
        .in("normalized_name", skillNorms);

      skills?.forEach((s: any) => skillIdMap.set(s.normalized_name, s.id));
    }

    let committedCount = 0;
    let duplicateAlertCount = 0;

    for (const item of itemsToCommit) {
      if (!item.isValid) continue;

      const skillId = item.skill_normalized_name
        ? skillIdMap.get(item.skill_normalized_name) || null
        : null;

      // Create Question Entity
      const { data: qData, error: qErr } = await supabase
        .from("questions")
        .insert({
          tenant_id: tenantId,
          bank_id: bankId,
          question_type: item.question_type,
          lifecycle_status: "PENDING_REVIEW", // Invariant: Never auto-published
        })
        .select("id")
        .single();

      if (qErr || !qData) continue;

      // Create Initial Question Version (v1)
      const { data: vData, error: vErr } = await supabase
        .from("question_versions")
        .insert({
          tenant_id: tenantId,
          question_id: qData.id,
          version_number: 1,
          prompt: item.prompt,
          content_format: "MARKDOWN",
          options: item.options as unknown as Record<string, unknown>[],
          answer_key: item.answer_key,
          explanation: item.explanation || null,
          difficulty: item.difficulty,
          skill_id: skillId,
          topic_tags: item.topic_tags,
          source_type: item.source_type,
          source_reference: `Imported from ${fileName} (Row ${item.rowNumber})`,
          license_type: "PROPRIETARY",
          review_status: "UNREVIEWED",
          fingerprint: item.fingerprint,
          change_summary: `Initial batch import from ${fileName}`,
          created_by: userId,
        })
        .select("id")
        .single();

      if (vErr || !vData) continue;

      // Set current_version_id
      await supabase
        .from("questions")
        .update({ current_version_id: vData.id })
        .eq("id", qData.id);

      // Record duplicate candidate if matched with an existing database question (valid UUID)
      const isUuid = (val?: string) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      if (item.duplicateQuestionId && item.similarityScore && isUuid(item.duplicateQuestionId)) {
        duplicateAlertCount++;
        await supabase.from("question_duplicate_candidates").insert({
          tenant_id: tenantId,
          source_question_id: qData.id,
          matched_question_id: item.duplicateQuestionId,
          similarity_score: item.similarityScore,
          detection_method: item.isDuplicate && item.similarityScore === 1.0 ? "EXACT_FINGERPRINT" : "TEXT_SIMILARITY",
          status: "PENDING_REVIEW",
        });
      }

      committedCount++;
    }

    return {
      success: true,
      jobId: job?.id,
      committedCount,
      duplicateAlertCount,
    };
  }
}
