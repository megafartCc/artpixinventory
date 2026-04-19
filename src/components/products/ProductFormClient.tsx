"use client";

import { startTransition, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, PackagePlus, Upload, X } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { canManageCatalog } from "@/lib/permissions";
import { productUnits } from "@/lib/product-schemas";

type IndexOption = {
  id: string;
  name: string;
};

export type ProductFormState = {
  compoundId: string;
  name: string;
  indexId: string;
  uom: (typeof productUnits)[number];
  barcode: string;
  minStock: string;
  notes: string;
  active: boolean;
  categories: string[];
  categoryInput: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  itemsPerBox: string;
  boxesPerPallet: string;
  itemWeight: string;
  dimensionUnit: string;
  weightUnit: string;
  packagingImageUrl: string;
};

const inputClassName =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

function createInitialState(indexes: IndexOption[], initialValue?: Partial<ProductFormState>) {
  return {
    compoundId: initialValue?.compoundId ?? "",
    name: initialValue?.name ?? "",
    indexId: initialValue?.indexId ?? indexes[0]?.id ?? "",
    uom: initialValue?.uom ?? "pcs",
    barcode: initialValue?.barcode ?? "",
    minStock: initialValue?.minStock ?? "0",
    notes: initialValue?.notes ?? "",
    active: initialValue?.active ?? true,
    categories: initialValue?.categories ?? [],
    categoryInput: "",
    length: initialValue?.length ?? "",
    width: initialValue?.width ?? "",
    height: initialValue?.height ?? "",
    weight: initialValue?.weight ?? "",
    itemsPerBox: initialValue?.itemsPerBox ?? "",
    boxesPerPallet: initialValue?.boxesPerPallet ?? "",
    itemWeight: initialValue?.itemWeight ?? "",
    dimensionUnit: initialValue?.dimensionUnit ?? "in",
    weightUnit: initialValue?.weightUnit ?? "lb",
    packagingImageUrl: initialValue?.packagingImageUrl ?? "",
  } satisfies ProductFormState;
}

export function ProductFormClient({
  locale,
  mode,
  indexes,
  productId,
  initialValue,
}: {
  locale: string;
  mode: "create" | "edit";
  indexes: IndexOption[];
  productId?: string;
  initialValue?: Partial<ProductFormState>;
}) {
  const t = useTranslations("Products");
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManageCatalog(session?.user?.role);
  const [form, setForm] = useState(() => createInitialState(indexes, initialValue));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  useToastFeedback(error, feedback);

  const imagePreview = useMemo(() => form.packagingImageUrl.trim(), [form.packagingImageUrl]);

  const addCategory = (value: string) => {
    const next = value.trim();
    if (!next || form.categories.includes(next)) {
      setForm((current) => ({ ...current, categoryInput: "" }));
      return;
    }

    setForm((current) => ({
      ...current,
      categories: [...current.categories, next],
      categoryInput: "",
    }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManage) {
      return;
    }

    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch(
      mode === "create" ? "/api/products" : `/api/products/${productId}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compoundId: form.compoundId,
          name: form.name,
          indexId: form.indexId,
          uom: form.uom,
          barcode: form.barcode,
          minStock: form.minStock,
          notes: form.notes,
          packagingImageUrl: form.packagingImageUrl,
          categories: form.categories,
          length: form.length,
          width: form.width,
          height: form.height,
          weight: form.weight,
          itemsPerBox: form.itemsPerBox,
          boxesPerPallet: form.boxesPerPallet,
          itemWeight: form.itemWeight,
          dimensionUnit: form.dimensionUnit,
          weightUnit: form.weightUnit,
          active: form.active,
        }),
      }
    );

    const payload = (await response.json()) as {
      error?: string;
      product?: { id: string };
    };

    setSubmitting(false);

    if (!response.ok || !payload.product?.id) {
      setError(payload.error ?? t("feedback.saveFailed"));
      return;
    }

    const nextProductId = payload.product.id;
    setFeedback(mode === "create" ? t("feedback.created") : t("feedback.updated"));
    startTransition(() => {
      router.push(`/${locale}/products/${nextProductId}`);
      router.refresh();
    });
  };

  const handleImageUpload = (file: File | null) => {
    if (!file) {
      setForm((current) => ({ ...current, packagingImageUrl: "" }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        packagingImageUrl: typeof reader.result === "string" ? reader.result : "",
      }));
    };
    reader.readAsDataURL(file);
  };

  if (!canManage) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          {t("errorPermission")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4 sm:p-6 lg:p-8 pb-28 xl:pb-8">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href={`/${locale}/products`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  ←
                </span>
                Back to Products
              </Link>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                {mode === "create" ? t("addProductTitle") : t("editProduct")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                {mode === "create"
                  ? "Create a product record with packaging dimensions, categories, and uploadable packaging art."
                  : "Edit the product record, packaging details, and catalog metadata in one place."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[540px]">
              <MetricCard title="Categories" value={String(form.categories.length)} icon={PackagePlus} />
              <MetricCard title="Active" value={form.active ? "Yes" : "No"} icon={CheckCircle2} />
              <MetricCard
                title="Packaging"
                value={imagePreview ? "Image set" : "No image"}
                icon={Upload}
              />
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-6">
          <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Catalog Details</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label={t("compoundId")}>
                <input
                  value={form.compoundId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, compoundId: event.target.value }))
                  }
                  className={inputClassName}
                  required
                />
              </Field>
              <Field label={t("name")}>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className={inputClassName}
                  required
                />
              </Field>
              <Field label={t("index")}>
                <select
                  value={form.indexId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, indexId: event.target.value }))
                  }
                  className={inputClassName}
                  required
                >
                  {indexes.map((index) => (
                    <option key={index.id} value={index.id}>
                      {index.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("unit")}>
                <select
                  value={form.uom}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      uom: event.target.value as (typeof productUnits)[number],
                    }))
                  }
                  className={inputClassName}
                >
                  {productUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit.toUpperCase()}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("barcode")}>
                <input
                  value={form.barcode}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, barcode: event.target.value }))
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label={t("minStock")}>
                <input
                  value={form.minStock}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, minStock: event.target.value }))
                  }
                  className={inputClassName}
                  inputMode="numeric"
                />
              </Field>
              <div className="xl:col-span-3">
                <Field label={t("categoriesLabel")}>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap gap-2">
                      {form.categories.length ? (
                        form.categories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                categories: current.categories.filter((entry) => entry !== category),
                              }))
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
                          >
                            {category}
                            <X className="h-3 w-3" />
                          </button>
                        ))
                      ) : (
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
                          {t("noCategoriesSelected")}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <input
                        value={form.categoryInput}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, categoryInput: event.target.value }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            addCategory(form.categoryInput);
                          }
                        }}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                        placeholder={t("categoryPlaceholder")}
                      />
                      <button
                        type="button"
                        onClick={() => addCategory(form.categoryInput)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
                      >
                        {t("addCategory")}
                      </button>
                    </div>
                  </div>
                </Field>
              </div>
              <div className="xl:col-span-3">
                <Field label={t("notesLabel")}>
                  <textarea
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className="min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
              </div>
              <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 xl:col-span-3">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, active: event.target.checked }))
                  }
                />
                {t("active")}
              </label>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Packaging</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dimensions, packaging counts, and optional packaging art used for planning and label context.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {form.dimensionUnit || "in"}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {form.weightUnit || "lb"}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Length">
                <input
                  value={form.length}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, length: event.target.value }))
                  }
                  className={inputClassName}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Width">
                <input
                  value={form.width}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, width: event.target.value }))
                  }
                  className={inputClassName}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Height">
                <input
                  value={form.height}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, height: event.target.value }))
                  }
                  className={inputClassName}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Dimension Unit">
                <input
                  value={form.dimensionUnit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dimensionUnit: event.target.value }))
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Weight">
                <input
                  value={form.weight}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, weight: event.target.value }))
                  }
                  className={inputClassName}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Weight Unit">
                <input
                  value={form.weightUnit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, weightUnit: event.target.value }))
                  }
                  className={inputClassName}
                />
              </Field>
              <Field label="Items Per Box">
                <input
                  value={form.itemsPerBox}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, itemsPerBox: event.target.value }))
                  }
                  className={inputClassName}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Boxes Per Pallet">
                <input
                  value={form.boxesPerPallet}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, boxesPerPallet: event.target.value }))
                  }
                  className={inputClassName}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Item Weight">
                <input
                  value={form.itemWeight}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, itemWeight: event.target.value }))
                  }
                  className={inputClassName}
                  inputMode="decimal"
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Packaging Image
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Store a preview image or packaging sheet as a data URL.
                    </p>
                  </div>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, packagingImageUrl: "" }))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-8 text-center transition hover:border-slate-400 hover:bg-slate-50">
                  <Upload className="h-5 w-5 text-slate-500" />
                  <span className="mt-3 text-sm font-semibold text-slate-700">Choose packaging image</span>
                  <span className="mt-1 text-xs text-slate-400">PNG, JPG, or WebP. Stored locally as a data URL.</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleImageUpload(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Preview
                </p>
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Packaging preview"
                    width={1200}
                    height={800}
                    unoptimized
                    className="mt-4 h-64 w-full rounded-[20px] border border-slate-200 object-contain bg-slate-50"
                  />
                ) : (
                  <div className="mt-4 flex h-64 items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
                    No packaging image selected.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Save the record or return to the catalog without submitting changes.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {mode === "create" ? "Create" : "Update"}
              </span>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link
                href={`/${locale}/products`}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t("cancel")}
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "create" ? t("createProduct") : t("saveChanges")}
              </button>
            </div>
          </section>
        </form>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur xl:hidden">
        <div className="mx-auto flex max-w-5xl gap-3">
          <Link
            href={`/${locale}/products`}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-4 text-center text-base font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t("cancel")}
          </Link>
          <button
            type="button"
            onClick={() => {
              const submitButton = document.querySelector<HTMLButtonElement>('button[type="submit"]');
              submitButton?.click();
            }}
            disabled={submitting}
            className="flex-1 rounded-2xl bg-slate-950 px-4 py-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
            {mode === "create" ? t("createProduct") : t("saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {title}
        </p>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
