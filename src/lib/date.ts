/**
 * Deterministic, locale-independent date formatters.
 * Dates are rendered in UTC so server and browser output is identical regardless
 * of deployment region or the visitor's timezone. The UI labels UTC timestamps.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function asValidDate(input: Date | string | number | null | undefined): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(input: Date | string | number | null | undefined): string {
  const date = asValidDate(input);
  if (!date) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatTimeUtc(input: Date | string | number | null | undefined): string {
  const date = asValidDate(input);
  if (!date) return "";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes} UTC`;
}

export function formatDateTime(input: Date | string | number | null | undefined): string {
  const date = asValidDate(input);
  if (!date) return "";
  return `${formatDate(date)} ${formatTimeUtc(date)}`;
}
