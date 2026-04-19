"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { canManageVendors } from "@/lib/permissions";
import { ActivityTimeline } from "@/components/ActivityTimeline";

type ProductOption = {
  id: string;
  compoundId: string;
  name: string;
};

type ProductMapping = {
  id: string;
  productId: string;
  compoundId: string;
  productName: string;
  isDefault: boolean;
  moq: number | null;
  unitCost: string | null;
  leadTimeDays: number | null;
  vendorSku: string | null;
  notes: string | null;
};

type PurchaseOrderSummary = {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string;
  totalCost: string;
};

type MappingFormState = {
  productId: string;
  productSearch: string;
  isDefault: boolean;
  moq: string;
  unitCost: string;
  leadTimeDays: string;
  vendorSku: string;
  notes: string;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

export function VendorDetailClient({
  locale,
  vendorId,
  vendorName,
  vendorInfo,
  products,
  mappings,
  purchaseOrders,
}: {
  locale: string;
  vendorId: string;
  vendorName: string;
  vendorInfo: {
    country: string | null;
    paymentTerms: string | null;
    defaultLeadTimeDays: number | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    active: boolean;
    containerTemplateName: string | null;
    enableContainerConstraints: boolean;
  };
  products: ProductOption[];
  mappings: ProductMapping[];
  purchaseOrders: PurchaseOrderSummary[];
}) {
  const t = useTranslations("VendorDetail");
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManageVendors(session?.user?.role);
  const [productSearch, setProductSearch] = useState("");
  const [form, setForm] = useState<MappingFormState>({
    productId: "",
    productSearch: "",
    isDefault: false,
    moq: "",
    unitCost: "",
    leadTimeDays: "",
    vendorSku: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useToastFeedback(error, feedback);

  const filteredProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase();
    if (!normalized) {
      return products;
    }

    return products.filter((product) =>
      [product.compoundId, product.name]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [productSearch, products]);

  const refresh = () => startTransition(() => router.refresh());

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch(`/api/vendors/${vendorId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: form.productId,
        isDefault: form.isDefault,
        moq: form.moq,
        unitCost: form.unitCost,
        leadTimeDays: form.leadTimeDays,
        vendorSku: form.vendorSku,
        notes: form.notes,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? t("feedback.saveFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.saved"));
    setForm({
      productId: "",
      productSearch: "",
      isDefault: false,
      moq: "",
      unitCost: "",
      leadTimeDays: "",
      vendorSku: "",
      notes: "",
    });
    setProductSearch("");
    refresh();
  };

  const removeMapping = async (mapping: ProductMapping) => {
    const confirmed = window.confirm(
      t("confirmRemove", { product: mapping.compoundId, vendor: vendorName })
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(
      `/api/vendors/${vendorId}/products/${mapping.id}`,
      { method: "DELETE" }
    );
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? t("feedback.deleteFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.deleted"));
    refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="w-full space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href={`/${locale}/vendors`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-indigo-600"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 group-hover:bg-indigo-50">
                ←
              </span>
              {t("back")}
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
                {vendorName}
              </h1>
              <span
                className={`rounded-2xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest ${
                  vendorInfo.active
                    ? "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200"
                    : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {vendorInfo.active ? t("active") : t("inactive")}
              </span>
            </div>
            <p className="mt-3 text-lg text-slate-500">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href={`/${locale}/container-templates`}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {t("containerTemplates")}
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <section className="group overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-xl font-bold text-slate-900">{t("info")}</h2>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2">
              <InfoCard label={t("country")} value={vendorInfo.country} />
              <InfoCard label={t("paymentTerms")} value={vendorInfo.paymentTerms} />
              <InfoCard
                label={t("leadTime")}
                value={
                  vendorInfo.defaultLeadTimeDays === null
                    ? null
                    : `${vendorInfo.defaultLeadTimeDays} ${t("days")}`
                }
              />
              <InfoCard
                label={t("containerTemplate")}
                value={vendorInfo.containerTemplateName}
              />
              <InfoCard label={t("contact")} value={vendorInfo.contactName} />
              <InfoCard label={t("email")} value={vendorInfo.email} />
              <InfoCard label={t("phone")} value={vendorInfo.phone} />
              <div className="rounded-[24px] border border-slate-100 bg-slate-50/50 p-6">
                <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {t("status")}
                </dt>
                <dd className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900">
                   <span className={`h-2.5 w-2.5 rounded-full ${vendorInfo.active ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "bg-slate-300"}`} />
                  {vendorInfo.active ? t("active") : t("inactive")}
                </dd>
              </div>
            </dl>
            <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {t("address")}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {vendorInfo.address || t("noAddress")}
              </p>
            </div>
            <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {t("notes")}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {vendorInfo.notes || t("noNotes")}
              </p>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">{t("addMapping")}</h2>
            {!canManage ? (
              <div className="mt-8 rounded-[24px] bg-slate-50 p-6 text-center text-sm text-slate-400 italic">
                {t("readOnly")}
              </div>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">{t("searchProduct")}</span>
                    <input
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder={t("filterPlaceholder")}
                      className={inputClassName}
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">{t("product")}</span>
                    <select
                      value={form.productId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          productId: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      required
                    >
                      <option value="">{t("selectProduct")}</option>
                      {filteredProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.compoundId} - {product.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">{t("moq")}</span>
                    <input
                      value={form.moq}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, moq: event.target.value }))
                      }
                      className={inputClassName}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">{t("unitCost")}</span>
                    <input
                      value={form.unitCost}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          unitCost: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      inputMode="decimal"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">{t("leadTimeDays")}</span>
                    <input
                      value={form.leadTimeDays}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          leadTimeDays: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">{t("vendorSku")}</span>
                    <input
                      value={form.vendorSku}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          vendorSku: event.target.value,
                        }))
                      }
                      className={inputClassName}
                    />
                  </label>
                </div>

                <label className="inline-flex items-center gap-3 text-sm font-bold text-slate-700 px-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isDefault: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  {t("defaultMapping")}
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">{t("notes")}</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className={`${inputClassName} min-h-24 resize-y`}
                  />
                </label>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-2xl bg-slate-950 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {submitting ? t("saving") : t("saveMapping")}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">{t("productMapping")}</h2>
          <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-6 py-4">{t("product")}</th>
                  <th className="px-6 py-4 text-center">{t("default")}</th>
                  <th className="px-6 py-4 text-center">{t("moq")}</th>
                  <th className="px-6 py-4 text-center">{t("unitCost")}</th>
                  <th className="px-6 py-4 text-center">{t("leadTime")}</th>
                  <th className="px-6 py-4">{t("vendorSku")}</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-medium">
                      {t("noMappings")}
                    </td>
                  </tr>
                ) : (
                  mappings.map((mapping) => (
                    <tr key={mapping.id} className="transition hover:bg-slate-50/50">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-950">
                            {mapping.compoundId}
                          </span>
                          <span className="text-xs text-slate-500">{mapping.productName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {mapping.isDefault ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 ring-1 ring-inset ring-emerald-200">
                             {t("yes")}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center font-medium">{mapping.moq ?? "-"}</td>
                      <td className="px-6 py-5 text-center font-bold text-slate-950">
                        {mapping.unitCost === null ? "-" : `$${mapping.unitCost}`}
                      </td>
                      <td className="px-6 py-5 text-center font-medium">
                        {mapping.leadTimeDays === null
                          ? "-"
                          : `${mapping.leadTimeDays} ${t("days")}`}
                      </td>
                      <td className="px-6 py-5 font-mono text-xs">{mapping.vendorSku || "-"}</td>
                      <td className="px-6 py-5 text-right">
                        {canManage && (
                          <button
                            onClick={() => void removeMapping(mapping)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("remove")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">{t("poHistory")}</h2>
          {purchaseOrders.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center font-medium text-slate-400">
              {t("noPo")}
            </div>
          ) : (
            <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-6 py-4">{t("poNumber")}</th>
                    <th className="px-6 py-4">{t("status")}</th>
                    <th className="px-6 py-4 text-center">{t("orderDate")}</th>
                    <th className="px-6 py-4 text-right">{t("total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="transition hover:bg-slate-50/50">
                      <td className="px-6 py-5 font-bold text-slate-950">
                        {po.poNumber}
                      </td>
                      <td className="px-6 py-5">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          {po.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center font-medium">{po.orderDate}</td>
                      <td className="px-6 py-5 text-right font-bold text-slate-950">${po.totalCost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-8">{t("activityHistory")}</h2>
          <ActivityTimeline entityType="Vendor" entityId={vendorId} />
        </section>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-base font-semibold text-slate-900">
        {value || "-"}
      </dd>
    </div>
  );
}
