import { formatInAppTimeZone, APP_TIME_ZONE } from "@/lib/appTimezone";

export type SchedulingEmailType =
  | "screen_call_scheduled"
  | "screen_call_rescheduled"
  | "interview_scheduled"
  | "interview_rescheduled";

/** Payload for the dedicated scheduling Power Automate flow (body composed in PA, like invite). */
export interface SchedulingEmailPayload {
  type: SchedulingEmailType;
  name: string;
  email: string;
  subject: string;
  eventLabel: string;
  clientName: string;
  jobTitle: string;
  date: string;
  time: string;
  timeZone: string;
  mode: string;
  linkOrPhone: string;
  roundNumber?: number;
  recruiterName: string;
}

type CandidateRow = { first_name?: string; last_name?: string; email?: string | null };

function candidateFromSubmission(submission: { candidates?: CandidateRow | CandidateRow[] | null }) {
  const c = submission.candidates;
  if (Array.isArray(c)) return c[0];
  return c ?? undefined;
}

export function candidateDisplayName(c?: CandidateRow | null) {
  if (!c) return "Candidate";
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Candidate";
}

export function formatSchedulingDateTime(scheduledAtIso: string) {
  const d = new Date(scheduledAtIso);
  if (Number.isNaN(d.getTime())) return { date: scheduledAtIso, time: "" };
  return {
    date: formatInAppTimeZone(d, "EEEE, MMMM d, yyyy"),
    time: formatInAppTimeZone(d, "h:mm a"),
  };
}

function eventCopy(type: SchedulingEmailType, jobTitle: string, clientName: string, roundNumber?: number) {
  const round = roundNumber != null ? ` (Round ${roundNumber})` : "";
  switch (type) {
    case "screen_call_scheduled":
      return {
        eventLabel: "Screen call scheduled",
        subject: `Screen call scheduled: ${jobTitle} at ${clientName}`,
      };
    case "screen_call_rescheduled":
      return {
        eventLabel: "Screen call rescheduled",
        subject: `Screen call rescheduled: ${jobTitle} at ${clientName}`,
      };
    case "interview_scheduled":
      return {
        eventLabel: `Interview scheduled${round}`,
        subject: `Interview scheduled${round}: ${jobTitle} at ${clientName}`,
      };
    case "interview_rescheduled":
      return {
        eventLabel: `Interview rescheduled${round}`,
        subject: `Interview rescheduled${round}: ${jobTitle} at ${clientName}`,
      };
  }
}

export function buildSchedulingEmailPayload(
  type: SchedulingEmailType,
  submission: {
    client_name?: string | null;
    position?: string | null;
    candidates?: CandidateRow | CandidateRow[] | null;
  },
  opts: {
    scheduledAtIso: string;
    mode: string;
    linkOrPhone?: string | null;
    roundNumber?: number;
    recruiterName?: string | null;
  }
): SchedulingEmailPayload | null {
  const candidate = candidateFromSubmission(submission);
  const email = candidate?.email?.trim();
  if (!email) return null;

  const name = candidateDisplayName(candidate);
  const clientName = submission.client_name?.trim() || "Client";
  const jobTitle = submission.position?.trim() || "Position";
  const { date, time } = formatSchedulingDateTime(opts.scheduledAtIso);
  const copy = eventCopy(type, jobTitle, clientName, opts.roundNumber);

  return {
    type,
    name,
    email,
    subject: copy.subject,
    eventLabel: copy.eventLabel,
    clientName,
    jobTitle,
    date,
    time,
    timeZone: APP_TIME_ZONE,
    mode: opts.mode,
    linkOrPhone: opts.linkOrPhone?.trim() ?? "",
    roundNumber: opts.roundNumber,
    recruiterName: opts.recruiterName?.trim() || "Recruiting Team",
  };
}

/** POST to the dedicated scheduling Power Automate flow (VITE_SCHEDULING_WEBHOOK). */
export async function postSchedulingEmailWebhook(payload: SchedulingEmailPayload) {
  const webhook = import.meta.env.VITE_SCHEDULING_WEBHOOK as string | undefined;
  if (!webhook?.trim()) {
    console.warn("VITE_SCHEDULING_WEBHOOK not configured; skipping scheduling email");
    return;
  }
  const res = await fetch(webhook.trim(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Webhook failed (${res.status})`);
  }
}

export async function notifySchedulingEmail(
  type: SchedulingEmailType,
  submission: Parameters<typeof buildSchedulingEmailPayload>[1],
  opts: Parameters<typeof buildSchedulingEmailPayload>[2]
) {
  const payload = buildSchedulingEmailPayload(type, submission, opts);
  if (!payload) return { sent: false as const, reason: "no_candidate_email" as const };
  await postSchedulingEmailWebhook(payload);
  return { sent: true as const };
}
