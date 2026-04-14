/** Whether the submission row already has vendor-response fields (skip vendor dialog). */
export function submissionHasVendorDetails(s: any): boolean {
  if (s.rate == null || s.rate === "") return false;
  if (Number.isNaN(Number(s.rate))) return false;
  if (!s.job_type) return false;
  const hasJd =
    (typeof s.job_description === "string" && s.job_description.trim() !== "") ||
    Boolean(s.job_description_url);
  if (!hasJd) return false;
  if (s.job_type !== "Remote") {
    if (!String(s.city ?? "").trim() || !s.state) return false;
  }
  return true;
}

/** Screen call was saved (skip schedule dialog when reverting status). */
export function submissionHasScheduledScreen(s: any): boolean {
  return Boolean(s.screen_scheduled_at);
}

/** Assessment was saved (skip assessment dialog when reverting status or re-selecting Assessment). */
export function submissionHasAssessmentDetails(s: any): boolean {
  const end = s.assessment_end_date;
  if (end == null) return false;
  const endStr = typeof end === "string" ? end.trim() : String(end).trim();
  if (!endStr || endStr === "null" || endStr === "undefined") return false;
  const linkRaw = s.assessment_link;
  const link =
    typeof linkRaw === "string" ? linkRaw.trim() : String(linkRaw ?? "").trim();
  const attRaw = s.assessment_attachment_url;
  const hasAtt = Boolean(attRaw && String(attRaw).trim().length > 0);
  return Boolean(link || hasAtt);
}

/**
 * After vendor response, recruiters may send a candidate to **Assessment** or **Screen Call** directly (two routes).
 * Assessment details are only required before opening the screen scheduler when the submission is already on the
 * assessment path (`status === "Assessment"`) and details are still missing.
 * Direct Screen Call (bypassing assessment) must not force the assessment dialog.
 * When `screen_scheduled_at` is already set, returns false so we skip the assessment step.
 */
export function submissionShouldPromptAssessmentBeforeScreen(s: any): boolean {
  if (submissionHasScheduledScreen(s)) return false;
  if (submissionHasAssessmentDetails(s)) return false;
  if (!submissionHasVendorDetails(s)) return false;
  return s.status === "Assessment";
}
