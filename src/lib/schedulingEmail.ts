import { formatInAppTimeZone, APP_TIME_ZONE } from "@/lib/appTimezone";

export type SchedulingEmailType =
  | "screen_call_scheduled"
  | "screen_call_rescheduled"
  | "interview_scheduled"
  | "interview_rescheduled";

/** Submission fields used for attachment links in scheduling emails. */
export type SchedulingSubmissionSource = {
  client_name?: string | null;
  position?: string | null;
  status?: string | null;
  screen_resume_url?: string | null;
  screen_questions_url?: string | null;
  screen_response_status?: string | null;
  screen_rejection_note?: string | null;
  job_description_url?: string | null;
  assessment_link?: string | null;
  assessment_attachment_url?: string | null;
  assessment_end_date?: string | null;
  candidates?: { first_name?: string; last_name?: string; email?: string | null } | { first_name?: string; last_name?: string; email?: string | null }[] | null;
};

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
  status: string;
  applicationStatus: string;
  resumeUrl: string;
  interviewQuestionsUrl: string;
  jobDescriptionUrl: string;
  assessmentLink: string;
  assessmentAttachmentUrl: string;
  assessmentEndDate: string;
  rejectionNote: string;
  roundNumber?: number;
  recruiterName: string;
}

export type SchedulingNotifyOpts = {
  scheduledAtIso: string;
  mode: string;
  linkOrPhone?: string | null;
  roundNumber?: number;
  recruiterName?: string | null;
  /** Screen response (Yes/No/None) or interview status (Scheduled, etc.). */
  status?: string | null;
  resumeUrl?: string | null;
  interviewQuestionsUrl?: string | null;
  rejectionNote?: string | null;
};

type CandidateRow = { first_name?: string; last_name?: string; email?: string | null };

function candidateFromSubmission(submission: SchedulingSubmissionSource) {
  const c = submission.candidates;
  if (Array.isArray(c)) return c[0];
  return c ?? undefined;
}

function pickUrl(...values: (string | null | undefined)[]) {
  for (const v of values) {
    const s = v?.trim();
    if (s) return s;
  }
  return "";
}

function pickStatus(...values: (string | null | undefined)[]) {
  for (const v of values) {
    const s = v?.trim();
    if (s && s !== "None") return s;
  }
  return "Pending";
}

function formatAssessmentEndDate(value: string | null | undefined) {
  if (!value?.trim()) return "";
  const raw = value.trim();
  const d = raw.length === 10 ? new Date(`${raw}T12:00:00`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return formatInAppTimeZone(d, "EEEE, MMMM d, yyyy");
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

function resolveEventStatus(
  type: SchedulingEmailType,
  submission: SchedulingSubmissionSource,
  opts: SchedulingNotifyOpts
) {
  const isInterview = type.startsWith("interview");
  if (isInterview) {
    return pickStatus(opts.status, "Scheduled");
  }
  return pickStatus(opts.status, submission.screen_response_status);
}

export function buildSchedulingEmailPayload(
  type: SchedulingEmailType,
  submission: SchedulingSubmissionSource,
  opts: SchedulingNotifyOpts
): SchedulingEmailPayload | null {
  const candidate = candidateFromSubmission(submission);
  const email = candidate?.email?.trim();
  if (!email) return null;

  const name = candidateDisplayName(candidate);
  const clientName = submission.client_name?.trim() || "Client";
  const jobTitle = submission.position?.trim() || "Position";
  const { date, time } = formatSchedulingDateTime(opts.scheduledAtIso);
  const copy = eventCopy(type, jobTitle, clientName, opts.roundNumber);
  const isInterview = type.startsWith("interview");

  const resumeUrl = isInterview ? "" : pickUrl(opts.resumeUrl, submission.screen_resume_url);
  const interviewQuestionsUrl = pickUrl(
    opts.interviewQuestionsUrl,
    isInterview ? undefined : submission.screen_questions_url
  );

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
    status: resolveEventStatus(type, submission, opts),
    applicationStatus: submission.status?.trim() || "",
    resumeUrl,
    interviewQuestionsUrl,
    jobDescriptionUrl: pickUrl(submission.job_description_url),
    assessmentLink: pickUrl(submission.assessment_link),
    assessmentAttachmentUrl: pickUrl(submission.assessment_attachment_url),
    assessmentEndDate: formatAssessmentEndDate(submission.assessment_end_date),
    rejectionNote: pickUrl(opts.rejectionNote, submission.screen_rejection_note),
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
  submission: SchedulingSubmissionSource,
  opts: SchedulingNotifyOpts
) {
  const payload = buildSchedulingEmailPayload(type, submission, opts);
  if (!payload) return { sent: false as const, reason: "no_candidate_email" as const };
  await postSchedulingEmailWebhook(payload);
  return { sent: true as const };
}
