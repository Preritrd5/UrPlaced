/**
 * Student Activity Contribution Heatmap Service
 * 
 * Provides server-side authoritative aggregation for student submissions across
 * the trailing 365 calendar days.
 * 
 * Sources aggregated:
 * 1. assessment_attempts (SUBMITTED, SCORED, RESULT_RELEASED)
 * 2. drive_applications (REGISTERED, IN_PROCESS, OFFER_EXTENDED, OFFER_ACCEPTED)
 * 3. review_sessions (REFLECTION_SAVED, PRACTICE_STARTED)
 * 
 * Strict isolation: Scoped to tenant_id and student_id.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface DayBreakdown {
  assessments: number;
  applications: number;
  mistakeRemediations: number;
}

export interface DayActivity {
  date: string; // "YYYY-MM-DD"
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  breakdown: DayBreakdown;
}

export interface HeatmapCell {
  date: string; // "YYYY-MM-DD"
  dayOfMonth: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  isFuture: boolean;
  activity: DayActivity;
}

export interface MonthBlock {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "Nov", "Dec", etc.
  year: number;
  columns: Array<Array<HeatmapCell | null>>; // 7 rows per column (Sun=0 to Sat=6)
}

export interface StudentActivityHeatmapPayload {
  studentId: string;
  totalSubmissions: number;
  totalActiveDays: number;
  maxStreak: number;
  currentStreak: number;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  days: Record<string, DayActivity>;
  months: MonthBlock[];
}

export interface HeatmapOptions {
  timezone?: string;
  referenceDate?: Date;
}

export class StudentActivityHeatmapService {
  /**
   * Format a Date into "YYYY-MM-DD" in the specified timezone
   */
  static formatDateInTimezone(date: Date, timezone: string = "Asia/Kolkata"): string {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return formatter.format(date);
    } catch {
      // Fallback to UTC if timezone is invalid
      return date.toISOString().slice(0, 10);
    }
  }

  /**
   * Compute intensity level from 0 to 4
   */
  static computeLevel(count: number): 0 | 1 | 2 | 3 | 4 {
    if (count <= 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 3;
    return 4;
  }

  /**
   * Generate 365 days range
   */
  static getTrailing365DayRange(options?: HeatmapOptions): {
    startDateStr: string;
    endDateStr: string;
    timezone: string;
  } {
    const timezone = options?.timezone || "Asia/Kolkata";
    const refDate = options?.referenceDate || new Date();

    const endDateStr = this.formatDateInTimezone(refDate, timezone);

    // Calculate 364 days prior to endDateStr
    const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
    const endDateUtc = new Date(Date.UTC(endYear, endMonth - 1, endDay));
    const startDateUtc = new Date(endDateUtc.getTime() - 364 * 86400000);
    const startDateStr = startDateUtc.toISOString().slice(0, 10);

    return { startDateStr, endDateStr, timezone };
  }

  /**
   * Structure days into monthly column blocks for the calendar grid
   */
  static buildMonthBlocks(
    startDateStr: string,
    endDateStr: string,
    daysMap: Record<string, DayActivity>
  ): MonthBlock[] {
    const months: MonthBlock[] = [];
    const [sY, sM] = startDateStr.split("-").map(Number);
    const [eY, eM] = endDateStr.split("-").map(Number);

    let curY = sY;
    let curM = sM;

    while (curY < eY || (curY === eY && curM <= eM)) {
      const monthKey = `${curY}-${String(curM).padStart(2, "0")}`;
      const firstDateOfMonth = new Date(Date.UTC(curY, curM - 1, 1));
      const lastDateOfMonth = new Date(Date.UTC(curY, curM, 0));
      const totalDaysInMonth = lastDateOfMonth.getUTCDate();
      const monthLabel = firstDateOfMonth.toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      });

      const daysInThisMonth: HeatmapCell[] = [];
      for (let d = 1; d <= totalDaysInMonth; d++) {
        const dStr = `${curY}-${String(curM).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (dStr >= startDateStr && dStr <= endDateStr) {
          const dateObj = new Date(Date.UTC(curY, curM - 1, d));
          const dow = dateObj.getUTCDay(); // 0 = Sun, 6 = Sat
          const activity = daysMap[dStr] || {
            date: dStr,
            count: 0,
            level: 0,
            breakdown: { assessments: 0, applications: 0, mistakeRemediations: 0 },
          };

          daysInThisMonth.push({
            date: dStr,
            dayOfMonth: d,
            dayOfWeek: dow,
            isFuture: dStr > endDateStr,
            activity,
          });
        }
      }

      if (daysInThisMonth.length > 0) {
        const columns: Array<Array<HeatmapCell | null>> = [];
        let curCol: Array<HeatmapCell | null> = new Array(7).fill(null);

        for (const day of daysInThisMonth) {
          const dow = day.dayOfWeek;
          if (curCol[dow] !== null || (dow === 0 && curCol.some((x) => x !== null))) {
            columns.push(curCol);
            curCol = new Array(7).fill(null);
          }
          curCol[dow] = day;
        }
        if (curCol.some((x) => x !== null)) {
          columns.push(curCol);
        }

        months.push({
          monthKey,
          monthLabel,
          year: curY,
          columns,
        });
      }

      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    return months;
  }

  /**
   * Main service function to compute the complete activity heatmap for a student
   */
  static async getHeatmap(
    tenantId: string,
    studentId: string,
    options?: HeatmapOptions
  ): Promise<StudentActivityHeatmapPayload> {
    if (!tenantId || !studentId) {
      throw new Error("tenantId and studentId are required");
    }

    const { startDateStr, endDateStr, timezone } = this.getTrailing365DayRange(options);

    // Initialize 365 calendar days
    const daysMap: Record<string, DayActivity> = {};
    const [sY, sM, sD] = startDateStr.split("-").map(Number);
    const startUtc = new Date(Date.UTC(sY, sM - 1, sD));

    for (let i = 0; i < 365; i++) {
      const curDate = new Date(startUtc.getTime() + i * 86400000);
      const curStr = curDate.toISOString().slice(0, 10);
      if (curStr <= endDateStr) {
        daysMap[curStr] = {
          date: curStr,
          count: 0,
          level: 0,
          breakdown: {
            assessments: 0,
            applications: 0,
            mistakeRemediations: 0,
          },
        };
      }
    }

    const supabase = createAdminClient();

    // Timestamp boundary with safe buffer for timezone offsets
    const windowStartBoundary = new Date(startUtc.getTime() - 24 * 3600000).toISOString();
    const windowEndBoundary = new Date(
      new Date(endDateStr + "T23:59:59.999Z").getTime() + 24 * 3600000
    ).toISOString();

    // 1. Fetch completed assessment attempts
    const { data: attempts, error: attemptsErr } = await supabase
      .from("assessment_attempts")
      .select("id, submitted_at, status")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .in("status", ["SUBMITTED", "SCORED", "RESULT_RELEASED"])
      .gte("submitted_at", windowStartBoundary)
      .lte("submitted_at", windowEndBoundary);

    if (attemptsErr) {
      console.error("[StudentActivityHeatmapService] Error fetching attempts:", attemptsErr);
    }

    // 2. Fetch drive applications
    const { data: applications, error: appsErr } = await supabase
      .from("drive_applications")
      .select("id, registration_date, created_at, status")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .in("status", ["REGISTERED", "IN_PROCESS", "OFFER_EXTENDED", "OFFER_ACCEPTED"])
      .gte("registration_date", windowStartBoundary)
      .lte("registration_date", windowEndBoundary);

    if (appsErr) {
      console.error("[StudentActivityHeatmapService] Error fetching applications:", appsErr);
    }

    // 3. Fetch mistake remediation review sessions
    const { data: reviews, error: reviewsErr } = await supabase
      .from("review_sessions")
      .select("id, created_at, action_type")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .in("action_type", ["REFLECTION_SAVED", "PRACTICE_STARTED"])
      .gte("created_at", windowStartBoundary)
      .lte("created_at", windowEndBoundary);

    if (reviewsErr) {
      console.error("[StudentActivityHeatmapService] Error fetching review sessions:", reviewsErr);
    }

    // Deduplication sets to ensure zero double-counting
    const processedAttemptIds = new Set<string>();
    const processedAppIds = new Set<string>();
    const processedReviewIds = new Set<string>();

    // Ingest assessment attempts
    if (attempts && Array.isArray(attempts)) {
      for (const a of attempts) {
        if (!a.id || processedAttemptIds.has(a.id) || !a.submitted_at) continue;
        processedAttemptIds.add(a.id);

        const dateStr = this.formatDateInTimezone(new Date(a.submitted_at), timezone);
        if (daysMap[dateStr]) {
          daysMap[dateStr].count += 1;
          daysMap[dateStr].breakdown.assessments += 1;
        }
      }
    }

    // Ingest recruitment drive applications
    if (applications && Array.isArray(applications)) {
      for (const app of applications) {
        if (!app.id || processedAppIds.has(app.id)) continue;
        const ts = app.registration_date || app.created_at;
        if (!ts) continue;
        processedAppIds.add(app.id);

        const dateStr = this.formatDateInTimezone(new Date(ts), timezone);
        if (daysMap[dateStr]) {
          daysMap[dateStr].count += 1;
          daysMap[dateStr].breakdown.applications += 1;
        }
      }
    }

    // Ingest mistake remediation sessions
    if (reviews && Array.isArray(reviews)) {
      for (const rev of reviews) {
        if (!rev.id || processedReviewIds.has(rev.id) || !rev.created_at) continue;
        processedReviewIds.add(rev.id);

        const dateStr = this.formatDateInTimezone(new Date(rev.created_at), timezone);
        if (daysMap[dateStr]) {
          daysMap[dateStr].count += 1;
          daysMap[dateStr].breakdown.mistakeRemediations += 1;
        }
      }
    }

    // Compute levels and aggregate metrics
    const sortedDates = Object.keys(daysMap).sort();
    let totalSubmissions = 0;
    let totalActiveDays = 0;
    let maxStreak = 0;
    let currentStreakCount = 0;

    for (const d of sortedDates) {
      const day = daysMap[d];
      day.level = this.computeLevel(day.count);

      if (day.count > 0) {
        totalSubmissions += day.count;
        totalActiveDays += 1;
        currentStreakCount += 1;
        if (currentStreakCount > maxStreak) {
          maxStreak = currentStreakCount;
        }
      } else {
        currentStreakCount = 0;
      }
    }

    // Calculate current trailing streak (ending today or yesterday)
    let currentStreak = 0;
    const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
    const todayActivity = daysMap[endDateStr];
    const yesterdayDate = new Date(Date.UTC(endYear, endMonth - 1, endDay - 1))
      .toISOString()
      .slice(0, 10);
    const yesterdayActivity = daysMap[yesterdayDate];

    let startStreakDate = "";
    if (todayActivity && todayActivity.count > 0) {
      startStreakDate = endDateStr;
    } else if (yesterdayActivity && yesterdayActivity.count > 0) {
      startStreakDate = yesterdayDate;
    }

    if (startStreakDate) {
      const idx = sortedDates.indexOf(startStreakDate);
      if (idx !== -1) {
        for (let i = idx; i >= 0; i--) {
          if (daysMap[sortedDates[i]].count > 0) {
            currentStreak += 1;
          } else {
            break;
          }
        }
      }
    }

    const months = this.buildMonthBlocks(startDateStr, endDateStr, daysMap);

    return {
      studentId,
      totalSubmissions,
      totalActiveDays,
      maxStreak,
      currentStreak,
      startDate: startDateStr,
      endDate: endDateStr,
      days: daysMap,
      months,
    };
  }
}
