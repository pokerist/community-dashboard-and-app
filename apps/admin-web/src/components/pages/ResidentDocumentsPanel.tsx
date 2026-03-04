import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage, formatDateTime } from "../../lib/live-data";
import type { ResidentOverview } from "./resident-360.types";

type ResidentDocumentsPanelProps = {
  documents: ResidentOverview["documents"]["documents"];
};

export function ResidentDocumentsPanel({ documents }: ResidentDocumentsPanelProps) {
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const previewFile = async (fileId: string, filename?: string | null) => {
    setDownloadingFileId(fileId);
    try {
      const response = await apiClient.get(`/files/${fileId}/stream`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream",
      });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      if (filename) {
        toast.success(`Opened ${filename}`);
      }
    } catch (error) {
      toast.error("Failed to preview file", { description: errorMessage(error) });
    } finally {
      setDownloadingFileId(null);
    }
  };

  if (!documents.length) {
    return (
      <Card className="p-4 rounded-xl">
        <p className="text-sm text-[#64748B]">No documents linked to this resident yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const file = doc.file;
        const unitLabel = doc.unit
          ? [doc.unit.projectName, doc.unit.block ? `Block ${doc.unit.block}` : null, doc.unit.unitNumber ? `Unit ${doc.unit.unitNumber}` : null]
              .filter(Boolean)
              .join(" - ")
          : null;
        return (
          <Card key={`${file.id}-${doc.source}`} className="p-4 rounded-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#475569]" />
                  <span className="text-sm font-medium text-[#0F172A]">{file.name || `File ${file.id.slice(0, 8)}`}</span>
                  <Badge variant="secondary" className="bg-[#F1F5F9] text-[#334155]">
                    {doc.category}
                  </Badge>
                </div>
                <div className="text-xs text-[#64748B]">
                  Source: {doc.source} • Uploaded: {formatDateTime(doc.uploadedAt)}
                </div>
                {unitLabel ? <div className="text-xs text-[#64748B]">Unit: {unitLabel}</div> : null}
                <div className="text-xs text-[#64748B]">File ID: {file.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingFileId === file.id}
                  onClick={() => void previewFile(file.id, file.name)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  {downloadingFileId === file.id ? "Opening..." : "Preview / Download"}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

