"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { useTranslations } from "next-intl";

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
  const [dropWarnings, setDropWarnings] = useState<string[]>([]);
  const t = useTranslations("TransferWorkflow");
  useToastFeedback(error, feedback);

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
      setError(payload.error ?? t("feedback.startFailed"));
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
      setError(payload.error ?? t("feedback.collectFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.collected"));
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
      setError(payload.error ?? t("feedback.modeFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.modeStarted"));
    refresh();
  };

  const drop = async () => {
    if (!currentTransfer) {
      return;
    }

    setSubmitting(true);
    setError("");
    setDropWarnings([]);

    const response = await fetch(`/api/transfers/${currentTransfer.id}/drop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationQrCode: destinationQr,
        productId: dropProductId,
        quantity: dropQty,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      warnings?: string[];
    };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? t("feedback.dropFailed"));
      return;
    }

    if (payload.warnings && payload.warnings.length > 0) {
      setDropWarnings(payload.warnings);
    }

    setFeedback(payload.message ?? t("feedback.dropped"));
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
      setError(payload.error ?? t("feedback.cancelFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.cancelled"));
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
              {t("back")}
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">
              {t("subtitle")}
            </p>
          </div>
          {!currentTransfer ? (
            <button
              onClick={() => void startTransfer()}
              disabled={submitting}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t("startTransfer")}
            </button>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{currentTransfer.reference}</p>
              <p>{t("status")}: {currentTransfer.status}</p>
            </div>
          )}
        </div>

        {currentTransfer && (
          <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              {currentTransfer.status === "COLLECTING" && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                        {t("collectionMode")}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">
                        {t("scanLocation")}
                      </h2>
                    </div>
                    <button className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white">
                      {t("scanLocation")}
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    <input
                      value={sourceQr}
                      onChange={(event) => setSourceQr(event.target.value)}
                      placeholder={t("sourcePlaceholder")}
                      className={inputClassName}
                      autoFocus
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
                          <p className="mt-1 text-xs text-slate-500">{t("inStock")}: {stock.quantity}</p>
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <input
                        value={pickQty}
                        onChange={(event) => setPickQty(event.target.value)}
                        placeholder={t("qty")}
                        className={inputClassName}
                        inputMode="numeric"
                      />
                      <button
                        onClick={() => void collect()}
                        disabled={submitting || !sourceQr || !selectedProductId || !pickQty}
                        className="rounded-2xl bg-sky-600 px-5 py-4 text-base lg:py-3 lg:text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {t("addToCart")}
                      </button>
                    </div>

                    <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] flex flex-col sm:flex-row gap-3 z-50 lg:static lg:p-0 lg:border-none lg:bg-transparent lg:shadow-none lg:flex-row lg:flex-wrap">
                      <button
                        onClick={() => setSourceQr("")}
                        className="rounded-2xl border border-slate-200 px-4 py-4 text-base lg:py-2.5 lg:text-sm font-medium text-slate-700 hover:bg-slate-50 flex-1"
                      >
                        {t("scanAnother")}
                      </button>
                      <button
                        onClick={() => void switchToDropoff()}
                        disabled={submitting || cartItems.length === 0}
                        className="rounded-2xl bg-amber-500 px-4 py-4 text-base lg:py-2.5 lg:text-sm font-semibold text-white disabled:opacity-60 flex-1"
                      >
                        {t("switchToDropoff")}
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
                        {t("dropoffMode")}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900">
                        {t("scanDestination")}
                      </h2>
                    </div>
                    <button className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white">
                      {t("scanDestination")}
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    <input
                      value={destinationQr}
                      onChange={(event) => setDestinationQr(event.target.value)}
                      placeholder={t("destPlaceholder")}
                      className={inputClassName}
                      autoFocus
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

                    {dropWarnings.length > 0 && (
                      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200">
                              <span className="text-sm">⚠️</span>
                            </span>
                            <div className="space-y-1">
                              {dropWarnings.map((warning, index) => (
                                <p key={index} className="text-sm font-medium text-amber-800">
                                  {warning}
                                </p>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => setDropWarnings([])}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-100"
                          >
                            {t("dismiss")}
                          </button>
                        </div>
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
                            {t("remainingInCart")}: {item.quantity}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                      <input
                        value={dropQty}
                        onChange={(event) => setDropQty(event.target.value)}
                        placeholder={t("dropQty")}
                        className={inputClassName}
                        inputMode="numeric"
                      />
                      <button
                        onClick={() => void drop()}
                        disabled={submitting || !destinationQr || !dropProductId || !dropQty}
                        className="rounded-2xl bg-amber-500 px-5 py-4 text-base lg:py-3 lg:text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {t("drop")}
                      </button>
                    </div>

                    <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] flex flex-col sm:flex-row gap-3 z-50 lg:static lg:p-0 lg:border-none lg:bg-transparent lg:shadow-none lg:flex-row lg:flex-wrap">
                      <button
                        onClick={() => setDestinationQr("")}
                        className="rounded-2xl border border-slate-200 px-4 py-4 text-base lg:py-2.5 lg:text-sm font-medium text-slate-700 hover:bg-slate-50 flex-1"
                      >
                        {t("scanAnotherDest")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">{t("cart")}</h2>
                  <Link
                    href={`/${locale}/transfers/${currentTransfer.id}`}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700"
                  >
                    {t("detail")}
                  </Link>
                </div>
                <div className="mt-5 space-y-3">
                  {cartItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                      {t("cartEmpty")}
                    </div>
                  ) : (
                    cartItems.map((item) => (
                      <div
                        key={item.productId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="font-semibold text-slate-900">{item.compoundId}</p>
                        <p className="text-sm text-slate-500">{item.productName}</p>
                        <p className="mt-1 text-xs text-slate-500">{t("qtyLabel")}: {item.quantity}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">{t("transferControls")}</h2>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => void cancelTransfer()}
                    disabled={submitting}
                    className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {t("cancelTransfer")}
                  </button>
                  {currentTransfer.status === "COMPLETED" && (
                    <Link
                      href={`/${locale}/transfers/${currentTransfer.id}`}
                      className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      {t("viewCompletedTransfer")}
                    </Link>
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">
                    {t("controlsInfo")}
                  </p>
                </div>
              </div>

              {currentTransfer && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900 mb-5">{t("activity")}</h2>
                  <ActivityTimeline entityType="Transfer" entityId={currentTransfer.id} />
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
