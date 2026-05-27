export const JOB_PORTAL_OPTIONS = [
  "LinkedIn",
  "Indeed",
  "Monster",
  "ZipRecruiter",
  "Company Website",
  "Other",
] as const;

export type JobPortal = (typeof JOB_PORTAL_OPTIONS)[number];

export type ApplicationImportRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  clientName: string;
  position: string;
  jobPortal: string;
  jobLink: string;
};

export type ParsedImportRow = ApplicationImportRow & {
  candidateId: string | null;
  errors: string[];
  /** Row passes validation and is shown in preview */
  valid: boolean;
  /** Safe to insert into database (excludes test-cache-only matches) */
  importable: boolean;
};

export type ImportPreviewResult = {
  headers: string[];
  rows: ParsedImportRow[];
  parseError: string | null;
};

const HEADER_ALIASES: Record<string, keyof Omit<ApplicationImportRow, "rowNumber">> = {
  "candidate first name": "firstName",
  "first name": "firstName",
  firstname: "firstName",
  "candidate_first_name": "firstName",
  "candidate last name": "lastName",
  "last name": "lastName",
  lastname: "lastName",
  "candidate_last_name": "lastName",
  "client name": "clientName",
  client: "clientName",
  "client_name": "clientName",
  position: "position",
  "job title": "position",
  title: "position",
  "job portal": "jobPortal",
  portal: "jobPortal",
  job_portal: "jobPortal",
  "job link": "jobLink",
  link: "jobLink",
  url: "jobLink",
  "job url": "jobLink",
  job_link: "jobLink",
};

export const IMPORT_TEMPLATE_CSV = `Candidate First Name,Candidate Last Name,Client Name,Position,Job Portal,Job Link
Jane,Doe,Acme Corp,Software Engineer,LinkedIn,https://example.com/jobs/123
John,Smith,Globex Inc,Data Analyst,Indeed,https://example.com/jobs/456
`;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

function normalizeNamePart(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function candidateKey(firstName: string, lastName: string): string {
  return `${normalizeNamePart(firstName)}|${normalizeNamePart(lastName)}`;
}

/** Minimal RFC-style CSV parse (commas, quoted fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      if (ch === "\r") i++;
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }

  return rows;
}

function mapHeaders(headerRow: string[]): Partial<Record<keyof Omit<ApplicationImportRow, "rowNumber">, number>> {
  const map: Partial<Record<keyof Omit<ApplicationImportRow, "rowNumber">, number>> = {};
  headerRow.forEach((h, i) => {
    const key = HEADER_ALIASES[normalizeHeader(h)];
    if (key) map[key] = i;
  });
  return map;
}

function normalizeJobPortal(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const exact = JOB_PORTAL_OPTIONS.find((p) => p.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  if (/linkedin/i.test(t)) return "LinkedIn";
  if (/indeed/i.test(t)) return "Indeed";
  if (/monster/i.test(t)) return "Monster";
  if (/zip/i.test(t)) return "ZipRecruiter";
  if (/company\s*web/i.test(t)) return "Company Website";
  return "Other";
}

export function buildCandidateLookup(
  candidates: { id: string; first_name: string; last_name?: string | null }[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const c of candidates) {
    const key = candidateKey(c.first_name, c.last_name ?? "");
    const list = map.get(key) ?? [];
    list.push(c.id);
    map.set(key, list);
  }
  return map;
}

export function previewApplicationImport(
  csvText: string,
  candidates: { id: string; first_name: string; last_name?: string | null }[],
  options?: { isTestCacheCandidateId?: (id: string) => boolean }
): ImportPreviewResult {
  const isTestId = options?.isTestCacheCandidateId ?? (() => false);
  const trimmed = csvText.trim();
  if (!trimmed) {
    return { headers: [], rows: [], parseError: "File is empty" };
  }

  const grid = parseCsv(trimmed);
  if (grid.length < 2) {
    return { headers: grid[0] ?? [], rows: [], parseError: "CSV must include a header row and at least one data row" };
  }

  const headers = grid[0];
  const colMap = mapHeaders(headers);
  const required: (keyof Omit<ApplicationImportRow, "rowNumber">)[] = [
    "firstName",
    "lastName",
    "clientName",
    "position",
    "jobPortal",
    "jobLink",
  ];
  const missing = required.filter((k) => colMap[k] === undefined);
  if (missing.length > 0) {
    return {
      headers,
      rows: [],
      parseError: `Missing columns: ${missing.join(", ")}. Use template headers: Candidate First Name, Candidate Last Name, Client Name, Position, Job Portal, Job Link`,
    };
  }

  const lookup = buildCandidateLookup(candidates);
  const rows: ParsedImportRow[] = [];

  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    const rowNumber = i + 1;
    const get = (key: keyof Omit<ApplicationImportRow, "rowNumber">) =>
      (cells[colMap[key]!] ?? "").trim();

    const firstName = get("firstName");
    const lastName = get("lastName");
    const clientName = get("clientName");
    const position = get("position");
    const jobPortalRaw = get("jobPortal");
    const jobLink = get("jobLink");
    const jobPortal = normalizeJobPortal(jobPortalRaw) ?? "";

    const errors: string[] = [];

    if (!firstName) errors.push("Candidate first name is required");
    if (!lastName) errors.push("Candidate last name is required");
    if (!clientName) errors.push("Client name is required");
    if (!position) errors.push("Position is required");
    if (!jobPortalRaw) errors.push("Job portal is required");
    else if (!jobPortal) errors.push("Invalid job portal");
    if (!jobLink) errors.push("Job link is required");
    else {
      try {
        new URL(jobLink);
      } catch {
        errors.push("Job link must be a valid URL (include https://)");
      }
    }

    let candidateId: string | null = null;
    if (firstName && lastName) {
      const matches = lookup.get(candidateKey(firstName, lastName)) ?? [];
      if (matches.length === 0) {
        errors.push(`No candidate found for "${firstName} ${lastName}"`);
      } else if (matches.length > 1) {
        errors.push(`Multiple candidates named "${firstName} ${lastName}" — resolve duplicates first`);
      } else {
        candidateId = matches[0];
      }
    }

    const baseValid = errors.length === 0 && !!candidateId;
    const importable = baseValid && !!candidateId && !isTestId(candidateId);

    rows.push({
      rowNumber,
      firstName,
      lastName,
      clientName,
      position,
      jobPortal,
      jobLink,
      candidateId,
      errors,
      valid: baseValid,
      importable,
    });
  }

  return { headers, rows, parseError: null };
}

export function downloadCsvFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadImportTemplate() {
  downloadCsvFile(IMPORT_TEMPLATE_CSV, "applications-import-template.csv");
}
