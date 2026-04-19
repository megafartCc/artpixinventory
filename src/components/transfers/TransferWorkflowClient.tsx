"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronRight,
  Package2,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { CameraScanner } from "@/components/scanner/CameraScanner";
import { useTranslations } from "next-intl";

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

type TransferRecord = {
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
};

type LocationRecord = {
  id: string;
  name: string;
  qrCode: string;
  type: string;
};

type StockRecord = {
  locationId: string;
  locationName: string;
  locationQrCode: string;
  productId: string;
  compoundId: string;
  productName: string;
  quantity: number;
};

type ExceptionState = {
  warnings: string[];
  productId: string;
  quantity: string;
  locationQrCode: string;
};

function normalizeQr(value: string) {
  return value.trim().toUpperCase();
}

function parseQty(value: string) {
  return Math.max(1, Number(value) || 1);
}

function formatStatus(status: string) {
  if (status === "COLLECTING") return "Collecting";
  if (status === "DROPPING") return "Dropping";
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return status;
}

function stepState(currentStatus: string, step: "collect" | "review" | "drop" | "done") {
  if (currentStatus === "COLLECTING") {
    return step === "collect" ? "active" : "upcoming";
  }
  if (currentStatus === "DROPPING") {
    if (step === "collect" || step === "review") return "complete";
    return step === "drop" ? "active" : "upcoming";
  }
  if (currentStatus === "COMPLETED") {
    return "complete";
  }
  return step === "collect" ? "active" : "upcoming";
}

export function TransferWorkflowClient({
  locale,
  currentTransfer,
  locations,
  stockLevels,
}: {
  locale: string;
  currentTransfer: TransferRecord | null;
  locations: LocationRecord[];
  stockLevels: StockRecord[];
}) {
  const router = useRouter();
  const t = useTranslations("TransferWorkflow");
  const [sourceQr, setSourceQr] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [sourceSearch, setSourceSearch] = useState("");
  const [destinationQr, setDestinationQr] = useState("");
  const [dropProductId, setDropProductId] = useState("");
  const [dropQty, setDropQty] = useState("1");
  const [dropSearch, setDropSearch] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dropWarnings, setDropWarnings] = useState<string[]>([]);
  const [pendingException, setPendingException] = useState<ExceptionState | null>(null);
  const [exceptionConfirmed, setExceptionConfirmed] = useState(false);
  useToastFeedback(error, feedback);

  const refresh = () => startTransition(() => router.refresh());

  const sourceLocation = useMemo(
    () =>
      locations.find((location) => normalizeQr(location.qrCode) === normalizeQr(sourceQr)) ??
      null,
    [locations, sourceQr]
  );

  const sourceStock = useMemo(() => {
    if (!sourceLocation) {
      return [];
    }

    const normalizedSearch = sourceSearch.trim().toLowerCase();
    return stockLevels
      .filter((stock) => stock.locationId === sourceLocation.id)
      .filter((stock) =>
        normalizedSearch
          ? `${stock.compoundId} ${stock.productName}`.toLowerCase().includes(normalizedSearch)
          : true
      )
      .sort((left, right) => left.compoundId.localeCompare(right.compoundId));
  }, [sourceLocation, sourceSearch, stockLevels]);

  const selectedSourceItem = sourceStock.find((stock) => stock.productId === selectedProductId) ?? null;

  const destinationLocation = useMemo(
    () =>
      locations.find(
        (location) => normalizeQr(location.qrCode) === normalizeQr(destinationQr)
      ) ?? null,
    [destinationQr, locations]
  );

  const cartItems = useMemo(() => {
    const itemMap = new Map<
      string,
      {
        productId: string;
        compoundId: string;
        productName: string;
        quantity: number;
        sourceNames: string[];
      }
    >();

    for (const pick of currentTransfer?.picks ?? []) {
      const existing = itemMap.get(pick.productId);
      itemMap.set(pick.productId, {
        productId: pick.productId,
        compoundId: pick.compoundId,
        productName: pick.productName,
        quantity: (existing?.quantity ?? 0) + pick.quantity,
        sourceNames: Array.from(new Set([...(existing?.sourceNames ?? []), pick.locationName])),
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

    return Array.from(itemMap.values())
      .filter((item) => item.quantity > 0)
      .filter((item) =>
        dropSearch.trim()
          ? `${item.compoundId} ${item.productName}`.toLowerCase().includes(dropSearch.trim().toLowerCase())
          : true
      )
      .sort((left, right) => left.compoundId.localeCompare(right.compoundId));
  }, [currentTransfer, dropSearch]);

  const selectedDropItem = cartItems.find((item) => item.productId === dropProductId) ?? null;

  const progress = useMemo(() => {
    const picked = (currentTransfer?.picks ?? []).reduce((sum, pick) => sum + pick.quantity, 0);
    const dropped = (currentTransfer?.drops ?? []).reduce((sum, drop) => sum + drop.quantity, 0);
    const openLines = cartItems.length;

    return {
      picked,
      dropped,
      openLines,
      percent: picked > 0 ? Math.round((dropped / picked) * 100) : 0,
    };
  }, [cartItems.length, currentTransfer]);

  const canStartDropoff = (currentTransfer?.status === "COLLECTING" && progress.picked > 0) ?? false;

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
    if (!currentTransfer || !sourceLocation || !selectedSourceItem) {
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/transfers/${currentTransfer.id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationQrCode: sourceLocation.qrCode,
        productId: selectedSourceItem.productId,
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
    setSelectedProductId("");
    setPickQty("1");
    setSourceSearch("");
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
    setDropProductId("");
    setDropQty("1");
    refresh();
  };

  const performDrop = async (allowException: boolean) => {
    if (!currentTransfer || !destinationLocation || !selectedDropItem) {
      return;
    }

    setSubmitting(true);
    setError("");
    setDropWarnings([]);

    const response = await fetch(`/api/transfers/${currentTransfer.id}/drop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationQrCode: destinationLocation.qrCode,
        productId: selectedDropItem.productId,
        quantity: dropQty,
        allowException,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      warnings?: string[];
      requiresConfirmation?: boolean;
    };
    setSubmitting(false);

    if (response.status === 409 && payload.requiresConfirmation) {
      setPendingException({
        warnings: payload.warnings ?? [],
        productId: selectedDropItem.productId,
        quantity: dropQty,
        locationQrCode: destinationLocation.qrCode,
      });
      return;
    }

    if (!response.ok) {
      setError(payload.error ?? t("feedback.dropFailed"));
      return;
    }

    setPendingException(null);
    setExceptionConfirmed(false);

    if (payload.warnings && payload.warnings.length > 0) {
      setDropWarnings(payload.warnings);
    }

    setFeedback(payload.message ?? t("feedback.dropped"));
    setDropQty("1");
    setDropProductId("");
    setDropSearch("");
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
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-[1600px] space-y-10">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href={`/${locale}/transfers`}
                className="text-sm font-bold text-slate-400 transition hover:text-slate-600 uppercase tracking-widest"
              >
                ← {t("back")}
              </Link>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950">
                {t("title")}
              </h1>
              <p className="mt-2 max-w-4xl text-lg text-slate-500 leading-relaxed">
                Mobile-optimized collection and drop confirmation flow. Scan or paste location QR codes, confirm the pick cart, then finish controlled drops with exception approval.
              </p>
            </div>

            {!currentTransfer ? (
              <button
                onClick={() => void startTransfer()}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
              >
                <ScanLine className="h-5 w-5" />
                {t("startTransfer")}
              </button>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3 lg:w-[540px]">
                <MetricCard title="Transfer" value={currentTransfer.reference} icon={ArrowLeftRight} />
                <MetricCard title="Picked" value={String(progress.picked)} icon={Package2} />
                <MetricCard title="Dropped" value={String(progress.dropped)} icon={CheckCircle2} />
              </div>
            )}
          </div>
        </div>

        {currentTransfer && (
          <>
            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid gap-6 sm:grid-cols-4">
                  <FlowStep
                    label="Collect"
                    state={stepState(currentTransfer.status, "collect")}
                    detail={`${progress.picked} units`}
                  />
                  <FlowStep
                    label="Review"
                    state={stepState(currentTransfer.status, "review")}
                    detail={`${progress.openLines} open lines`}
                  />
                  <FlowStep
                    label="Drop"
                    state={stepState(currentTransfer.status, "drop")}
                    detail={`${progress.percent}% complete`}
                  />
                  <FlowStep
                    label="Done"
                    state={stepState(currentTransfer.status, "done")}
                    detail={formatStatus(currentTransfer.status)}
                  />
                </div>

                <div className="rounded-[28px] border border-slate-100 bg-slate-50/50 p-6 lg:min-w-[320px]">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    <span>Overall Progress</span>
                    <span className="text-slate-950">{progress.percent}%</span>
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-slate-200 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-500 ease-out shadow-sm"
                      style={{ width: `${Math.min(progress.percent, 100)}%` }}
                    />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-500">
                    {progress.openLines === 0
                      ? "Cart cleared. Waiting for completion."
                      : `${progress.openLines} line items pending destination drop.`}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="space-y-6">
                {currentTransfer.status === "COLLECTING" && (
                  <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="mb-10">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">
                          Collection Mode
                        </p>
                        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">
                          1. Scan Source Location
                        </h2>
                        <p className="mt-3 max-w-2xl text-lg text-slate-500 leading-relaxed">
                          Scan the location QR code to reveal its current inventory. Then pick the items to move.
                        </p>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <InlineNote>Pick only from the scanned location.</InlineNote>
                        <InlineNote>Switch to drop-off only after the cart is correct.</InlineNote>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <CameraScanner
                          title="Source scan"
                          subtitle="Use the device camera for source QR scans. The source stock list updates immediately after a valid scan."
                          placeholder={t("sourcePlaceholder")}
                          onDetected={(value) => setSourceQr(value)}
                        />
                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {locations.slice(0, 12).map((location) => (
                              <button
                                key={location.id}
                                type="button"
                                onClick={() => setSourceQr(location.qrCode)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                              >
                                {location.name}
                              </button>
                            ))}
                          </div>
                          {sourceLocation ? (
                            <ScanConfirmCard
                              title={sourceLocation.name}
                              meta={`${sourceLocation.qrCode} / ${sourceLocation.type}`}
                              tone="sky"
                            />
                          ) : (
                            <EmptyHint message="Waiting for a valid source QR scan." />
                          )}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <PanelTitle
                          icon={Package2}
                          title="Pick from source stock"
                          description="Select the SKU, set quantity, and add it straight into the transfer cart."
                        />
                        {sourceLocation ? (
                          <>
                            <div className="mt-4">
                              <input
                                value={sourceSearch}
                                onChange={(event) => setSourceSearch(event.target.value)}
                                placeholder="Search source stock"
                                className={inputClassName}
                              />
                            </div>
                            <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                              {sourceStock.length === 0 ? (
                                <EmptyHint message="No active stock found at this source location." />
                              ) : (
                                sourceStock.map((stock) => (
                                  <button
                                    key={`${stock.locationId}-${stock.productId}`}
                                    type="button"
                                    onClick={() => setSelectedProductId(stock.productId)}
                                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                                      selectedProductId === stock.productId
                                        ? "border-sky-500 bg-sky-50"
                                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">{stock.compoundId}</p>
                                        <p className="mt-1 text-sm text-slate-500">{stock.productName}</p>
                                      </div>
                                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        {stock.quantity} on hand
                                      </span>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="mt-4">
                            <EmptyHint message="Scan a source location to unlock its stock list." />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <PanelTitle
                        icon={ChevronRight}
                        title="Confirm pick"
                        description="Every pick deducts stock immediately from the source location."
                      />
                      {selectedSourceItem ? (
                        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                          <SelectedItemCard
                            title={selectedSourceItem.compoundId}
                            subtitle={selectedSourceItem.productName}
                            meta={`${selectedSourceItem.quantity} available at ${sourceLocation?.name}`}
                          />
                          <div className="rounded-3xl border border-slate-200 bg-white p-4">
                            <label className="text-sm font-medium text-slate-700">Pick quantity</label>
                            <div className="mt-3 flex items-center gap-2">
                              <StepButton onClick={() => setPickQty(String(Math.max(1, parseQty(pickQty) - 1)))}>-</StepButton>
                              <input
                                value={pickQty}
                                onChange={(event) => setPickQty(event.target.value)}
                                className={`${inputClassName} text-center`}
                                inputMode="numeric"
                              />
                              <StepButton onClick={() => setPickQty(String(parseQty(pickQty) + 1))}>+</StepButton>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4">
                          <EmptyHint message="Select a SKU from the scanned source location." />
                        </div>
                      )}
                    </div>

                    <MobileActionBar
                      primaryLabel="Pick into cart"
                      primaryTone="sky"
                      onPrimary={() => void collect()}
                      secondaryLabel="Start drop-off"
                      onSecondary={() => void switchToDropoff()}
                      disablePrimary={submitting || !sourceLocation || !selectedSourceItem}
                      disableSecondary={submitting || !canStartDropoff}
                    />
                  </div>
                )}

                {currentTransfer.status === "DROPPING" && (
                  <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="mb-10">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">
                          Drop-off Mode
                        </p>
                        <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">
                          2. Scan Destination & Drop
                        </h2>
                        <p className="mt-3 max-w-2xl text-lg text-slate-500 leading-relaxed">
                          Select a product from your cart, scan the destination QR, and confirm the drop quantity.
                        </p>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <InlineNote tone="amber">Wrong-location drops require approval.</InlineNote>
                        <InlineNote tone="amber">Transfer auto-completes when cart is empty.</InlineNote>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <CameraScanner
                          title="Destination scan"
                          subtitle="Scan the live destination location instead of typing QR values manually."
                          placeholder={t("destPlaceholder")}
                          onDetected={(value) => setDestinationQr(value)}
                        />
                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {locations
                              .filter((location) => location.type !== "WAREHOUSE")
                              .slice(0, 12)
                              .map((location) => (
                                <button
                                  key={location.id}
                                  type="button"
                                  onClick={() => setDestinationQr(location.qrCode)}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                                >
                                  {location.name}
                                </button>
                              ))}
                          </div>
                          {destinationLocation ? (
                            <ScanConfirmCard
                              title={destinationLocation.name}
                              meta={`${destinationLocation.qrCode} / ${destinationLocation.type}`}
                              tone="amber"
                            />
                          ) : (
                            <EmptyHint message="Waiting for a valid destination QR scan." />
                          )}
                        </div>

                        {dropWarnings.length > 0 && (
                          <div className="mt-4 rounded-3xl border border-amber-300 bg-amber-50 p-4">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                              <div className="space-y-1">
                                {dropWarnings.map((warning) => (
                                  <p key={warning} className="text-sm font-medium text-amber-800">
                                    {warning}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {pendingException && (
                          <div className="mt-4 rounded-3xl border border-rose-300 bg-rose-50 p-4">
                            <div className="flex items-start gap-3">
                              <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-600" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-rose-800">
                                  Exception confirmation required
                                </p>
                                <div className="mt-2 space-y-1">
                                  {pendingException.warnings.map((warning) => (
                                    <p key={warning} className="text-sm text-rose-700">
                                      {warning}
                                    </p>
                                  ))}
                                </div>
                                <label className="mt-3 flex items-center gap-2 text-sm text-rose-800">
                                  <input
                                    type="checkbox"
                                    checked={exceptionConfirmed}
                                    onChange={(event) => setExceptionConfirmed(event.target.checked)}
                                  />
                                  I reviewed this drop and want to continue anyway.
                                </label>
                                <div className="mt-4 flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPendingException(null);
                                      setExceptionConfirmed(false);
                                    }}
                                    className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                                  >
                                    Cancel exception
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void performDrop(true)}
                                    disabled={!exceptionConfirmed || submitting}
                                    className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                                  >
                                    Approve exception and drop
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <PanelTitle
                          icon={Package2}
                          title="Drop from cart"
                          description="Only remaining cart lines can be dropped. The transfer closes automatically when all lines are cleared."
                        />
                        <div className="mt-4">
                          <input
                            value={dropSearch}
                            onChange={(event) => setDropSearch(event.target.value)}
                            placeholder="Search remaining cart"
                            className={inputClassName}
                          />
                        </div>
                        <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                          {cartItems.length === 0 ? (
                            <EmptyHint message="No remaining cart lines. The transfer will finish as soon as the backend marks it complete." />
                          ) : (
                            cartItems.map((item) => (
                              <button
                                key={item.productId}
                                type="button"
                                onClick={() => setDropProductId(item.productId)}
                                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                                  dropProductId === item.productId
                                    ? "border-amber-500 bg-amber-50"
                                    : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{item.compoundId}</p>
                                    <p className="mt-1 text-sm text-slate-500">{item.productName}</p>
                                    <p className="mt-1 text-xs text-slate-400">
                                      From {item.sourceNames.join(", ")}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                    {item.quantity} open
                                  </span>
                                </div>
                              </button>
                            ))
                          )}
                        </div>

                        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <PanelTitle
                            icon={CheckCircle2}
                            title="Confirm drop"
                            description="Check the destination, selected SKU, and quantity before committing the stock."
                          />
                          {selectedDropItem ? (
                            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                              <SelectedItemCard
                                title={selectedDropItem.compoundId}
                                subtitle={selectedDropItem.productName}
                                meta={`${selectedDropItem.quantity} remaining / ${selectedDropItem.sourceNames.join(", ")}`}
                              />
                              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                                <label className="text-sm font-medium text-slate-700">Drop quantity</label>
                                <div className="mt-3 flex items-center gap-2">
                                  <StepButton onClick={() => setDropQty(String(Math.max(1, parseQty(dropQty) - 1)))}>-</StepButton>
                                  <input
                                    value={dropQty}
                                    onChange={(event) => setDropQty(event.target.value)}
                                    className={`${inputClassName} text-center`}
                                    inputMode="numeric"
                                  />
                                  <StepButton onClick={() => setDropQty(String(parseQty(dropQty) + 1))}>+</StepButton>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4">
                              <EmptyHint message="Select a remaining cart line before confirming the drop." />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <MobileActionBar
                      primaryLabel="Confirm drop"
                      primaryTone="amber"
                      onPrimary={() => void performDrop(false)}
                      secondaryLabel="Scan another destination"
                      onSecondary={() => {
                        setDestinationQr("");
                        setPendingException(null);
                        setExceptionConfirmed(false);
                      }}
                      disablePrimary={submitting || !destinationLocation || !selectedDropItem}
                    />
                  </div>
                )}
              </section>

              <section className="self-start space-y-6 xl:sticky xl:top-4">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{t("cart")}</h2>
                    <Link
                      href={`/${locale}/transfers/${currentTransfer.id}`}
                      className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
                    >
                      {t("detail")}
                    </Link>
                  </div>
                  <div className="mt-5 space-y-3">
                    {cartItems.length === 0 ? (
                      <EmptyHint message={t("cartEmpty")} />
                    ) : (
                      cartItems.map((item) => (
                        <div
                          key={item.productId}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.compoundId}</p>
                              <p className="mt-1 text-sm text-slate-500">{item.productName}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                From {item.sourceNames.join(", ")}
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {item.quantity}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-semibold text-slate-900">Transfer controls</h2>
                  <div className="mt-5 grid gap-3">
                    {currentTransfer.status === "COLLECTING" && (
                      <button
                        type="button"
                        onClick={() => void switchToDropoff()}
                        disabled={!canStartDropoff || submitting}
                        className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
                      >
                        Start drop-off
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void cancelTransfer()}
                      disabled={submitting}
                      className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                    >
                      {t("cancelTransfer")}
                    </button>
                  </div>
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-3">
                      <SummaryRow label="Status" value={formatStatus(currentTransfer.status)} />
                      <SummaryRow label="Picked units" value={String(progress.picked)} />
                      <SummaryRow label="Dropped units" value={String(progress.dropped)} />
                      <SummaryRow label="Open lines" value={String(progress.openLines)} />
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="mb-5 text-lg font-semibold text-slate-900">{t("activity")}</h2>
                  <ActivityTimeline entityType="Transfer" entityId={currentTransfer.id} />
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{title}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm border border-slate-50">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function FlowStep({
  label,
  state,
  detail,
}: {
  label: string;
  state: "active" | "complete" | "upcoming";
  detail: string;
}) {
  const active = state === "active";
  const complete = state === "complete";

  return (
    <div className="flex items-start gap-4">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 transition-all duration-300 ${
          active
            ? "border-indigo-600 bg-indigo-50 text-indigo-600 scale-110 shadow-md"
            : complete
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-200 bg-white text-slate-300"
        }`}
      >
        {complete ? (
          <CheckCircle2 className="h-6 w-6" />
        ) : (
          <span className="text-lg font-black">{label[0]}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-bold uppercase tracking-wider ${active ? "text-slate-950" : "text-slate-400"}`}>
          {label}
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500 truncate">{detail}</p>
      </div>
    </div>
  );
}

function InlineNote({
  children,
  tone = "sky",
}: {
  children: React.ReactNode;
  tone?: "sky" | "amber";
}) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
        tone === "sky"
          ? "border border-sky-200 bg-sky-50 text-sky-700"
          : "border border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {children}
    </span>
  );
}

function PanelTitle({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm border border-slate-100">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-bold text-slate-950">{title}</p>
        <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function ScanConfirmCard({
  title,
  meta,
  tone,
}: {
  title: string;
  meta: string;
  tone: "sky" | "amber";
}) {
  return (
    <div
      className={`rounded-3xl border px-4 py-4 ${
        tone === "sky" ? "border-sky-200 bg-sky-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2
          className={`mt-0.5 h-5 w-5 ${tone === "sky" ? "text-sky-600" : "text-amber-600"}`}
        />
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function SelectedItemCard({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle: string;
  meta: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-2xl font-black tracking-tight text-slate-950">{title}</p>
      <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{meta}</p>
    </div>
  );
}

function StepButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
    >
      {children}
    </button>
  );
}

function MobileActionBar({
  primaryLabel,
  secondaryLabel,
  primaryTone,
  disablePrimary,
  disableSecondary = false,
  onPrimary,
  onSecondary,
}: {
  primaryLabel: string;
  secondaryLabel: string;
  primaryTone: "sky" | "amber";
  disablePrimary: boolean;
  disableSecondary?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div className="mt-6 lg:mt-5">
      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onSecondary}
            disabled={disableSecondary}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-4 text-base font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 lg:py-3 lg:text-sm"
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={onPrimary}
            disabled={disablePrimary}
            className={`flex-1 rounded-2xl px-4 py-4 text-base font-semibold text-white transition disabled:opacity-60 lg:py-3 lg:text-sm ${
              primaryTone === "sky" ? "bg-sky-600 hover:bg-sky-700" : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="flex min-h-[140px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-4 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
