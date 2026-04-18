"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { buildLocationLabelZpl, buildPalletLabelZpl, buildProductLabelZpl } from "@/lib/zpl";

type ProductOption = { id: string; compoundId: string; name: string };
type LocationOption = { id: string; name: string; type: string; qrCode: string };
type PalletOption = { id: string; palletNumber: string; status: string };

const tabButtonClass = "rounded-lg px-3 py-2 text-sm font-medium";

export function LabelsClient({
  products,
  locations,
  pallets,
}: {
  products: ProductOption[];
  locations: LocationOption[];
  pallets: PalletOption[];
}) {
  const t = useTranslations("Labels");
  const [tab, setTab] = useState<"products" | "locations" | "pallets">("products");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productQty, setProductQty] = useState<Record<string, string>>({});
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedPalletId, setSelectedPalletId] = useState("");

  const productZpl = useMemo(() => {
    const labels: string[] = [];
    for (const productId of selectedProductIds) {
      const product = products.find((entry) => entry.id === productId);
      if (!product) continue;
      const qty = Math.max(1, Number(productQty[productId]) || 1);
      for (let i = 0; i < qty; i += 1) {
        labels.push(buildProductLabelZpl({ compoundId: product.compoundId, productName: product.name }));
      }
    }
    return labels.join("\n\n");
  }, [selectedProductIds, productQty, products]);

  const locationZpl = useMemo(() => {
    return selectedLocationIds
      .map((locationId) => locations.find((entry) => entry.id === locationId))
      .filter(Boolean)
      .map((location) =>
        buildLocationLabelZpl({
          qrCode: location!.qrCode,
          locationName: location!.name,
          locationType: location!.type,
        })
      )
      .join("\n\n");
  }, [locations, selectedLocationIds]);

  const palletZpl = useMemo(() => {
    const pallet = pallets.find((entry) => entry.id === selectedPalletId);
    if (!pallet) return "";
    return buildPalletLabelZpl({ palletNumber: pallet.palletNumber, palletId: pallet.id });
  }, [pallets, selectedPalletId]);

  const previewZpl = tab === "products" ? productZpl : tab === "locations" ? locationZpl : palletZpl;

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-slate-500">{t("subtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("products")}
            className={`${tabButtonClass} ${tab === "products" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {t("tabs.products")}
          </button>
          <button
            onClick={() => setTab("locations")}
            className={`${tabButtonClass} ${tab === "locations" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {t("tabs.locations")}
          </button>
          <button
            onClick={() => setTab("pallets")}
            className={`${tabButtonClass} ${tab === "pallets" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            {t("tabs.pallets")}
          </button>
        </div>

        {tab === "products" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">{t("selectProducts")}</p>
            <div className="mt-3 space-y-2">
              {products.map((product) => {
                const checked = selectedProductIds.includes(product.id);
                return (
                  <div key={product.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
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
                    <span className="flex-1 text-sm text-slate-700">{product.compoundId} — {product.name}</span>
                    <input
                      type="number"
                      min={1}
                      value={productQty[product.id] ?? "1"}
                      onChange={(event) => setProductQty((current) => ({ ...current, [product.id]: event.target.value }))}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === "locations" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">{t("selectLocations")}</p>
            <div className="mt-3 space-y-2">
              {locations.map((location) => (
                <label key={location.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
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
                  <span className="text-sm text-slate-700">{location.name} ({location.type})</span>
                  <span className="ml-auto text-xs text-slate-500">{location.qrCode}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "pallets" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">{t("recentPallets")}</p>
            <div className="mt-3 space-y-2">
              {pallets.map((pallet) => (
                <label key={pallet.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <input
                    type="radio"
                    name="pallet"
                    checked={selectedPalletId === pallet.id}
                    onChange={() => setSelectedPalletId(pallet.id)}
                  />
                  <span className="text-sm text-slate-700">{pallet.palletNumber}</span>
                  <span className="ml-auto text-xs text-slate-500">{pallet.status}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{t("previewTitle")}</h2>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(previewZpl)}
              disabled={!previewZpl}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              {t("copyZpl")}
            </button>
          </div>
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
            {previewZpl || t("previewEmpty")}
          </pre>
        </div>
      </div>
    </div>
  );
}
