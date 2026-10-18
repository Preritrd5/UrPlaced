/**
 * Source Ingestion & SSRF Security Service
 * Validates external URLs with strict SSRF controls (blocks localhost, RFC1918, link-local, cloud metadata).
 * Safely fetches and sanitizes text from permitted remote sources and uploaded files.
 */

export interface URLValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

export class SourceIngestionService {
  private static readonly MAX_CONTENT_LENGTH = 2 * 1024 * 1024; // 2MB limit
  private static readonly FETCH_TIMEOUT_MS = 5000; // 5-second timeout

  /**
   * Strictly validates a URL to prevent Server-Side Request Forgery (SSRF)
   */
  public static validateUrlForSSRF(rawUrl: string): URLValidationResult {
    try {
      const url = new URL(rawUrl.trim());

      // 1. Enforce HTTP / HTTPS protocol only
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { isValid: false, error: "Only HTTP and HTTPS protocols are permitted." };
      }

      const hostname = url.hostname.toLowerCase();

      // 2. Reject localhost and loopback names
      if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname === "0.0.0.0"
      ) {
        return { isValid: false, error: "Access to loopback and localhost addresses is forbidden." };
      }

      // 3. Reject Cloud Metadata IP addresses (AWS, GCP, Azure, DigitalOcean)
      if (hostname === "169.254.169.254" || hostname.startsWith("169.254.")) {
        return { isValid: false, error: "Access to cloud instance metadata services is forbidden." };
      }

      // 4. Reject RFC 1918 Private IPv4 Networks
      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      const match = hostname.match(ipv4Regex);
      if (match) {
        const octet1 = parseInt(match[1], 10);
        const octet2 = parseInt(match[2], 10);

        if (octet1 === 10) {
          return { isValid: false, error: "Access to private 10.0.0.0/8 networks is forbidden." };
        }
        if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
          return { isValid: false, error: "Access to private 172.16.0.0/12 networks is forbidden." };
        }
        if (octet1 === 192 && octet2 === 168) {
          return { isValid: false, error: "Access to private 192.168.0.0/16 networks is forbidden." };
        }
        if (octet1 === 127) {
          return { isValid: false, error: "Access to loopback networks is forbidden." };
        }
        if (octet1 === 0) {
          return { isValid: false, error: "Access to unassigned zero-networks is forbidden." };
        }
      }

      // 5. Block standard internal domain patterns
      if (
        hostname.endsWith(".internal") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".corp") ||
        hostname.endsWith(".lan")
      ) {
        return { isValid: false, error: "Access to internal hostnames is forbidden." };
      }

      return { isValid: true, sanitizedUrl: url.toString() };
    } catch {
      return { isValid: false, error: "Invalid URL format." };
    }
  }

  /**
   * Safely fetches content from a validated remote source with size and timeout guards
   */
  public static async fetchRemoteSourceText(rawUrl: string): Promise<{ text: string; title: string }> {
    const validation = this.validateUrlForSSRF(rawUrl);
    if (!validation.isValid || !validation.sanitizedUrl) {
      throw new Error(`SSRF Security Guard: ${validation.error}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(validation.sanitizedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "UrPlaced-DriveFit-Ingestion/1.0",
          Accept: "text/html,text/plain,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        throw new Error(`Remote source responded with HTTP status ${response.status}`);
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > this.MAX_CONTENT_LENGTH) {
        throw new Error("Source document exceeds maximum permitted size of 2MB.");
      }

      const rawHtml = await response.text();
      clearTimeout(timeout);

      // Extract title if HTML
      const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "Imported Remote Source";

      // Sanitize and strip HTML tags to extract clean text
      const sanitizedText = this.stripHtml(rawHtml);

      return {
        text: sanitizedText.slice(0, 50000), // Bound maximum text
        title: title.slice(0, 255),
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        throw new Error("Remote source request timed out after 5 seconds.");
      }
      throw err;
    }
  }

  /**
   * Strips HTML markup, scripts, and styles to produce clean plain text
   */
  public static stripHtml(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }
}
