"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, PackageSearch, SendHorizonal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { CameraScanner } from "@/components/scanner/CameraScanner";
import { ActivityTimeline } from "@/components/ActivityTimeline";

type ProductOption = {
  id: string;
  compoundId: string;
  name: string;
  barcode: string | null;
};

type EntryRow = {
  id: string;
  productId: string;
  compoundId: string;
  productName: string;
  countedQty: number;
  variance: number;
  scannedAt: string;
  notes: string | null;
  countedByName: string;
};

type SessionRecord = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  type: string;
  status: string;
  notes: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
};

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function CountSessionClient({
  locale,
  session,
  products,
  entries,
  canCount,
  canReview,
  currentUserId,
}: {
  locale: string;
  session: SessionRecord;
  products: ProductOption[];
  entries: EntryRow[];
  canCount: boolean;
  canReview: boolean;
  currentUserId: string;
}) {
  const t = useTranslations("Counts");
  const router = useRouter();
  const [scanValue, setScanValue] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [countedQty, setCountedQty] = useState("0");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useToastFeedback(error, feedback);

  const refresh = () => startTransition(() => router.refresh());

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return products.slice(0, 16);
    }

    return products
      .filter((product) =>
        `${product.compoundId} ${product.name} ${product.barcode ?? ""}`
          .toLowerCase()
          .includes(normalized)
      )
      .slice(0, 16);
  }, [products, search]);

  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ??
    products.find(
      (product) =>
        product.compoundId.toLowerCase() === scanValue.trim().toLowerCase() ||
        (product.barcode ?? "").toLowerCase() === scanValue.trim().toLowerCase()
    ) ??
    null;

  const assignedUserCanCount =
    !session.assignedToId || session.assignedToId === currentUserId || canReview;
  const allowEntry = canCount && assignedUserCanCount && session.status === "IN_PROGRESS";

  const submitEntry = async () => {
    const targetProduct = selectedProduct ?? products.find((product) => product.id === selectedProductId) ?? null;
    if (!targetProduct) {
      setError(t("errors.noProduct"));
      return;
    }

    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch(`/api/counts/${session.id}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scanValue: scanValue || targetProduct.compoundId,
        countedQty,
        notes,
      }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? t("errors.entryFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.entrySaved"));
    setScanValue("");
    setSelectedProductId("");
    setCountedQty("0");
    setNotes("");
    refresh();
  };

  const submitCount = async () => {
    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch(`/api/counts/${session.id}/submit`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? t("errors.submitFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.submitted"));
    refresh();
  };

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link
              href={`/${locale}/counts`}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              {t("back")}
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {session.name}
              </h1>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {session.type}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {session.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-base text-slate-600">
              {session.locationName}
              {session.assignedToName ? ` • ${t("assignedTo")} ${session.assignedToName}` : ""}
            </p>
            <p className="mt-3 max-w-3xl text-sm text-slate-500">
              {session.notes?.trim() ? session.notes : t("blindCountHint")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
            <MetricCard title={t("metrics.entries")} value={String(entries.length)} />
            <MetricCard
              title={t("metrics.variances")}
              value={canReview || session.status !== "IN_PROGRESS" 
                ? String(entries.filter((entry) => entry.variance !== 0).length)
                : "?"}
            />
            <MetricCard
              title={t("metrics.status")}
              value={session.status.replaceAll("_", " ")}
            />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-5">
            <CameraScanner
              title={t("scannerTitle")}
              subtitle={t("scannerSubtitle")}
              placeholder={t("scannerPlaceholder")}
              onDetected={(value) => {
                setScanValue(value);
                const detected =
                  products.find(
                    (product) =>
                      product.compoundId.toLowerCase() === value.trim().toLowerCase() ||
                      (product.barcode ?? "").toLowerCase() === value.trim().toLowerCase()
                  ) ?? null;
                if (detected) {
                  setSelectedProductId(detected.id);
                  setSearch(detected.compoundId);
                }
              }}
            />

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <PackageSearch className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-900">{t("entryTitle")}</h2>
              </div>

              {!allowEntry ? (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  {session.status === "IN_PROGRESS"
                    ? t("notAssigned")
                    : t("entryLocked")}
                </div>
              ) : (
                <>
                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px]">
                    <Field label={t("fields.searchProduct")}>
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className={inputClassName}
                        placeholder={t("searchPlaceholder")}
                      />
                    </Field>
                    <Field label={t("fields.countedQty")}>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={countedQty}
                        onChange={(event) => setCountedQty(event.target.value)}
                        className={inputClassName}
                      />
                    </Field>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {filteredProducts.map((product) => {
                      const active = selectedProductId === product.id;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setScanValue(product.compoundId);
                          }}
                          className={`rounded-3xl border px-4 py-4 text-left transition ${
                            active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          <p className="text-sm font-semibold">{product.compoundId}</p>
                          <p className={`mt-1 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>
                            {product.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t("blindCountLabel")}
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {selectedProduct ? `${selectedProduct.compoundId} • ${selectedProduct.name}` : t("awaitingScan")}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {t("expectedHidden")}
                    </p>
                  </div>

                  <div className="mt-4">
                    <Field label={t("fields.notes")}>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        className={`${inputClassName} min-h-28`}
                        placeholder={t("notesPlaceholder")}
                      />
                    </Field>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => void submitEntry()}
                      disabled={submitting || !selectedProduct}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 lg:min-h-0 lg:text-sm"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      <span>{submitting ? t("savingEntry") : t("saveEntry")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitCount()}
                      disabled={submitting || entries.length === 0}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 lg:min-h-0 lg:text-sm"
                    >
                      <SendHorizonal className="h-4 w-4" />
                      <span>{t("submitCount")}</span>
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{t("entriesTitle")}</h2>
              {canReview && session.status === "SUBMITTED" && (
                <Link
                  href={`/${locale}/counts/${session.id}/review`}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t("review")}
                </Link>
              )}
            </div>

            {entries.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                {t("emptyEntries")}
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {entries.map((entry) => (
                  <div key={entry.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{entry.compoundId}</p>
                        <p className="mt-1 text-sm text-slate-500">{entry.productName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-slate-900">{entry.countedQty}</p>
                        {(canReview || session.status !== "IN_PROGRESS") && (
                          <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${entry.variance === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                            {entry.variance === 0 ? t("varianceMatched") : `${entry.variance > 0 ? "+" : ""}${entry.variance}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{entry.countedByName}</span>
                      <span>{formatTimestamp(entry.scannedAt)}</span>
                      {entry.notes ? <span>{entry.notes}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">{t("activity")}</h2>
          <div className="mt-5">
            <ActivityTimeline entityType="CountSession" entityId={session.id} />
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
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
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
