"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Download, Search, X } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { canAdjustStock } from "@/lib/permissions";
import { stockAdjustmentReasonOptions } from "@/lib/stock-schemas";

type ProductRow = {
  id: string;
  compoundId: string;
  name: string;
  indexId: string;
  indexName: string;
  categories: string[];
  minStock: number;
  reservedQty: number;
  stockByLocation: Record<string, number>;
};

type IndexOption = {
  id: string;
  name: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type LocationColumn = {
  id: string;
  name: string;
  label: string;
  type: string;
  depth: number;
};

type AdjustmentTarget = {
  productId: string;
  productName: string;
  compoundId: string;
  locationId: string;
  locationName: string;
  currentQty: number;
};

type AdjustmentForm = {
  newQty: string;
  reason: (typeof stockAdjustmentReasonOptions)[number];
  notes: string;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

function getCellTone(quantity: number, minStock: number) {
  if (quantity <= 0 || quantity < minStock) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (minStock > 0) {
    const threshold = Math.max(minStock, Math.ceil(minStock * 1.25));
    if (quantity <= threshold) {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function downloadCsv(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function StockLevelsClient({
  initialProducts,
  indexes,
  categories,
  locationColumns,
}: {
  initialProducts: ProductRow[];
  indexes: IndexOption[];
  categories: CategoryOption[];
  locationColumns: LocationColumn[];
}) {
  const t = useTranslations("Stock");
  const router = useRouter();
  const { data: session } = useSession();
  const canAdjust = canAdjustStock(session?.user?.role);
  const [search, setSearch] = useState("");
  const [indexFilter, setIndexFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  useToastFeedback(error, feedback);
  const [adjustmentTarget, setAdjustmentTarget] = useState<AdjustmentTarget | null>(
    null
  );
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>({
    newQty: "0",
    reason: "COUNT_VARIANCE",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const visibleLocations = useMemo(() => {
    return locationFilter === "all"
      ? locationColumns
      : locationColumns.filter((location) => location.id === locationFilter);
  }, [locationColumns, locationFilter]);

  const filteredProducts = useMemo(() => {
    let products = [...initialProducts];
    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch) {
      products = products.filter((product) =>
        [product.compoundId, product.name]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      );
    }

    if (indexFilter !== "all") {
      products = products.filter((product) => product.indexId === indexFilter);
    }

    if (categoryFilter !== "all") {
      products = products.filter((product) =>
        product.categories.includes(categoryFilter)
      );
    }

    return products;
  }, [categoryFilter, indexFilter, initialProducts, search]);

  const exportCurrentView = () => {
    const headers = [
      t("columns.compoundId"),
      t("columns.product"),
      t("columns.index"),
      t("columns.categories"),
      t("columns.minStock"),
      t("columns.reserved"),
      t("columns.available"),
      t("columns.total"),
      ...visibleLocations.map((location) => location.name),
    ];

    const lines = filteredProducts.map((product) => {
      const total = visibleLocations.reduce(
        (sum, location) => sum + (product.stockByLocation[location.id] ?? 0),
        0
      );
      const available = total - product.reservedQty;

      return [
        product.compoundId,
        product.name,
        product.indexName,
        product.categories.join("|"),
        String(product.minStock),
        String(product.reservedQty),
        String(available),
        String(total),
        ...visibleLocations.map((location) =>
          String(product.stockByLocation[location.id] ?? 0)
        ),
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",");
    });

    downloadCsv(
      `stock-levels-${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(","), ...lines].join("\n")
    );
  };

  const openAdjustment = (
    product: ProductRow,
    location: LocationColumn,
    currentQty: number
  ) => {
    if (!canAdjust) {
      return;
    }

    setAdjustmentTarget({
      productId: product.id,
      productName: product.name,
      compoundId: product.compoundId,
      locationId: location.id,
      locationName: location.name,
      currentQty,
    });
    setAdjustmentForm({
      newQty: String(currentQty),
      reason: "COUNT_VARIANCE",
      notes: "",
    });
    setError("");
    setFeedback("");
  };

  const submitAdjustment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adjustmentTarget) {
      return;
    }

    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch("/api/stock/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: adjustmentTarget.productId,
        locationId: adjustmentTarget.locationId,
        newQty: adjustmentForm.newQty,
        reason: adjustmentForm.reason,
        notes: adjustmentForm.notes,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? t("feedback.adjustFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.adjusted"));
    setAdjustmentTarget(null);
    startTransition(() => router.refresh());
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-6 lg:p-8">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">
              {t("subtitle")}
            </p>
          </div>
          <button
            onClick={exportCurrentView}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            {t("exportCsv")}
          </button>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <select
            value={indexFilter}
            onChange={(event) => setIndexFilter(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{t("allIndexes")}</option>
            {indexes.map((index) => (
              <option key={index.id} value={index.id}>
                {index.name}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{t("allCategories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{t("allLocations")}</option>
            {locationColumns.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 z-20 min-w-[260px] bg-slate-50 px-4 py-3">
                    {t("columns.product")}
                  </th>
                  <th className="min-w-[120px] px-4 py-3">{t("columns.index")}</th>
                  <th className="min-w-[90px] px-4 py-3">{t("columns.min")}</th>
                  <th className="min-w-[120px] px-4 py-3">{t("columns.total")}</th>
                  {visibleLocations.map((location) => (
                    <th key={location.id} className="min-w-[120px] px-4 py-3">
                      <div className="flex flex-col">
                        <span>{location.name}</span>
                        <span className="text-[10px] normal-case text-slate-400">
                          {location.type}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + visibleLocations.length}
                      className="px-4 py-16 text-center text-slate-400"
                    >
                      {t("noMatch")}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const totalQty = locationColumns.reduce(
                      (sum, location) =>
                        sum + (product.stockByLocation[location.id] ?? 0),
                      0
                    );
                    const availableQty = totalQty - product.reservedQty;

                    return (
                      <tr key={product.id}>
                        <td className="sticky left-0 z-10 bg-white px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-slate-900">
                              {product.compoundId}
                            </span>
                            <span>{product.name}</span>
                            {product.categories.length > 0 && (
                              <span className="text-xs text-slate-400">
                                {product.categories.join(", ")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">{product.indexName}</td>
                        <td className="px-4 py-4">{product.minStock}</td>
                        <td className="px-4 py-4">
                          <div
                            className={`rounded-xl border px-3 py-2 ${getCellTone(
                              totalQty,
                              product.minStock
                            )}`}
                          >
                            <div className="font-semibold">{totalQty}</div>
                            {product.reservedQty > 0 && (
                              <div className="mt-1 text-[11px] font-medium">
                                {t("available")}: {availableQty}
                              </div>
                            )}
                          </div>
                        </td>
                        {visibleLocations.map((location) => {
                          const quantity = product.stockByLocation[location.id] ?? 0;

                          return (
                            <td key={`${product.id}-${location.id}`} className="px-4 py-4">
                              <button
                                type="button"
                                disabled={!canAdjust}
                                onClick={() =>
                                  openAdjustment(product, location, quantity)
                                }
                                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                                  canAdjust ? "hover:shadow-sm" : "cursor-default"
                                } ${getCellTone(quantity, product.minStock)}`}
                              >
                                <div className="font-semibold">{quantity}</div>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {adjustmentTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t("adjustStock")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {adjustmentTarget.compoundId} • {adjustmentTarget.productName}
                </p>
              </div>
              <button
                onClick={() => setAdjustmentTarget(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitAdjustment} className="space-y-5 px-6 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p>
                  <strong>{t("location")}:</strong> {adjustmentTarget.locationName}
                </p>
                <p className="mt-1">
                  <strong>{t("currentQty")}:</strong> {adjustmentTarget.currentQty}
                </p>
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>{t("newQuantity")}</span>
                <input
                  value={adjustmentForm.newQty}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      newQty: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  inputMode="numeric"
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>{t("reason")}</span>
                <select
                  value={adjustmentForm.reason}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      reason: event.target.value as AdjustmentForm["reason"],
                    }))
                  }
                  className={inputClassName}
                >
                  {stockAdjustmentReasonOptions.map((reason) => (
                    <option key={reason} value={reason}>
                      {t(`reasons.${reason}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                <span>{t("notes")}</span>
                <textarea
                  value={adjustmentForm.notes}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className={`${inputClassName} min-h-28 resize-y`}
                />
              </label>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setAdjustmentTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submitting ? t("saving") : t("saveAdjustment")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
