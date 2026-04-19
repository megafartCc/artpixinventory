"use client";

import { ChangeEvent, DragEvent, startTransition, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  ClipboardCheck,
  FileText,
  ReceiptText,
  ShieldCheck,
  Upload,
} from "lucide-react";
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

const documentPresets = ["CI", "PL", "Invoice", "Spec", "Photos"];

function stepState(status: string, step: "draft" | "approval" | "ordered" | "received") {
  if (status === "DRAFT") {
    return step === "draft" ? "active" : "upcoming";
  }

  if (status === "PENDING_APPROVAL") {
    if (step === "draft") return "complete";
    return step === "approval" ? "active" : "upcoming";
  }

  if (status === "APPROVED") {
    if (step === "ordered" || step === "received") return "upcoming";
    return "complete";
  }

  if (status === "ORDERED") {
    if (step === "received") return "upcoming";
    return "complete";
  }

  if (["PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"].includes(status)) {
    return "complete";
  }

  return step === "draft" ? "active" : "upcoming";
}

function readinessIssues(purchaseOrder: PurchaseOrderDetail) {
  const zeroReceived = purchaseOrder.items.every((item) => item.receivedQty === 0);
  return {
    documentCount: purchaseOrder.documents.length,
    warningCount: purchaseOrder.constraintWarnings.length,
    hasVendorReference: Boolean(purchaseOrder.vendorOrderId),
    hasReceivingStarted: !zeroReceived,
  };
}

export function PurchaseOrderDetailClient({
  locale,
  purchaseOrder,
}: {
  locale: string;
  purchaseOrder: PurchaseOrderDetail;
}) {
  const t = useTranslations("PurchaseOrderDetail");
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
  const [dragActive, setDragActive] = useState(false);
  useToastFeedback(error, feedback);

  const readiness = useMemo(() => readinessIssues(purchaseOrder), [purchaseOrder]);

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
      setError(payload.error ?? t("feedback.statusUpdateFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.statusUpdated"));
    refresh();
  };

  const duplicate = async () => {
    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/duplicate`, {
      method: "POST",
    });
    const payload = (await response.json()) as {
      error?: string;
      data?: { id: string };
    };
    setSubmitting(false);

    if (!response.ok || !payload.data?.id) {
      setError(payload.error ?? t("feedback.duplicateFailed"));
      return;
    }

    router.push(`/${locale}/purchase-orders/${payload.data.id}`);
  };

  const deleteDraft = async () => {
    const confirmed = window.confirm(t("confirmDelete"));
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
      setError(payload.error ?? t("feedback.deleteFailed"));
      return;
    }

    router.push(`/${locale}/purchase-orders`);
  };

  const readFile = async (file: File) => {
    setFileName(file.name);

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });

    setFileUrl(dataUrl);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await readFile(file);
  };

  const handleDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    await readFile(file);
  };

  const uploadDocument = async () => {
    if (!label || !fileName || !fileUrl) {
      setError(t("chooseFileFirst"));
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        fileName,
        fileUrl,
        fileSize: fileUrl.length,
      }),
    });
    const payload = (await response.json()) as { error?: string; message?: string };
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? t("feedback.uploadFailed"));
      return;
    }

    setFeedback(payload.message ?? t("feedback.documentUploaded"));
    setLabel("");
    setFileName("");
    setFileUrl("");
    refresh();
  };

  return (
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href={`/${locale}/purchase-orders`}
                className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                {t("back")}
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {purchaseOrder.poNumber}
                </h1>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${getPoStatusTone(purchaseOrder.status)}`}>
                  {formatPoStatus(purchaseOrder.status)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {purchaseOrder.vendorName}
                {purchaseOrder.vendorCountry ? `, ${purchaseOrder.vendorCountry}` : ""}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
              <MetricCard title="Line items" value={String(purchaseOrder.items.length)} icon={ReceiptText} />
              <MetricCard title="Documents" value={String(readiness.documentCount)} icon={FileText} />
              <MetricCard title="Total" value={`$${purchaseOrder.totalCost}`} icon={ClipboardCheck} />
            </div>
          </div>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <FlowStep label="Draft" detail="Create and revise" state={stepState(purchaseOrder.status, "draft")} />
            <FlowStep label="Approval" detail="Manager/admin signoff" state={stepState(purchaseOrder.status, "approval")} />
            <FlowStep label="Ordered" detail="Sent to vendor" state={stepState(purchaseOrder.status, "ordered")} />
            <FlowStep label="Receiving" detail="Inbound and palletized" state={stepState(purchaseOrder.status, "received")} />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">{t("summary")}</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <Info label={t("vendor")} value={purchaseOrder.vendorName} />
                <Info label={t("vendorOrderId")} value={purchaseOrder.vendorOrderId || "-"} />
                <Info label={t("orderDate")} value={purchaseOrder.orderDate} />
                <Info label={t("expectedDate")} value={purchaseOrder.expectedDate || "-"} />
                <Info label={t("createdBy")} value={purchaseOrder.createdBy} />
                <Info label={t("approvedBy")} value={purchaseOrder.approvedBy || "-"} />
                <Info label={t("approvedAt")} value={purchaseOrder.approvedAt || "-"} />
                <Info
                  label={t("metricsLabel")}
                  value={`${purchaseOrder.totalWeightKg ?? "0"} kg / ${purchaseOrder.totalPallets ?? 0} / ${purchaseOrder.totalLooseBoxes ?? 0}`}
                />
              </dl>
              <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("notes")}</p>
                <p className="mt-2 text-sm text-slate-600">{purchaseOrder.notes || t("noNotes")}</p>
              </div>
              {purchaseOrder.constraintWarnings.length > 0 && (
                <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" />
                    <div className="space-y-2">
                      {purchaseOrder.constraintWarnings.map((warning) => (
                        <p key={warning} className="text-sm text-amber-700">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">{t("lineItems")}</h2>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("columnProduct")}</th>
                      <th className="px-4 py-3">{t("columnOrdered")}</th>
                      <th className="px-4 py-3">{t("columnReceived")}</th>
                      <th className="px-4 py-3">{t("columnUnitCost")}</th>
                      <th className="px-4 py-3">{t("columnTotal")}</th>
                      <th className="px-4 py-3">{t("columnNotes")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {purchaseOrder.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">{item.compoundId}</span>
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

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{t("documents")}</h2>
                  <a
                    href={`/api/purchase-orders/${purchaseOrder.id}/pdf`}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {t("exportPdf")}
                  </a>
                </div>

                {canManage && (
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">Upload PO document</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {documentPresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setLabel(preset)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            label === preset
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4">
                      <input
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        placeholder={t("documentLabelPlaceholder")}
                        className={inputClassName}
                      />
                    </div>
                    <label
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(event) => void handleDrop(event)}
                      className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-4 py-8 text-center transition ${
                        dragActive
                          ? "border-slate-900 bg-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      <Upload className="h-6 w-6 text-slate-400" />
                      <span className="mt-3 text-sm font-medium text-slate-700">
                        Drop a file here or click to browse
                      </span>
                      <span className="mt-1 text-xs text-slate-400">
                        Stores one document at a time on this record.
                      </span>
                      <input type="file" onChange={(event) => void handleFileChange(event)} className="hidden" />
                    </label>
                    {fileName && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        Ready to upload: <span className="font-semibold text-slate-900">{fileName}</span>
                      </div>
                    )}
                    <button
                      onClick={() => void uploadDocument()}
                      disabled={submitting}
                      className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {t("uploadDocument")}
                    </button>
                  </div>
                )}

                <div className="mt-5 space-y-3">
                  {purchaseOrder.documents.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                      {t("noDocuments")}
                    </div>
                  ) : (
                    purchaseOrder.documents.map((document) => (
                      <div key={document.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{document.label}</p>
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                {document.uploadedAt}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">{document.fileName}</p>
                          </div>
                          <a
                            href={document.fileUrl}
                            download={document.fileName}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-white"
                          >
                            {t("download")}
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900">{t("receivingHistory")}</h2>
                {purchaseOrder.receivingSessions.length === 0 ? (
                  <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-400">
                    {t("noReceivingSessions")}
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {purchaseOrder.receivingSessions.map((sessionRow) => (
                      <div key={sessionRow.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{sessionRow.status}</p>
                            <p className="mt-1 text-sm text-slate-500">Started {sessionRow.startedAt}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {sessionRow.completedAt ? `Completed ${sessionRow.completedAt}` : "Still open"} / {sessionRow.receivedBy}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="mb-5 text-lg font-semibold text-slate-900">{t("activityHistory")}</h2>
              <ActivityTimeline entityType="PurchaseOrder" entityId={purchaseOrder.id} />
            </section>
          </div>

          <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">{t("actions")}</h2>
              <p className="mt-1 text-sm text-slate-500">
                High-signal action rail for editing, approval, ordering, receiving, and cancellation.
              </p>
              <div className="mt-5 grid gap-3">
                {purchaseOrder.status === "DRAFT" && canManage && (
                  <>
                    <Link
                      href={`/${locale}/purchase-orders/${purchaseOrder.id}/edit`}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      {t("edit")}
                    </Link>
                    <button
                      onClick={() => void runAction("SUBMIT")}
                      disabled={submitting}
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {t("submitApproval")}
                    </button>
                    <button
                      onClick={() => void deleteDraft()}
                      disabled={submitting}
                      className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                    >
                      {t("delete")}
                    </button>
                  </>
                )}

                {purchaseOrder.status === "PENDING_APPROVAL" && (
                  <>
                    {canManage && (
                      <Link
                        href={`/${locale}/purchase-orders/${purchaseOrder.id}/edit`}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {t("edit")}
                      </Link>
                    )}
                    {canApprove && (
                      <>
                        <button
                          onClick={() => void runAction("APPROVE")}
                          disabled={submitting}
                          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {t("approve")}
                        </button>
                        <button
                          onClick={() => void runAction("REJECT")}
                          disabled={submitting}
                          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          {t("reject")}
                        </button>
                      </>
                    )}
                  </>
                )}

                {purchaseOrder.status === "APPROVED" && canManage && (
                  <button
                    onClick={() => void runAction("MARK_ORDERED")}
                    disabled={submitting}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {t("markOrdered")}
                  </button>
                )}

                {purchaseOrder.status === "ORDERED" && (
                  <Link
                    href={`/${locale}/receiving`}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {t("goToReceiving")}
                  </Link>
                )}

                <button
                  onClick={() => void duplicate()}
                  disabled={submitting}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {t("duplicatePo")}
                </button>

                {purchaseOrder.canCancel && canManage && (
                  <button
                    onClick={() => void runAction("CANCEL")}
                    disabled={submitting}
                    className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                  >
                    {t("cancelPo")}
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Approval summary</h2>
              <div className="mt-5 grid gap-3">
                <SummaryMetric label="Constraint warnings" value={String(readiness.warningCount)} tone={readiness.warningCount > 0 ? "amber" : "slate"} />
                <SummaryMetric label="Vendor reference" value={readiness.hasVendorReference ? "Yes" : "No"} tone={readiness.hasVendorReference ? "slate" : "amber"} />
                <SummaryMetric label="Receiving started" value={readiness.hasReceivingStarted ? "Yes" : "No"} tone={readiness.hasReceivingStarted ? "emerald" : "slate"} />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">Cost summary</h2>
              <div className="mt-5 space-y-3">
                <SummaryRow label={t("subtotal")} value={`$${purchaseOrder.subtotal}`} />
                <SummaryRow label={t("shippingCost")} value={`$${purchaseOrder.shippingCost}`} />
                <SummaryRow label={t("otherCosts")} value={`$${purchaseOrder.otherCosts}`} />
                <SummaryRow label={t("total")} value={`$${purchaseOrder.totalCost}`} emphasize />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowStep({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: "active" | "complete" | "upcoming";
}) {
  const tone =
    state === "active"
      ? "border-slate-900 bg-slate-900 text-white"
      : state === "complete"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-500";

  return (
    <div className={`rounded-3xl border px-4 py-4 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-2 text-sm font-medium">{detail}</p>
    </div>
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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "slate" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
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
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-2 text-base font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <p className={`text-sm ${emphasize ? "font-semibold text-slate-900" : "font-medium text-slate-600"}`}>{label}</p>
      <p className={`${emphasize ? "text-lg font-semibold text-slate-900" : "text-sm font-semibold text-slate-900"}`}>{value}</p>
    </div>
  );
}
