"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard, Copy, Layers3, Package2, Printer, QrCode, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { buildLocationLabelZpl, buildPalletLabelZpl, buildProductLabelZpl } from "@/lib/zpl";
import { sendZplToBrowserPrint } from "@/lib/browser-print";

type ProductOption = { id: string; compoundId: string; name: string };
type LocationOption = { id: string; name: string; type: string; qrCode: string };
type PalletOption = { id: string; palletNumber: string; status: string };
type TabKey = "products" | "locations" | "pallets";
type PresetId = "standard" | "bulk" | "compact" | "warehouse" | "replenishment" | "dock";

type LabelInstance = {
  key: string;
  title: string;
  subtitle: string;
  meta: string;
  zpl: string;
};

type QueueItem = {
  id: string;
  tab: TabKey;
  presetLabel: string;
  title: string;
  labelCount: number;
  createdAt: string;
  zpl: string;
};

const tabButtonClass =
  "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition";

const presetConfig: Record<
  TabKey,
  Array<{ id: PresetId; label: string; description: string; copies: number }>
> = {
  products: [
    { id: "standard", label: "Standard", description: "One label per requested unit.", copies: 1 },
    { id: "bulk", label: "Bulk Run", description: "Double copies for packout and backups.", copies: 2 },
    { id: "compact", label: "Compact", description: "Single-copy quick print preset.", copies: 1 },
  ],
  locations: [
    { id: "warehouse", label: "Warehouse", description: "Two copies for aisle and shelf placement.", copies: 2 },
    { id: "compact", label: "Compact", description: "Single location marker.", copies: 1 },
    { id: "bulk", label: "Reset Set", description: "Four copies for full bin relabeling.", copies: 4 },
  ],
  pallets: [
    { id: "standard", label: "Standard", description: "One pallet label for the current load.", copies: 1 },
    { id: "replenishment", label: "Replenishment", description: "Two copies for staging and floor moves.", copies: 2 },
    { id: "dock", label: "Dock Set", description: "Three copies for inbound dock handling.", copies: 3 },
  ],
};

function buildQueueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function openPrintWindow(title: string, labels: LabelInstance[]) {
  const nextWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
  if (!nextWindow) {
    throw new Error("Print window was blocked.");
  }

  const cards = labels
    .map(
      (label) => `
        <article class="card">
          <div class="eyebrow">${label.meta}</div>
          <h2>${label.title}</h2>
          <div class="barcode">BARCODE</div>
          <p>${label.subtitle}</p>
        </article>
      `
    )
    .join("");

  nextWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1 { font-size: 20px; margin-bottom: 16px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
          .card { border: 1px solid #cbd5e1; border-radius: 20px; padding: 16px; break-inside: avoid; }
          .eyebrow { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b; }
          h2 { margin: 16px 0 12px; font-size: 24px; }
          .barcode {
            border: 1px dashed #94a3b8;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
            font-size: 11px;
            letter-spacing: 0.3em;
            color: #475569;
          }
          p { margin-top: 16px; font-size: 14px; color: #334155; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <section class="grid">${cards}</section>
      </body>
    </html>
  `);
  nextWindow.document.close();
  nextWindow.focus();
  nextWindow.print();
}

export function LabelsClient({
  initialTab = "products",
  initialProductId = "",
  products,
  locations,
  pallets,
}: {
  initialTab?: TabKey;
  initialProductId?: string;
  products: ProductOption[];
  locations: LocationOption[];
  pallets: PalletOption[];
}) {
  const t = useTranslations("Labels");
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    initialProductId ? [initialProductId] : []
  );
  const [productQty, setProductQty] = useState<Record<string, string>>(
    initialProductId ? { [initialProductId]: "1" } : {}
  );
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedPalletId, setSelectedPalletId] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<Record<TabKey, PresetId>>({
    products: "standard",
    locations: "warehouse",
    pallets: "standard",
  });
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [selectionSearch, setSelectionSearch] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  useToastFeedback(errorMessage, feedbackMessage);

  const activePreset =
    presetConfig[tab].find((preset) => preset.id === selectedPreset[tab]) ?? presetConfig[tab][0];

  const currentLabels = useMemo<LabelInstance[]>(() => {
    if (tab === "products") {
      return selectedProductIds.flatMap((productId) => {
        const product = products.find((entry) => entry.id === productId);
        if (!product) return [];

        const requestedQty = Math.max(1, Number(productQty[productId]) || 1);
        const copies = requestedQty * activePreset.copies;

        return Array.from({ length: copies }, (_, index) => ({
          key: `${productId}-${index}`,
          title: product.compoundId,
          subtitle: product.name,
          meta: `${activePreset.label} / Copy ${index + 1} of ${copies}`,
          zpl: buildProductLabelZpl({
            compoundId: product.compoundId,
            productName: product.name,
          }),
        }));
      });
    }

    if (tab === "locations") {
      return selectedLocationIds.flatMap((locationId) => {
        const location = locations.find((entry) => entry.id === locationId);
        if (!location) return [];

        return Array.from({ length: activePreset.copies }, (_, index) => ({
          key: `${locationId}-${index}`,
          title: location.name,
          subtitle: location.type,
          meta: `${location.qrCode} / Copy ${index + 1} of ${activePreset.copies}`,
          zpl: buildLocationLabelZpl({
            qrCode: location.qrCode,
            locationName: location.name,
            locationType: location.type,
          }),
        }));
      });
    }

    const pallet = pallets.find((entry) => entry.id === selectedPalletId);
    if (!pallet) return [];

    return Array.from({ length: activePreset.copies }, (_, index) => ({
      key: `${pallet.id}-${index}`,
      title: pallet.palletNumber,
      subtitle: pallet.status,
      meta: `${activePreset.label} / Copy ${index + 1} of ${activePreset.copies}`,
      zpl: buildPalletLabelZpl({
        palletNumber: pallet.palletNumber,
        palletId: pallet.id,
      }),
    }));
  }, [activePreset, locations, pallets, productQty, products, selectedLocationIds, selectedPalletId, selectedProductIds, tab]);

  const previewZpl = currentLabels.map((label) => label.zpl).join("\n\n");
  const previewCards = currentLabels.slice(0, 6);

  const normalizedSelectionSearch = selectionSearch.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    if (!normalizedSelectionSearch) {
      return products;
    }

    return products.filter((product) =>
      `${product.compoundId} ${product.name}`.toLowerCase().includes(normalizedSelectionSearch)
    );
  }, [normalizedSelectionSearch, products]);

  const filteredLocations = useMemo(() => {
    if (!normalizedSelectionSearch) {
      return locations;
    }

    return locations.filter((location) =>
      `${location.name} ${location.type} ${location.qrCode}`.toLowerCase().includes(normalizedSelectionSearch)
    );
  }, [locations, normalizedSelectionSearch]);

  const filteredPallets = useMemo(() => {
    if (!normalizedSelectionSearch) {
      return pallets;
    }

    return pallets.filter((pallet) =>
      `${pallet.palletNumber} ${pallet.status}`.toLowerCase().includes(normalizedSelectionSearch)
    );
  }, [normalizedSelectionSearch, pallets]);

  const selectionSummary =
    tab === "products"
      ? `${selectedProductIds.length} products selected`
      : tab === "locations"
        ? `${selectedLocationIds.length} locations selected`
        : selectedPalletId
          ? "1 pallet selected"
          : "No pallet selected";

  const handleCopy = async (value: string, message: string) => {
    if (!value) {
      setErrorMessage("Nothing is ready to copy yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setErrorMessage("");
      setFeedbackMessage(message);
    } catch {
      setFeedbackMessage("");
      setErrorMessage("Clipboard copy failed.");
    }
  };

  const addCurrentToQueue = () => {
    if (!currentLabels.length) {
      setErrorMessage("Select at least one label target before queuing.");
      return;
    }

    const summaryTitle =
      tab === "products"
        ? `${selectedProductIds.length} product batches`
        : tab === "locations"
        ? `${selectedLocationIds.length} location batches`
          : "Pallet batch";

    setQueueItems((current) => [
      {
        id: buildQueueId(),
        tab,
        presetLabel: activePreset.label,
        title: summaryTitle,
        labelCount: currentLabels.length,
        createdAt: new Date().toLocaleTimeString(),
        zpl: previewZpl,
      },
      ...current,
    ]);
    setErrorMessage("");
    setFeedbackMessage("Current labels added to the batch queue.");
  };

  const copyQueue = async () => {
    const queueZpl = queueItems.map((item) => item.zpl).join("\n\n");
    await handleCopy(queueZpl, "Queued ZPL copied.");
  };

  const printCurrent = () => {
    if (!currentLabels.length) {
      setErrorMessage("Select labels before opening print preview.");
      return;
    }

    try {
      openPrintWindow("Label Preview", currentLabels);
      setErrorMessage("");
      setFeedbackMessage("Print preview opened.");
    } catch (error) {
      setFeedbackMessage("");
      setErrorMessage((error as Error).message);
    }
  };

  const selectionSearchPlaceholder =
    tab === "products"
      ? "Search product labels"
      : tab === "locations"
        ? "Search locations or QR"
        : "Search pallet labels";

  const printQueue = () => {
    const queueLabels = queueItems.flatMap((item) =>
      item.zpl.split("\n\n").map((zpl, index) => ({
        key: `${item.id}-${index}`,
        title: item.title,
        subtitle: item.presetLabel,
        meta: `${item.tab} / queued`,
        zpl,
      }))
    );

    if (!queueLabels.length) {
      setErrorMessage("Queue is empty.");
      return;
    }

    try {
      openPrintWindow("Queued Labels", queueLabels);
      setErrorMessage("");
      setFeedbackMessage("Queued labels opened in print preview.");
    } catch (error) {
      setFeedbackMessage("");
      setErrorMessage((error as Error).message);
    }
  };

  const printCurrentToZebra = async () => {
    if (!previewZpl) {
      setErrorMessage("Select labels before sending to Zebra.");
      return;
    }

    try {
      await sendZplToBrowserPrint(previewZpl);
      setErrorMessage("");
      setFeedbackMessage("Current labels sent to Zebra Browser Print.");
    } catch (error) {
      setFeedbackMessage("");
      setErrorMessage((error as Error).message);
    }
  };

  const printQueueToZebra = async () => {
    const queueZpl = queueItems.map((item) => item.zpl).join("\n\n");
    if (!queueZpl) {
      setErrorMessage("Queue is empty.");
      return;
    }

    try {
      await sendZplToBrowserPrint(queueZpl);
      setErrorMessage("");
      setFeedbackMessage("Queued labels sent to Zebra Browser Print.");
    } catch (error) {
      setFeedbackMessage("");
      setErrorMessage((error as Error).message);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{t("title")}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">{t("subtitle")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                onClick={() => {
                  setTab("products");
                  setSelectionSearch("");
                }}
                className={`${tabButtonClass} ${tab === "products" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
              >
                {t("tabs.products")}
              </button>
              <button
                onClick={() => {
                  setTab("locations");
                  setSelectionSearch("");
                }}
                className={`${tabButtonClass} ${tab === "locations" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
              >
                {t("tabs.locations")}
              </button>
              <button
                onClick={() => {
                  setTab("pallets");
                  setSelectionSearch("");
                }}
                className={`${tabButtonClass} ${tab === "pallets" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
              >
                {t("tabs.pallets")}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Ready labels" value={String(currentLabels.length)} icon={Printer} compact />
          <StatCard title="Queue jobs" value={String(queueItems.length)} icon={Layers3} compact />
          <StatCard title="Preset copies" value={String(activePreset.copies)} icon={Copy} compact />
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <div className="space-y-5">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Selection</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectionSummary}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {activePreset.label}
                </span>
              </div>

              <div className="mt-5 space-y-2">
                <input
                  value={selectionSearch}
                  onChange={(event) => setSelectionSearch(event.target.value)}
                  placeholder={selectionSearchPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                />

                {tab === "products" ? (
                  <>
                    <p className="text-sm text-slate-600">{t("selectProducts")}</p>
                    <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
                      {filteredProducts.length === 0 ? (
                        <EmptyState message="No products match this search." />
                      ) : (
                        filteredProducts.map((product) => {
                          const checked = selectedProductIds.includes(product.id);
                          return (
                            <div key={product.id} className="grid grid-cols-[auto_minmax(0,1fr)_96px] items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    setSelectedProductIds((current) => [...current, product.id]);
                                    setProductQty((current) => ({ ...current, [product.id]: current[product.id] ?? "1" }));
                                  } else {
                                    setSelectedProductIds((current) => current.filter((id) => id !== product.id));
                                  }
                                }}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-slate-800">{product.compoundId}</span>
                                <span className="block truncate text-xs text-slate-500">{product.name}</span>
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={productQty[product.id] ?? "1"}
                                onChange={(event) =>
                                  setProductQty((current) => ({ ...current, [product.id]: event.target.value }))
                                }
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : null}

                {tab === "locations" ? (
                  <>
                    <p className="text-sm text-slate-600">{t("selectLocations")}</p>
                    <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
                      {filteredLocations.length === 0 ? (
                        <EmptyState message="No locations match this search." />
                      ) : (
                        filteredLocations.map((location) => (
                          <label key={location.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedLocationIds.includes(location.id)}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setSelectedLocationIds((current) => [...current, location.id]);
                                } else {
                                  setSelectedLocationIds((current) => current.filter((id) => id !== location.id));
                                }
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-slate-800">{location.name}</span>
                              <span className="block text-xs text-slate-500">{location.type}</span>
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {location.qrCode}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </>
                ) : null}

                {tab === "pallets" ? (
                  <>
                    <p className="text-sm text-slate-600">{t("recentPallets")}</p>
                    <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
                      {filteredPallets.length === 0 ? (
                        <EmptyState message="No pallets match this search." />
                      ) : (
                        filteredPallets.map((pallet) => (
                          <label key={pallet.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-3">
                            <input
                              type="radio"
                              name="pallet"
                              checked={selectedPalletId === pallet.id}
                              onChange={() => setSelectedPalletId(pallet.id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-slate-800">{pallet.palletNumber}</span>
                              <span className="block text-xs text-slate-500">Status {pallet.status}</span>
                            </span>
                            {selectedPalletId === pallet.id ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : null}
                          </label>
                        ))
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Preview thumbnails</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    First {Math.min(previewCards.length, 6)} labels from the current selection.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {currentLabels.length} total
                </span>
              </div>

              {previewCards.length === 0 ? (
                <EmptyState message={t("previewEmpty")} />
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {previewCards.map((label) => (
                    <article key={label.key} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label.meta}</p>
                      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{label.title}</p>
                      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-[11px] font-semibold tracking-[0.3em] text-slate-500">
                        BARCODE
                      </div>
                      <p className="mt-4 text-sm text-slate-600">{label.subtitle}</p>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-[24px] bg-slate-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">ZPL output</h3>
                  <button
                    type="button"
                    onClick={() => void handleCopy(previewZpl, "Current ZPL copied.")}
                    disabled={!previewZpl}
                    className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {t("copyZpl")}
                  </button>
                </div>
                <pre className="mt-3 max-h-96 overflow-auto text-xs text-slate-100">
                  {previewZpl || t("previewEmpty")}
                </pre>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Print presets</h2>
              <div className="mt-5 space-y-3">
                {presetConfig[tab].map((preset) => {
                  const active = preset.id === selectedPreset[tab];
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        setSelectedPreset((current) => ({
                          ...current,
                          [tab]: preset.id,
                        }))
                      }
                      className={`flex w-full items-start gap-3 rounded-3xl border px-4 py-4 text-left transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${active ? "bg-white/10 text-white" : "bg-white text-slate-700 shadow-sm"}`}>
                        {tab === "products" ? <Package2 className="h-4 w-4" /> : tab === "locations" ? <QrCode className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{preset.label}</span>
                        <span className={`mt-1 block text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>
                          {preset.description}
                        </span>
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${active ? "bg-white/10 text-white" : "bg-white text-slate-500"}`}>
                        {preset.copies}x
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="space-y-3">
                  <SummaryRow label="Current preset" value={activePreset.label} />
                  <SummaryRow label="Prepared labels" value={String(currentLabels.length)} />
                  <SummaryRow label="Queue jobs" value={String(queueItems.length)} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ActionButton onClick={() => void handleCopy(previewZpl, "Current ZPL copied.")} icon={Copy}>
                  {t("copyZpl")}
                </ActionButton>
                <ActionButton onClick={addCurrentToQueue} icon={Layers3}>
                  Queue Current
                </ActionButton>
                <ActionButton onClick={() => void printCurrentToZebra()} icon={Printer}>
                  Send to Zebra
                </ActionButton>
                <ActionButton onClick={printCurrent} icon={Printer}>
                  Print Preview
                </ActionButton>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Batch queue</h2>
                  <p className="mt-1 text-sm text-slate-500">Stage multiple print jobs before copying or printing them together.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void printQueueToZebra()}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Send Queue
                  </button>
                  <button
                    type="button"
                    onClick={printQueue}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Print Queue
                  </button>
                  <button
                    type="button"
                    onClick={copyQueue}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Copy Queue ZPL
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueItems([])}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {queueItems.length === 0 ? (
                <EmptyState message="No queued jobs yet." />
              ) : (
                <div className="mt-5 space-y-3">
                  {queueItems.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {item.presetLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.labelCount} labels / queued at {item.createdAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCopy(item.zpl, "Queued job copied.")}
                            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-white hover:text-slate-700"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQueueItems((current) => current.filter((entry) => entry.id !== item.id))}
                            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-white hover:text-slate-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  compact = false,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${compact ? "px-4 py-4" : "px-4 py-5"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={`font-semibold tracking-tight text-slate-900 ${compact ? "mt-3 text-2xl" : "mt-4 text-3xl"}`}>{value}</p>
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

function ActionButton({
  children,
  icon: Icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
