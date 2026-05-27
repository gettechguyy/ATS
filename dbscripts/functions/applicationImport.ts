import { createSubmission } from "./submissions";

export type BulkImportApplicationInput = {
  candidate_id: string;
  recruiter_id: string;
  client_name: string;
  position: string;
  job_portal: string;
  job_link: string;
};

export type BulkImportResult = {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
  firstApplicationCount: number;
};

export async function bulkImportApplications(
  rows: BulkImportApplicationInput[],
  rowNumbers: number[]
): Promise<BulkImportResult> {
  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  let firstApplicationCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = rowNumbers[i] ?? i + 2;
    try {
      const result = await createSubmission({
        candidate_id: row.candidate_id,
        recruiter_id: row.recruiter_id,
        client_name: row.client_name,
        position: row.position,
        job_portal: row.job_portal,
        job_link: row.job_link,
        status: "Applied",
      });
      imported++;
      if (result.isFirstApplication) firstApplicationCount++;
    } catch (e) {
      errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : "Import failed",
      });
    }
  }

  return {
    imported,
    failed: errors.length,
    errors,
    firstApplicationCount,
  };
}
