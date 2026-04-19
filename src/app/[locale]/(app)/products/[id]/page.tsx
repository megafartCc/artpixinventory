import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getServerSession } from "next-auth";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Boxes,
  Pencil,
  Printer,
  Truck,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageCatalog } from "@/lib/permissions";
import { buildProductLabelZpl } from "@/lib/zpl";
import { ActivityTimeline } from "@/components/ActivityTimeline";

function formatLocale(locale: string) {
  if (locale === "ru") return "ru-RU";
  if (locale === "ua") return "uk-UA";
  return "en-US";
}

function formatDate(locale: string, value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(formatLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatCurrency(locale: string, value: string | number) {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(formatLocale(locale), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export default async function ProductDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  noStore();

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      index: { select: { name: true } },
      categories: {
        include: { category: { select: { name: true } } },
      },
      stockLevels: {
        include: {
          location: { select: { id: true, name: true, type: true } },
        },
        orderBy: [{ quantity: "desc" }, { location: { name: "asc" } }],
      },
      vendors: {
        include: {
          vendor: { select: { id: true, name: true, country: true } },
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      },
      poItems: {
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              orderDate: true,
              status: true,
              vendor: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { purchaseOrder: { orderDate: "desc" } },
        take: 12,
      },
      receivingItems: {
        include: {
          receivingSession: {
            select: {
              id: true,
              completedAt: true,
              startedAt: true,
              location: { select: { name: true } },
              purchaseOrder: { select: { poNumber: true } },
            },
          },
        },
        orderBy: { receivingSession: { startedAt: "desc" } },
        take: 10,
      },
      adjustments: {
        include: {
          location: { select: { name: true } },
          adjustedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      transferPicks: {
        include: {
          fromLocation: { select: { name: true } },
          transfer: { select: { id: true, reference: true, status: true } },
        },
        orderBy: { pickedAt: "desc" },
        take: 8,
      },
      transferDrops: {
        include: {
          toLocation: { select: { name: true } },
          transfer: { select: { id: true, reference: true, status: true } },
        },
        orderBy: { droppedAt: "desc" },
        take: 8,
      },
      defectItems: {
        include: {
          reason: { select: { name: true, faultType: true } },
          defectReport: {
            select: {
              id: true,
              reportNumber: true,
              status: true,
              source: true,
              createdAt: true,
            },
          },
        },
        orderBy: { defectReport: { createdAt: "desc" } },
        take: 12,
      },
    },
  });

  if (!product) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const canEditProduct = canManageCatalog(session?.user?.role);
  const totalStock = product.stockLevels.reduce((sum, row) => sum + row.quantity, 0);
  const categoryNames = product.categories.map((entry) => entry.category.name);
  const productZpl = buildProductLabelZpl({
    compoundId: product.compoundId,
    productName: product.name,
  });

  const recentMovements = [
    ...product.receivingItems.map((item) => ({
      id: `receipt-${item.id}`,
      kind: "Receipt",
      icon: Truck,
      title: `${item.receivedQty} units received`,
      detail: `${item.receivingSession.purchaseOrder.poNumber} into ${item.receivingSession.location.name}`,
      timestamp: item.receivingSession.completedAt ?? item.receivingSession.startedAt,
    })),
    ...product.adjustments.map((item) => ({
      id: `adjustment-${item.id}`,
      kind: "Adjustment",
      icon: Boxes,
      title: `${item.previousQty} to ${item.newQty}`,
      detail: `${item.reason} at ${item.location.name} by ${item.adjustedBy.name}`,
      timestamp: item.createdAt,
    })),
    ...product.transferPicks.map((item) => ({
      id: `pick-${item.id}`,
      kind: "Transfer out",
      icon: ArrowLeftRight,
      title: `${item.quantity} units picked`,
      detail: `${item.transfer.reference} from ${item.fromLocation.name}`,
      timestamp: item.pickedAt,
    })),
    ...product.transferDrops.map((item) => ({
      id: `drop-${item.id}`,
      kind: "Transfer in",
      icon: ArrowLeftRight,
      title: `${item.quantity} units dropped`,
      detail: `${item.transfer.reference} into ${item.toLocation.name}`,
      timestamp: item.droppedAt,
    })),
  ]
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
    .slice(0, 12);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="w-full space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href={`/${params.locale}/products`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-indigo-600"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
                <ArrowLeft className="h-3.5 w-3.5" />
              </span>
              Back to Products
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
                {product.compoundId}
              </h1>
              <span
                className={`rounded-2xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest ${
                  product.active
                    ? "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200"
                    : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {product.active ? "Active" : "Inactive"}
              </span>
              <span className="rounded-2xl bg-blue-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-600 ring-1 ring-inset ring-blue-200">
                {product.uom}
              </span>
            </div>
            <p className="mt-3 text-lg font-medium text-slate-600">{product.name}</p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-500">
              Part of Index <span className="font-semibold text-slate-900">{product.index.name}</span> with{" "}
              {categoryNames.length || 0} categories, min stock {product.minStock}, and total on-hand quantity{" "}
              {totalStock}.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {canEditProduct && (
                <Link
                  href={`/${params.locale}/products/${product.id}/edit`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Product
                </Link>
              )}
              <Link
                href={`/${params.locale}/labels?tab=products&product=${product.id}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                Label Center
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:w-[600px]">
            <ActionCard
              href={`/${params.locale}/labels?tab=products&product=${product.id}`}
              title="Label Center"
              description="Preload ZPL workflow"
              icon={Printer}
            />
            <div className="grid grid-cols-3 gap-3">
              <MetricCard title="Stock" value={String(totalStock)} />
              <MetricCard title="Locs" value={String(product.stockLevels.length)} />
              <MetricCard title="Defects" value={String(product.defectItems.length)} />
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <section className="group overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-xl font-bold text-slate-900">Technical Specifications</h2>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2">
              <InfoTile label="Compound ID" value={product.compoundId} />
              <InfoTile label="Barcode" value={product.barcode ?? "Not set"} />
              <InfoTile label="Index" value={product.index.name} />
              <InfoTile label="Min stock" value={String(product.minStock)} />
              <InfoTile label="Average cost" value={formatCurrency(params.locale, product.avgCost.toString())} />
              <InfoTile label="ERPIX ID" value={product.erpixId ?? "Not mapped"} />
              <InfoTile
                label="Dimensions"
                value={
                  product.length && product.width && product.height
                    ? `${product.length} x ${product.width} x ${product.height} ${product.dimensionUnit ?? "in"}`
                    : "Not set"
                }
              />
              <InfoTile
                label="Categories"
                value={categoryNames.length ? categoryNames.join(", ") : "No categories"}
              />
            </dl>
            <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Operational Notes
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {product.notes?.trim() ? product.notes : "No product notes yet."}
              </p>
            </div>
            {product.packagingImageUrl ? (
              <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition group-hover:bg-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Packaging Image
                </p>
                <Image
                  src={product.packagingImageUrl}
                  alt={`${product.compoundId} packaging preview`}
                  width={1200}
                  height={800}
                  unoptimized
                  className="mt-4 h-64 w-full rounded-2xl border border-slate-200 bg-white object-contain"
                />
              </div>
            ) : null}
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">Real-time Stock Distribution</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                {totalStock} {product.uom}
              </span>
            </div>
            {product.stockLevels.length === 0 ? (
              <EmptyPanel message="No stock is currently assigned to this product." />
            ) : (
              <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Physical Location</th>
                      <th className="px-6 py-4 text-center">Type</th>
                      <th className="px-6 py-4 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {product.stockLevels.map((row) => (
                      <tr key={row.id} className="transition hover:bg-slate-50/50">
                        <td className="px-6 py-5 font-bold text-slate-900">{row.location.name}</td>
                        <td className="px-6 py-5 text-center">
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 ring-1 ring-inset ring-slate-200">
                            {row.location.type}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right font-extrabold text-slate-950">{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.3fr_1fr]">
          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Procurement & Pricing History</h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {product.vendors.length === 0 ? (
                <div className="lg:col-span-2">
                  <EmptyPanel message="No vendor mappings exist for this product." />
                </div>
              ) : (
                product.vendors.slice(0, 4).map((mapping) => (
                  <div
                    key={mapping.id}
                    className="rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 transition hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{mapping.vendor.name}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {mapping.vendor.country ?? "Global"}
                          {mapping.vendorSku ? ` • SKU ${mapping.vendorSku}` : ""}
                        </p>
                      </div>
                      {mapping.isDefault && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 ring-1 ring-inset ring-emerald-200">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-4">
                      <MiniStat
                        label="Unit cost"
                        value={mapping.unitCost ? formatCurrency(params.locale, mapping.unitCost.toString()) : "-"}
                      />
                      <MiniStat label="MOQ" value={mapping.moq?.toString() ?? "-"} />
                      <MiniStat label="Lead" value={mapping.leadTimeDays ? `${mapping.leadTimeDays}d` : "-"} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 overflow-hidden rounded-[24px] border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-6 py-4">PO Ref</th>
                    <th className="px-6 py-4">Source Vendor</th>
                    <th className="px-6 py-4 text-center">Date</th>
                    <th className="px-6 py-4 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {product.poItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center italic text-slate-400">
                        No purchase order history recorded.
                      </td>
                    </tr>
                  ) : (
                    product.poItems.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50/50">
                        <td className="px-6 py-5 font-bold text-slate-950">{item.purchaseOrder.poNumber}</td>
                        <td className="px-6 py-5">{item.purchaseOrder.vendor.name}</td>
                        <td className="px-6 py-5 text-center font-medium text-slate-500">
                          {formatDate(params.locale, item.purchaseOrder.orderDate)}
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-slate-950">
                          {formatCurrency(params.locale, item.unitCost.toString())}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Recent Movements</h2>
            {recentMovements.length === 0 ? (
              <EmptyPanel message="No receiving, transfer, or adjustment history yet." />
            ) : (
              <div className="mt-8 space-y-4">
                {recentMovements.map((movement) => (
                  <div
                    key={movement.id}
                    className="rounded-[24px] border border-slate-100 bg-slate-50/30 p-5 transition hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-700 shadow-sm">
                        <movement.icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-slate-950">{movement.title}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                            {movement.kind}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{movement.detail}</p>
                        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {formatDate(params.locale, movement.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">Labeling Identity</h2>
              <Link
                href={`/${params.locale}/labels?tab=products&product=${product.id}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                ZPL Center
              </Link>
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <div className="rounded-[28px] border border-slate-100 bg-slate-50/50 p-6">
                <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Physical Label Preview
                  </p>
                  <p className="mt-6 text-3xl font-extrabold tracking-tight text-slate-950">
                    {product.compoundId}
                  </p>
                  <div className="mt-6 flex h-16 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">
                    BARCODE
                  </div>
                  <p className="mt-6 truncate text-sm font-medium text-slate-600">{product.name}</p>
                </div>
              </div>
              <div className="relative group">
                <pre className="h-full max-h-[300px] overflow-auto rounded-[28px] bg-slate-950 p-6 font-mono text-[11px] leading-relaxed text-slate-300 scrollbar-hide">
                  {productZpl}
                </pre>
                <div className="absolute right-4 top-4 opacity-0 transition group-hover:opacity-100">
                  <span className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                    ZPL II
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">Quality Exceptions</h2>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  product.defectItems.length > 0
                    ? "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200"
                    : "bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {product.defectItems.length} Incidents
              </span>
            </div>
            {product.defectItems.length === 0 ? (
              <EmptyPanel message="No defect history is linked to this product." />
            ) : (
              <div className="mt-8 space-y-4">
                {product.defectItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-slate-100 bg-slate-50/30 p-5 transition hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white text-rose-600 shadow-sm">
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-slate-950">
                            {item.defectReport.reportNumber}
                          </p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                            {item.defectReport.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          <span className="font-bold text-slate-900">{item.quantity}</span> units •{" "}
                          {item.reason.name}
                        </p>
                        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {item.defectReport.source} • {formatDate(params.locale, item.defectReport.createdAt)}
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
          <h2 className="mb-8 text-xl font-bold text-slate-900">System Activity Audit</h2>
          <ActivityTimeline entityType="Product" entityId={product.id} />
        </section>
      </div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-1 block text-xs text-slate-500">{description}</span>
      </span>
    </Link>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className="mt-2 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="mt-5 flex min-h-[180px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}
