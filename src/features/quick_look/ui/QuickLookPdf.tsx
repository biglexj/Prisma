import { convertFileSrc } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookPdfProps {
  payload: QuickLookPayload;
}

export function QuickLookPdf({ payload }: QuickLookPdfProps) {
  const pdfSrc = `${convertFileSrc(payload.path)}#toolbar=0&navpanes=0`;

  return (
    <div className="quicklook-pdf-container">
      <iframe
        className="quicklook-pdf-iframe"
        src={pdfSrc}
        title={payload.fileName}
      />
    </div>
  );
}
