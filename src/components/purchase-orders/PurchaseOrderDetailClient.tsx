"use client";

import { ChangeEvent, startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToastFeedback } from "@/hooks/useToastFeedback";
import {
  canApprovePurchaseOrders,
  canManagePurchaseOrders,
} from "@/lib/permissions";
import {
  formatPoStatus,
  getPoStatusTone,
} from "@/lib/purchase-order-utils";
import { ActivityTimeline } from "@/components/ActivityTimeline";

type PurchaseOrderDetail = {
  id: string;
  poNumber: string;
  vendorName: string;
  vendorCountry: string | null;
  vendorOrderId: string | null;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  subtotal: string;
  shippingCost: string;
  otherCosts: string;
  totalCost: string;
  totalWeightKg: string | null;
  totalPallets: number | null;
  totalLooseBoxes: number | null;
  notes: string | null;
  constraintWarnings: string[];
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  canCancel: boolean;
  items: Array<{
    id: string;
    compoundId: string;
    name: string;
    orderedQty: number;
    receivedQty: number;
    unitCost: string;
    totalCost: string;
    notes: string | null;
  }>;
  documents: Array<{
    id: string;
    label: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: string;
  }>;
  receivingSessions: Array<{
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    receivedBy: string;
  }>;
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200";

export function PurchaseOrderDetailClient({
  locale,
  purchaseOrder,
}: {
  locale: string;
  purchaseOrder: PurchaseOrderDetail;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const canManage = canManagePurchaseOrders(session?.user?.role);
  const canApprove = canApprovePurchaseOrders(session?.user?.role);
  const [label, setLabel] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useToastFeedback(error, feedback);

  const refresh = () => startTransition(() => router.refresh());

  const runAction = async (
    action: "SUBMIT" | "APPROVE" | "REJECT" | "MARK_ORDERED" | "CANCEL"
  ) => {
    setSubmitting(true);
    setError("");
    setFeedback("");

    const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Status update failed.");
      return;
    }

    setFeedback(payload.message ?? "Purchase order updated.");
    refresh();
  };

  const duplicate = async () => {
    setSubmitting(true);
    setError("");

    const response = await fetch(
      `/api/purchase-orders/${purchaseOrder.id}/duplicate`,
      {
        method: "POST",
      }
    );
    const payload = (await response.json()) as {
      error?: string;
      data?: { id: string };
      message?: string;
    };
    setSubmitting(false);

    if (!response.ok || !payload.data?.id) {
      setError(payload.error ?? "Duplicate failed.");
      return;
    }

    router.push(`/${locale}/purchase-orders/${payload.data.id}`);
  };

  const deleteDraft = async () => {
    const confirmed = window.confirm("Delete this draft purchase order?");
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Delete failed.");
      return;
    }

    router.push(`/${locale}/purchase-orders`);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });

    setFileUrl(dataUrl);
  };

  const uploadDocument = async () => {
    if (!label || !fileName || !fileUrl) {
      setError("Add a label and choose a file first.");
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(
      `/api/purchase-orders/${purchaseOrder.id}/documents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          fileName,
          fileUrl,
          fileSize: fileUrl.length,
        }),
      }
    );
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Upload failed.");
      return;
    }

    setFeedback(payload.message ?? "Document uploaded.");
    setLabel("");
    setFileName("");
    setFileUrl("");
    refresh();
  };

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href={`/${locale}/purchase-orders`}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Back to Purchase Orders
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">
                {purchaseOrder.poNumber}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${getPoStatusTone(
                  purchaseOrder.status
                )}`}
              >
                {formatPoStatus(purchaseOrder.status)}
              </span>
            </div>
            <p className="mt-1 text-slate-500">
              {purchaseOrder.vendorName}
              {purchaseOrder.vendorCountry ? `, ${purchaseOrder.vendorCountry}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/purchase-orders/${purchaseOrder.id}/pdf`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export PDF
            </a>
            {canManage && (
              <button
                onClick={() => void duplicate()}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Duplicate PO
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">PO Summary</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Info label="Vendor" value={purchaseOrder.vendorName} />
              <Info label="Vendor Order ID" value={purchaseOrder.vendorOrderId || "-"} />
              <Info label="Order Date" value={purchaseOrder.orderDate} />
              <Info label="Expected Date" value={purchaseOrder.expectedDate || "-"} />
              <Info label="Created By" value={purchaseOrder.createdBy} />
              <Info label="Approved By" value={purchaseOrder.approvedBy || "-"} />
              <Info label="Approved At" value={purchaseOrder.approvedAt || "-"} />
              <Info
                label="Weight / Pallets / Loose"
                value={`${purchaseOrder.totalWeightKg ?? "0"} kg / ${
                  purchaseOrder.totalPallets ?? 0
                } / ${purchaseOrder.totalLooseBoxes ?? 0}`}
              />
            </dl>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {purchaseOrder.notes || "No notes."}
              </p>
            </div>
            {purchaseOrder.constraintWarnings.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                <p className="font-semibold">Constraint warnings</p>
                {purchaseOrder.constraintWarnings.map((warning) => (
                  <p key={warning} className="mt-2">
                    {warning}
                  </p>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Status Actions</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {purchaseOrder.status === "DRAFT" && canManage && (
                <>
                  <Link
                    href={`/${locale}/purchase-orders/${purchaseOrder.id}/edit`}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => void runAction("SUBMIT")}
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Submit for Approval
                  </button>
                  <button
                    onClick={() => void deleteDraft()}
                    disabled={submitting}
                    className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </>
              )}
              {purchaseOrder.status === "PENDING_APPROVAL" && (
                <>
                  {canManage && (
                    <Link
                      href={`/${locale}/purchase-orders/${purchaseOrder.id}/edit`}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                  )}
                  {canApprove && (
                    <>
                      <button
                        onClick={() => void runAction("APPROVE")}
                        disabled={submitting}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void runAction("REJECT")}
                        disabled={submitting}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </>
              )}
              {purchaseOrder.status === "APPROVED" && canManage && (
                <button
                  onClick={() => void runAction("MARK_ORDERED")}
                  disabled={submitting}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  Mark as Ordered
                </button>
              )}
              {purchaseOrder.status === "ORDERED" && (
                <Link
                  href={`/${locale}/receiving`}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
                >
                  Go to Receiving
                </Link>
              )}
              {purchaseOrder.canCancel && canManage && (
                <button
                  onClick={() => void runAction("CANCEL")}
                  disabled={submitting}
                  className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  Cancel PO
                </button>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>${purchaseOrder.subtotal}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                <span>Shipping Cost</span>
                <span>${purchaseOrder.shippingCost}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                <span>Other Costs</span>
                <span>${purchaseOrder.otherCosts}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>${purchaseOrder.totalCost}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Line Items</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Ordered</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {purchaseOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">
                          {item.compoundId}
                        </span>
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">{item.orderedQty}</td>
                    <td className="px-4 py-4">{item.receivedQty}</td>
                    <td className="px-4 py-4">${item.unitCost}</td>
                    <td className="px-4 py-4">${item.totalCost}</td>
                    <td className="px-4 py-4">{item.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
            {canManage && (
              <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Label (CI, PL, Invoice)"
                  className={inputClassName}
                />
                <input
                  type="file"
                  onChange={(event) => void handleFileChange(event)}
                  className={inputClassName}
                />
                <button
                  onClick={() => void uploadDocument()}
                  disabled={submitting}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  Upload Document
                </button>
              </div>
            )}
            <div className="mt-5 space-y-3">
              {purchaseOrder.documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                  No documents uploaded yet.
                </div>
              ) : (
                purchaseOrder.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {document.label}
                      </p>
                      <p className="text-sm text-slate-500">{document.fileName}</p>
                    </div>
                    <a
                      href={document.fileUrl}
                      download={document.fileName}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Download
                    </a>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Receiving History</h2>
            {purchaseOrder.receivingSessions.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                No receiving sessions yet.
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3">Completed</th>
                      <th className="px-4 py-3">Received By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {purchaseOrder.receivingSessions.map((sessionRow) => (
                      <tr key={sessionRow.id}>
                        <td className="px-4 py-4">{sessionRow.status}</td>
                        <td className="px-4 py-4">{sessionRow.startedAt}</td>
                        <td className="px-4 py-4">{sessionRow.completedAt || "-"}</td>
                        <td className="px-4 py-4">{sessionRow.receivedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mt-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-5">Activity history</h2>
          <ActivityTimeline entityType="PurchaseOrder" entityId={purchaseOrder.id} />
        </section>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-base font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
