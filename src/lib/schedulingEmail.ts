import { formatInAppTimeZone, APP_TIME_ZONE } from "@/lib/appTimezone";
import { getAppBaseUrl } from "@/lib/utils";
import { fetchProfilesByRole, fetchProfileByUserId } from "../../dbscripts/functions/profiles";

/**
 * Power Automate `type` field. Add `assessment_assigned` to your flow's enum if missing.
 * @see CUSTOM_AUTH_SETUP / VITE_SCHEDULING_WEBHOOK
 */
export type SchedulingEmailType =
  | "screen_call_scheduled"
  | "screen_call_rescheduled"
  | "interview_scheduled"
  | "interview_rescheduled"
  | "first_application_started"
  | "assessment_assigned";

/** Submission fields used for attachment links in scheduling emails. */
export type SchedulingSubmissionSource = {
  id?: string;
  company_id?: string | null;
  recruiter_id?: string | null;
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
  candidates?:
    | { first_name?: string; last_name?: string; email?: string | null; agency_id?: string | null }
    | { first_name?: string; last_name?: string; email?: string | null; agency_id?: string | null }[]
    | null;
};

/** Payload for the dedicated scheduling Power Automate flow. */
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
  appLink?: string;
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

export type SchedulingNotifyResult = {
  /** True if the candidate email was sent (same meaning as before this change). */
  sent: boolean;
  reason?: "no_candidate_email" | "invalid_payload";
  /** Company / agency admin copies attempted (each is a separate POST). */
  staffEmailsAttempted?: number;
  staffEmailsSucceeded?: number;
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
    case "first_application_started":
      return {
        eventLabel: "Your marketing journey has started",
        subject: `Congratulations! Your first application is live — ${jobTitle}`,
      };
    case "assessment_assigned":
      return {
        eventLabel: "Assessment assigned",
        subject: `Assessment assigned: ${jobTitle} at ${clientName}`,
      };
  }
}

const EMPTY_SCHEDULING_FIELDS = {
  date: "",
  time: "",
  mode: "",
  linkOrPhone: "",
  resumeUrl: "",
  interviewQuestionsUrl: "",
  jobDescriptionUrl: "",
  assessmentLink: "",
  assessmentAttachmentUrl: "",
  assessmentEndDate: "",
  rejectionNote: "",
} as const;

function submissionAppLink(submission: SchedulingSubmissionSource): string {
  const base = getAppBaseUrl();
  if (!base || !submission.id) return "";
  return `${base.replace(/\/$/, "")}/submissions/${submission.id}`;
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

/** Body without recipient `name` / `email` (same POST shape for candidate + each admin). */
export function buildSchedulingEmailBody(
  type: SchedulingEmailType,
  submission: SchedulingSubmissionSource,
  opts: SchedulingNotifyOpts
): Omit<SchedulingEmailPayload, "name" | "email"> | null {
  if (type === "assessment_assigned") return null;

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
    appLink: submissionAppLink(submission),
  };
}

export function buildAssessmentAssignedEmailBody(
  submission: SchedulingSubmissionSource,
  opts: { recruiterName: string | null }
): Omit<SchedulingEmailPayload, "name" | "email"> | null {
  const clientName = submission.client_name?.trim() || "Client";
  const jobTitle = submission.position?.trim() || "Position";
  const endRaw = submission.assessment_end_date?.trim() || "";
  const endIso = endRaw.length === 10 ? `${endRaw}T12:00:00` : endRaw || new Date().toISOString();
  const { date, time } = formatSchedulingDateTime(endIso);
  const copy = eventCopy("assessment_assigned", jobTitle, clientName);
  const link = pickUrl(submission.assessment_link);
  const file = pickUrl(submission.assessment_attachment_url);

  return {
    type: "assessment_assigned",
    subject: copy.subject,
    eventLabel: copy.eventLabel,
    clientName,
    jobTitle,
    date,
    time: time || "",
    timeZone: APP_TIME_ZONE,
    mode: link ? "Link" : file ? "File" : "",
    linkOrPhone: link || file,
    status: "Pending",
    applicationStatus: "Assessment",
    resumeUrl: "",
    interviewQuestionsUrl: "",
    jobDescriptionUrl: pickUrl(submission.job_description_url),
    assessmentLink: link,
    assessmentAttachmentUrl: file,
    assessmentEndDate: formatAssessmentEndDate(submission.assessment_end_date),
    rejectionNote: "",
    recruiterName: opts.recruiterName?.trim() || "Recruiting Team",
    appLink: submissionAppLink(submission),
  };
}

export function buildFirstApplicationStartedPayload(opts: {
  candidate: CandidateRow;
  clientName: string;
  jobTitle: string;
  applicationStatus: string;
  recruiterName: string;
}): SchedulingEmailPayload | null {
  const email = opts.candidate.email?.trim();
  if (!email) return null;

  const clientName = opts.clientName?.trim() || "Client";
  const jobTitle = opts.jobTitle?.trim() || "Role";
  const copy = eventCopy("first_application_started", jobTitle, clientName);
  const appBase = getAppBaseUrl();
  const appLink = appBase ? `${appBase}/login` : "/login";

  return {
    type: "first_application_started",
    name: candidateDisplayName(opts.candidate),
    email,
    subject: copy.subject,
    eventLabel: copy.eventLabel,
    clientName,
    jobTitle,
    timeZone: APP_TIME_ZONE,
    status: "Active",
    applicationStatus: opts.applicationStatus?.trim() || "Applied",
    recruiterName: opts.recruiterName?.trim() || "Recruiting Team",
    appLink,
    ...EMPTY_SCHEDULING_FIELDS,
  };
}

export async function notifyFirstApplicationStarted(opts: {
  candidate: CandidateRow;
  clientName: string;
  jobTitle: string;
  applicationStatus: string;
  recruiterName: string;
}) {
  const payload = buildFirstApplicationStartedPayload(opts);
  if (!payload) return { sent: false as const, reason: "no_candidate_email" as const };
  await postSchedulingEmailWebhook(payload);
  return { sent: true as const };
}

/** Company admins + agency admins (when the submitting recruiter belongs to an agency). */
export async function collectSchedulingStaffRecipients(
  companyId: string,
  recruiterUserId: string | null | undefined
): Promise<{ full_name: string; email: string }[]> {
  const byKey = new Map<string, { full_name: string; email: string }>();

  const admins = await fetchProfilesByRole("admin", undefined, companyId);
  for (const p of admins as { full_name?: string; email?: string }[]) {
    const email = p.email?.trim();
    if (email) byKey.set(email.toLowerCase(), { full_name: p.full_name?.trim() || "Admin", email });
  }

  if (recruiterUserId) {
    const prof = (await fetchProfileByUserId(recruiterUserId)) as { agency_id?: string | null } | null;
    const agencyId = prof?.agency_id;
    if (agencyId) {
      const agencyAdmins = await fetchProfilesByRole("agency_admin", agencyId, companyId);
      for (const p of agencyAdmins as { full_name?: string; email?: string }[]) {
        const email = p.email?.trim();
        if (email) byKey.set(email.toLowerCase(), { full_name: p.full_name?.trim() || "Agency admin", email });
      }
    }
  }

  return [...byKey.values()];
}

const STAFF_NOTIFY_TYPES: SchedulingEmailType[] = [
  "screen_call_scheduled",
  "screen_call_rescheduled",
  "interview_scheduled",
  "interview_rescheduled",
  "assessment_assigned",
];

export async function postSchedulingEmailToStaff(
  body: Omit<SchedulingEmailPayload, "name" | "email">,
  companyId: string,
  recruiterUserId: string | null | undefined
): Promise<{ attempted: number; succeeded: number }> {
  const recipients = await collectSchedulingStaffRecipients(companyId, recruiterUserId);
  let attempted = 0;
  let succeeded = 0;
  for (const r of recipients) {
    attempted += 1;
    try {
      await postSchedulingEmailWebhook({
        ...body,
        name: r.full_name,
        email: r.email,
      });
      succeeded += 1;
    } catch (e) {
      console.warn("Staff scheduling webhook failed for", r.email, e);
    }
  }
  return { attempted, succeeded };
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

/** Candidate + company/agency admin copies (same JSON body, different `name` / `email`). */
export async function notifySchedulingEmail(
  type: SchedulingEmailType,
  submission: SchedulingSubmissionSource & { company_id?: string | null; recruiter_id?: string | null },
  opts: SchedulingNotifyOpts
): Promise<SchedulingNotifyResult> {
  const body = buildSchedulingEmailBody(type, submission, opts);
  if (!body) return { sent: false, reason: "invalid_payload" };

  const candidate = candidateFromSubmission(submission);
  let candidateSent = false;
  if (candidate?.email?.trim()) {
    await postSchedulingEmailWebhook({
      ...body,
      name: candidateDisplayName(candidate),
      email: candidate.email.trim(),
    });
    candidateSent = true;
  }

  let staffAttempted = 0;
  let staffSucceeded = 0;
  const companyId = submission.company_id?.trim();
  if (companyId && STAFF_NOTIFY_TYPES.includes(type)) {
    const staff = await postSchedulingEmailToStaff(body, companyId, submission.recruiter_id ?? null);
    staffAttempted = staff.attempted;
    staffSucceeded = staff.succeeded;
  }

  if (!candidateSent) {
    return {
      sent: false,
      reason: "no_candidate_email",
      staffEmailsAttempted: staffAttempted,
      staffEmailsSucceeded: staffSucceeded,
    };
  }
  return {
    sent: true,
    staffEmailsAttempted: staffAttempted,
    staffEmailsSucceeded: staffSucceeded,
  };
}

/** After assessment details are saved (status Assessment). */
export async function notifyAssessmentAssignedEmail(
  submission: SchedulingSubmissionSource & { company_id?: string | null; recruiter_id?: string | null },
  opts: { recruiterName: string | null }
): Promise<SchedulingNotifyResult> {
  const body = buildAssessmentAssignedEmailBody(submission, opts);
  if (!body) return { sent: false, reason: "invalid_payload" };

  const candidate = candidateFromSubmission(submission);
  let candidateSent = false;
  if (candidate?.email?.trim()) {
    await postSchedulingEmailWebhook({
      ...body,
      name: candidateDisplayName(candidate),
      email: candidate.email.trim(),
    });
    candidateSent = true;
  }

  let staffAttempted = 0;
  let staffSucceeded = 0;
  const companyId = submission.company_id?.trim();
  if (companyId) {
    const staff = await postSchedulingEmailToStaff(body, companyId, submission.recruiter_id ?? null);
    staffAttempted = staff.attempted;
    staffSucceeded = staff.succeeded;
  }

  if (!candidateSent) {
    return {
      sent: false,
      reason: "no_candidate_email",
      staffEmailsAttempted: staffAttempted,
      staffEmailsSucceeded: staffSucceeded,
    };
  }
  return { sent: true, staffEmailsAttempted: staffAttempted, staffEmailsSucceeded: staffSucceeded };
}
