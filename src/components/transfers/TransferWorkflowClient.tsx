"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

export function TransferWorkflowClient({
  locale,
  currentTransfer,
  locations,
  stockLevels,
}: {
  locale: string;
  currentTransfer: {
    id: string;
    reference: string;
    status: string;
    picks: Array<{
      id: string;
      productId: string;
      compoundId: string;
      productName: string;
      locationId: string;
      locationName: string;
      quantity: number;
    }>;
    drops: Array<{
      id: string;
      productId: string;
      compoundId: string;
      productName: string;
      locationId: string;
      locationName: string;
      quantity: number;
    }>;
  } | null;
  locations: Array<{
    id: string;
    name: string;
    qrCode: string;
    type: string;
  }>;
  stockLevels: Array<{
    locationId: string;
    locationName: string;
    locationQrCode: string;
    productId: string;
    compoundId: string;
    productName: string;
    quantity: number;
  }>;
}) {
  const router = useRouter();
  const [sourceQr, setSourceQr] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [pickQty, setPickQty] = useState("");
  const [destinationQr, setDestinationQr] = useState("");
  const [dropProductId, setDropProductId] = useState("");
  const [dropQty, setDropQty] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => startTransition(() => router.refresh());

  const sourceLocation = useMemo(
    () => locations.find((location) => location.qrCode === sourceQr) ?? null,
    [locations, sourceQr]
  );
  const sourceStock = useMemo(
    () =>
      sourceLocation
        ? stockLevels.filter((stock) => stock.locationId === sourceLocation.id)
        : [],
    [sourceLocation, stockLevels]
  );

  const cartItems = useMemo(() => {
    const itemMap = new Map<
      string,
      {
        productId: string;
        compoundId: string;
        productName: string;
        quantity: number;
      }
    >();

    for (const pick of currentTransfer?.picks ?? []) {
      const existing = itemMap.get(pick.productId);
      itemMap.set(pick.productId, {
        productId: pick.productId,
        compoundId: pick.compoundId,
        productName: pick.productName,
        quantity: (existing?.quantity ?? 0) + pick.quantity,
      });
    }

    for (const drop of currentTransfer?.drops ?? []) {
      const existing = itemMap.get(drop.productId);
      if (!existing) {
        continue;
      }
      existing.quantity -= drop.quantity;
      itemMap.set(drop.productId, existing);
    }

    return Array.from(itemMap.values()).filter((item) => item.quantity > 0);
  }, [currentTransfer]);

  const destinationLocation = useMemo(
    () => locations.find((location) => location.qrCode === destinationQr) ?? null,
    [destinationQr, locations]
  );

  const startTransfer = async () => {
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = (await response.json()) as { error?: string; data?: { id: string } };
    setSubmitting(false);

    if (!response.ok || !payload.data?.id) {
      setError(payload.error ?? "Failed to start transfer.");
      return;
    }

    router.push(`/${locale}/transfers/new?transfer=${payload.data.id}`);
  };

  const collect = async () => {
    if (!currentTransfer) {
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/transfers/${currentTransfer.id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationQrCode: sourceQr,
        productId: selectedProductId,
        quantity: pickQty,
      }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to collect stock.");
      return;
    }

    setFeedback(payload.message ?? "Item collected.");
    setPickQty("");
    setSelectedProductId("");
    refresh();
  };

  const switchToDropoff = async () => {
    if (!currentTransfer) {
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/transfers/${currentTransfer.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "START_DROPOFF" }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to switch transfer mode.");
      return;
    }

    setFeedback(payload.message ?? "Drop-off mode started.");
    refresh();
  };

  const drop = async () => {
    if (!currentTransfer) {
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/transfers/${currentTransfer.id}/drop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationQrCode: destinationQr,
        productId: dropProductId,
        quantity: dropQty,
      }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to drop stock.");
      return;
    }

    setFeedback(payload.message ?? "Stock dropped.");
    setDropQty("");
    setDropProductId("");
    refresh();
  };

  const cancelTransfer = async () => {
    if (!currentTransfer) {
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/transfers/${currentTransfer.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CANCEL" }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to cancel transfer.");
      return;
    }

    setFeedback(payload.message ?? "Transfer cancelled.");
    router.push(`/${locale}/transfers`);
  };

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href={`/${locale}/transfers`}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Back to Transfers
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">New Transfer</h1>
            <p className="mt-1 text-slate-500">
              Mobile-first pick and drop workflow using location QR codes.
            </p>
          </div>
          {!currentTransfer ? (
            <button
              onClick={() => void startTransfer()}
              disabled={submitting}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              Start Transfer
            </button>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{currentTransfer.reference}</p>
              <p>Status: {currentTransfer.status}</p>
            </div>
          )}
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

        {currentTransfer && (
          <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              {currentTransfer.status === "COLLECTING" && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                        Collection Mode
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">
                        Scan Location
                      </h2>
                    </div>
                    <button className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white">
                      Scan Location
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    <input
                      value={sourceQr}
                      onChange={(event) => setSourceQr(event.target.value)}
                      placeholder="Paste or scan source location QR"
                      className={inputClassName}
                    />
                    <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                      {locations.slice(0, 18).map((location) => (
                        <button
                          key={location.id}
                          onClick={() => setSourceQr(location.qrCode)}
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          {location.name}
                        </button>
                      ))}
                    </div>

                    {sourceLocation && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">{sourceLocation.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{sourceLocation.qrCode}</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {sourceStock.map((stock) => (
                        <button
                          key={`${stock.locationId}-${stock.productId}`}
                          onClick={() => setSelectedProductId(stock.productId)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left ${
                            selectedProductId === stock.productId
                              ? "border-sky-500 bg-sky-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <p className="font-semibold text-slate-900">{stock.compoundId}</p>
                          <p className="text-sm text-slate-500">{stock.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">In stock: {stock.quantity}</p>
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <input
                        value={pickQty}
                        onChange={(event) => setPickQty(event.target.value)}
                        placeholder="Quantity"
                        className={inputClassName}
                        inputMode="numeric"
                      />
                      <button
                        onClick={() => void collect()}
                        disabled={submitting || !sourceQr || !selectedProductId || !pickQty}
                        className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Add to Cart
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setSourceQr("")}
                        className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Scan Another Location
                      </button>
                      <button
                        onClick={() => void switchToDropoff()}
                        disabled={submitting || cartItems.length === 0}
                        className="rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Switch to Drop-Off
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentTransfer.status === "DROPPING" && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                        Drop-Off Mode
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">
                        Scan Destination
                      </h2>
                    </div>
                    <button className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white">
                      Scan Destination
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    <input
                      value={destinationQr}
                      onChange={(event) => setDestinationQr(event.target.value)}
                      placeholder="Paste or scan destination location QR"
                      className={inputClassName}
                    />
                    <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                      {locations
                        .filter((location) => !["WAREHOUSE"].includes(location.type))
                        .slice(0, 18)
                        .map((location) => (
                          <button
                            key={location.id}
                            onClick={() => setDestinationQr(location.qrCode)}
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            {location.name}
                          </button>
                        ))}
                    </div>

                    {destinationLocation && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">{destinationLocation.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {destinationLocation.qrCode}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {cartItems.map((item) => (
                        <button
                          key={item.productId}
                          onClick={() => setDropProductId(item.productId)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left ${
                            dropProductId === item.productId
                              ? "border-amber-500 bg-amber-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <p className="font-semibold text-slate-900">{item.compoundId}</p>
                          <p className="text-sm text-slate-500">{item.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Remaining in cart: {item.quantity}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <input
                        value={dropQty}
                        onChange={(event) => setDropQty(event.target.value)}
                        placeholder="Drop quantity"
                        className={inputClassName}
                        inputMode="numeric"
                      />
                      <button
                        onClick={() => void drop()}
                        disabled={submitting || !destinationQr || !dropProductId || !dropQty}
                        className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Drop
                      </button>
                    </div>

                    <button
                      onClick={() => setDestinationQr("")}
                      className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Scan Another Destination
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Cart</h2>
                  <Link
                    href={`/${locale}/transfers/${currentTransfer.id}`}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700"
                  >
                    Detail
                  </Link>
                </div>
                <div className="mt-5 space-y-3">
                  {cartItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                      Cart is empty.
                    </div>
                  ) : (
                    cartItems.map((item) => (
                      <div
                        key={item.productId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="font-semibold text-slate-900">{item.compoundId}</p>
                        <p className="text-sm text-slate-500">{item.productName}</p>
                        <p className="mt-1 text-xs text-slate-500">Qty: {item.quantity}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Transfer Controls</h2>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => void cancelTransfer()}
                    disabled={submitting}
                    className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    Cancel Transfer
                  </button>
                  {currentTransfer.status === "COMPLETED" && (
                    <Link
                      href={`/${locale}/transfers/${currentTransfer.id}`}
                      className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      View Completed Transfer
                    </Link>
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">
                    Once you switch to drop-off mode, collection stays locked. On cancel, all picked stock is returned to its original locations.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
