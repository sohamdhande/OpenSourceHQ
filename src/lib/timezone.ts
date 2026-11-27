/** Return a calendar date key in an IANA timezone, independent of the host locale. */
export function getDateKeyInTimeZone(input: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(input);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Convert a datetime-local wall-clock value in a named IANA timezone to UTC. */
export function localDateTimeToUtcISOString(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid event date and time.");

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const target = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  };
  const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  let candidate = targetAsUtc;
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const parts = formatter.formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    const correction = targetAsUtc - representedAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }

  const finalParts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
  const matchesRequestedTime = Number(finalParts.year) === target.year
    && Number(finalParts.month) === target.month
    && Number(finalParts.day) === target.day
    && Number(finalParts.hour) === target.hour
    && Number(finalParts.minute) === target.minute;
  if (!matchesRequestedTime) {
    throw new Error("That local time does not exist in the selected timezone because of a daylight-saving transition. Choose another time.");
  }
  return new Date(candidate).toISOString();
}

export function formatDateTimeInTimeZone(input: Date | string, timeZone: string): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  }
}

/** Count consecutive days with at least one report ending today (or yesterday if today is not logged yet). */
export function computeReportingStreak(reportDates: Date[], today: Date): number {
  if (reportDates.length === 0) return 0;
  const dateSet = new Set(reportDates.map((d) => d.toISOString().split("T")[0]));
  const checkDate = new Date(today);
  if (!dateSet.has(checkDate.toISOString().split("T")[0])) {
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }
  let streak = 0;
  while (dateSet.has(checkDate.toISOString().split("T")[0])) {
    streak += 1;
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
  }
  return streak;
}
