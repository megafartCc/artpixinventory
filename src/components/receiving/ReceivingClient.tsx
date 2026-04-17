"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

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
      setError(payload.error ?? "Receiving failed.");
      return;
    }

    setFeedback(payload.message ?? "Receiving complete.");
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
      setError("Choose at least one pallet quantity.");
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
      setError(payload.error ?? "Failed to create pallet.");
      return;
    }

    setFeedback(payload.message ?? "Pallet created.");
    setZplBundle(payload.data);
    setPalletQuantities({});
    refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Receiving</h1>
            <p className="mt-1 text-slate-500">
              Receive ordered stock, create pallets, and stage placement into sublocations.
            </p>
          </div>
          <Link
            href={`/${locale}/receiving/place`}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Pallet Placement
          </Link>
        </div>

        {(error || feedback) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || feedback}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Receive PO</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Step 1: Select Vendor">
                <select
                  value={vendorId}
                  onChange={(event) => {
                    setVendorId(event.target.value);
                    setPurchaseOrderId("");
                    setReceivingRows([]);
                  }}
                  className={inputClassName}
                >
                  <option value="">Choose vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Step 2: Select PO">
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
                  <option value="">Choose purchase order</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.poNumber} ({po.status})
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Ordered</th>
                    <th className="px-4 py-3">Received</th>
                    <th className="px-4 py-3">Remaining</th>
                    <th className="px-4 py-3">Receive Qty</th>
                    <th className="px-4 py-3">Damaged</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {!selectedPurchaseOrder ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                        Choose a vendor and purchase order to start receiving.
                      </td>
                    </tr>
                  ) : (
                    selectedPurchaseOrder.items.map((item) => {
                      const row =
                        receivingRows.find((entry) => entry.poItemId === item.poItemId) ??
                        {
                          poItemId: item.poItemId,
                          receiveQty: "0",
                          damagedQty: "0",
                          notes: "",
                        };

                      return (
                        <tr key={item.poItemId}>
                          <td className="px-4 py-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900">
                                {item.compoundId}
                              </span>
                              <span>{item.productName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">{item.orderedQty}</td>
                          <td className="px-4 py-4">{item.receivedQty}</td>
                          <td className="px-4 py-4">{item.remainingQty}</td>
                          <td className="px-4 py-4">
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
                              className={inputClassName}
                              inputMode="numeric"
                            />
                          </td>
                          <td className="px-4 py-4">
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
                              className={inputClassName}
                              inputMode="numeric"
                            />
                          </td>
                          <td className="px-4 py-4">
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
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 grid gap-4">
              <Field label="Session Notes">
                <textarea
                  value={receivingNotes}
                  onChange={(event) => setReceivingNotes(event.target.value)}
                  className={`${inputClassName} min-h-24 resize-y`}
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => void submitReceiving()}
                disabled={submitting || !selectedPurchaseOrder}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                Complete Receiving
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Create Pallet</h2>
              <Field label="Recent Receiving Session">
                <select
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  className={inputClassName}
                >
                  <option value="">Choose session</option>
                  {recentSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.poNumber} - {session.startedAt}
                    </option>
                  ))}
                </select>
              </Field>

              {!selectedSession ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  No receiving session selected.
                </div>
              ) : (
                <>
                  <div className="mt-5 space-y-3">
                    {palletAvailability.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                        All received items are already palletized.
                      </div>
                    ) : (
                      palletAvailability.map((item) => (
                        <div
                          key={item.productId}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {item.compoundId}
                              </p>
                              <p className="text-sm text-slate-500">{item.productName}</p>
                            </div>
                            <div className="w-32">
                              <input
                                value={palletQuantities[item.productId] ?? ""}
                                onChange={(event) =>
                                  setPalletQuantities((current) => ({
                                    ...current,
                                    [item.productId]: event.target.value,
                                  }))
                                }
                                placeholder={`0 / ${item.remainingQty}`}
                                className={inputClassName}
                                inputMode="numeric"
                              />
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Remaining to palletize: {item.remainingQty}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      onClick={() => void createPallet()}
                      disabled={submitting || palletAvailability.length === 0}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                    >
                      Create Pallet
                    </button>
                  </div>
                </>
              )}
            </div>

            {zplBundle && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {zplBundle.palletNumber}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Zebra-ready ZPL generated for the latest pallet.
                    </p>
                  </div>
                  <button
                    onClick={() => downloadText(`${zplBundle.palletNumber}.zpl`, zplBundle.zpl)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                    Print QR
                  </button>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-emerald-300">
                  {zplBundle.zpl}
                </pre>
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
