import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Download, FileUp, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadImportTemplate, previewApplicationImport, type ParsedImportRow } from "@/lib/applicationImport";
import { bulkImportApplications } from "../../dbscripts/functions/applicationImport";
import { isTestCacheId } from "@/lib/testDataCache";

type ImportApplicationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recruiterId: string;
  candidates: { id: string; first_name: string; last_name?: string | null }[];
  onSuccess: () => void;
};

export function ImportApplicationsDialog({
  open,
  onOpenChange,
  recruiterId,
  candidates,
  onSuccess,
}: ImportApplicationsDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!csvText.trim()) return null;
    return previewApplicationImport(csvText, candidates, {
      isTestCacheCandidateId: isTestCacheId,
    });
  }, [csvText, candidates]);

  const importableRows = preview?.rows.filter((r) => r.importable) ?? [];
  const invalidCount = preview ? preview.rows.filter((r) => !r.valid).length : 0;

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!importableRows.length) throw new Error("No rows ready to import to the database");
      return bulkImportApplications(
        importableRows.map((r) => ({
          candidate_id: r.candidateId!,
          recruiter_id: recruiterId,
          client_name: r.clientName,
          position: r.position,
          job_portal: r.jobPortal,
          job_link: r.jobLink,
        })),
        importableRows.map((r) => r.rowNumber)
      );
    },
    onSuccess: (result) => {
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} application${result.imported === 1 ? "" : "s"}`);
      }
      if (result.firstApplicationCount > 0) {
        toast.info(
          `${result.firstApplicationCount} candidate${result.firstApplicationCount === 1 ? "" : "s"} received first-application welcome email(s).`
        );
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} row(s) failed during import`);
      }
      onSuccess();
      handleClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleClose = () => {
    setCsvText("");
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
    onOpenChange(false);
  };

  const onFileChange = (file: File | null) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      toast.error("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import applications</DialogTitle>
          <DialogDescription>
            Upload a CSV to preview rows, then import. Candidate first and last name must match an
            existing candidate. Required columns: Client Name, Position, Job Portal, Job Link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="interactive-3d" onClick={downloadImportTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="interactive-3d"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {fileName ? "Change file" : "Choose CSV"}
            </Button>
          </div>

          {fileName ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                File: <span className="font-medium text-foreground">{fileName}</span>
              </p>
              {preview && !preview.parseError ? (
                <p>
                  {preview.rows.length} row(s) · {importableRows.length} ready to import
                  {invalidCount > 0 ? ` · ${invalidCount} with issues` : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Download the template, fill in your applications, then choose the CSV file to preview.
            </p>
          )}

          {preview?.parseError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {preview.parseError}
            </p>
          ) : null}

          {preview && preview.rows.length > 0 && !preview.parseError ? (
            <div className="data-table-shell max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Job portal</TableHead>
                    <TableHead className="min-w-[140px]">Job link</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <ImportPreviewRow key={row.rowNumber} row={row} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <Button
            type="button"
            className="interactive-3d w-full sm:w-auto"
            disabled={importMutation.isPending || importableRows.length === 0}
            onClick={() => importMutation.mutate()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importMutation.isPending
              ? "Importing…"
              : `Import ${importableRows.length} application${importableRows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportPreviewRow({ row }: { row: ParsedImportRow }) {
  return (
    <TableRow className={cn(!row.valid && "bg-destructive/5")}>
      <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
      <TableCell>
        {row.firstName} {row.lastName}
      </TableCell>
      <TableCell>{row.clientName || "—"}</TableCell>
      <TableCell>{row.position || "—"}</TableCell>
      <TableCell className="whitespace-nowrap text-sm">{row.jobPortal || "—"}</TableCell>
      <TableCell className="max-w-[200px] truncate text-xs" title={row.jobLink || undefined}>
        {row.jobLink ? (
          <a
            href={row.jobLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.jobLink.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs">
        {row.importable ? (
          <span className="font-medium text-emerald-600 dark:text-emerald-400">Ready</span>
        ) : row.valid ? (
          <span className="font-medium text-amber-700 dark:text-amber-300">Test cache only</span>
        ) : (
          <span className="text-destructive">{row.errors.join("; ")}</span>
        )}
      </TableCell>
    </TableRow>
  );
}
