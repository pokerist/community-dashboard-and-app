import { useState } from "react";
import { toast } from "sonner";
import { FileText, Download, ExternalLink, Image, File } from "lucide-react";
import apiClient from "../../lib/api-client";
import { errorMessage, formatDateTime } from "../../lib/live-data";
import type { ResidentOverview } from "./resident-360.types";

type ResidentDocumentsPanelProps = {
  documents: ResidentOverview["documents"]["documents"];
};

const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];

// ─── File type icon ───────────────────────────────────────────
function FileIcon({ name }: { name?: string | null }) {
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (["jpg","jpeg","png","gif","webp"].includes(ext)) return <Image style={{ width: "14px", height: "14px" }} />;
  if (ext === "pdf") return <FileText style={{ width: "14px", height: "14px" }} />;
  return <File style={{ width: "14px", height: "14px" }} />;
}

// ─── Source badge ─────────────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "#F3F4F6", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{source}</span>
  );
}

export function ResidentDocumentsPanel({ documents }: ResidentDocumentsPanelProps) {
  const [openingId, setOpeningId] = useState<string | null>(null);

  const previewFile = async (fileId: string, filename?: string | null) => {
    setOpeningId(fileId);
    try {
      const res = await apiClient.get(`/files/${fileId}/stream`, { responseType: "blob" });
      const blob    = new Blob([res.data], { type: res.headers["content-type"] || "application/octet-stream" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      if (filename) toast.success(`Opened ${filename}`);
    } catch (e) { toast.error("Failed to preview file", { description: errorMessage(e) }); }
    finally { setOpeningId(null); }
  };

  if (!documents.length) {
    return (
      <div style={{ padding: "32px", borderRadius: "9px", border: "1px dashed #E5E7EB", textAlign: "center", fontFamily: "'Work Sans', sans-serif" }}>
        <FileText style={{ width: "22px", height: "22px", color: "#D1D5DB", margin: "0 auto 8px" }} />
        <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No documents linked to this resident yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontFamily: "'Work Sans', sans-serif" }}>
      {documents.map((doc, idx) => {
        const file      = doc.file;
        const accent    = ACCENTS[idx % ACCENTS.length];
        const unitLabel = doc.unit
          ? [doc.unit.projectName, doc.unit.block ? `Block ${doc.unit.block}` : null, doc.unit.unitNumber ? `Unit ${doc.unit.unitNumber}` : null].filter(Boolean).join(" – ")
          : null;
        const isOpening = openingId === file.id;

        return (
          <div key={`${file.id}-${doc.source}`} style={{ borderRadius: "9px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "stretch" }}>
              {/* Accent left bar */}
              <div style={{ width: "3px", background: accent, flexShrink: 0 }} />

              <div style={{ flex: 1, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                {/* Left: metadata */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  {/* File type icon chip */}
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${accent}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: accent }}>
                    <FileIcon name={file.name} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "240px" }}>
                        {file.name || `File ${file.id.slice(0, 8)}`}
                      </p>
                      <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 7px", borderRadius: "4px", background: `${accent}12`, color: accent }}>{doc.category}</span>
                      <SourceBadge source={doc.source} />
                    </div>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Uploaded {formatDateTime(doc.uploadedAt)}</span>
                      {unitLabel && <span style={{ fontSize: "11px", color: "#9CA3AF" }}>· {unitLabel}</span>}
                      <span style={{ fontSize: "10.5px", color: "#D1D5DB", fontFamily: "'DM Mono', monospace" }}>{file.id.slice(0, 12)}…</span>
                    </div>
                  </div>
                </div>

                {/* Right: action */}
                <button type="button" disabled={isOpening} onClick={() => void previewFile(file.id, file.name)}
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: `1px solid ${isOpening ? "#E5E7EB" : accent + "40"}`, background: isOpening ? "#F9FAFB" : `${accent}08`, color: isOpening ? "#9CA3AF" : accent, cursor: isOpening ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, transition: "all 120ms ease", flexShrink: 0, fontFamily: "'Work Sans', sans-serif" }}>
                  {isOpening ? <Download style={{ width: "12px", height: "12px" }} /> : <ExternalLink style={{ width: "12px", height: "12px" }} />}
                  {isOpening ? "Opening…" : "Preview"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}