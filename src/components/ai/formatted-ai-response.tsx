"use client";

import React, { useState } from "react";
import { Check, Copy, Terminal, Lightbulb, Sparkles, HelpCircle } from "lucide-react";

export interface FormattedAIResponseProps {
  content: string;
  className?: string;
  onCopyFull?: () => void;
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; language: string; code: string }
  | {
      type: "table";
      headers: string[];
      alignments: ("left" | "center" | "right")[];
      rows: string[][];
    }
  | { type: "blockquote"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

/**
 * Checks if a line is a markdown table separator row like:
 * |:---|:---:|---:|
 */
function isTableDivider(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = withoutEdges.split("|").map((c) => c.trim());
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c));
}

/**
 * Extracts alignment from a table divider cell (e.g. ":---:", "---:", ":---")
 */
function parseAlignment(cell: string): "left" | "center" | "right" {
  const c = cell.trim();
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

/**
 * Splits a table row string into individual cells.
 */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdges.split("|").map((cell) => cell.trim());
}

/**
 * Parses markdown text into high-level structured blocks.
 */
function parseMarkdownBlocks(rawText: string): Block[] {
  const lines = rawText.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Fenced Code Block
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim() || "code";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        type: "code",
        language,
        code: codeLines.join("\n"),
      });
      continue;
    }

    // 2. Horizontal Rule
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 3. Headings (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 4. Markdown Table
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      isTableDivider(lines[i + 1])
    ) {
      const headers = parseTableRow(line);
      const dividerRow = parseTableRow(lines[i + 1]);
      const alignments = dividerRow.map(parseAlignment);
      const rows: string[][] = [];
      i += 2; // advance past header and divider

      while (
        i < lines.length &&
        lines[i].trim().includes("|") &&
        !isTableDivider(lines[i]) &&
        !lines[i].trim().startsWith("```")
      ) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }

      blocks.push({
        type: "table",
        headers,
        alignments,
        rows,
      });
      continue;
    }

    // 5. Blockquote / Callout (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "blockquote",
        lines: quoteLines,
      });
      continue;
    }

    // 6. Unordered List (*, -, +)
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const currentTrim = lines[i].trim();
        const listMatch = currentTrim.match(/^[-*+]\s+(.+)$/);
        if (listMatch) {
          items.push(listMatch[1].trim());
          i++;
        } else if (
          items.length > 0 &&
          (lines[i].startsWith("  ") || lines[i].startsWith("\t")) &&
          currentTrim.length > 0 &&
          !/^\d+\.\s+/.test(currentTrim)
        ) {
          // Indented continuation line of previous list item
          items[items.length - 1] += "\n" + currentTrim;
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: "ul",
        items,
      });
      continue;
    }

    // 7. Ordered List (1. , 2. )
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const currentTrim = lines[i].trim();
        const numMatch = currentTrim.match(/^\d+\.\s+(.+)$/);
        if (numMatch) {
          items.push(numMatch[1].trim());
          i++;
        } else if (
          items.length > 0 &&
          (lines[i].startsWith("  ") || lines[i].startsWith("\t")) &&
          currentTrim.length > 0 &&
          !/^[-*+]\s+/.test(currentTrim)
        ) {
          // Indented continuation line
          items[items.length - 1] += "\n" + currentTrim;
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        type: "ol",
        items,
      });
      continue;
    }

    // 8. Blank line
    if (!trimmed) {
      i++;
      continue;
    }

    // 9. Standard Paragraph (collect consecutive text lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().match(/^#{1,6}\s+/) &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].trim().match(/^[-*+]\s+/) &&
      !lines[i].trim().match(/^\d+\.\s+/) &&
      !/^(?:-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !(lines[i].trim().includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        text: paraLines.join(" "),
      });
    }
  }

  return blocks;
}

/**
 * Common Big-O complexity regex patterns.
 * Matches: O(1), O(log n), O(n), O(n log n), O(n^2), O(n^3), O(2^n), O(n!), O(V + E), O(V+E), O(k), O(n+k), etc.
 */
const BIG_O_REGEX = /\b(O\((?:1|log\s*n|n|n\s*log\s*n|n\^[0-9]+|n!|2\^n|k|V\s*\+\s*E|V\s*\+\s*E\s*log\s*V|n\s*\+\s*k|sqrt\(n\)|[a-zA-Z0-9\s\+\*\^\/!_]+)\))/g;

/**
 * Formats mathematical superscripts (e.g., n^2 -> n², 2^n -> 2ⁿ).
 */
function formatSuperscripts(text: string): React.ReactNode {
  if (!text.includes("^")) return text;
  const unicodeMap: Record<string, string> = {
    "^0": "⁰",
    "^1": "¹",
    "^2": "²",
    "^3": "³",
    "^4": "⁴",
    "^5": "⁵",
    "^6": "⁶",
    "^7": "⁷",
    "^8": "⁸",
    "^9": "⁹",
    "^n": "ⁿ",
    "^k": "ᵏ",
  };
  let replaced = text;
  for (const [key, val] of Object.entries(unicodeMap)) {
    replaced = replaced.replaceAll(key, val);
  }
  if (!replaced.includes("^")) return replaced;

  // Fallback for any other exponents
  const parts = replaced.split(/(\^[0-9a-zA-Z]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("^")) {
      return (
        <sup key={idx} className="text-[9px] font-bold">
          {part.slice(1)}
        </sup>
      );
    }
    return part;
  });
}

/**
 * Parses inline formatting:
 * - Complexity badges: O(n log n), O(n^2), O(1)
 * - Inline code: `code`
 * - Bold + Italic: ***text***
 * - Bold: **text**
 * - Italic: *text* or _text_
 * - Links: [label](url)
 */
export function formatInlineText(text: string): React.ReactNode {
  if (!text) return null;

  // Tokenize by inline code first to preserve code spans without sub-parsing
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((part, pIdx) => {
    // If it's inline code `...`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const codeSnippet = part.slice(1, -1);
      return (
        <code
          key={`code-${pIdx}`}
          className="font-mono text-[11.5px] bg-[#EDECE7] dark:bg-[#151821] text-[#5052C9] dark:text-[#9294FF] px-1.5 py-0.5 rounded border border-[#DDDCD5] dark:border-[#303548] font-medium"
        >
          {codeSnippet}
        </code>
      );
    }

    // Process Big-O complexity badges, bold, italics, links
    return parseFormattedSpans(part, pIdx);
  });
}

function parseFormattedSpans(text: string, parentKey: number | string): React.ReactNode {
  // Regex pattern matching:
  // 1. Big-O: O(...)
  // 2. Bold: **...**
  // 3. Italic: *...* or _..._
  // 4. Link: [...](...)
  const tokenRegex = /(\bO\([a-zA-Z0-9\s\+\*\^\/!_]+\)|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  const tokens = text.split(tokenRegex);

  return tokens.map((token, idx) => {
    const key = `${parentKey}-span-${idx}`;
    if (!token) return null;

    // 1. Big-O Complexity Badge
    if (token.startsWith("O(") && token.endsWith(")")) {
      return (
        <span
          key={key}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#5052C9]/10 text-[#5052C9] dark:bg-[#5052C9]/25 dark:text-[#9294FF] border border-[#5052C9]/20 shadow-xs mx-0.5 align-baseline whitespace-nowrap"
          title={`Computational Complexity: ${token}`}
        >
          {formatSuperscripts(token)}
        </span>
      );
    }

    // 2. Bold + Italic ***text***
    if (token.startsWith("***") && token.endsWith("***") && token.length > 6) {
      return (
        <strong key={key} className="font-bold text-[#24283A] dark:text-[#F2F1F8]">
          <em className="italic">{token.slice(3, -3)}</em>
        </strong>
      );
    }

    // 3. Bold **text**
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      const boldContent = token.slice(2, -2);
      // Recursively allow complexity inside bold like **O(n log n)**
      return (
        <strong key={key} className="font-semibold text-[#24283A] dark:text-[#F2F1F8]">
          {parseFormattedSpans(boldContent, `${key}-b`)}
        </strong>
      );
    }

    // 4. Italic *text* or _text_
    if (
      (token.startsWith("*") && token.endsWith("*") && token.length > 2) ||
      (token.startsWith("_") && token.endsWith("_") && token.length > 2)
    ) {
      return (
        <em key={key} className="italic text-[#292D40] dark:text-[#B9BDCD]">
          {token.slice(1, -1)}
        </em>
      );
    }

    // 5. Markdown Link [label](url)
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={key}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5052C9] dark:text-[#9294FF] underline underline-offset-2 hover:text-[#4345B0] font-medium transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
    }

    // Regular plain text span
    return <React.Fragment key={key}>{token}</React.Fragment>;
  });
}

/**
 * Code Block Component with Language Pill & 1-Click Copy
 */
function CodeBlockView({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang =
    {
      py: "Python",
      python: "Python",
      js: "JavaScript",
      javascript: "JavaScript",
      ts: "TypeScript",
      typescript: "TypeScript",
      cpp: "C++",
      "c++": "C++",
      c: "C",
      java: "Java",
      sql: "SQL",
      bash: "Shell / Bash",
      sh: "Shell",
      html: "HTML",
      css: "CSS",
      json: "JSON",
      pseudo: "Pseudocode",
      pseudocode: "Pseudocode",
    }[language.toLowerCase()] || (language.toUpperCase());

  return (
    <div className="my-3 rounded-xl border border-[#DDDCD5] dark:border-[#303548] overflow-hidden shadow-sm bg-[#1A1D27] dark:bg-[#111318]">
      {/* Code Header Bar */}
      <div className="bg-[#24283A] dark:bg-[#151821] px-4 py-2 flex items-center justify-between text-xs text-[#DDDCD5] font-mono border-b border-white/10 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#2E8F86]" />
          <span className="font-semibold uppercase tracking-wider text-[11px] text-[#DDDCD5]/90">
            {displayLang}
          </span>
        </div>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[#DDDCD5] hover:text-white transition-colors text-[11px]"
          title="Copy code snippet"
          aria-label="Copy code snippet"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[#2E8F86]" />
              <span className="text-[#2E8F86] font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-[#DDDCD5]" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-4 overflow-x-auto font-mono text-xs md:text-sm leading-relaxed text-[#F8F7F3] selection:bg-[#5052C9]/40">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Main FormattedAIResponse Component
 */
export function FormattedAIResponse({
  content,
  className = "",
}: FormattedAIResponseProps) {
  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);

  return (
    <div
      className={`ai-formatted-response text-xs sm:text-sm leading-relaxed text-[#24283A] dark:text-[#F2F1F8] font-inter space-y-2.5 ${className}`}
    >
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "heading": {
            if (block.level === 1) {
              return (
                <h1
                  key={idx}
                  className="text-lg md:text-xl font-bold font-outfit text-[#24283A] dark:text-[#F2F1F8] mt-4 mb-2 pb-1.5 border-b border-[#DDDCD5] dark:border-[#303548] first:mt-0"
                >
                  {formatInlineText(block.text)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={idx}
                  className="text-base md:text-lg font-bold font-outfit text-[#24283A] dark:text-[#F2F1F8] mt-3.5 mb-2 flex items-center gap-2 first:mt-0"
                >
                  <span className="w-1.5 h-4 bg-[#5052C9] rounded-full inline-block shrink-0" />
                  <span>{formatInlineText(block.text)}</span>
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3
                  key={idx}
                  className="text-sm md:text-base font-bold font-outfit text-[#24283A] dark:text-[#F2F1F8] mt-3 mb-1.5 first:mt-0"
                >
                  {formatInlineText(block.text)}
                </h3>
              );
            }
            return (
              <h4
                key={idx}
                className="text-xs md:text-sm font-semibold font-outfit text-[#5052C9] dark:text-[#9294FF] mt-2 mb-1 first:mt-0 uppercase tracking-wide"
              >
                {formatInlineText(block.text)}
              </h4>
            );
          }

          case "code":
            return (
              <CodeBlockView
                key={idx}
                language={block.language}
                code={block.code}
              />
            );

          case "table":
            return (
              <div
                key={idx}
                className="my-3.5 overflow-x-auto rounded-xl border border-[#DDDCD5] dark:border-[#303548] shadow-sm bg-[#FBFAF7] dark:bg-[#151821]"
              >
                <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[500px]">
                  <thead className="bg-[#EDECE7] dark:bg-[#1B1E2A] text-[#24283A] dark:text-[#F2F1F8] border-b border-[#B8B6AC]/40 dark:border-[#303548]">
                    <tr>
                      {block.headers.map((h, hIdx) => {
                        const align = block.alignments[hIdx] || "left";
                        return (
                          <th
                            key={hIdx}
                            style={{ textAlign: align }}
                            className="px-4 py-2.5 font-outfit font-semibold text-xs text-[#24283A] dark:text-[#F2F1F8] uppercase tracking-wider"
                          >
                            {formatInlineText(h)}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="odd:bg-[#FBFAF7] even:bg-[#F8F7F3] dark:odd:bg-[#151821] dark:even:bg-[#1B1E2A] hover:bg-[#EDECE7]/50 dark:hover:bg-[#252A3A] transition-colors border-b border-[#DDDCD5]/60 dark:border-[#303548]/60 last:border-b-0"
                      >
                        {row.map((cell, cIdx) => {
                          const align = block.alignments[cIdx] || "left";
                          return (
                            <td
                              key={cIdx}
                              style={{ textAlign: align }}
                              className="px-4 py-2.5 text-xs md:text-sm text-[#24283A] dark:text-[#F2F1F8] align-top"
                            >
                              {formatInlineText(cell)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "blockquote":
            return (
              <div
                key={idx}
                className="my-3 p-3.5 rounded-r-xl border-l-4 border-[#5052C9] bg-[#EDECE7]/60 dark:bg-[#222636]/60 text-xs md:text-sm text-[#24283A] dark:text-[#F2F1F8] shadow-xs space-y-1"
              >
                {block.lines.map((qLine, qIdx) => (
                  <p key={qIdx} className="leading-relaxed">
                    {formatInlineText(qLine)}
                  </p>
                ))}
              </div>
            );

          case "ul":
            return (
              <ul key={idx} className="space-y-2.5 my-2.5 pl-1">
                {block.items.map((item, itemIdx) => {
                  const subLines = item.split("\n");
                  return (
                    <li
                      key={itemIdx}
                      className="flex items-start gap-2.5 text-xs md:text-sm text-[#24283A] dark:text-[#F2F1F8] leading-relaxed"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5052C9] dark:bg-[#9294FF] mt-2 shrink-0" />
                      <div className="flex-1 space-y-1">
                        {subLines.map((line, lIdx) => (
                          <div
                            key={lIdx}
                            className={lIdx > 0 ? "text-[#292D40]/85 dark:text-[#B9BDCD]" : ""}
                          >
                            {formatInlineText(line)}
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );

          case "ol":
            return (
              <ol key={idx} className="space-y-3 my-2.5 pl-1">
                {block.items.map((item, itemIdx) => {
                  const subLines = item.split("\n");
                  return (
                    <li
                      key={itemIdx}
                      className="flex items-start gap-2.5 text-xs md:text-sm text-[#24283A] dark:text-[#F2F1F8] leading-relaxed"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#5052C9]/10 text-[#5052C9] dark:bg-[#5052C9]/25 dark:text-[#9294FF] font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 border border-[#5052C9]/20">
                        {itemIdx + 1}
                      </span>
                      <div className="flex-1 space-y-1">
                        {subLines.map((line, lIdx) => (
                          <div
                            key={lIdx}
                            className={lIdx > 0 ? "text-[#292D40]/85 dark:text-[#B9BDCD]" : ""}
                          >
                            {formatInlineText(line)}
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ol>
            );

          case "hr":
            return (
              <hr
                key={idx}
                className="my-4 border-[#DDDCD5] dark:border-[#303548]"
              />
            );

          case "paragraph": {
            // Check if paragraph is a section header like **Time Complexity:** or **Key Takeaways:**
            const isStandAloneHeader = /^\*\*[^*]+:\*\*\s*$/.test(block.text);
            if (isStandAloneHeader) {
              return (
                <div
                  key={idx}
                  className="font-bold font-outfit text-[#24283A] dark:text-[#F2F1F8] text-sm md:text-base mt-4 mb-1.5 first:mt-0 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E8F86] inline-block" />
                  {formatInlineText(block.text)}
                </div>
              );
            }
            const isLeadIn = /^\*\*[^*]+:\*\*/.test(block.text);
            return (
              <p
                key={idx}
                className={`leading-relaxed text-[#24283A] dark:text-[#F2F1F8] ${
                  isLeadIn ? "mt-2.5 mb-1" : "mb-2"
                }`}
              >
                {formatInlineText(block.text)}
              </p>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
