import React from "react";
import { Printer, FileDown, X } from "lucide-react";
import { Button } from "./Button";
import { printElement, exportPDF } from "../../lib/print";
import { cn } from "../../lib/utils";

/**
 * A modal-style overlay that shows printable content with Print + PDF buttons.
 * The content inside should have id = printId and class "print-area".
 */
export default function PrintPreview({
  open,
  onClose,
  title,
  printId,
  pdfFilename = "document.pdf",
  pdfFormat = "a4",
  children,
}) {
  if (!open) return null;

  const onPrint = () => printElement(printId);
  const onPdf = () => exportPDF(printId, pdfFilename, { format: pdfFormat });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" data-testid="print-preview">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm no-print" onClick={onClose} />
      <div className="relative bg-cream/30 rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-border rounded-t-xl no-print">
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPdf} data-testid="print-preview-pdf">
              <FileDown size={14} /> Xuất PDF
            </Button>
            <Button size="sm" onClick={onPrint} data-testid="print-preview-print">
              <Printer size={14} /> In
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-cream text-ink-muted"
              data-testid="print-preview-close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className={cn("flex-1 overflow-y-auto p-6 flex justify-center")}>
          <div id={printId} className="print-area bg-white shadow-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
