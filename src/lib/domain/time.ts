import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { RRule } from "rrule";

export const DEFAULT_TIMEZONE = "Asia/Shanghai";

export function localDay(value: Date | string, timeZone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(new Date(value), timeZone, "yyyy-MM-dd");
}

export function utcFromLocalParts(parts: string, timeZone = DEFAULT_TIMEZONE) {
  return fromZonedTime(parts, timeZone).toISOString();
}

export function nextOccurrence(startIso: string, rrule: string | null, timeZone = DEFAULT_TIMEZONE) {
  if (!rrule) return null;
  const start = new Date(startIso);
  const rule = RRule.fromString(rrule);
  const next = rule.after(start, false);
  return next ? formatInTimeZone(next, timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX") : null;
}
