"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import QRCode from "react-qr-code";
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Power,
  X,
} from "lucide-react";
import { type LocationType } from "@prisma/client";
import {
  LOCATION_HIERARCHY_RULES,
  buildLocationQrCode,
  collectDescendantIds,
  flattenLocationsForSelect,
  locationTypeLabels,
} from "@/lib/location-utils";
import { canManageLocations } from "@/lib/permissions";

type LocationRecord = {
  id: string;
  name: string;
  type: LocationType;
  parentId: string | null;
  qrCode: string | null;
  description: string | null;
  active: boolean;
};

type FormState = {
  name: string;
  type: LocationType;
  parentId: string;
  description: string;
  active: boolean;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

const typeBadgeStyles: Record<LocationType, string> = {
  WAREHOUSE: "bg-slate-900 text-white",
  ZONE: "bg-blue-100 text-blue-700",
  SHELF: "bg-cyan-100 text-cyan-700",
  BIN: "bg-slate-100 text-slate-700",
  PRODUCTION: "bg-amber-100 text-amber-700",
  SHIPPING: "bg-indigo-100 text-indigo-700",
  QUARANTINE: "bg-rose-100 text-rose-700",
  DEFECTIVE: "bg-red-100 text-red-700",
  RECEIVING: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-violet-100 text-violet-700",
};

export function LocationManager({
  locations,
}: {
  locations: LocationRecord[];
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManageLocations(session?.user?.role);
  const [selectedId, setSelectedId] = useState<string | null>(locations[0]?.id ?? null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      locations
        .filter((location) => location.parentId === null)
        .map((location) => [location.id, true])
    )
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    type: "WAREHOUSE",
    parentId: "",
    description: "",
    active: true,
  });
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedLocation =
    locations.find((location) => location.id === selectedId) ?? null;
  const flattenedOptions = useMemo(
    () => flattenLocationsForSelect(locations),
    [locations]
  );
  const selectedLocationAllowedChildren = selectedLocation
    ? LOCATION_HIERARCHY_RULES[selectedLocation.type]
    : [];

  const childCount = (locationId: string) =>
    locations.filter((location) => location.parentId === locationId).length;

  const refresh = () => startTransition(() => router.refresh());

  const availableParentOptions = editingId
    ? flattenedOptions.filter(
        (option) =>
          !collectDescendantIds(locations, editingId).has(option.id) &&
          option.id !== editingId
      )
    : flattenedOptions;

  const resolveAllowedTypes = (parentId: string): LocationType[] => {
    if (!parentId) {
      return ["WAREHOUSE"];
    }

    const parent = locations.find((location) => location.id === parentId);
    return parent ? LOCATION_HIERARCHY_RULES[parent.type] : ["WAREHOUSE"];
  };

  const allowedTypes = resolveAllowedTypes(form.parentId);

  const openCreate = (parentId?: string) => {
    const nextParentId = parentId ?? "";
    const nextAllowedTypes = resolveAllowedTypes(nextParentId);
    setEditingId(null);
    setForm({
      name: "",
      type: nextAllowedTypes[0],
      parentId: nextParentId,
      description: "",
      active: true,
    });
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

  const openEdit = (location: LocationRecord) => {
    setEditingId(location.id);
    setForm({
      name: location.name,
      type: location.type,
      parentId: location.parentId ?? "",
      description: location.description ?? "",
      active: location.active,
    });
    setDrawerOpen(true);
    setError("");
    setFeedback("");
  };

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
      editingId ? `/api/locations/${editingId}` : "/api/locations",
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
    setFeedback(result.message ?? "Location saved.");
    setDrawerOpen(false);
    refresh();
  };

  const toggleActive = async (location: LocationRecord) => {
    const response = await fetch(`/api/locations/${location.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: location.name,
        type: location.type,
        parentId: location.parentId,
        description: location.description ?? "",
        active: !location.active,
      }),
    });

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setError(result.error ?? "Update failed.");
      return;
    }

    setFeedback(result.message ?? "Location updated.");
    refresh();
  };

  const toggleExpand = (locationId: string) => {
    setExpanded((current) => ({ ...current, [locationId]: !current[locationId] }));
  };

  const renderTree = (parentId: string | null = null, depth = 0) => {
    const items = locations
      .filter((location) => location.parentId === parentId)
      .sort((left, right) => left.name.localeCompare(right.name));

    if (items.length === 0) {
      return null;
    }

    return (
      <ul className={`${depth > 0 ? "ml-4 border-l border-slate-200 pl-3" : ""}`}>
        {items.map((location) => {
          const hasChildren = childCount(location.id) > 0;
          const isExpanded = expanded[location.id] ?? depth < 1;
          const isSelected = selectedId === location.id;

          return (
            <li key={location.id} className="py-1">
              <button
                onClick={() => setSelectedId(location.id)}
                className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition ${
                  isSelected
                    ? "bg-indigo-50 text-indigo-700"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    if (hasChildren) {
                      toggleExpand(location.id);
                    }
                  }}
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded ${
                    hasChildren ? "hover:bg-white" : "invisible"
                  }`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{location.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeBadgeStyles[location.type]}`}
                    >
                      {location.type}
                    </span>
                    {!location.active && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Inactive
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-slate-400">
                    {location.qrCode ?? buildLocationQrCode(location.name)}
                  </span>
                </div>
              </button>
              {hasChildren && isExpanded && renderTree(location.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[640px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="w-full max-w-md border-r border-slate-200 bg-slate-50/60">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Location Tree</h2>
            <p className="text-xs text-slate-500">
              Warehouse {"->"} zone {"->"} shelf {"->"} bin
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => openCreate()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Root
            </button>
          )}
        </div>
        <div className="h-full overflow-y-auto p-4">{renderTree()}</div>
      </div>

      <div className="flex-1 bg-white">
        {selectedLocation ? (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-slate-200 px-8 py-6">
              <div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-slate-400" />
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${typeBadgeStyles[selectedLocation.type]}`}
                  >
                    {locationTypeLabels[selectedLocation.type]}
                  </span>
                  {!selectedLocation.active && (
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      Inactive
                    </span>
                  )}
                </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">
                  {selectedLocation.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  {selectedLocation.description || "No location description yet."}
                </p>
              </div>

              {canManage && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(selectedLocation)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  {selectedLocationAllowedChildren.length > 0 && (
                    <button
                      onClick={() => openCreate(selectedLocation.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4" />
                      Add Child
                    </button>
                  )}
                </div>
              )}
            </div>

            {(error || feedback) && (
              <div
                className={`mx-8 mt-6 rounded-xl border px-4 py-3 text-sm ${
                  error
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {error || feedback}
              </div>
            )}

            <div className="grid flex-1 gap-6 p-8 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-lg font-semibold text-slate-900">QR Identity</h2>
                <div className="mt-5 flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <QRCode
                    value={selectedLocation.qrCode ?? buildLocationQrCode(selectedLocation.name)}
                    size={180}
                    style={{ height: "auto", width: "100%", maxWidth: 180 }}
                  />
                  <div className="mt-4 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
                    {selectedLocation.qrCode ?? buildLocationQrCode(selectedLocation.name)}
                  </div>
                </div>
                <div className="mt-6 space-y-3 text-sm text-slate-600">
                  <p>
                    <strong>Children:</strong> {childCount(selectedLocation.id)}
                  </p>
                  <p>
                    <strong>Parent:</strong>{" "}
                    {locations.find(
                      (location) => location.id === selectedLocation.parentId
                    )?.name ?? "Top level"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Management</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {locationTypeLabels[selectedLocation.type]}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {selectedLocation.active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => openEdit(selectedLocation)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit Location
                    </button>
                    <button
                      onClick={() => toggleActive(selectedLocation)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Power className="h-4 w-4" />
                      {selectedLocation.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            Select a location to inspect and manage it.
          </div>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="h-full flex-1 cursor-default"
          />
          <div className="flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingId ? "Edit Location" : "Create Location"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  QR codes are generated automatically from the location name.
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
                  <span>Parent</span>
                  <select
                    value={form.parentId}
                    onChange={(event) => {
                      const nextParentId = event.target.value;
                      const nextAllowedTypes = resolveAllowedTypes(nextParentId);
                      setForm((current) => ({
                        ...current,
                        parentId: nextParentId,
                        type: nextAllowedTypes.includes(current.type)
                          ? current.type
                          : nextAllowedTypes[0],
                      }));
                    }}
                    className={inputClassName}
                  >
                    <option value="">Top level</option>
                    {availableParentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  <span>Type</span>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as LocationType,
                      }))
                    }
                    className={inputClassName}
                  >
                    {allowedTypes.map((type) => (
                      <option key={type} value={type}>
                        {locationTypeLabels[type]}
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {editingId ? "Save Changes" : "Create Location"}
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
