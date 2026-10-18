# Service Contracts & Boundary Specifications — UrPlaced V1.0

**Product:** UrPlaced — Multi-College Placement Preparation & Management SaaS  
**Phase:** 01 — Product Blueprint & Architecture  
**Status:** Approved Specification (Contract Outline Only — No Application Endpoints Implemented in Phase 01)

---

## 1. Boundary Design Principles

1. **Service Boundaries Are Authoritative:** All business operations pass through strongly typed TypeScript domain services located in `src/modules/<module-name>/services/`.
2. **Contract-First Transport:** Route Handlers (`/api/...`) and Next.js Server Actions act as thin transport controllers responsible only for deserializing HTTP requests, authenticating session context, validating schemas with Zod, and dispatching to domain services.
3. **Explicit Context Injection:** Every service function requires an explicit `ServiceContext` containing `tenantId`, `userId`, `roles`, and `correlationId`.

---

## 2. Standardized Error Handling & Response Envelope

All API routes and server action responses adhere to a uniform JSON envelope:

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata: {
    timestamp: string;
    correlationId: string;
  };
}

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'TENANT_MISMATCH'
  | 'RESOURCE_NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONCURRENCY_CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';
```

---

## 3. Core Domain Service Contracts

### 1. `TenantManagementService`
```typescript
export interface CreateTenantInput {
  slug: string;
  legalName: string;
  primaryDomain: string;
  studentSeatLimit: number;
  initialAdminEmail: string;
  initialAdminName: string;
}

export interface TenantManagementService {
  createTenant(ctx: ServiceContext, input: CreateTenantInput): Promise<{ tenantId: string; inviteToken: string }>;
  suspendTenant(ctx: ServiceContext, tenantId: string, reason: string): Promise<void>;
  updateSeatLimit(ctx: ServiceContext, tenantId: string, newLimit: number): Promise<void>;
  getTenantHealth(ctx: ServiceContext, tenantId: string): Promise<TenantHealthSummary>;
}
```

### 2. `StudentImportService`
```typescript
export interface StudentImportRow {
  rollNumber: string;
  fullName: string;
  email: string;
  departmentCode: string;
  graduationYear: number;
  cgpa: number;
  activeBacklogs: number;
  historyBacklogs: number;
  tenthPercentage?: number;
  twelfthPercentage?: number;
}

export interface IngestionPreviewResult {
  importJobId: string;
  totalRows: number;
  validRowCount: number;
  errorRowCount: number;
  errors: Array<{
    rowNumber: number;
    column: string;
    errorCode: string;
    message: string;
  }>;
}

export interface StudentImportService {
  stageAndValidateCsv(ctx: ServiceContext, fileBuffer: Buffer): Promise<IngestionPreviewResult>;
  commitImportBatch(ctx: ServiceContext, importJobId: string): Promise<{ committedCount: number }>;
  downloadErrorReportCsv(ctx: ServiceContext, importJobId: string): Promise<Buffer>;
}
```

### 3. `DriveAndEligibilityService`
```typescript
export interface CreateDriveInput {
  companyId: string;
  roleTitle: string;
  stipendCtcPayload: { ctcLpa: number; stipendMonthly?: number; currency: string };
  applicationDeadline: Date;
  rounds: Array<{ sequence: number; name: string; type: 'OA' | 'TECH' | 'HR' | 'GD' }>;
  criteria: {
    minCgpa: number;
    maxActiveBacklogs: number;
    allowedCohortIds: string[];
    minTenthPercentage?: number;
    minTwelfthPercentage?: number;
  };
}

export interface StudentEligibilityResult {
  studentId: string;
  rollNumber: string;
  status: 'ELIGIBLE' | 'DISQUALIFIED' | 'NEEDS_REVIEW';
  failedCriteriaReasons: string[];
  evaluatedAt: Date;
}

export interface DriveAndEligibilityService {
  createDrive(ctx: ServiceContext, input: CreateDriveInput): Promise<{ driveId: string }>;
  publishDrive(ctx: ServiceContext, driveId: string): Promise<void>;
  evaluateDriveEligibility(ctx: ServiceContext, driveId: string): Promise<{ totalEvaluated: number; eligibleCount: number }>;
  getStudentDriveEligibility(ctx: ServiceContext, driveId: string, studentId: string): Promise<StudentEligibilityResult>;
  overrideEligibilityManual(ctx: ServiceContext, driveId: string, studentId: string, newStatus: 'ELIGIBLE' | 'DISQUALIFIED', rationale: string): Promise<void>;
}
```

### 4. `QuestionBankSentinelService`
```typescript
export interface CreateQuestionInput {
  questionType: 'MCQ' | 'MSQ' | 'NUMERIC' | 'CODING';
  body: string;
  explanation: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topicIds: string[];
  provenanceType: 'OFFICIAL_DOCUMENT' | 'COLLEGE_OFFICIAL' | 'AI_GENERATED';
  options?: Array<{ text: string; isCorrect: boolean }>;
  codingTemplate?: Record<string, string>;
  testCases?: Array<{ stdin: string; expectedStdout: string; isHidden: boolean }>;
}

export interface SentinelValidationReport {
  isValid: boolean;
  duplicateWarning?: { existingQuestionId: string; similarityScore: number };
  validationErrors: string[];
}

export interface QuestionBankSentinelService {
  validateAndDraftQuestion(ctx: ServiceContext, input: CreateQuestionInput): Promise<{ questionId: string; report: SentinelValidationReport }>;
  reviewAndApproveQuestion(ctx: ServiceContext, questionId: string, reviewerNotes?: string): Promise<{ questionVersionId: string }>;
  createQuestionSet(ctx: ServiceContext, title: string, questionVersionIds: string[]): Promise<{ questionSetVersionId: string }>;
}
```

### 5. `AssessmentEngineService`
```typescript
export interface StartAssessmentResult {
  attemptId: string;
  assessmentTitle: string;
  durationSecondsRemaining: number;
  questionSetSnapshot: Array<{
    questionVersionId: string;
    questionType: string;
    body: string;
    options?: Array<{ id: string; text: string }>;
    codingTemplate?: Record<string, string>;
  }>;
}

export interface AutosaveResponsePayload {
  attemptId: string;
  questionVersionId: string;
  responsePayload: Record<string, unknown>;
  sequenceNumber: number;
}

export interface AssessmentEngineService {
  startAttempt(ctx: ServiceContext, assessmentId: string): Promise<StartAssessmentResult>;
  autosaveResponse(ctx: ServiceContext, payload: AutosaveResponsePayload): Promise<{ acknowledgedSeq: number }>;
  submitFinalAttempt(ctx: ServiceContext, attemptId: string): Promise<{ finalScore: number; submissionTimestamp: Date }>;
  getAttemptReview(ctx: ServiceContext, attemptId: string): Promise<AttemptReviewData>;
}
```

### 6. `CodeExecutionRunnerAdapter`
```typescript
export interface CodeExecutionRequest {
  language: 'python' | 'java' | 'cpp' | 'javascript';
  sourceCode: string;
  stdin: string;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface ExecutionResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  memoryUsedMb: number;
  status: 'ACCEPTED' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'SANDBOX_ERROR';
}

export interface CodeExecutionRunnerAdapter {
  execute(request: CodeExecutionRequest): Promise<ExecutionResponse>;
  runBatchTestCases(
    language: string,
    sourceCode: string,
    testCases: Array<{ stdin: string; expectedStdout: string; isHidden: boolean }>
  ): Promise<{ passedCount: number; totalCount: number; results: Array<{ passed: boolean; executionTimeMs: number; error?: string }> }>;
}
```

### 7. `MistakeBankAndMasteryService`
```typescript
export interface MistakeEntry {
  mistakeId: string;
  questionVersionId: string;
  topicName: string;
  difficulty: string;
  mistakeType: 'INCORRECT_ANSWER' | 'SKIPPED' | 'FLAGGED_REVIEW';
  studentResponse: Record<string, unknown>;
  correctAnswer: Record<string, unknown>;
  explanation: string;
  masteryState: 'UNRESOLVED' | 'IN_REVISION' | 'MASTERED';
  nextRevisionDue: Date;
}

export interface MistakeBankAndMasteryService {
  recordAttemptMistakes(ctx: ServiceContext, attemptId: string): Promise<{ newMistakesLogged: number }>;
  getStudentMistakes(ctx: ServiceContext, filters: { topicId?: string; state?: string }): Promise<MistakeEntry[]>;
  generateMasteryRetest(ctx: ServiceContext, topicId: string): Promise<{ retestAssessmentId: string }>;
  recordRetestEvaluation(ctx: ServiceContext, retestAttemptId: string): Promise<{ topicMastered: boolean }>;
}
```

### 8. `PlacementMemoryService`
```typescript
export interface CandidateDebriefSubmission {
  driveId: string;
  roundName: string;
  questionsEncounteredText: string;
  difficultyRating: number;
  interviewThemes: string[];
}

export interface HistoricalCompanyIntel {
  companyName: string;
  totalHistoricalDrives: number;
  verifiedRoundsSummary: Array<{ roundName: string; focusTopics: string[] }>;
  moderatedCandidateReports: Array<{ roundName: string; debriefSnippet: string; date: Date }>;
  criteriaDiffVsLastYear?: { cgpaDelta: number; newSkillsRequired: string[] };
}

export interface PlacementMemoryService {
  submitCandidateDebrief(ctx: ServiceContext, submission: CandidateDebriefSubmission): Promise<{ reportId: string }>;
  moderateCandidateReport(ctx: ServiceContext, reportId: string, action: 'APPROVE' | 'REJECT', notes?: string): Promise<void>;
  getCompanyPlacementMemory(ctx: ServiceContext, companyId: string): Promise<HistoricalCompanyIntel>;
}
```

### 9. `InstitutionalAnalyticsService`
```typescript
export interface CohortReadinessIndex {
  cohortId: string;
  cohortLabel: string;
  totalStudents: number;
  eligibleStudentCount: number;
  averageTopicAccuracies: Record<string, number>;
  skillReadinessDistribution: {
    readyPercentage: number;
    attentionNeededPercentage: number;
    criticalGapPercentage: number;
  };
}

export interface TrainingImpactComparison {
  sessionId: string;
  sessionTitle: string;
  preAssessmentAverageScore: number;
  postAssessmentAverageScore: number;
  percentageImprovement: number;
  statisticallySignificant: boolean;
}

export interface InstitutionalAnalyticsService {
  getCohortReadiness(ctx: ServiceContext, cohortId: string): Promise<CohortReadinessIndex>;
  getTrainingSessionImpact(ctx: ServiceContext, sessionId: string): Promise<TrainingImpactComparison>;
  exportPlacementLedgerCsv(ctx: ServiceContext, filterOptions: Record<string, unknown>): Promise<Buffer>;
}
```
