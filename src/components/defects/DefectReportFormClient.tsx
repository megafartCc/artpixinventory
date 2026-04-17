"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

type ProductOption = {
  id: string;
  compoundId: string;
  name: string;
};

type ReasonOption = {
  id: string;
  name: string;
  faultType: string;
};

type LocationOption = {
  id: string;
  name: string;
};

type MachineOption = {
  id: string;
  name: string;
  locationId: string;
};

type DefectLine = {
  productId: string;
  reasonId: string;
  quantity: string;
  notes: string;
};

export function DefectReportFormClient({
  locale,
  products,
  reasons,
  locations,
  machines,
  defaultDefectiveLocationId,
}: {
  locale: string;
  products: ProductOption[];
  reasons: ReasonOption[];
  locations: LocationOption[];
  machines: MachineOption[];
  defaultDefectiveLocationId: string;
}) {
  const t = useTranslations("DefectForm");
  const tc = useTranslations("CommonExtended");
  const router = useRouter();
  const [source, setSource] = useState<"PRE_PRODUCTION" | "PRODUCTION">("PRE_PRODUCTION");
  const [machineId, setMachineId] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [locationId, setLocationId] = useState(defaultDefectiveLocationId);
  const [erpixOrderId, setErpixOrderId] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DefectLine[]>([
    { productId: "", reasonId: "", quantity: "1", notes: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSave = useMemo(
    () =>
      items.length > 0 &&
      items.every((item) => item.productId && item.reasonId && Number(item.quantity) > 0),
    [items]
  );

  const updateItem = (index: number, key: keyof DefectLine, value: string) => {
    setItems((current) => current.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const addItem = () => {
    setItems((current) => [...current, { productId: "", reasonId: "", quantity: "1", notes: "" }]);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, idx) => idx !== index));
  };

  const submit = async () => {
    setSaving(true);
    setError("");

    const response = await fetch("/api/defects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        machineId: source === "PRODUCTION" ? machineId : null,
        fromLocationId: source === "PRE_PRODUCTION" ? fromLocationId : null,
        locationId,
        erpixOrderId,
        operatorName,
        notes,
        items: items.map((item) => ({
          productId: item.productId,
          reasonId: item.reasonId,
          quantity: item.quantity,
          notes: item.notes,
        })),
      }),
    });

    const payload = (await response.json()) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(payload.error ?? t("errors.createFailed"));
      return;
    }

    startTransition(() => router.push(`/${locale}/defects`));
    startTransition(() => router.refresh());
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href={`/${locale}/defects`} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            {t("back")}
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{t("title")}</h1>
          <p className="mt-1 text-slate-500">{t("subtitle")}</p>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">{t("source")}</span>
            <select value={source} onChange={(event) => setSource(event.target.value as typeof source)} className={inputClassName}>
              <option value="PRE_PRODUCTION">{t("sourceOptions.preProduction")}</option>
              <option value="PRODUCTION">{t("sourceOptions.production")}</option>
            </select>
          </label>

          {source === "PRODUCTION" ? (
            <label className="space-y-1 text-sm text-slate-600">
              <span className="font-medium text-slate-700">{t("machine")}</span>
              <select value={machineId} onChange={(event) => setMachineId(event.target.value)} className={inputClassName}>
                <option value="">{t("selectMachine")}</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="space-y-1 text-sm text-slate-600">
              <span className="font-medium text-slate-700">{t("fromLocation")}</span>
              <select value={fromLocationId} onChange={(event) => setFromLocationId(event.target.value)} className={inputClassName}>
                <option value="">{t("selectLocation")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">{t("defectiveLocation")}</span>
            <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className={inputClassName}>
              <option value="">{t("selectLocation")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">{t("erpixOrderId")}</span>
            <input value={erpixOrderId} onChange={(event) => setErpixOrderId(event.target.value)} className={inputClassName} />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">{t("operatorName")}</span>
            <input value={operatorName} onChange={(event) => setOperatorName(event.target.value)} className={inputClassName} />
          </label>

          <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
            <span className="font-medium text-slate-700">{t("notes")}</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={inputClassName} />
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{t("itemsTitle")}</h2>
            <button type="button" onClick={addItem} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {tc("addItem")}
            </button>
          </div>

          {items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-slate-100 p-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <select value={item.productId} onChange={(event) => updateItem(index, "productId", event.target.value)} className={inputClassName}>
                  <option value="">{t("selectProduct")}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.compoundId} — {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <select value={item.reasonId} onChange={(event) => updateItem(index, "reasonId", event.target.value)} className={inputClassName}>
                  <option value="">{t("selectReason")}</option>
                  {reasons.map((reason) => (
                    <option key={reason.id} value={reason.id}>
                      {reason.name} ({t(`faultType.${reason.faultType}` as "faultType.VENDOR")})
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <input type="number" min={1} value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} className={inputClassName} placeholder={t("qty")} />
              </div>
              <div className="md:col-span-2">
                <input value={item.notes} onChange={(event) => updateItem(index, "notes", event.target.value)} className={inputClassName} placeholder={t("itemNotes")} />
              </div>
              <div className="md:col-span-1">
                <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  {tc("remove")}
                </button>
              </div>
            </div>
          ))}
        </div>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="flex justify-end gap-3">
          <Link href={`/${locale}/defects`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {tc("cancel")}
          </Link>
          <button onClick={() => void submit()} disabled={saving || !canSave || (source === "PRE_PRODUCTION" && !fromLocationId) || (source === "PRODUCTION" && !machineId)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
            {saving ? t("submitting") : t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
