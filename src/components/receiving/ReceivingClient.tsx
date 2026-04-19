"use client";

import React, { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { sendZplToBrowserPrint } from "@/lib/browser-print";
import { PdfExportButton } from "@/components/PdfExportButton";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

type VendorOption = {
  id: string;
  name: string;
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    status: string;
    orderDate: string;
    items: Array<{
      poItemId: string;
      productId: string;
      compoundId: string;
      productName: string;
      orderedQty: number;
      receivedQty: number;
      remainingQty: number;
    }>;
  }>;
};

type RecentSession = {
  id: string;
  poNumber: string;
  startedAt: string;
  status: string;
  items: Array<{
    productId: string;
    compoundId: string;
    productName: string;
    receivedQty: number;
    damagedQty: number;
  }>;
  pallets: Array<{
    id: string;
    palletNumber: string;
    status: string;
    items: Array<{
      productId: string;
      compoundId: string;
      quantity: number;
    }>;
  }>;
};

export function ReceivingClient({
  locale,
  vendors,
  recentSessions,
}: {
  locale: string;
  vendors: VendorOption[];
  recentSessions: RecentSession[];
}) {
  const t = useTranslations("Receiving");
  const router = useRouter();
  const [vendorId, setVendorId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [receivingRows, setReceivingRows] = useState<
    Array<{ poItemId: string; receiveQty: string; damagedQty: string; notes: string }>
  >([]);
  const [receivingNotes, setReceivingNotes] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(recentSessions[0]?.id ?? "");
  const [palletQuantities, setPalletQuantities] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [zplBundle, setZplBundle] = useState<{ palletNumber: string; zpl: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useToastFeedback(error, feedback);

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === vendorId) ?? null,
    [vendorId, vendors]
  );
  const purchaseOrders = useMemo(
    () => selectedVendor?.purchaseOrders ?? [],
    [selectedVendor]
  );
  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((po) => po.id === purchaseOrderId) ?? null,
    [purchaseOrderId, purchaseOrders]
  );
  const selectedSession = useMemo(
    () => recentSessions.find((session) => session.id === selectedSessionId) ?? null,
    [recentSessions, selectedSessionId]
  );

  const palletAvailability = useMemo(() => {
    if (!selectedSession) {
      return [];
    }

    const receivedByProduct = new Map<string, { compoundId: string; productName: string; quantity: number }>();
    for (const item of selectedSession.items) {
      receivedByProduct.set(item.productId, {
        compoundId: item.compoundId,
        productName: item.productName,
        quantity: (receivedByProduct.get(item.productId)?.quantity ?? 0) + item.receivedQty,
      });
    }

    for (const pallet of selectedSession.pallets) {
      for (const item of pallet.items) {
        const current = receivedByProduct.get(item.productId);
        if (!current) {
          continue;
        }
        current.quantity -= item.quantity;
      }
    }

    return Array.from(receivedByProduct.entries())
      .map(([productId, value]) => ({
        productId,
        compoundId: value.compoundId,
        productName: value.productName,
        remainingQty: value.quantity,
      }))
      .filter((item) => item.remainingQty > 0);
  }, [selectedSession]);

  const refresh = () => startTransition(() => router.refresh());

  const submitReceiving = async () => {
    if (!selectedPurchaseOrder) {
      return;
    }

    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch("/api/receiving/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: selectedPurchaseOrder.id,
        notes: receivingNotes,
        items: receivingRows,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      data?: { receivingSessionId: string };
    };
    setSubmitting(false);

    if (!response.ok || !payload.data) {
      setError(payload.error ?? t("feedback.failed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.complete"));
    setSelectedSessionId(payload.data.receivingSessionId);
    setVendorId("");
    setPurchaseOrderId("");
    setReceivingRows([]);
    setReceivingNotes("");
    refresh();
  };

  const createPallet = async () => {
    if (!selectedSession) {
      return;
    }

    const items = palletAvailability
      .map((item) => ({
        productId: item.productId,
        quantity: Number(palletQuantities[item.productId] || 0),
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      setError(t("feedback.chooseQty"));
      return;
    }

    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch("/api/receiving/pallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receivingSessionId: selectedSession.id,
        items,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      data?: { palletNumber: string; zpl: string };
    };
    setSubmitting(false);

    if (!response.ok || !payload.data) {
      setError(payload.error ?? t("feedback.palletFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.palletCreated"));
    setZplBundle(payload.data);
    setPalletQuantities({});
    refresh();
  };

  return (
    <div className="p-6 pb-32 lg:p-8 lg:pb-8">
      <div className="w-full space-y-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">{t("title")}</h1>
              <p className="mt-2 text-lg text-slate-500">
                {t("subtitle")}
              </p>
            </div>
            <Link
              href={`/${locale}/receiving/place`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              {t("palletPlacement")}
            </Link>
          </div>
        </div>

        <div className="grid gap-8 2xl:grid-cols-[1fr_420px]">
          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">{t("receivePo")}</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <Field label={t("step1")}>
                <select
                  value={vendorId}
                  onChange={(event) => {
                    setVendorId(event.target.value);
                    setPurchaseOrderId("");
                    setReceivingRows([]);
                  }}
                  className={inputClassName}
                  autoFocus
                >
                  <option value="">{t("chooseVendor")}</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("step2")}>
                <select
                  value={purchaseOrderId}
                  onChange={(event) => {
                    const nextPoId = event.target.value;
                    setPurchaseOrderId(nextPoId);
                    const po = purchaseOrders.find((entry) => entry.id === nextPoId);
                    setReceivingRows(
                      po?.items.map((item) => ({
                        poItemId: item.poItemId,
                        receiveQty: item.remainingQty > 0 ? String(item.remainingQty) : "0",
                        damagedQty: "0",
                        notes: "",
                      })) ?? []
                    );
                  }}
                  className={inputClassName}
                  disabled={!selectedVendor}
                >
                  <option value="">{t("choosePo")}</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.poNumber} ({po.status})
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {!selectedPurchaseOrder ? (
              <div className="mt-8 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-20 text-center font-medium text-slate-400">
                {t("emptyTable")}
              </div>
            ) : (
              <>
                <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-100">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        <tr>
                          <th className="px-6 py-4">{t("columns.product")}</th>
                          <th className="px-6 py-4 text-center">{t("columns.ordered")}</th>
                          <th className="px-6 py-4 text-center">{t("columns.received")}</th>
                          <th className="px-6 py-4 text-center">{t("columns.remaining")}</th>
                          <th className="px-6 py-4 text-center">{t("columns.receiveQty")}</th>
                          <th className="px-6 py-4 text-center">{t("columns.damaged")}</th>
                          <th className="px-6 py-4">{t("columns.notes")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                        {selectedPurchaseOrder.items.map((item) => {
                          const row =
                            receivingRows.find((entry) => entry.poItemId === item.poItemId) ??
                            {
                              poItemId: item.poItemId,
                              receiveQty: "0",
                              damagedQty: "0",
                              notes: "",
                            };

                          return (
                            <tr key={item.poItemId} className="transition hover:bg-slate-50/50">
                              <td className="px-6 py-5">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-950">
                                    {item.compoundId}
                                  </span>
                                  <span className="text-xs text-slate-500">{item.productName}</span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-center font-medium">{item.orderedQty}</td>
                              <td className="px-6 py-5 text-center font-medium">{item.receivedQty}</td>
                              <td className="px-6 py-5 text-center font-bold text-slate-950">{item.remainingQty}</td>
                              <td className="px-6 py-5 text-center">
                                <input
                                  value={row.receiveQty}
                                  onChange={(event) =>
                                    setReceivingRows((current) =>
                                      current.map((entry) =>
                                        entry.poItemId === item.poItemId
                                          ? { ...entry, receiveQty: event.target.value }
                                          : entry
                                      )
                                    )
                                  }
                                  className={`${inputClassName} max-w-[100px] text-center font-bold`}
                                  inputMode="numeric"
                                />
                              </td>
                              <td className="px-6 py-5 text-center">
                                <input
                                  value={row.damagedQty}
                                  onChange={(event) =>
                                    setReceivingRows((current) =>
                                      current.map((entry) =>
                                        entry.poItemId === item.poItemId
                                          ? { ...entry, damagedQty: event.target.value }
                                          : entry
                                      )
                                    )
                                  }
                                  className={`${inputClassName} max-w-[100px] text-center text-rose-600 font-bold`}
                                  inputMode="numeric"
                                />
                              </td>
                              <td className="px-6 py-5">
                                <input
                                  value={row.notes}
                                  onChange={(event) =>
                                    setReceivingRows((current) =>
                                      current.map((entry) =>
                                        entry.poItemId === item.poItemId
                                          ? { ...entry, notes: event.target.value }
                                          : entry
                                      )
                                    )
                                  }
                                  className={inputClassName}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-8 rounded-[24px] border border-slate-100 bg-slate-50/50 p-6">
                  <Field label={t("sessionNotes")}>
                    <textarea
                      value={receivingNotes}
                      onChange={(event) => setReceivingNotes(event.target.value)}
                      className={`${inputClassName} min-h-24 resize-y bg-white`}
                    />
                  </Field>
                </div>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => void submitReceiving()}
                    disabled={submitting || !selectedPurchaseOrder}
                    className="rounded-2xl bg-slate-950 px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {t("completeReceiving")}
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="space-y-8">
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{t("createPallet")}</h2>
              <div className="mt-8">
                <Field label={t("recentSession")}>
                  <div className="flex gap-3">
                    <select
                      value={selectedSessionId}
                      onChange={(event) => setSelectedSessionId(event.target.value)}
                      className={inputClassName}
                    >
                      <option value="">{t("chooseSession")}</option>
                      {recentSessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.poNumber} — {session.startedAt}
                        </option>
                      ))}
                    </select>
                    {selectedSession && (
                      <PdfExportButton
                        filename={`receiving_${selectedSession.poNumber}_${selectedSession.startedAt.slice(0, 10)}.pdf`}
                        title={`Receiving Report: ${selectedSession.poNumber}`}
                        headers={["Product", "Received", "Damaged"]}
                        rows={selectedSession.items.map((item) => [
                          item.compoundId,
                          item.receivedQty,
                          item.damagedQty,
                        ])}
                      />
                    )}
                  </div>
                </Field>
              </div>

              {!selectedSession ? (
                <div className="mt-8 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center font-medium text-slate-400">
                  {t("noSession")}
                </div>
              ) : (
                <>
                <div className="mt-8 space-y-4">
                  {palletAvailability.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center font-medium text-slate-400">
                        {t("allPalletized")}
                      </div>
                    ) : (
                      palletAvailability.map((item) => (
                        <div
                          key={item.productId}
                          className="rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition hover:bg-white hover:shadow-md"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-950 truncate">
                                {item.compoundId}
                              </p>
                              <p className="text-xs text-slate-500 truncate">{item.productName}</p>
                            </div>
                            <div className="w-24 shrink-0">
                              <input
                                value={palletQuantities[item.productId] ?? ""}
                                onChange={(event) =>
                                  setPalletQuantities((current) => ({
                                    ...current,
                                    [item.productId]: event.target.value,
                                  }))
                                }
                                placeholder={`/ ${item.remainingQty}`}
                                className={`${inputClassName} px-2 text-center text-sm font-bold`}
                                inputMode="numeric"
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avail to Palletize</span>
                             <span className="text-sm font-bold text-slate-700">{item.remainingQty}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-8">
                    <button
                      onClick={() => void createPallet()}
                      disabled={submitting || palletAvailability.length === 0}
                      className="w-full rounded-2xl bg-indigo-600 px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {t("createPallet")}
                    </button>
                  </div>
                </>
              )}
            </div>

            {zplBundle && (
              <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 truncate">
                      {zplBundle.palletNumber}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("zebraReady")}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => void printToZebra(zplBundle.zpl, setError, setFeedback)}
                    className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white shadow-md transition hover:bg-slate-800"
                  >
                    {t("printQr")}
                  </button>
                  <button
                    onClick={() => downloadText(`${zplBundle.palletNumber}.zpl`, zplBundle.zpl)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                    ZPL
                  </button>
                </div>
                <pre className="mt-6 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-[10px] font-mono leading-relaxed text-emerald-400">
                  {zplBundle.zpl}
                </pre>
              </div>
            )}

            {selectedSession && (
              <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900 mb-8">{t("activity")}</h2>
                <ActivityTimeline entityType="ReceivingSession" entityId={selectedSession.id} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function printToZebra(
  zpl: string,
  setError: (value: string) => void,
  setFeedback: (value: string) => void
) {
  try {
    await sendZplToBrowserPrint(zpl);
    setError("");
    setFeedback("Pallet label sent to Zebra Browser Print.");
  } catch (error) {
    setFeedback("");
    setError((error as Error).message);
  }
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
