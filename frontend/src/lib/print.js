// Print + PDF export utilities using browser print + html2pdf.js

import html2pdf from "html2pdf.js";

/**
 * Print an element by opening a print-friendly dialog.
 * Uses CSS @media print to hide the rest of the page.
 */
export function printElement(elementId) {
  document.body.classList.add("printing-mode");
  document.body.setAttribute("data-print-target", elementId);
  // Small delay so the body class applies before native print dialog
  setTimeout(() => {
    window.print();
    // Cleanup after print dialog closes
    setTimeout(() => {
      document.body.classList.remove("printing-mode");
      document.body.removeAttribute("data-print-target");
    }, 500);
  }, 100);
}

/**
 * Export an element to PDF using html2pdf.js
 * @param elementId - target div id
 * @param filename - name of pdf file
 * @param options.format - 'a4' (default) or [80, 297] for 80mm thermal
 */
export async function exportPDF(elementId, filename = "document.pdf", options = {}) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const isThermal = options.format === "80mm";

  const opt = {
    margin: isThermal ? [3, 2, 3, 2] : [10, 10, 10, 10],
    filename,
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
    jsPDF: isThermal
      ? { unit: "mm", format: [80, 297], orientation: "portrait" }
      : { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  await html2pdf().from(el).set(opt).save();
}
