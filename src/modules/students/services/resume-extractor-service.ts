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
  pageCount?: number;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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
      if (buffer.length < 50) {
        return {
          text: "",
          wordCount: 0,
          characterCount: 0,
          detectedSections: [],
          parsingStatus: "FAILED",
          warning: "File is empty or corrupted.",
        };
      }

      // Check zip magic number: PK\x03\x04
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
        return {
          text: "",
          wordCount: 0,
          characterCount: 0,
          detectedSections: [],
          parsingStatus: "FAILED",
          warning: "Invalid binary signature: file is not a valid OpenXML archive.",
        };
      }

      const zip = await JSZip.loadAsync(buffer);

      // Defend against zip decompression bombs & excessive entries
      let entryCount = 0;
      const MAX_ENTRIES = 150;
      zip.forEach(() => {
        entryCount++;
      });

      if (entryCount > MAX_ENTRIES) {
        return {
          text: "",
          wordCount: 0,
          characterCount: 0,
          detectedSections: [],
          parsingStatus: "FAILED",
          warning: "Suspicious archive: exceeds maximum allowed file entries count.",
        };
      }

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

      // Extract paragraphs and table cells with proper section boundaries
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
          paragraphs.push(decodeXmlEntities(pText.trim()));
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
   * Extracts text from PDF document buffer using production PDF parser
   */
  public static async extractPdf(buffer: Buffer): Promise<ExtractionResult> {
    try {
      if (buffer.length < 50) {
        return {
          text: "",
          wordCount: 0,
          characterCount: 0,
          detectedSections: [],
          parsingStatus: "FAILED",
          warning: "File is empty or corrupted.",
        };
      }

      const isPdfHeader = buffer.subarray(0, 5).toString("latin1").startsWith("%PDF");
      if (!isPdfHeader) {
        return {
          text: "",
          wordCount: 0,
          characterCount: 0,
          detectedSections: [],
          parsingStatus: "FAILED",
          warning: "Invalid binary signature: file does not start with %PDF.",
        };
      }

      let rawText = "";
      let pageCount = 1;

      try {
        const pdfModule: any = await import("pdf-parse");
        const parseFn =
          typeof pdfModule === "function"
            ? pdfModule
            : typeof pdfModule.default === "function"
            ? pdfModule.default
            : null;

        if (parseFn) {
          const parsed = await parseFn(buffer);
          rawText = parsed?.text || "";
          pageCount = parsed?.numpages || 1;
        } else if (pdfModule?.PDFParse || pdfModule?.default?.PDFParse) {
          const PDFClass = pdfModule?.PDFParse || pdfModule?.default?.PDFParse;
          const parser = new PDFClass({ data: buffer });
          const res = await parser.getText();
          rawText = res?.text || "";
          pageCount = res?.total || 1;
        }
      } catch (pdfErr: any) {
        console.warn("[ResumeExtractorService] PDF parsing engine notice:", pdfErr?.message);
      }

      const cleanText = rawText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
      const detectedSections = this.detectSectionHeaders(cleanText);
      const isScannedOrEmpty = wordCount < 15;

      return {
        text: cleanText,
        wordCount,
        characterCount: cleanText.length,
        detectedSections,
        pageCount: pageCount || 1,
        parsingStatus: isScannedOrEmpty ? "PARTIALLY_PARSED" : "PARSED",
        warning: isScannedOrEmpty
          ? "PDF contains little or no embedded text layer (scanned or image-only document). Requires OCR or text-layer PDF."
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
