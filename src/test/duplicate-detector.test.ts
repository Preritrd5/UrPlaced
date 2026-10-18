import { describe, it, expect } from "vitest";
import { DuplicateDetector } from "@/modules/question-bank/services/duplicate-detector";

describe("DuplicateDetector", () => {
  it("normalizes text cleanly", () => {
    const raw = "  What   is the TIME complexity of Binary Search?!  \n";
    const norm = DuplicateDetector.normalizeText(raw);
    expect(norm).toBe("what is the time complexity of binary search");
  });

  it("produces identical fingerprints regardless of option ordering", () => {
    const prompt = "Which layer does HTTP operate on?";
    const options1 = [
      { text: "Application Layer" },
      { text: "Transport Layer" },
      { text: "Network Layer" },
    ];
    const options2 = [
      { text: "Network Layer" },
      { text: "Application Layer" },
      { text: "Transport Layer" },
    ];

    const fp1 = DuplicateDetector.generateFingerprint(prompt, options1);
    const fp2 = DuplicateDetector.generateFingerprint(prompt, options2);

    expect(fp1).toBe(fp2);
  });

  it("detects exact duplicates via fingerprint", () => {
    const prompt = "What is the worst case time complexity of Quick Sort?";
    const fp = DuplicateDetector.generateFingerprint(prompt, [
      { text: "O(n^2)" },
      { text: "O(n log n)" },
    ]);

    const existing = [
      {
        questionId: "q_1",
        versionId: "v_1",
        prompt,
        fingerprint: fp,
      },
      {
        questionId: "q_2",
        versionId: "v_2",
        prompt: "Unrelated question",
        fingerprint: "hash_2",
      },
    ];

    const result = DuplicateDetector.detectDuplicates(prompt, fp, existing);

    expect(result.isExactDuplicate).toBe(true);
    expect(result.highestSimilarity).toBe(1.0);
    expect(result.matchedQuestionId).toBe("q_1");
    expect(result.detectionMethod).toBe("EXACT_FINGERPRINT");
  });

  it("flags near-duplicate questions with high text similarity", () => {
    const promptA = "What is the time complexity of searching an element in a binary search tree?";
    const promptB = "What is the time complexity to search for an element in a binary search tree?";

    const sim = DuplicateDetector.calculateSimilarity(promptA, promptB);
    expect(sim).toBeGreaterThanOrEqual(0.75);

    const fpA = DuplicateDetector.generateFingerprint(promptA);
    const existing = [
      {
        questionId: "q_existing",
        versionId: "v_existing",
        prompt: promptB,
        fingerprint: "different_fingerprint",
      },
    ];

    const result = DuplicateDetector.detectDuplicates(promptA, fpA, existing, 0.75);

    expect(result.isExactDuplicate).toBe(false);
    expect(result.highestSimilarity).toBeGreaterThanOrEqual(0.75);
    expect(result.matchedQuestionId).toBe("q_existing");
    expect(result.detectionMethod).toBe("TEXT_SIMILARITY");
  });

  it("returns low similarity for completely distinct questions", () => {
    const promptA = "Calculate the derivative of sin(x) with respect to x.";
    const promptB = "Describe how TCP handles congestion control using slow start.";

    const sim = DuplicateDetector.calculateSimilarity(promptA, promptB);
    expect(sim).toBeLessThan(0.15);
  });
});
