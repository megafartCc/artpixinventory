"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { generateTablePdf } from "@/lib/pdf-utils";

type PdfExportButtonProps = {
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
};

export function PdfExportButton({
  filename,
  title,
  headers,
  rows,
}: PdfExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await generateTablePdf({
        filename,
        title,
        headers,
        rows,
      });
    } catch (error) {
      console.error("PDF export failed", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={() => void handleExport()}
      disabled={exporting}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 active:scale-95"
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : (
        <FileText className="h-4 w-4 text-slate-400" />
      )}
      <span>Export PDF</span>
    </button>
  );
}
