/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Assessment Engine: Isolated Code Runner Boundary
 * ==============================================================================
 * Enforces zero fake grading. If no authoritative execution runner is configured,
 * it returns execution-unavailable status honestly rather than simulating execution.
 */

export interface TestCaseInput {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export interface RunnerExecutionResult {
  runnerAvailable: boolean;
  message: string;
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  results: Array<{
    testCaseIndex: number;
    passed: boolean;
    actualOutput?: string;
    expectedOutput?: string;
    executionTimeMs?: number;
    error?: string;
  }>;
}

export class IsolatedRunnerBoundary {
  /**
   * Executes candidate code against test cases in an isolated runner.
   * If no external runner URL is configured via environment variables,
   * gracefully reports runner unavailability without fabricating results.
   */
  public static async executeCode(
    language: string,
    code: string,
    testCases: TestCaseInput[]
  ): Promise<RunnerExecutionResult> {
    const runnerEndpoint = process.env.CODE_RUNNER_ENDPOINT;

    if (!runnerEndpoint || runnerEndpoint.trim() === "") {
      return {
        runnerAvailable: false,
        message:
          "Authoritative code runner environment is not configured in this deployment. Candidate code has been safely persisted for evaluation.",
        allPassed: false,
        passedCount: 0,
        totalCount: testCases.length,
        results: testCases.map((tc, index) => ({
          testCaseIndex: index,
          passed: false,
          error: "Runner unavailable (execution deferred)",
        })),
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s execution timeout

      const response = await fetch(runnerEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CODE_RUNNER_TOKEN || ""}`,
        },
        body: JSON.stringify({
          language,
          code,
          testCases,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          runnerAvailable: true,
          message: `Code runner error (HTTP ${response.status}). Code persisted.`,
          allPassed: false,
          passedCount: 0,
          totalCount: testCases.length,
          results: testCases.map((tc, index) => ({
            testCaseIndex: index,
            passed: false,
            error: `Runner HTTP error ${response.status}`,
          })),
        };
      }

      const data = await response.json();
      return {
        runnerAvailable: true,
        message: data.message || "Executed successfully",
        allPassed: Boolean(data.allPassed),
        passedCount: Number(data.passedCount || 0),
        totalCount: testCases.length,
        results: Array.isArray(data.results) ? data.results : [],
      };
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      return {
        runnerAvailable: true,
        message: isTimeout
          ? "Execution timed out (exceeded 10000ms limit)."
          : `Code runner connection failure: ${err?.message || "Unknown"}`,
        allPassed: false,
        passedCount: 0,
        totalCount: testCases.length,
        results: testCases.map((tc, index) => ({
          testCaseIndex: index,
          passed: false,
          error: isTimeout ? "Timeout" : "Runner unreachable",
        })),
      };
    }
  }
}
