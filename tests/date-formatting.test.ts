import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTimeUtc } from "@/lib/date";

describe("deterministic UTC date formatting", () => {
  it("renders the same stable UTC date regardless of runtime locale", () => {
    expect(formatDate("2026-11-24T23:30:00.000Z")).toBe("Nov 24, 2026");
  });

  it("labels formatted date-times and times as UTC", () => {
    const instant = "2026-11-24T08:05:00.000Z";
    expect(formatDateTime(instant)).toBe("Nov 24, 2026 08:05 UTC");
    expect(formatTimeUtc(instant)).toBe("08:05 UTC");
  });

  it("handles null, epoch zero, and invalid dates safely", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(0)).toBe("Jan 1, 1970");
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDateTime(undefined)).toBe("");
  });
});
