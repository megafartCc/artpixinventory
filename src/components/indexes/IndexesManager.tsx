"use client";

import { useMemo, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import { canManageCatalog } from "@/lib/permissions";

type IndexRecord = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  productCount: number;
};

type FormState = {
  name: string;
  description: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  active: true,
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

export function IndexesManager({
  initialIndexes,
}: {
  initialIndexes: IndexRecord[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManageCatalog(session?.user?.role);
  const [indexes, setIndexes] = useState(initialIndexes);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [error, setError] = useState<string>("");
  useToastFeedback(error, feedback);

  const filteredIndexes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return indexes;
    }

    return indexes.filter((index) =>
      [index.name, index.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [indexes, query]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

  const openEdit = (index: IndexRecord) => {
    setEditingId(index.id);
    setForm({
      name: index.name,
      description: index.description ?? "",
      active: index.active,
    });
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

  const refreshIndexes = () => startTransition(() => router.refresh());

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch(
      editingId ? `/api/indexes/${editingId}` : "/api/indexes",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );

    const result = (await response.json()) as {
      data?: IndexRecord;
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      setSubmitting(false);
      setError(result.error ?? "Save failed.");
      return;
    }

    setSubmitting(false);
    setFeedback(result.message ?? "Saved.");
    setDrawerOpen(false);
    refreshIndexes();
  };

  const toggleActive = async (index: IndexRecord) => {
    const response = await fetch(`/api/indexes/${index.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: index.name,
        description: index.description ?? "",
        active: !index.active,
      }),
    });

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(result.error ?? "Update failed.");
      return;
    }

    setFeedback(result.message ?? "Index updated.");
    setIndexes((current) =>
      current.map((entry) =>
        entry.id === index.id ? { ...entry, active: !entry.active } : entry
      )
    );
    refreshIndexes();
  };

  const deleteIndex = async (index: IndexRecord) => {
    const confirmed = window.confirm(
      `Delete "${index.name}"? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/indexes/${index.id}`, {
      method: "DELETE",
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(result.error ?? "Delete failed.");
      return;
    }

    setFeedback(result.message ?? "Index deleted.");
    setIndexes((current) => current.filter((entry) => entry.id !== index.id));
    refreshIndexes();
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Indexes</h1>
            <p className="mt-1 text-slate-500">
              Maintain the routing buckets that drive product flow and imports.
            </p>
          </div>
          {canManage && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New Index
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search index name or description"
            className={inputClassName}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredIndexes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-400">
                      No indexes match the current search.
                    </td>
                  </tr>
                ) : (
                  filteredIndexes.map((index) => (
                    <tr key={index.id}>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {index.name}
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        {index.description || "—"}
                      </td>
                      <td className="px-4 py-4">{index.productCount}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            index.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {index.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {canManage ? (
                            <>
                              <button
                                onClick={() => openEdit(index)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => toggleActive(index)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              >
                                <Power className="h-3.5 w-3.5" />
                                {index.active ? "Deactivate" : "Reactivate"}
                              </button>
                              <button
                                onClick={() => deleteIndex(index)}
                                disabled={index.productCount > 0}
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
                  {editingId ? "Edit Index" : "Create Index"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep the product routing list clean and descriptive.
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
                  <span>Name</span>
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {editingId ? "Save Changes" : "Create Index"}
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
