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
 * Vendor is done and assessment is not, and no screen is scheduled yet — need assessment before opening the screen scheduler.
 * When `screen_scheduled_at` is already set (e.g. reverting status while row still has screen data), returns false so we skip the assessment step.
 */
export function submissionShouldPromptAssessmentBeforeScreen(s: any): boolean {
  if (submissionHasScheduledScreen(s)) return false;
  if (submissionHasAssessmentDetails(s)) return false;
  if (!submissionHasVendorDetails(s)) return false;
  const st = s.status;
  return (
    st === "Vendor Responded" ||
    st === "Applied" ||
    st === "Assessment" ||
    st === "Interview"
  );
}
