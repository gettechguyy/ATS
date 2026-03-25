import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from "date-fns";

/** US Eastern (handles EST and EDT). */
export const APP_TIME_ZONE = "America/New_York";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse Eastern calendar yyyy-MM-dd into UTC instants (avoids relying on the browser's local zone). */
function easternYmdBounds(ymd: string, end: boolean): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return fromZonedTime(
    `${y}-${pad2(m)}-${pad2(d)}T${end ? "23:59:59.999" : "00:00:00.000"}`,
    APP_TIME_ZONE
  );
}

/** Inclusive start of the US Eastern calendar day that `date` falls on. */
export function easternDayStartUtc(date: Date): Date {
  const ymd = formatInTimeZone(date, APP_TIME_ZONE, "yyyy-MM-dd");
  return easternYmdBounds(ymd, false);
}

/** Inclusive end of that Eastern calendar day (for lte filters). */
export function easternDayEndUtc(date: Date): Date {
  const ymd = formatInTimeZone(date, APP_TIME_ZONE, "yyyy-MM-dd");
  return easternYmdBounds(ymd, true);
}

export function formatInAppTimeZone(date: Date, fmt: string): string {
  return formatInTimeZone(date, APP_TIME_ZONE, fmt);
}

const appDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** Format a stored timestamptz for UI in US Eastern (12-hour clock with AM/PM). No timezone suffix. */
export function formatInAppDateTime(isoOrDate: string | Date | null | undefined): string {
  if (isoOrDate == null || isoOrDate === "") return "—";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "—";
  return appDateTimeFormatter.format(d);
}

export function easternPresetToday(): { from: Date; to: Date } {
  const z = toZonedTime(new Date(), APP_TIME_ZONE);
  return {
    from: fromZonedTime(startOfDay(z), APP_TIME_ZONE),
    to: fromZonedTime(endOfDay(z), APP_TIME_ZONE),
  };
}

export function easternPresetYesterday(): { from: Date; to: Date } {
  const z = toZonedTime(new Date(), APP_TIME_ZONE);
  const y = subDays(z, 1);
  return {
    from: fromZonedTime(startOfDay(y), APP_TIME_ZONE),
    to: fromZonedTime(endOfDay(y), APP_TIME_ZONE),
  };
}

export function easternPresetThisWeek(): { from: Date; to: Date } {
  const z = toZonedTime(new Date(), APP_TIME_ZONE);
  const ws = startOfWeek(z, { weekStartsOn: 1 });
  const we = endOfWeek(z, { weekStartsOn: 1 });
  return {
    from: fromZonedTime(ws, APP_TIME_ZONE),
    to: fromZonedTime(we, APP_TIME_ZONE),
  };
}

export function easternPresetLastWeek(): { from: Date; to: Date } {
  const z = toZonedTime(new Date(), APP_TIME_ZONE);
  const thisStart = startOfWeek(z, { weekStartsOn: 1 });
  const lastStart = subDays(thisStart, 7);
  const lastEnd = endOfWeek(lastStart, { weekStartsOn: 1 });
  return {
    from: fromZonedTime(lastStart, APP_TIME_ZONE),
    to: fromZonedTime(lastEnd, APP_TIME_ZONE),
  };
}

/** UTC instants for Supabase gte/lte on timestamptz columns. */
export function easternRangeForDashboardFilter(
  range: { from?: Date | null; to?: Date | null } | undefined
): { start: Date | null; end: Date | null } {
  if (!range?.from && !range?.to) return { start: null, end: null };
  const start = range.from ? easternDayStartUtc(range.from) : null;
  const end = range.to ? easternDayEndUtc(range.to) : null;
  return { start, end };
}
