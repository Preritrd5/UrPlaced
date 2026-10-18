import { describe, it, expect } from "vitest";
import { SourceIngestionService } from "@/modules/recruitment-intelligence/services/source-ingestion-service";

describe("SourceIngestionService SSRF Protection", () => {
  it("rejects non-HTTP/HTTPS protocols", () => {
    const fileRes = SourceIngestionService.validateUrlForSSRF("file:///etc/passwd");
    expect(fileRes.isValid).toBe(false);
    expect(fileRes.error).toContain("Only HTTP and HTTPS");

    const ftpRes = SourceIngestionService.validateUrlForSSRF("ftp://ftp.example.com/file.txt");
    expect(ftpRes.isValid).toBe(false);

    const gopherRes = SourceIngestionService.validateUrlForSSRF("gopher://127.0.0.1:70/");
    expect(gopherRes.isValid).toBe(false);
  });

  it("blocks localhost and loopback targets", () => {
    expect(SourceIngestionService.validateUrlForSSRF("http://localhost:3000/api").isValid).toBe(false);
    expect(SourceIngestionService.validateUrlForSSRF("http://127.0.0.1:8080").isValid).toBe(false);
    expect(SourceIngestionService.validateUrlForSSRF("http://127.0.0.2:80").isValid).toBe(false);
    expect(SourceIngestionService.validateUrlForSSRF("http://sub.localhost").isValid).toBe(false);
    expect(SourceIngestionService.validateUrlForSSRF("http://0.0.0.0:80").isValid).toBe(false);
  });

  it("blocks cloud instance metadata service (AWS/GCP/Azure 169.254.169.254)", () => {
    const metadataRes = SourceIngestionService.validateUrlForSSRF("http://169.254.169.254/latest/meta-data/");
    expect(metadataRes.isValid).toBe(false);
    expect(metadataRes.error).toContain("metadata");

    const linkLocalRes = SourceIngestionService.validateUrlForSSRF("http://169.254.1.1/secret");
    expect(linkLocalRes.isValid).toBe(false);
  });

  it("blocks RFC 1918 private IPv4 networks", () => {
    // 10.0.0.0/8
    expect(SourceIngestionService.validateUrlForSSRF("http://10.0.0.1/admin").isValid).toBe(false);
    expect(SourceIngestionService.validateUrlForSSRF("http://10.255.255.255/").isValid).toBe(false);

    // 172.16.0.0/12
    expect(SourceIngestionService.validateUrlForSSRF("http://172.16.0.1/dashboard").isValid).toBe(false);
    expect(SourceIngestionService.validateUrlForSSRF("http://172.31.255.255/").isValid).toBe(false);

    // 192.168.0.0/16
    expect(SourceIngestionService.validateUrlForSSRF("http://192.168.1.1/router").isValid).toBe(false);
    expect(SourceIngestionService.validateUrlForSSRF("http://192.168.0.254/").isValid).toBe(false);
  });

  it("blocks internal hostnames ending with .local, .internal, .corp", () => {
    expect(SourceIngestionService.validateUrlForSSRF("https://vault.corp/secrets").isValid).toBe(false);
    expect(SourceIngestionService.validateUrlForSSRF("http://api.internal/").isValid).toBe(false);
    expect(SourceIngestionService.validateUrlForSSRF("http://cluster.local/").isValid).toBe(false);
  });

  it("allows valid public external career URLs", () => {
    const googleRes = SourceIngestionService.validateUrlForSSRF("https://careers.google.com/jobs/results");
    expect(googleRes.isValid).toBe(true);
    expect(googleRes.sanitizedUrl).toBe("https://careers.google.com/jobs/results");

    const amazonRes = SourceIngestionService.validateUrlForSSRF("https://www.amazon.jobs/en/jobs/12345");
    expect(amazonRes.isValid).toBe(true);
    expect(amazonRes.sanitizedUrl).toBe("https://www.amazon.jobs/en/jobs/12345");
  });

  it("safely strips HTML tags while preserving text", () => {
    const rawHtml = `
      <html>
        <head><title>Job Title</title><style>.test{color:red;}</style></head>
        <body>
          <script>alert("hack")</script>
          <h1>Software Engineer</h1>
          <p>Proficiency in <strong>Java</strong> &amp; <em>SQL</em> required.</p>
        </body>
      </html>
    `;
    const stripped = SourceIngestionService.stripHtml(rawHtml);
    expect(stripped).toContain("Software Engineer");
    expect(stripped).toContain("Proficiency in Java & SQL required.");
    expect(stripped).not.toContain("<script>");
    expect(stripped).not.toContain("alert");
    expect(stripped).not.toContain(".test");
  });
});
