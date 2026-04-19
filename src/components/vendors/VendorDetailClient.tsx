"use client";

import { startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/${locale}/vendors`}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              {t("back")}
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{vendorName}</h1>
            <p className="mt-1 text-slate-500">
              {t("subtitle")}
            </p>
          </div>
          <Link
            href={`/${locale}/container-templates`}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {t("containerTemplates")}
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("info")}</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
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
              <InfoCard
                label={t("status")}
                value={vendorInfo.active ? t("active") : t("inactive")}
              />
            </dl>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("address")}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {vendorInfo.address || t("noAddress")}
              </p>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("notes")}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {vendorInfo.notes || t("noNotes")}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{t("addMapping")}</h2>
            {!canManage ? (
              <p className="mt-4 text-sm text-slate-400">
                {t("readOnly")}
              </p>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>{t("searchProduct")}</span>
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder={t("filterPlaceholder")}
                    className={inputClassName}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>{t("product")}</span>
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

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span>{t("moq")}</span>
                    <input
                      value={form.moq}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, moq: event.target.value }))
                      }
                      className={inputClassName}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span>{t("unitCost")}</span>
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
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span>{t("leadTimeDays")}</span>
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
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    <span>{t("vendorSku")}</span>
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

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isDefault: event.target.checked,
                      }))
                    }
                  />
                  {t("defaultMapping")}
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>{t("notes")}</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className={`${inputClassName} min-h-24 resize-y`}
                  />
                </label>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {submitting ? t("saving") : t("saveMapping")}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{t("productMapping")}</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("product")}</th>
                  <th className="px-4 py-3">{t("default")}</th>
                  <th className="px-4 py-3">{t("moq")}</th>
                  <th className="px-4 py-3">{t("unitCost")}</th>
                  <th className="px-4 py-3">{t("leadTime")}</th>
                  <th className="px-4 py-3">{t("vendorSku")}</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                      {t("noMappings")}
                    </td>
                  </tr>
                ) : (
                  mappings.map((mapping) => (
                    <tr key={mapping.id}>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {mapping.compoundId}
                          </span>
                          <span>{mapping.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {mapping.isDefault ? t("yes") : t("no")}
                      </td>
                      <td className="px-4 py-4">{mapping.moq ?? "-"}</td>
                      <td className="px-4 py-4">
                        {mapping.unitCost === null ? "-" : `$${mapping.unitCost}`}
                      </td>
                      <td className="px-4 py-4">
                        {mapping.leadTimeDays === null
                          ? "-"
                          : `${mapping.leadTimeDays} ${t("days")}`}
                      </td>
                      <td className="px-4 py-4">{mapping.vendorSku || "-"}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          {canManage && (
                            <button
                              onClick={() => void removeMapping(mapping)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {t("remove")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{t("poHistory")}</h2>
          {purchaseOrders.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
              {t("noPo")}
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{t("poNumber")}</th>
                    <th className="px-4 py-3">{t("status")}</th>
                    <th className="px-4 py-3">{t("orderDate")}</th>
                    <th className="px-4 py-3">{t("total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {po.poNumber}
                      </td>
                      <td className="px-4 py-4">{po.status}</td>
                      <td className="px-4 py-4">{po.orderDate}</td>
                      <td className="px-4 py-4">${po.totalCost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-5">{t("activityHistory")}</h2>
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
