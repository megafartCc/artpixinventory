"use client";

import { useMemo, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { collectDescendantIds } from "@/lib/location-utils";
import { canManageCatalog } from "@/lib/permissions";

type CategoryRecord = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  active: boolean;
  productCount: number;
  childCount: number;
};

type CategoryTreeRow = CategoryRecord & {
  depth: number;
};

type FormState = {
  name: string;
  description: string;
  parentId: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  parentId: "",
  active: true,
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

function flattenCategories(categories: CategoryRecord[]) {
  const byParent = new Map<string | null, CategoryRecord[]>();
  for (const category of categories) {
    const bucket = byParent.get(category.parentId) ?? [];
    bucket.push(category);
    byParent.set(category.parentId, bucket);
  }

  for (const siblings of Array.from(byParent.values())) {
    siblings.sort((left, right) => left.name.localeCompare(right.name));
  }

  const flattened: CategoryTreeRow[] = [];
  const visit = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) ?? [];
    for (const child of children) {
      flattened.push({ ...child, depth });
      visit(child.id, depth + 1);
    }
  };

  visit(null, 0);
  return flattened;
}

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories: CategoryRecord[];
}) {
  const t = useTranslations("Categories");
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManageCatalog(session?.user?.role);
  const [categories, setCategories] = useState(initialCategories);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  useToastFeedback(error, feedback);

  const flattenedCategories = useMemo(
    () => flattenCategories(categories),
    [categories]
  );

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return flattenedCategories;
    }

    return flattenedCategories.filter((category) =>
      [category.name, category.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [flattenedCategories, query]);

  const refresh = () => startTransition(() => router.refresh());

  const openCreate = (parentId?: string) => {
    setEditingId(null);
    setForm({ ...emptyForm, parentId: parentId ?? "" });
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

  const openEdit = (category: CategoryRecord) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      description: category.description ?? "",
      parentId: category.parentId ?? "",
      active: category.active,
    });
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

  const disallowedParentIds = editingId
    ? collectDescendantIds(categories, editingId)
    : new Set<string>();
  if (editingId) {
    disallowedParentIds.add(editingId);
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFeedback("");

    const payload = {
      ...form,
      parentId: form.parentId || null,
    };

    const response = await fetch(
      editingId ? `/api/categories/${editingId}` : "/api/categories",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setSubmitting(false);
      setError(result.error ?? "Save failed.");
      return;
    }

    setSubmitting(false);
    setFeedback(result.message ?? "Category saved.");
    setDrawerOpen(false);
    refresh();
  };

  const toggleActive = async (category: CategoryRecord) => {
    const response = await fetch(`/api/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: category.name,
        description: category.description ?? "",
        parentId: category.parentId,
        active: !category.active,
      }),
    });

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(result.error ?? "Update failed.");
      return;
    }

    setFeedback(result.message ?? "Category updated.");
    setCategories((current) =>
      current.map((entry) =>
        entry.id === category.id ? { ...entry, active: !entry.active } : entry
      )
    );
    refresh();
  };

  const deleteCategory = async (category: CategoryRecord) => {
    const confirmed = window.confirm(
      `Delete "${category.name}"? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/categories/${category.id}`, {
      method: "DELETE",
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(result.error ?? "Delete failed.");
      return;
    }

    setFeedback(result.message ?? "Category deleted.");
    setCategories((current) =>
      current.filter((entry) => entry.id !== category.id)
    );
    refresh();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
            <p className="mt-1 text-slate-500">
              {t("subtitle")}
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => openCreate()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              {t("newCategory")}
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search category name or description"
            className={inputClassName}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Children</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                      {t("noCategories")}
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((category) => (
                    <tr key={category.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${category.depth * 18}px` }}
                        >
                          {category.depth > 0 && (
                            <span className="text-slate-300">↳</span>
                          )}
                          <span>{category.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        {category.description || "—"}
                      </td>
                      <td className="px-4 py-4">{category.productCount}</td>
                      <td className="px-4 py-4">{category.childCount}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            category.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {category.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {canManage ? (
                            <>
                              <button
                                onClick={() => openCreate(category.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Child
                              </button>
                              <button
                                onClick={() => openEdit(category)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {t("edit")}
                              </button>
                              <button
                                onClick={() => toggleActive(category)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <Power className="h-3.5 w-3.5" />
                                {category.active ? "Deactivate" : "Reactivate"}
                              </button>
                              <button
                                onClick={() => deleteCategory(category)}
                                disabled={
                                  category.productCount > 0 || category.childCount > 0
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">Read only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/35">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="h-full flex-1 cursor-default"
          />
          <div className="flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingId ? t("editCategory") : t("createCategory")}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Build a clean parent/child hierarchy for product grouping.
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-1 flex-col">
              <div className="grid flex-1 gap-5 overflow-y-auto px-6 py-5">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>{t("name")}</span>
                  <input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className={inputClassName}
                    required
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>Parent Category</span>
                  <select
                    value={form.parentId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        parentId: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  >
                    <option value="">Top level</option>
                    {flattenedCategories
                      .filter((category) => !disallowedParentIds.has(category.id))
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {`${"  ".repeat(category.depth)}${category.name}`}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>Description</span>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className={`${inputClassName} min-h-28 resize-y`}
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, active: event.target.checked }))
                    }
                  />
                  Active
                </label>
              </div>

              <div className="border-t border-slate-200 px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {editingId ? t("saveChanges") : t("createCategory")}
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
