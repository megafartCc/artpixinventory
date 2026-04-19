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
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href={`/${locale}/purchase-orders`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-indigo-600"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 group-hover:bg-indigo-50">
                  ←
                </span>
                {t("back")}
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">
                  {purchaseOrder.poNumber}
                </h1>
                <span className={`rounded-2xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest ring-1 ring-inset ${getPoStatusTone(purchaseOrder.status)}`}>
                  {formatPoStatus(purchaseOrder.status)}
                </span>
              </div>
              <p className="mt-3 text-lg text-slate-500 font-medium">
                {purchaseOrder.vendorName}
                {purchaseOrder.vendorCountry ? `, ${purchaseOrder.vendorCountry}` : ""}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:w-[600px]">
              <MetricCard title="Line items" value={String(purchaseOrder.items.length)} icon={ReceiptText} />
              <MetricCard title="Documents" value={String(readiness.documentCount)} icon={FileText} />
              <MetricCard title="Total value" value={`$${purchaseOrder.totalCost}`} icon={ClipboardCheck} />
            </div>
          </div>
        </div>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid gap-6 sm:grid-cols-4">
            <FlowStep label="Draft" detail="Initial revision" state={stepState(purchaseOrder.status, "draft")} />
            <FlowStep label="Approval" detail="Manager signoff" state={stepState(purchaseOrder.status, "approval")} />
            <FlowStep label="Ordered" detail="Sent to vendor" state={stepState(purchaseOrder.status, "ordered")} />
            <FlowStep label="Receiving" detail="Inbound logistics" state={stepState(purchaseOrder.status, "received")} />
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[1fr_400px]">
          <div className="space-y-8">
            <section className="group rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
              <h2 className="text-xl font-bold text-slate-900">{t("summary")}</h2>
              <dl className="mt-8 grid gap-6 sm:grid-cols-2">
                <Info label={t("vendor")} value={purchaseOrder.vendorName} />
                <Info label={t("vendorOrderId")} value={purchaseOrder.vendorOrderId || "-"} />
                <Info label={t("orderDate")} value={purchaseOrder.orderDate} />
                <Info label={t("expectedDate")} value={purchaseOrder.expectedDate || "-"} />
                <Info label={t("createdBy")} value={purchaseOrder.createdBy} />
                <Info label={t("approvedBy")} value={purchaseOrder.approvedBy || "-"} />
                <Info label={t("approvedAt")} value={purchaseOrder.approvedAt || "-"} />
                <Info
                  label={t("metricsLabel")}
                  value={`${purchaseOrder.totalWeightKg ?? "0"} kg / ${purchaseOrder.totalPallets ?? 0} pallets / ${purchaseOrder.totalLooseBoxes ?? 0} boxes`}
                />
              </dl>
              <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{t("notes")}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{purchaseOrder.notes || t("noNotes")}</p>
              </div>
              {purchaseOrder.constraintWarnings.length > 0 && (
                <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50/50 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-amber-900">Constraint Compliance Alerts</p>
                      {purchaseOrder.constraintWarnings.map((warning) => (
                        <p key={warning} className="text-sm text-amber-700">
                          • {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm overflow-hidden">
              <h2 className="text-xl font-bold text-slate-900">{t("lineItems")}</h2>
              <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    <tr>
                      <th className="px-6 py-4">{t("columnProduct")}</th>
                      <th className="px-6 py-4 text-center">{t("columnOrdered")}</th>
                      <th className="px-6 py-4 text-center">{t("columnReceived")}</th>
                      <th className="px-6 py-4 text-right">{t("columnUnitCost")}</th>
                      <th className="px-6 py-4 text-right">{t("columnTotal")}</th>
                      <th className="px-6 py-4">{t("columnNotes")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {purchaseOrder.items.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50/50">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-950">{item.compoundId}</span>
                            <span className="text-xs text-slate-500">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center font-medium">{item.orderedQty}</td>
                        <td className="px-6 py-5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${item.receivedQty >= item.orderedQty ? "bg-emerald-50 text-emerald-600" : item.receivedQty > 0 ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"}`}>
                            {item.receivedQty}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-medium">${item.unitCost}</td>
                        <td className="px-6 py-5 text-right font-bold text-slate-950">${item.totalCost}</td>
                        <td className="px-6 py-5 text-xs text-slate-500 italic max-w-[200px] truncate">{item.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
              <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-slate-900">{t("documents")}</h2>
                  <a
                    href={`/api/purchase-orders/${purchaseOrder.id}/pdf`}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    {t("exportPdf")}
                  </a>
                </div>

                {canManage && (
                  <div className="mt-8 rounded-[28px] border border-slate-100 bg-slate-50/50 p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">Repository Upload</p>
                    <div className="flex flex-wrap gap-2">
                      {documentPresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setLabel(preset)}
                          className={`rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                            label === preset
                              ? "border-slate-900 bg-slate-900 text-white shadow-md"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <div className="mt-6">
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
                      className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-6 py-12 text-center transition ${
                        dragActive
                          ? "border-indigo-400 bg-white"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                        <Upload className="h-6 w-6" />
                      </div>
                      <span className="mt-4 text-sm font-bold text-slate-900">
                        Drop file or browse
                      </span>
                      <span className="mt-1 text-xs text-slate-400">
                        Max 10MB per document
                      </span>
                      <input type="file" onChange={(event) => void handleFileChange(event)} className="hidden" />
                    </label>
                    {fileName && (
                      <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-5 py-4 text-sm font-medium text-indigo-700">
                        Queue: <span className="font-bold">{fileName}</span>
                      </div>
                    )}
                    <button
                      onClick={() => void uploadDocument()}
                      disabled={submitting}
                      className="mt-6 w-full rounded-[20px] bg-slate-950 px-6 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {t("uploadDocument")}
                    </button>
                  </div>
                )}

                <div className="mt-8 space-y-4">
                  {purchaseOrder.documents.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm font-medium text-slate-400">
                      {t("noDocuments")}
                    </div>
                  ) : (
                    purchaseOrder.documents.map((document) => (
                      <div key={document.id} className="group rounded-[24px] border border-slate-100 bg-slate-50/30 p-5 transition hover:bg-white hover:shadow-md">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-950">{document.label}</p>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 ring-1 ring-inset ring-slate-200">
                                {document.uploadedAt}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500 truncate">{document.fileName}</p>
                          </div>
                          <a
                            href={document.fileUrl}
                            download={document.fileName}
                            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            {t("download")}
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">{t("receivingHistory")}</h2>
                {purchaseOrder.receivingSessions.length === 0 ? (
                  <div className="mt-8 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-sm font-medium text-slate-400">
                    {t("noReceivingSessions")}
                  </div>
                ) : (
                  <div className="mt-8 space-y-4">
                    {purchaseOrder.receivingSessions.map((sessionRow) => (
                      <div key={sessionRow.id} className="rounded-[24px] border border-slate-100 bg-slate-50/30 p-5 transition hover:bg-white hover:shadow-md">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className={`text-sm font-bold uppercase tracking-wider ${sessionRow.status === "COMPLETED" ? "text-emerald-600" : "text-blue-600"}`}>{sessionRow.status}</p>
                            <p className="mt-2 text-sm font-medium text-slate-900">Agent: {sessionRow.receivedBy}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {sessionRow.completedAt ? `Closed ${sessionRow.completedAt}` : `Open since ${sessionRow.startedAt}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="mb-8 text-xl font-bold text-slate-900">{t("activityHistory")}</h2>
              <ActivityTimeline entityType="PurchaseOrder" entityId={purchaseOrder.id} />
            </section>
          </div>

          <div className="space-y-8 xl:sticky xl:top-20 xl:self-start">
            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{t("actions")}</h2>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Primary workflow controls for state transition and record maintenance.
              </p>
              <div className="mt-8 grid gap-4">
                {purchaseOrder.status === "DRAFT" && canManage && (
                  <>
                    <Link
                      href={`/${locale}/purchase-orders/${purchaseOrder.id}/edit`}
                      className="rounded-[20px] border border-slate-200 bg-white px-6 py-4 text-center text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-50"
                    >
                      {t("edit")}
                    </Link>
                    <button
                      onClick={() => void runAction("SUBMIT")}
                      disabled={submitting}
                      className="rounded-[20px] bg-slate-950 px-6 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {t("submitApproval")}
                    </button>
                    <button
                      onClick={() => void deleteDraft()}
                      disabled={submitting}
                      className="rounded-[20px] border border-rose-100 bg-rose-50 px-6 py-4 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
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
                        className="rounded-[20px] border border-slate-200 bg-white px-6 py-4 text-center text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-50"
                      >
                        {t("edit")}
                      </Link>
                    )}
                    {canApprove && (
                      <>
                        <button
                          onClick={() => void runAction("APPROVE")}
                          disabled={submitting}
                          className="rounded-[20px] bg-emerald-600 px-6 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {t("approve")}
                        </button>
                        <button
                          onClick={() => void runAction("REJECT")}
                          disabled={submitting}
                          className="rounded-[20px] border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-slate-50 disabled:opacity-60"
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
                    className="rounded-[20px] bg-slate-950 px-6 py-4 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {t("markOrdered")}
                  </button>
                )}

                {purchaseOrder.status === "ORDERED" && (
                  <Link
                    href={`/${locale}/receiving`}
                    className="rounded-[20px] bg-indigo-600 px-6 py-4 text-center text-sm font-bold text-white shadow-lg transition hover:bg-indigo-700"
                  >
                    {t("goToReceiving")}
                  </Link>
                )}

                <button
                  onClick={() => void duplicate()}
                  disabled={submitting}
                  className="rounded-[20px] border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {t("duplicatePo")}
                </button>

                {purchaseOrder.canCancel && canManage && (
                  <button
                    onClick={() => void runAction("CANCEL")}
                    disabled={submitting}
                    className="rounded-[20px] border border-rose-100 bg-rose-50 px-6 py-4 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
                  >
                    {t("cancelPo")}
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Health Monitor</h2>
              <div className="mt-8 grid gap-4">
                <SummaryMetric label="Compliance warnings" value={String(readiness.warningCount)} tone={readiness.warningCount > 0 ? "amber" : "slate"} />
                <SummaryMetric label="Vendor mapped" value={readiness.hasVendorReference ? "Yes" : "No"} tone={readiness.hasVendorReference ? "slate" : "amber"} />
                <SummaryMetric label="Logistics started" value={readiness.hasReceivingStarted ? "Yes" : "No"} tone={readiness.hasReceivingStarted ? "emerald" : "slate"} />
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Financial Summary</h2>
              <div className="mt-8 space-y-4">
                <SummaryRow label={t("subtotal")} value={`$${purchaseOrder.subtotal}`} />
                <SummaryRow label={t("shippingCost")} value={`$${purchaseOrder.shippingCost}`} />
                <SummaryRow label={t("otherCosts")} value={`$${purchaseOrder.otherCosts}`} />
                <div className="pt-4 border-t border-slate-100">
                  <SummaryRow label={t("total")} value={`$${purchaseOrder.totalCost}`} emphasize />
                </div>
              </div>
            </section>
          </div>
        </div>
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
