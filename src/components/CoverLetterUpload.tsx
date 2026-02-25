import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadCoverLetter, deleteCandidateCoverLetters } from "../../dbscripts/functions/storage";
import { updateCandidateCoverLetterUrl } from "../../dbscripts/functions/candidates";

interface CoverLetterUploadProps {
  candidateId: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}

export default function CoverLetterUpload({ candidateId, currentUrl, onUploaded }: CoverLetterUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File must be under 10MB");
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await uploadCoverLetter(candidateId, file);
      await updateCandidateCoverLetterUrl(candidateId, publicUrl);
      onUploaded(publicUrl);
      toast.success("Cover letter uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleUpload}
        className="hidden"
      />
      {currentUrl ? (
        <div className="flex items-center gap-2">
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-info underline"
          >
            <FileText className="h-3 w-3" /> View Cover Letter
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={async () => {
              if (!confirm("Delete cover letter? This will remove the file from storage.")) return;
              setDeleting(true);
              try {
                await deleteCandidateCoverLetters(candidateId);
                await updateCandidateCoverLetterUrl(candidateId, null);
                onUploaded("");
                toast.success("Cover letter removed");
              } catch (err: any) {
                toast.error(err?.message || "Failed to remove cover letter");
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="mr-1 h-3 w-3" /> Upload Cover Letter</>
          )}
        </Button>
      )}
    </div>
  );
}

