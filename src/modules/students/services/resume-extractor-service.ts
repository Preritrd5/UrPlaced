/**
 * Resume Document Text Extraction Pipeline
 * 
 * Safely parses PDF and DOCX resume documents in Node.js runtime,
 * extracting plain text with intact section boundaries and detecting
 * scanned/empty document edge-cases.
 */

import * as zlib from "zlib";
import JSZip from "jszip";

export interface ExtractionResult {
  text: string;
  wordCount: number;
  characterCount: number;
  detectedSections: string[];
  parsingStatus: "PARSED" | "PARTIALLY_PARSED" | "FAILED";
  warning?: string;
}

export class ResumeExtractorService {
  /**
   * Common ATS section header keyword detector
   */
  public static detectSectionHeaders(text: string): string[] {
    const knownHeaders = [
      { key: "CONTACT", regex: /(contact|phone|email|address|location)/i },
      { key: "SUMMARY", regex: /(summary|profile|about me|objective)/i },
      { key: "EDUCATION", regex: /(education|academic|qualifications|degree)/i },
      { key: "SKILLS", regex: /(skills|technical skills|technologies|competencies)/i },
      { key: "EXPERIENCE", regex: /(experience|employment|work history|internship)/i },
      { key: "PROJECTS", regex: /(projects|portfolio|personal projects|key projects)/i },
      { key: "CERTIFICATIONS", regex: /(certifications|certificates|licenses|credentials)/i },
      { key: "ACHIEVEMENTS", regex: /(achievements|honors|awards|extracurricular)/i },
    ];

    const found: string[] = [];
    const lines = text.split("\n");

    for (const line of lines) {
      const clean = line.trim();
      if (clean.length > 0 && clean.length < 50) {
        for (const h of knownHeaders) {
          if (!found.includes(h.key) && h.regex.test(clean)) {
            found.push(h.key);
          }
        }
      }
    }

    return found;
  }

  /**
   * Extracts text from DOCX (OpenXML) document buffer
   */
  public static async extractDocx(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const docXmlFile = zip.file("word/document.xml");

      if (!docXmlFile) {
        return {
          text: "",
          wordCount: 0,
          characterCount: 0,
          detectedSections: [],
          parsingStatus: "FAILED",
          warning: "Invalid DOCX: missing word/document.xml file in archive.",
        };
      }

      const xml = await docXmlFile.async("string");

      const paragraphs: string[] = [];
      const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
      let pMatch;

      while ((pMatch = pRegex.exec(xml)) !== null) {
        const pContent = pMatch[1];
        const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
        let tMatch;
        let pText = "";

        while ((tMatch = tRegex.exec(pContent)) !== null) {
          pText += tMatch[1];
        }

        if (pText.trim()) {
          paragraphs.push(pText.trim());
        }
      }

      const fullText = paragraphs.join("\n");
      const wordCount = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
      const detectedSections = this.detectSectionHeaders(fullText);

      return {
        text: fullText,
        wordCount,
        characterCount: fullText.length,
        detectedSections,
        parsingStatus: wordCount > 20 ? "PARSED" : "PARTIALLY_PARSED",
        warning: wordCount <= 20 ? "Document contains very little text. Please ensure it is complete." : undefined,
      };
    } catch (err: any) {
      console.error("[ResumeExtractorService] DOCX extraction error:", err);
      return {
        text: "",
        wordCount: 0,
        characterCount: 0,
        detectedSections: [],
        parsingStatus: "FAILED",
        warning: `DOCX parsing error: ${err.message}`,
      };
    }
  }

  /**
   * Extracts text from PDF stream objects
   */
  public static extractPdf(buffer: Buffer): ExtractionResult {
    try {
      const content = buffer.toString("latin1");

      if (!content.startsWith("%PDF")) {
        return {
          text: "",
          wordCount: 0,
          characterCount: 0,
          detectedSections: [],
          parsingStatus: "FAILED",
          warning: "Invalid binary signature: file does not start with %PDF.",
        };
      }

      let extractedText = "";
      const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
      let match;

      while ((match = streamRegex.exec(content)) !== null) {
        const streamData = Buffer.from(match[1], "latin1");
        let decompressed = "";

        try {
          decompressed = zlib.inflateSync(streamData).toString("latin1");
        } catch {
          decompressed = match[1];
        }

        const btRegex = /BT[\s\S]*?ET/g;
        let btMatch;

        while ((btMatch = btRegex.exec(decompressed)) !== null) {
          const block = btMatch[0];

          // Match (text) Tj
          const tjRegex = /\(([\s\S]*?)\)\s*Tj/g;
          let tjMatch;
          while ((tjMatch = tjRegex.exec(block)) !== null) {
            extractedText += tjMatch[1] + " ";
          }

          // Match [(t)(e)(x)(t)] TJ
          const arrayTjRegex = /\[([\s\S]*?)\]\s*TJ/g;
          let arrayMatch;
          while ((arrayMatch = arrayTjRegex.exec(block)) !== null) {
            const inner = arrayMatch[1];
            const innerTextRegex = /\(([\s\S]*?)\)/g;
            let innerTextMatch;
            while ((innerTextMatch = innerTextRegex.exec(inner)) !== null) {
              extractedText += innerTextMatch[1];
            }
            extractedText += " ";
          }
          extractedText += "\n";
        }
      }

      const cleanText = extractedText
        .replace(/\\([()\\])/g, "$1")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/[ \t]+/g, " ")
        .trim();

      const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
      const detectedSections = this.detectSectionHeaders(cleanText);

      const isScannedOrEmpty = wordCount < 15;

      return {
        text: cleanText,
        wordCount,
        characterCount: cleanText.length,
        detectedSections,
        parsingStatus: isScannedOrEmpty ? "PARTIALLY_PARSED" : "PARSED",
        warning: isScannedOrEmpty
          ? "PDF contains little or no embedded text layer. Gemini multimodal document vision will be used during scanning."
          : undefined,
      };
    } catch (err: any) {
      console.error("[ResumeExtractorService] PDF extraction error:", err);
      return {
        text: "",
        wordCount: 0,
        characterCount: 0,
        detectedSections: [],
        parsingStatus: "FAILED",
        warning: `PDF extraction error: ${err.message}`,
      };
    }
  }

  /**
   * Unified document extraction dispatcher
   */
  public static async extract(
    buffer: Buffer,
    fileType: "pdf" | "docx"
  ): Promise<ExtractionResult> {
    if (fileType === "docx") {
      return this.extractDocx(buffer);
    }
    return this.extractPdf(buffer);
  }
}
