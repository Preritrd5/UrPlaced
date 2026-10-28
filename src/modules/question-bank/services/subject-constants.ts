/**
-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Subject Model & Canonical Normalization Constants
-- ==============================================================================
*/

import { BankCategory } from "@/types/database";

export interface StandardSubjectDefinition {
  canonicalName: string;
  code: string;
  defaultCategory: BankCategory;
  description: string;
  aliases: string[];
}

export const STANDARD_SUBJECTS: StandardSubjectDefinition[] = [
  {
    canonicalName: "Computer Networks",
    code: "CN",
    defaultCategory: "TECHNICAL_CORE",
    description: "OSI model, TCP/IP, routing, switching, protocols, and network security",
    aliases: ["cn", "computer networks", "computer network", "networking", "network"],
  },
  {
    canonicalName: "Database Management Systems",
    code: "DBMS",
    defaultCategory: "TECHNICAL_CORE",
    description: "Relational models, SQL, indexing, normalization, transactions, and ACID",
    aliases: ["dbms", "database", "databases", "database management", "database management systems", "sql"],
  },
  {
    canonicalName: "Operating Systems",
    code: "OS",
    defaultCategory: "TECHNICAL_CORE",
    description: "Process scheduling, concurrency, deadlocks, memory virtualization, and file systems",
    aliases: ["os", "operating system", "operating systems"],
  },
  {
    canonicalName: "Data Structures & Algorithms",
    code: "DSA",
    defaultCategory: "CODING",
    description: "Arrays, linked lists, trees, graphs, sorting, dynamic programming, and complexity",
    aliases: ["dsa", "data structures", "data structures and algorithms", "data structures & algorithms", "algorithms"],
  },
  {
    canonicalName: "Coding",
    code: "CODING",
    defaultCategory: "CODING",
    description: "Hands-on programming, syntax, language fundamentals, and algorithmic problem solving",
    aliases: ["coding", "programming", "software engineering", "code"],
  },
  {
    canonicalName: "Aptitude",
    code: "APTITUDE",
    defaultCategory: "APTITUDE",
    description: "Quantitative aptitude, arithmetic, analytical reasoning, and data interpretation",
    aliases: ["aptitude", "quant", "quantitative", "quantitative aptitude", "numerical ability"],
  },
  {
    canonicalName: "Verbal Ability",
    code: "VERBAL",
    defaultCategory: "GENERAL",
    description: "Reading comprehension, grammar, vocabulary, sentence correction, and critical reasoning",
    aliases: ["verbal", "verbal ability", "english", "comprehension", "communication skills"],
  },
];

/**
 * Normalizes a raw subject string into a clean, canonical format.
 * Matches standard academic subjects case-insensitively via aliases,
 * or standardizes custom subject strings with proper spacing and title casing.
 */
export function normalizeSubjectName(rawSubject: string | null | undefined): string {
  if (!rawSubject) return "General";

  const cleaned = rawSubject
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) return "General";

  const lower = cleaned.toLowerCase();

  // Check alias matches
  for (const sub of STANDARD_SUBJECTS) {
    if (sub.canonicalName.toLowerCase() === lower || sub.code.toLowerCase() === lower) {
      return sub.canonicalName;
    }
    if (sub.aliases.some((alias) => alias.toLowerCase() === lower)) {
      return sub.canonicalName;
    }
  }

  // If custom subject, format nicely (capitalized words) up to 128 characters
  const formatted = cleaned
    .split(" ")
    .map((word) => {
      if (word.length <= 1) return word.toUpperCase();
      // Handle acronyms like "AI", "ML", "AWS"
      if (word === word.toUpperCase() && word.length <= 4) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

  return formatted.slice(0, 128);
}

/**
 * Determines default broad BankCategory for a given subject.
 */
export function getDefaultCategoryForSubject(subjectName: string): BankCategory {
  const normalized = normalizeSubjectName(subjectName);
  const matched = STANDARD_SUBJECTS.find(
    (s) => s.canonicalName.toLowerCase() === normalized.toLowerCase()
  );
  return matched ? matched.defaultCategory : "TECHNICAL_CORE";
}

/**
 * Validates subject string format and length.
 */
export function validateSubjectName(subject: string | null | undefined): {
  isValid: boolean;
  error?: string;
  normalized?: string;
} {
  if (!subject || !subject.trim()) {
    return { isValid: false, error: "Subject is required and cannot be empty." };
  }

  const trimmed = subject.trim();
  if (trimmed.length > 128) {
    return { isValid: false, error: "Subject cannot exceed 128 characters." };
  }

  const normalized = normalizeSubjectName(trimmed);
  return { isValid: true, normalized };
}
