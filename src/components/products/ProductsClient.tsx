"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Download, Loader2, PackagePlus, Search, X } from "lucide-react";
import { PdfExportButton } from "@/components/PdfExportButton";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { productUnits } from "@/lib/product-schemas";
import { useSavedViews } from "@/hooks/useSavedViews";

type ProductRecord = {
  id: string;
  compoundId: string;
  name: string;
  indexId: string;
  indexName: string;
  categories: string[];
  uom: string;
  minStock: number;
  avgCost: string;
  active: boolean;
  barcode: string | null;
  length: string;
  width: string;
  height: string;
  notes: string;
  dimensionUnit: string;
  updatedAt: string;
};

type Option = {
  id: string;
  name: string;
};

type FormState = {
  compoundId: string;
  name: string;
  indexId: string;
  uom: (typeof productUnits)[number];
  barcode: string;
  minStock: string;
  length: string;
  width: string;
  height: string;
  dimensionUnit: string;
  categories: string[];
  categoryInput: string;
  notes: string;
  active: boolean;
};


const createEmptyForm = (indexes: Option[]): FormState => ({
  compoundId: "",
  name: "",
  indexId: indexes[0]?.id ?? "",
  uom: "pcs",
  barcode: "",
  minStock: "0",
  length: "",
  width: "",
  height: "",
  dimensionUnit: "in",
  categories: [],
  categoryInput: "",
  notes: "",
  active: true,
});

const formatDimensions = (product: ProductRecord) =>
  product.length && product.width && product.height
    ? `${product.length} x ${product.width} x ${product.height} ${product.dimensionUnit}`
    : "-";

function downloadCsv(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ProductsClient({
  locale,
  initialProducts,
  indexes,
}: {
  locale: string;
  initialProducts: ProductRecord[];
  indexes: Option[];
}) {
  const t = useTranslations("Products");
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "WAREHOUSE";
  const canManageProducts = userRole !== "WAREHOUSE";
  const {
    state: filters,
    setState: setFilters,
    views,
    saveView,
    deleteView,
    resetState,
  } = useSavedViews("artpix:products:list", {
    search: "",
    indexFilter: "all",
    statusFilter: "active",
  }, {
    defaultViewName: userRole === "WAREHOUSE" ? "Warehouse catalog" : "Catalog view",
    defaultViewState: {
      search: "",
      indexFilter: "all",
      statusFilter: "active",
    },
  });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyForm(indexes));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  useToastFeedback(errorMessage, statusMessage);
  const deferredSearch = useDeferredValue(filters.search);

  let filteredProducts = [...initialProducts];
  if (deferredSearch.trim()) {
    const query = deferredSearch.trim().toLowerCase();
    filteredProducts = filteredProducts.filter((product) =>
      [product.compoundId, product.name, ...product.categories]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }
  if (filters.indexFilter !== "all") {
    filteredProducts = filteredProducts.filter((product) => product.indexId === filters.indexFilter);
  }
  if (filters.statusFilter !== "all") {
    filteredProducts = filteredProducts.filter((product) =>
      filters.statusFilter === "active" ? product.active : !product.active
    );
  }
  filteredProducts.sort((left, right) => left.compoundId.localeCompare(right.compoundId));

  const selectedProducts = useMemo(
    () => initialProducts.filter((product) => selectedProductIds.includes(product.id)),
    [initialProducts, selectedProductIds]
  );

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedProductIds.includes(product.id));

  const toggleVisibleSelection = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds((current) =>
        Array.from(new Set([...current, ...filteredProducts.map((product) => product.id)]))
      );
      return;
    }

    setSelectedProductIds((current) =>
      current.filter((id) => !filteredProducts.some((product) => product.id === id))
    );
  };

  const exportSelected = () => {
    if (selectedProducts.length === 0) {
      return;
    }

    const headers = ["ID", "Name", "Index", "Unit", "Min Stock", "Status"];
    const rows = selectedProducts.map((product) =>
      [
        product.compoundId,
        product.name,
        product.indexName,
        product.uom.toUpperCase(),
        product.minStock,
        product.active ? "Active" : "Inactive",
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    );

    downloadCsv(
      `products-selected-${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(","), ...rows].join("\n")
    );
  };

  const bulkDeactivate = async () => {
    if (selectedProducts.length === 0) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    const response = await fetch("/api/products/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedProducts.map((product) => product.id), active: false }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.error ?? t("feedback.saveFailed"));
      return;
    }

    setStatusMessage(payload.message ?? "Products updated.");
    setSelectedProductIds([]);
    startTransition(() => router.refresh());
  };

  const saveCurrentView = () => {
    const name = window.prompt("Save this product filter view as:");
    if (!name) {
      return;
    }

    saveView(name);
  };

  const addCategory = (value: string) => {
    const nextValue = value.trim();
    if (!nextValue || form.categories.includes(nextValue)) {
      setForm((current) => ({ ...current, categoryInput: "" }));
      return;
    }
    setForm((current) => ({
      ...current,
      categories: [...current.categories, nextValue],
      categoryInput: "",
    }));
  };

  const submitProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    const response = await fetch(
      editingProductId ? `/api/products/${editingProductId}` : "/api/products",
      {
        method: editingProductId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compoundId: form.compoundId,
          name: form.name,
          indexId: form.indexId,
          uom: form.uom,
          barcode: form.barcode,
          minStock: form.minStock,
          categories: form.categories,
          length: form.length,
          width: form.width,
          height: form.height,
          dimensionUnit: form.dimensionUnit,
          notes: form.notes,
          active: form.active,
        }),
      }
    );

    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setSubmitting(false);
      setErrorMessage(result.error ?? t("feedback.saveFailed"));
      return;
    }

    setSubmitting(false);
    setStatusMessage(editingProductId ? t("feedback.updated") : t("feedback.created"));
    startTransition(() => router.refresh());
    if (editingProductId) {
      setDrawerOpen(false);
      return;
    }
    setForm(createEmptyForm(indexes));
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-6 lg:p-8">
      <div className="flex min-h-0 flex-1 flex-col gap-10">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">{t("title")}</h1>
              <p className="mt-2 text-lg text-slate-500">{t("subtitle")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PdfExportButton
                filename={`products_${new Date().toISOString().slice(0, 10)}.pdf`}
                title="Product Catalog"
                headers={["ID", "Name", "Index", "Unit", "Min Stock", "Status"]}
                rows={filteredProducts.map((p) => [
                  p.compoundId,
                  p.name,
                  p.indexName,
                  p.uom.toUpperCase(),
                  p.minStock,
                  p.active ? "Active" : "Inactive",
                ])}
              />
              <button
                type="button"
                onClick={saveCurrentView}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Save view
              </button>
              <Link href="../indexes" className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                {t("indexes")}
              </Link>
              <Link href="../categories" className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                {t("categories")}
              </Link>
              <Link href="./import" className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                {t("csvImport")}
              </Link>
              {canManageProducts && (
                <Link href={`/${locale}/products/new`} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800">
                  <PackagePlus className="h-4 w-4" />
                  {t("addProduct")}
                </Link>
              )}
            </div>
          </div>
        </div>

        {views.length > 0 && (
          <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Saved views
              </span>
              {views.map((view) => (
                <div
                  key={view.id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => setFilters(view.state)}
                    className="text-xs font-semibold text-slate-700"
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteView(view.id)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={resetState}
                className="rounded-full border border-dashed border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <input 
              value={filters.search} 
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} 
              placeholder={t("searchPlaceholder")} 
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-200 focus:bg-white focus:ring-4 focus:ring-slate-50" 
            />
          </div>
          <select value={filters.indexFilter} onChange={(event) => setFilters((current) => ({ ...current, indexFilter: event.target.value }))} className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-200 focus:bg-white">
            <option value="all">{t("allIndexes")}</option>
            {indexes.map((index) => <option key={index.id} value={index.id}>{index.name}</option>)}
          </select>
          <select value={filters.statusFilter} onChange={(event) => setFilters((current) => ({ ...current, statusFilter: event.target.value }))} className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-200 focus:bg-white">
            <option value="active">{t("activeOnly")}</option>
            <option value="inactive">{t("inactiveOnly")}</option>
            <option value="all">{t("allStatuses")}</option>
          </select>
        </div>

        {selectedProductIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-medium text-slate-600">
              {selectedProductIds.length} selected
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportSelected}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export selected
              </button>
              <Link
                href={`/${locale}/labels?tab=products&products=${selectedProductIds.join(",")}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Print labels
              </Link>
              <button
                type="button"
                onClick={() => void bulkDeactivate()}
                disabled={!canManageProducts || submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                Deactivate
              </button>
              <button
                type="button"
                onClick={() => setSelectedProductIds([])}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleVisibleSelection(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                    />
                  </th>
                  <th className="px-8 py-4">{t("columns.compoundId")}</th>
                  <th className="px-8 py-4">{t("columns.name")}</th>
                  <th className="px-8 py-4">{t("columns.index")}</th>
                  <th className="px-8 py-4">{t("columns.categories")}</th>
                  <th className="px-8 py-4">{t("columns.dimensions")}</th>
                  <th className="px-8 py-4 text-center">{t("columns.minStock")}</th>
                  <th className="px-8 py-4 text-right">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={8} className="px-8 py-24 text-center font-medium text-slate-400">{t("noMatch")}</td></tr>
                ) : filteredProducts.map((product) => (
                  <tr key={product.id} className={`transition hover:bg-slate-50/50 ${selectedProductIds.includes(product.id) ? "bg-indigo-50/60" : ""}`}>
                    <td className="px-4 py-5">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.id)}
                        onChange={(event) => {
                          setSelectedProductIds((current) =>
                            event.target.checked
                              ? Array.from(new Set([...current, product.id]))
                              : current.filter((id) => id !== product.id)
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                      />
                    </td>
                    <td className="px-8 py-5">
                      <Link href={`/${locale}/products/${product.id}`} className="font-semibold text-slate-900 hover:underline decoration-slate-300 underline-offset-4">
                        {product.compoundId}
                      </Link>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{product.name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{product.uom}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 font-medium text-slate-500">{product.indexName}</td>
                    <td className="px-8 py-5">
                      <div className="flex flex-wrap gap-1.5">
                        {product.categories.length ? product.categories.map((category) => (
                          <span key={`${product.id}-${category}`} className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 tracking-tighter">{category}</span>
                        )) : <span className="text-slate-300 text-[10px] font-bold uppercase">None</span>}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-slate-500 font-medium">{formatDimensions(product)}</td>
                    <td className="px-8 py-5 text-center font-semibold text-slate-900">{product.minStock}</td>
                      <td className="px-8 py-5">
                        <div className="flex justify-end gap-3">
                          {canManageProducts && (
                            <Link
                              href={`/${locale}/products/${product.id}/edit`}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 transition shadow-sm hover:bg-slate-50"
                            >
                              {t("edit")}
                            </Link>
                          )}
                          <Link
                            href={`/${locale}/products/${product.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-900 hover:bg-slate-200 transition"
                          >
                            {t("view")}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/40 backdrop-blur-sm transition-all">
          <button type="button" onClick={() => setDrawerOpen(false)} className="h-full flex-1 cursor-default" />
          <div className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-start justify-between border-b border-slate-100 px-8 py-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">{editingProductId ? t("editProduct") : t("addProductTitle")}</h2>
                <p className="mt-2 text-sm font-medium text-slate-400 uppercase tracking-widest">{t("drawerSubtitle")}</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-2xl p-3 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={submitProduct} className="flex min-h-0 flex-1 flex-col">
              <div className="grid flex-1 gap-6 overflow-y-auto px-8 py-8 md:grid-cols-2">
                <Field label={t("compoundId")}><input value={form.compoundId} onChange={(event) => setForm((current) => ({ ...current, compoundId: event.target.value }))} className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-slate-50 transition" required /></Field>
                <Field label={t("name")}><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-slate-50 transition" required /></Field>
                <Field label={t("index")}><select value={form.indexId} onChange={(event) => setForm((current) => ({ ...current, indexId: event.target.value }))} className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-slate-50 transition" required>{indexes.map((index) => <option key={index.id} value={index.id}>{index.name}</option>)}</select></Field>
                <Field label={t("unit")}><select value={form.uom} onChange={(event) => setForm((current) => ({ ...current, uom: event.target.value as (typeof productUnits)[number] }))} className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-slate-50 transition">{productUnits.map((unit) => <option key={unit} value={unit}>{unit.toUpperCase()}</option>)}</select></Field>
                <Field label={t("barcode")}><input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-slate-50 transition" /></Field>
                <Field label={t("minStock")}><input value={form.minStock} onChange={(event) => setForm((current) => ({ ...current, minStock: event.target.value }))} className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-slate-50 transition" inputMode="numeric" /></Field>
                <div className="md:col-span-2 grid grid-cols-4 gap-3">
                   <div className="col-span-1"><Field label="L"><input value={form.length} onChange={(event) => setForm((current) => ({ ...current, length: event.target.value }))} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:bg-white transition" inputMode="decimal" /></Field></div>
                   <div className="col-span-1"><Field label="W"><input value={form.width} onChange={(event) => setForm((current) => ({ ...current, width: event.target.value }))} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:bg-white transition" inputMode="decimal" /></Field></div>
                   <div className="col-span-1"><Field label="H"><input value={form.height} onChange={(event) => setForm((current) => ({ ...current, height: event.target.value }))} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:bg-white transition" inputMode="decimal" /></Field></div>
                   <div className="col-span-1"><Field label="Unit"><input value={form.dimensionUnit} onChange={(event) => setForm((current) => ({ ...current, dimensionUnit: event.target.value }))} className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 focus:bg-white transition" /></Field></div>
                </div>
                <div className="md:col-span-2">
                  <Field label={t("categoriesLabel")}>
                    <div className="rounded-[24px] border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex flex-wrap gap-2">
                        {form.categories.length ? form.categories.map((category) => (
                          <button key={category} type="button" onClick={() => setForm((current) => ({ ...current, categories: current.categories.filter((entry) => entry !== category) }))} className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase text-white tracking-wider">
                            {category}
                            <X className="h-3 w-3" />
                          </button>
                        )) : <span className="text-xs font-bold uppercase tracking-widest text-slate-300">None selected</span>}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <input value={form.categoryInput} onChange={(event) => setForm((current) => ({ ...current, categoryInput: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addCategory(form.categoryInput); } }} className="flex-1 rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-slate-50 outline-none transition" placeholder={t("categoryPlaceholder")} />
                        <button type="button" onClick={() => addCategory(form.categoryInput)} className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:bg-slate-300 transition">{t("add")}</button>
                      </div>
                    </div>
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label={t("notesLabel")}><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600 focus:bg-white transition min-h-32 resize-none" /></Field>
                </div>
              </div>

              <div className="border-t border-slate-100 px-8 py-6 bg-slate-50/30">
                <div className="flex items-center justify-end gap-4">
                  <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-2xl px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition">{t("cancel")}</button>
                  <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-10 py-3 text-sm font-bold text-white shadow-xl hover:bg-slate-800 transition disabled:opacity-60">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingProductId ? t("saveChanges") : t("createProduct")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</span>
      {children}
    </div>
  );
}


