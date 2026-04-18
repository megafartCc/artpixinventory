"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { parseCsv } from "@/lib/csv";
import { canImportCatalog } from "@/lib/permissions";

type MappingKey =
  | "compoundId"
  | "name"
  | "index"
  | "category"
  | "uom"
  | "barcode"
  | "minStock"
  | "quantity"
  | "location";

const mappingTargets: { key: MappingKey; label: string; required?: boolean }[] = [
  { key: "compoundId", label: "Compound ID", required: true },
  { key: "name", label: "Name", required: true },
  { key: "index", label: "Index", required: true },
  { key: "category", label: "Category" },
  { key: "uom", label: "UOM" },
  { key: "barcode", label: "Barcode" },
  { key: "minStock", label: "Min Stock" },
  { key: "quantity", label: "Quantity" },
  { key: "location", label: "Location" },
];

function autoMapHeaders(headers: string[]) {
  const mapping: Record<MappingKey, string> = {
    compoundId: "",
    name: "",
    index: "",
    category: "",
    uom: "",
    barcode: "",
    minStock: "",
    quantity: "",
    location: "",
  };

  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: header.trim().toLowerCase(),
  }));

  const aliases: Record<MappingKey, string[]> = {
    compoundId: ["compound id", "compoundid", "sku", "item code"],
    name: ["name", "product name", "description"],
    index: ["index", "flow", "type"],
    category: ["category", "categories", "group"],
    uom: ["uom", "unit", "unit of measure"],
    barcode: ["barcode", "upc"],
    minStock: ["min stock", "minimum stock", "reorder point"],
    quantity: ["quantity", "qty", "on hand"],
    location: ["location", "warehouse location", "bin"],
  };

  for (const [key, names] of Object.entries(aliases) as [MappingKey, string[]][]) {
    const match = normalizedHeaders.find((header) =>
      names.includes(header.normalized)
    );
    if (match) {
      mapping[key] = match.raw;
    }
  }

  return mapping;
}

export function CsvImportClient({ locale }: { locale: string }) {
  const { data: session } = useSession();
  const canImport = canImportCatalog(session?.user?.role);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<MappingKey, string>>({
    compoundId: "",
    name: "",
    index: "",
    category: "",
    uom: "",
    barcode: "",
    minStock: "",
    quantity: "",
    location: "",
  });
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useToastFeedback(error, result ? `Created ${result.created}, skipped ${result.skipped}.` : "");

  const requiredMapped = mappingTargets
    .filter((target) => target.required)
    .every((target) => mapping[target.key]);

  const previewRows = useMemo(() => {
    return rows.slice(0, 10).map((row) => {
      const mappedRow: Record<string, string> = {};
      for (const target of mappingTargets) {
        const columnName = mapping[target.key];
        const columnIndex = headers.indexOf(columnName);
        mappedRow[target.key] = columnIndex >= 0 ? row[columnIndex] ?? "" : "";
      }
      return mappedRow;
    });
  }, [headers, mapping, rows]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);

    if (parsed.length < 2) {
      setError("CSV must include a header row and at least one data row.");
      setHeaders([]);
      setRows([]);
      return;
    }

    const [headerRow, ...dataRows] = parsed;
    setFileName(file.name);
    setHeaders(headerRow.map((entry) => entry.trim()));
    setRows(dataRows);
    setMapping(autoMapHeaders(headerRow));
    setResult(null);
    setError("");
  };

  const importRows = async () => {
    setSubmitting(true);
    setError("");
    setResult(null);

    const mappedRows = rows
      .map((row) => {
        const mappedRow: Record<string, string> = {};
        for (const target of mappingTargets) {
          const columnName = mapping[target.key];
          const columnIndex = headers.indexOf(columnName);
          mappedRow[target.key] = columnIndex >= 0 ? row[columnIndex] ?? "" : "";
        }
        return mappedRow;
      })
      .filter(
        (row) =>
          row.compoundId.trim() || row.name.trim() || row.index.trim()
      );

    const response = await fetch("/api/products/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: mappedRows }),
    });

    const payload = (await response.json()) as {
      data?: { created: number; skipped: number; errors: string[] };
      error?: string;
    };

    setSubmitting(false);

    if (!response.ok || !payload.data) {
      setError(payload.error ?? "Import failed.");
      return;
    }

    setResult(payload.data);
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">CSV Import</h1>
            <p className="mt-1 text-slate-500">
              Map inFlow or vendor CSV columns into products and optional setup stock.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/${locale}/products`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Back to Products
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">1. Upload CSV</h2>
            <p className="mt-1 text-sm text-slate-500">
              The first row must be headers. Duplicate compound IDs are skipped.
            </p>

            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-slate-400 hover:bg-white">
              <FileSpreadsheet className="h-10 w-10 text-slate-400" />
              <span className="mt-3 text-sm font-medium text-slate-700">
                {fileName || "Choose a CSV file"}
              </span>
              <span className="mt-1 text-xs text-slate-400">
                Click to browse or replace the current import file
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                }}
              />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">2. Import Rules</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>`compoundId`, `name`, and `index` are required mappings.</p>
              <p>Missing indexes or locations are treated as row-level errors.</p>
              <p>
                If `quantity` and `location` are mapped, initial stock levels are
                created with `INITIAL_SETUP` adjustments.
              </p>
              {!canImport && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                  Your current role is read-only for CSV imports.
                </p>
              )}
            </div>
          </section>
        </div>

        {headers.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">3. Column Mapping</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {mappingTargets.map((target) => (
                <label
                  key={target.key}
                  className="flex flex-col gap-1.5 text-sm font-medium text-slate-700"
                >
                  <span>
                    {target.label}
                    {target.required ? " *" : ""}
                  </span>
                  <select
                    value={mapping[target.key]}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [target.key]: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">Not mapped</option>
                    {headers.map((header) => (
                      <option key={`${target.key}-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>
        )}

        {previewRows.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">4. Preview</h2>
                <p className="mt-1 text-sm text-slate-500">
                  First 10 mapped rows before import.
                </p>
              </div>
              <button
                onClick={() => void importRows()}
                disabled={!requiredMapped || !canImport || submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {submitting ? "Importing..." : "Import"}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    {mappingTargets.map((target) => (
                      <th key={target.key} className="px-4 py-3">
                        {target.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {previewRows.map((row, index) => (
                    <tr key={`preview-${index}`}>
                      {mappingTargets.map((target) => (
                        <td key={`${index}-${target.key}`} className="px-4 py-3">
                          {row[target.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(error || result) && (
          <section
            className={`rounded-2xl border p-5 shadow-sm ${
              error
                ? "border-rose-200 bg-rose-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            {error ? (
              <p className="text-sm text-rose-700">{error}</p>
            ) : result ? (
              <div className="space-y-2 text-sm text-emerald-800">
                <p>
                  Created: <strong>{result.created}</strong>
                </p>
                <p>
                  Skipped duplicates: <strong>{result.skipped}</strong>
                </p>
                <p>
                  Errors: <strong>{result.errors.length}</strong>
                </p>
                {result.errors.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5">
                    {result.errors.map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
