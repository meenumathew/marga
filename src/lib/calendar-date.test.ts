import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isCalendarDate, localDateStamp } from "./calendar-date";

describe("isCalendarDate", () => {
  it("test_valid_calendar_date_is_accepted_unchanged", () => {
    expect(isCalendarDate("2026-08-01")).toBe(true);
  });

  it("test_impossible_calendar_date_is_rejected_without_mutation", () => {
    expect(isCalendarDate("2026-99-99")).toBe(false);
    expect(isCalendarDate("2026-04-31")).toBe(false);
    expect(isCalendarDate("2025-02-29")).toBe(false);
  });

  it("test_leap_year_february_29_is_accepted", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
  });

  it("test_date_boundaries_share_one_calendar_rule", () => {
    const boundaryFiles = [
      "src/app/api/milestones/route.ts",
      "src/lib/evidence.ts",
      "src/lib/learn-content.ts",
      "src/lib/progress.ts",
      "src/lib/progress-state.ts",
    ];

    // Boundaries that delegate their date checks to the shared progress rules
    // instead of calling isCalendarDate themselves.
    const delegatingFiles = [
      { file: "src/app/api/progress/route.ts", via: "@/lib/progress-state" },
    ];

    for (const boundaryFile of boundaryFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), boundaryFile), "utf8");

      expect(source).toContain("isCalendarDate");
      expect(source).not.toContain("^\\d{4}-\\d{2}-\\d{2}$");
    }

    for (const { file, via } of delegatingFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");

      expect(source).toContain(via);
      expect(source).not.toContain("^\\d{4}-\\d{2}-\\d{2}$");
    }
  });

  it("test_local_date_stamp_pads_month_and_day", () => {
    expect(localDateStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("test_local_date_stamp_keeps_the_local_calendar_day", () => {
    // Both ends of the same local day, so a UTC-based stamp would shift one of
    // them into a neighbouring day on any machine that is not on UTC.
    expect(localDateStamp(new Date(2026, 6, 1, 23, 30))).toBe("2026-07-01");
    expect(localDateStamp(new Date(2026, 6, 1, 0, 30))).toBe("2026-07-01");
  });

  it("test_local_date_stamp_is_a_valid_calendar_date", () => {
    expect(isCalendarDate(localDateStamp(new Date(2024, 1, 29)))).toBe(true);
  });
});
