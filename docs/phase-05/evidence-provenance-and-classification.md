# Phase 05: Evidence Provenance, Classification & Ingestion Security

## 1. Traceable Evidence Hierarchy

DriveFit mandates that every factual assertion displayed to coordinators or students must have a verifiable origin. Claims are never presented as authoritative facts without supporting evidence.

### 1.1 Evidence Classifications

| Classification | Meaning & Criteria | Visual Treatment |
| :--- | :--- | :--- |
| **`OFFICIAL`** | Directly sourced from official company job descriptions, authorized college placement circulars, or company career portals. | Green Badge (`#2E8F86`) |
| **`REPORTED`** | Historically contributed by candidates or alumni who attended previous recruitment drives. Moderated by staff. | Slate / Blue Badge |
| **`INFERRED`** | Algorithmic or AI-assisted recommendation derived from related technical competencies or role profiles. | Purple / Outline Badge |
| **`UNKNOWN`** | Missing or insufficient evidence. The platform displays `Unknown / Unconfirmed` rather than fabricating values. | Amber / Muted Badge |

---

## 2. Source Ingestion & SSRF Security Architecture

External URLs provided by placement staff are ingested using `SourceIngestionService` with strict Server-Side Request Forgery (SSRF) protections.

### 2.1 SSRF Security Controls
- **Protocol Restriction:** Only `http:` and `https:` schemes are allowed. Schemes like `file:`, `ftp:`, `gopher:` are immediately rejected.
- **Loopback & Localhost Rejection:** Rejects `localhost`, `127.0.0.1`, `127.0.0.0/8`, `::1`, `0.0.0.0`.
- **Cloud Metadata Protection:** Explicitly blocks cloud instance metadata IP addresses (`169.254.169.254` and `169.254.0.0/16`) used by AWS, Google Cloud, Azure, and DigitalOcean.
- **Private Subnet Protection:** Blocks RFC 1918 private IPv4 blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- **Internal Domain Protection:** Blocks hostnames ending with `.internal`, `.local`, `.corp`, `.lan`.
- **Execution Safeguards:** 5-second timeout, 2MB payload cap, and HTML stripping to prevent script injection.

---

## 3. Freshness, Staleness & Conflict Handling

### 3.1 Staleness Rules (`isSourceStale`)
- If a source was last checked or verified more than 180 days ago, it is flagged with `is_stale = true` and `stale_reason = "Source evidence was last verified > 180 days ago. Re-verification required."`.
- If a source is marked `SUPERSEDED` by a newer notice, it is permanently flagged as superseded and preserved for audit history.

### 3.2 Conflict Resolution
- When two sources assert contradictory values (e.g. one circular says minimum CGPA 7.0 and another says 7.5), the platform:
  1. Sets `has_conflict = true` on the requirement.
  2. Records conflict details including the competing requirement ID and values.
  3. Displays an alert to coordinators with actions to:
     - `KEEP_THIS`: retain the current claim.
     - `SUPERSEDE`: mark the older claim superseded.
     - `EDIT_VALUE`: enter the authoritative corrected value.
