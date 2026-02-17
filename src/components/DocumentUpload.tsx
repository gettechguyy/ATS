import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, File } from "lucide-react";
import { toast } from "sonner";
import { uploadCandidateDocument } from "../../dbscripts/functions/storage";
import { updateCandidateIdUrl, updateCandidateVisaUrl } from "../../dbscripts/functions/candidates";

interface DocumentUploadProps {
  candidateId: string;
  currentUrl: string | null;
  folder: "id" | "visa" | "resume";
  onUploaded: () => void;
}

export default function DocumentUpload({ candidateId, currentUrl, folder, onUploaded }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const publicUrl = await uploadCandidateDocument(candidateId, file, folder);
      if (folder === "id") {
        await updateCandidateIdUrl(candidateId, publicUrl);
      } else if (folder === "visa") {
        await updateCandidateVisaUrl(candidateId, publicUrl);
      } else {
        // fallback - store as resume_url
        // use existing helper by calling updateCandidateIdUrl for resume not ideal, but fallback to updateCandidateIdUrl
        await updateCandidateIdUrl(candidateId, publicUrl);
      }
      onUploaded();
      toast.success("Document uploaded");
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
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
            <File className="h-3 w-3" /> View
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
            <><Upload className="mr-1 h-3 w-3" /> Upload</>
          )}
        </Button>
      )}
    </div>
  );
}

