/**
-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- QuestionBank Sentinel: Exact & Near-Duplicate Detector
-- ==============================================================================
*/

import crypto from "crypto";

export interface DuplicateDetectionResult {
  isExactDuplicate: boolean;
  highestSimilarity: number;
  matchedQuestionId?: string;
  matchedVersionId?: string;
  detectionMethod?: "EXACT_FINGERPRINT" | "TEXT_SIMILARITY" | "OPTION_OVERLAP";
  candidates: Array<{
    questionId: string;
    versionId: string;
    prompt: string;
    similarityScore: number;
    detectionMethod: "EXACT_FINGERPRINT" | "TEXT_SIMILARITY" | "OPTION_OVERLAP";
  }>;
}

export class DuplicateDetector {
  /**
   * Normalizes text by removing non-alphanumeric noise, lowercasing, and normalizing spaces.
   */
  public static normalizeText(text: string): string {
    if (!text) return "";
    return text
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Generates a deterministic SHA-256 fingerprint for a question's content.
   */
  public static generateFingerprint(
    prompt: string,
    options?: Array<{ text: string }> | unknown
  ): string {
    const normPrompt = this.normalizeText(prompt);

    let normOptionsStr = "";
    if (Array.isArray(options)) {
      const sortedNormOptions = options
        .map((opt) => this.normalizeText(opt?.text || ""))
        .filter((t) => t.length > 0)
        .sort();
      normOptionsStr = sortedNormOptions.join("|");
    }

    const payload = `${normPrompt}:::${normOptionsStr}`;
    return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
  }

  /**
   * Generates word tokens and 3-grams for comprehensive similarity matching.
   */
  private static extractTokens(text: string): Set<string> {
    const normalized = this.normalizeText(text);
    const words = normalized.split(" ").filter((w) => w.length > 2);
    const tokens = new Set<string>(words);

    // Also extract 3-grams for typo-resilient phrase matching
    for (let i = 0; i <= normalized.length - 3; i++) {
      tokens.add(normalized.substring(i, i + 3));
    }

    return tokens;
  }

  /**
   * Calculates Jaccard similarity coefficient between two texts: |A ∩ B| / |A ∪ B|
   */
  public static calculateSimilarity(textA: string, textB: string): number {
    const normA = this.normalizeText(textA);
    const normB = this.normalizeText(textB);

    if (normA === normB) return 1.0;
    if (!normA || !normB) return 0.0;

    const tokensA = this.extractTokens(normA);
    const tokensB = this.extractTokens(normB);

    if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

    let intersectionSize = 0;
    tokensA.forEach((token) => {
      if (tokensB.has(token)) {
        intersectionSize++;
      }
    });

    const unionSize = tokensA.size + tokensB.size - intersectionSize;
    if (unionSize === 0) return 0.0;

    const score = intersectionSize / unionSize;
    return Math.round(score * 10000) / 10000;
  }

  /**
   * Analyzes a candidate question against existing question records in the bank or tenant.
   */
  public static detectDuplicates(
    candidatePrompt: string,
    candidateFingerprint: string,
    existingItems: Array<{
      questionId: string;
      versionId: string;
      prompt: string;
      fingerprint: string;
    }>,
    nearDuplicateThreshold = 0.75
  ): DuplicateDetectionResult {
    const candidates: DuplicateDetectionResult["candidates"] = [];
    let isExact = false;
    let highestSim = 0;
    let topMatchedQuestionId: string | undefined;
    let topMatchedVersionId: string | undefined;
    let topMethod: DuplicateDetectionResult["detectionMethod"];

    for (const item of existingItems) {
      if (item.fingerprint === candidateFingerprint) {
        isExact = true;
        highestSim = 1.0;
        topMatchedQuestionId = item.questionId;
        topMatchedVersionId = item.versionId;
        topMethod = "EXACT_FINGERPRINT";

        candidates.push({
          questionId: item.questionId,
          versionId: item.versionId,
          prompt: item.prompt,
          similarityScore: 1.0,
          detectionMethod: "EXACT_FINGERPRINT",
        });
        continue;
      }

      // Compute text similarity
      const sim = this.calculateSimilarity(candidatePrompt, item.prompt);
      if (sim >= nearDuplicateThreshold) {
        if (sim > highestSim) {
          highestSim = sim;
          topMatchedQuestionId = item.questionId;
          topMatchedVersionId = item.versionId;
          topMethod = "TEXT_SIMILARITY";
        }

        candidates.push({
          questionId: item.questionId,
          versionId: item.versionId,
          prompt: item.prompt,
          similarityScore: sim,
          detectionMethod: "TEXT_SIMILARITY",
        });
      }
    }

    // Sort candidates descending by similarity
    candidates.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      isExactDuplicate: isExact,
      highestSimilarity: highestSim,
      matchedQuestionId: topMatchedQuestionId,
      matchedVersionId: topMatchedVersionId,
      detectionMethod: topMethod,
      candidates,
    };
  }
}
