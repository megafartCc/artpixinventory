"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

const reasonOptions = ["DAMAGED_GOODS", "MISSING_ITEMS", "WRONG_ITEMS", "QUALITY_ISSUE", "OTHER"];

export function VendorCreditFormClient({
  locale,
  vendors,
  products,
  purchaseOrders,
}: {
  locale: string;
  vendors: Array<{ id: string; name: string }>;
  products: Array<{ id: string; compoundId: string; name: string }>;
  purchaseOrders: Array<{ id: string; poNumber: string; vendorId: string }>;
}) {
  const t = useTranslations("Credits");
  const tc = useTranslations("CommonExtended");
  const router = useRouter();
  const [vendorId, setVendorId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [reason, setReason] = useState("QUALITY_ISSUE");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ productId: "", quantity: "1", unitCost: "0", notes: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const vendorPoOptions = purchaseOrders.filter((po) => po.vendorId === vendorId);

  const submit = async () => {
    setSaving(true);
    setError("");

    const response = await fetch("/api/vendor-credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId,
        purchaseOrderId,
        reason,
        notes,
        items,
      }),
    });

    const payload = (await response.json()) as { error?: string };
    setSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to create credit.");
      return;
    }

    router.push(`/${locale}/credits`);
    router.refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href={`/${locale}/credits`} className="text-sm text-slate-500 hover:text-slate-700">{t("detailBack")}</Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{t("newTitle")}</h1>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">{t("vendor")}</span>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputClassName}>
              <option value="">{t("vendor")}</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">{t("linkedPo")}</span>
            <select value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} className={inputClassName}>
              <option value="">None</option>
              {vendorPoOptions.map((po) => (
                <option key={po.id} value={po.id}>{po.poNumber}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">{t("reason")}</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputClassName}>
              {reasonOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
            <span className="font-medium text-slate-700">{t("notes")}</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClassName} />
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{t("lineItems")}</h2>
            <button type="button" onClick={() => setItems((current) => [...current, { productId: "", quantity: "1", unitCost: "0", notes: "" }])} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{tc("addItem")}</button>
          </div>

          {items.map((item, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-12">
              <select value={item.productId} onChange={(e) => setItems((current) => current.map((entry, idx) => idx === index ? { ...entry, productId: e.target.value } : entry))} className={`${inputClassName} md:col-span-5`}>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.compoundId} — {product.name}</option>
                ))}
              </select>
              <input type="number" min={1} value={item.quantity} onChange={(e) => setItems((current) => current.map((entry, idx) => idx === index ? { ...entry, quantity: e.target.value } : entry))} className={`${inputClassName} md:col-span-2`} placeholder="Qty" />
              <input type="number" min={0.01} step={0.01} value={item.unitCost} onChange={(e) => setItems((current) => current.map((entry, idx) => idx === index ? { ...entry, unitCost: e.target.value } : entry))} className={`${inputClassName} md:col-span-2`} placeholder="Unit Cost" />
              <input value={item.notes} onChange={(e) => setItems((current) => current.map((entry, idx) => idx === index ? { ...entry, notes: e.target.value } : entry))} className={`${inputClassName} md:col-span-2`} placeholder={t("notes")} />
              <button type="button" onClick={() => setItems((current) => current.filter((_, idx) => idx !== index))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-1">{tc("remove")}</button>
            </div>
          ))}
        </div>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="flex justify-end gap-3">
          <Link href={`/${locale}/credits`} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">{tc("cancel")}</Link>
          <button disabled={saving || !vendorId} onClick={() => void submit()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
            {saving ? tc("saving") : t("create")}
          </button>
        </div>
      </div>
    </div>
  );
}
