"use client";

import { startTransition, useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, PackagePlus, Pencil, Power, Search, X } from "lucide-react";
import { productUnits } from "@/lib/product-schemas";

type ProductRecord = {
  id: string;
  compoundId: string;
  name: string;
  indexId: string;
  indexName: string;
  categories: string[];
  uom: string;
  minStock: number;
  avgCost: string;
  active: boolean;
  barcode: string | null;
  length: string;
  width: string;
  height: string;
  notes: string;
  dimensionUnit: string;
  updatedAt: string;
};

type Option = {
  id: string;
  name: string;
};

type FormState = {
  compoundId: string;
  name: string;
  indexId: string;
  uom: (typeof productUnits)[number];
  barcode: string;
  minStock: string;
  length: string;
  width: string;
  height: string;
  dimensionUnit: string;
  categories: string[];
  categoryInput: string;
  notes: string;
  active: boolean;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

const createEmptyForm = (indexes: Option[]): FormState => ({
  compoundId: "",
  name: "",
  indexId: indexes[0]?.id ?? "",
  uom: "pcs",
  barcode: "",
  minStock: "0",
  length: "",
  width: "",
  height: "",
  dimensionUnit: "in",
  categories: [],
  categoryInput: "",
  notes: "",
  active: true,
});

const formatDimensions = (product: ProductRecord) =>
  product.length && product.width && product.height
    ? `${product.length} x ${product.width} x ${product.height} ${product.dimensionUnit}`
    : "-";

export function ProductsClient({
  initialProducts,
  indexes,
  categories,
}: {
  initialProducts: ProductRecord[];
  indexes: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "WAREHOUSE";
  const canManageProducts = userRole !== "WAREHOUSE";
  const [search, setSearch] = useState("");
  const [indexFilter, setIndexFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyForm(indexes));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const deferredSearch = useDeferredValue(search);

  let filteredProducts = [...initialProducts];
  if (deferredSearch.trim()) {
    const query = deferredSearch.trim().toLowerCase();
    filteredProducts = filteredProducts.filter((product) =>
      [product.compoundId, product.name, ...product.categories]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }
  if (indexFilter !== "all") {
    filteredProducts = filteredProducts.filter((product) => product.indexId === indexFilter);
  }
  if (categoryFilter !== "all") {
    filteredProducts = filteredProducts.filter((product) => product.categories.includes(categoryFilter));
  }
  if (statusFilter !== "all") {
    filteredProducts = filteredProducts.filter((product) =>
      statusFilter === "active" ? product.active : !product.active
    );
  }
  filteredProducts.sort((left, right) => left.compoundId.localeCompare(right.compoundId));

  const openCreate = () => {
    setEditingProductId(null);
    setForm(createEmptyForm(indexes));
    setErrorMessage("");
    setStatusMessage("");
    setDrawerOpen(true);
  };

  const openEdit = (product: ProductRecord) => {
    const safeUom = productUnits.includes(product.uom as (typeof productUnits)[number])
      ? (product.uom as (typeof productUnits)[number])
      : "pcs";

    setEditingProductId(product.id);
    setForm({
      compoundId: product.compoundId,
      name: product.name,
      indexId: product.indexId,
      uom: safeUom,
      barcode: product.barcode ?? "",
      minStock: String(product.minStock),
      length: product.length,
      width: product.width,
      height: product.height,
      dimensionUnit: product.dimensionUnit,
      categories: [...product.categories],
      categoryInput: "",
      notes: product.notes,
      active: product.active,
    });
    setErrorMessage("");
    setStatusMessage("");
    setDrawerOpen(true);
  };

  const addCategory = (value: string) => {
    const nextValue = value.trim();
    if (!nextValue || form.categories.includes(nextValue)) {
      setForm((current) => ({ ...current, categoryInput: "" }));
      return;
    }
    setForm((current) => ({
      ...current,
      categories: [...current.categories, nextValue],
      categoryInput: "",
    }));
  };

  const submitProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    const response = await fetch(
      editingProductId ? `/api/products/${editingProductId}` : "/api/products",
      {
        method: editingProductId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compoundId: form.compoundId,
          name: form.name,
          indexId: form.indexId,
          uom: form.uom,
          barcode: form.barcode,
          minStock: form.minStock,
          categories: form.categories,
          length: form.length,
          width: form.width,
          height: form.height,
          dimensionUnit: form.dimensionUnit,
          notes: form.notes,
          active: form.active,
        }),
      }
    );

    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setSubmitting(false);
      setErrorMessage(result.error ?? "Product save failed.");
      return;
    }

    setSubmitting(false);
    setStatusMessage(editingProductId ? "Product updated." : "Product created.");
    startTransition(() => router.refresh());
    if (editingProductId) {
      setDrawerOpen(false);
      return;
    }
    setForm(createEmptyForm(indexes));
  };

  const toggleActive = async (product: ProductRecord) => {
    setSubmitting(true);
    setErrorMessage("");
    const response = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compoundId: product.compoundId,
        name: product.name,
        indexId: product.indexId,
        uom: product.uom,
        barcode: product.barcode ?? "",
        minStock: String(product.minStock),
        categories: product.categories,
        length: product.length,
        width: product.width,
        height: product.height,
        dimensionUnit: product.dimensionUnit,
        notes: product.notes,
        active: !product.active,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setSubmitting(false);
    if (!response.ok) {
      setErrorMessage(result.error ?? "Product update failed.");
      return;
    }
    setStatusMessage(product.active ? "Product deactivated." : "Product reactivated.");
    startTransition(() => router.refresh());
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Products</h1>
            <p className="mt-1 text-slate-500">Interactive catalog with live create, edit, and deactivate actions.</p>
          </div>
          {canManageProducts && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
              <PackagePlus className="h-4 w-4" />
              Add Product
            </button>
          )}
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <label className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by SKU, name, or category" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200" />
          </label>
          <select value={indexFilter} onChange={(event) => setIndexFilter(event.target.value)} className={inputClassName}>
            <option value="all">All Indexes</option>
            {indexes.map((index) => <option key={index.id} value={index.id}>{index.name}</option>)}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClassName}>
            <option value="all">All Categories</option>
            {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClassName}>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

        {(errorMessage || statusMessage) && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${errorMessage ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {errorMessage || statusMessage}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Compound ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Index</th>
                  <th className="px-4 py-3">Categories</th>
                  <th className="px-4 py-3">Dimensions</th>
                  <th className="px-4 py-3">UOM</th>
                  <th className="px-4 py-3">Min Stock</th>
                  <th className="px-4 py-3">Avg Cost</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center text-slate-400">No products match the current filters.</td></tr>
                ) : filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-4 font-semibold text-slate-900">{product.compoundId}</td>
                    <td className="px-4 py-4">{product.name}</td>
                    <td className="px-4 py-4">{product.indexName}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {product.categories.length ? product.categories.map((category) => (
                          <span key={`${product.id}-${category}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{category}</span>
                        )) : <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500">{formatDimensions(product)}</td>
                    <td className="px-4 py-4 uppercase">{product.uom}</td>
                    <td className="px-4 py-4">{product.minStock}</td>
                    <td className="px-4 py-4">${product.avgCost}</td>
                    <td className="px-4 py-4">{product.active ? "Yes" : "No"}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {canManageProducts ? (
                          <>
                            <button onClick={() => openEdit(product)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button onClick={() => toggleActive(product)} disabled={submitting} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
                              <Power className="h-3.5 w-3.5" />
                              {product.active ? "Deactivate" : "Reactivate"}
                            </button>
                          </>
                        ) : <span className="text-xs text-slate-400">Read only</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/35">
          <button type="button" onClick={() => setDrawerOpen(false)} className="h-full flex-1 cursor-default" />
          <div className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{editingProductId ? "Edit Product" : "Add Product"}</h2>
                <p className="mt-1 text-sm text-slate-500">Capture SKU, categories, and dimensions in one place.</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitProduct} className="flex min-h-0 flex-1 flex-col">
              <div className="grid flex-1 gap-5 overflow-y-auto px-6 py-5 md:grid-cols-2">
                <Field label="Compound ID"><input value={form.compoundId} onChange={(event) => setForm((current) => ({ ...current, compoundId: event.target.value }))} className={inputClassName} required /></Field>
                <Field label="Name"><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClassName} required /></Field>
                <Field label="Index"><select value={form.indexId} onChange={(event) => setForm((current) => ({ ...current, indexId: event.target.value }))} className={inputClassName} required>{indexes.map((index) => <option key={index.id} value={index.id}>{index.name}</option>)}</select></Field>
                <Field label="Unit"><select value={form.uom} onChange={(event) => setForm((current) => ({ ...current, uom: event.target.value as (typeof productUnits)[number] }))} className={inputClassName}>{productUnits.map((unit) => <option key={unit} value={unit}>{unit.toUpperCase()}</option>)}</select></Field>
                <Field label="Barcode"><input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} className={inputClassName} /></Field>
                <Field label="Min Stock"><input value={form.minStock} onChange={(event) => setForm((current) => ({ ...current, minStock: event.target.value }))} className={inputClassName} inputMode="numeric" /></Field>
                <Field label="Length"><input value={form.length} onChange={(event) => setForm((current) => ({ ...current, length: event.target.value }))} className={inputClassName} inputMode="decimal" /></Field>
                <Field label="Width"><input value={form.width} onChange={(event) => setForm((current) => ({ ...current, width: event.target.value }))} className={inputClassName} inputMode="decimal" /></Field>
                <Field label="Height"><input value={form.height} onChange={(event) => setForm((current) => ({ ...current, height: event.target.value }))} className={inputClassName} inputMode="decimal" /></Field>
                <Field label="Dimension Unit"><input value={form.dimensionUnit} onChange={(event) => setForm((current) => ({ ...current, dimensionUnit: event.target.value }))} className={inputClassName} /></Field>
                <div className="md:col-span-2">
                  <Field label="Categories">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap gap-2">
                        {form.categories.length ? form.categories.map((category) => (
                          <button key={category} type="button" onClick={() => setForm((current) => ({ ...current, categories: current.categories.filter((entry) => entry !== category) }))} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            {category}
                            <X className="h-3 w-3" />
                          </button>
                        )) : <span className="text-sm text-slate-400">No categories selected yet.</span>}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input value={form.categoryInput} onChange={(event) => setForm((current) => ({ ...current, categoryInput: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addCategory(form.categoryInput); } }} className={inputClassName} placeholder="Type a category and press Enter" />
                        <button type="button" onClick={() => addCategory(form.categoryInput)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Add</button>
                      </div>
                      {categories.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {categories.map((category) => (
                            <button key={category.id} type="button" onClick={() => addCategory(category.name)} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200">
                              {category.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Notes"><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={`${inputClassName} min-h-24 resize-y`} /></Field>
                </div>
              </div>

              <div className="border-t border-slate-200 px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingProductId ? "Save Changes" : "Create Product"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
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
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
