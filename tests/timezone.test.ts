import { describe, expect, it } from "vitest";
import { formatDateTimeInTimeZone, getDateKeyInTimeZone, localDateTimeToUtcISOString } from "@/lib/timezone";

describe("organization timezone utilities", () => {
  it("computes the same local calendar day from a UTC instant", () => {
    const instant = new Date("2026-11-24T19:00:00.000Z");
    expect(getDateKeyInTimeZone(instant, "Asia/Kolkata")).toBe("2026-11-25");
    expect(getDateKeyInTimeZone(instant, "UTC")).toBe("2026-11-24");
  });

  it("converts a wall-clock time in the selected timezone to the correct UTC instant", () => {
    expect(localDateTimeToUtcISOString("2026-11-25T00:30", "Asia/Kolkata")).toBe("2026-11-24T19:00:00.000Z");
    expect(localDateTimeToUtcISOString("2026-11-24T19:00", "UTC")).toBe("2026-11-24T19:00:00.000Z");
  });

  it("rejects nonexistent daylight-saving wall-clock times", () => {
    expect(() => localDateTimeToUtcISOString("2026-03-08T02:30", "America/New_York")).toThrow(/daylight-saving transition/i);
  });

  it("formats event times in the requested timezone", () => {
    const formatted = formatDateTimeInTimeZone("2026-11-24T19:00:00.000Z", "Asia/Kolkata");
    expect(formatted).toContain("Nov 25, 2026");
    expect(formatted).toMatch(/GMT\+5:30|IST/);
  });
});
