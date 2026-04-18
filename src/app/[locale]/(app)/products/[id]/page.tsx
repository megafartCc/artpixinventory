import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { AlertTriangle, ArrowLeftRight, Boxes, Package, Printer, Receipt, Truck } from "lucide-react";
import prisma from "@/lib/prisma";
import { buildProductLabelZpl } from "@/lib/zpl";

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
    <div className="px-2 py-4 sm:px-3 lg:px-4 xl:px-5">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link
              href={`/${params.locale}/products`}
              className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              Back to Products
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {product.compoundId}
              </h1>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {product.active ? "Active" : "Inactive"}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {product.uom}
              </span>
            </div>
            <p className="mt-2 text-base text-slate-600">{product.name}</p>
            <p className="mt-3 max-w-3xl text-sm text-slate-500">
              Index {product.index.name} with {categoryNames.length || 0} categories, min stock {product.minStock}, and total on-hand quantity {totalStock}.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[520px]">
            <ActionCard
              href={`/${params.locale}/labels?tab=products&product=${product.id}`}
              title="Open label center"
              description="Preload this product in the label workflow."
              icon={Printer}
            />
            <MetricCard title="Total stock" value={String(totalStock)} />
            <MetricCard title="Locations" value={String(product.stockLevels.length)} />
            <MetricCard
              title="Linked defects"
              value={String(product.defectItems.length)}
            />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
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
            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Notes
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {product.notes?.trim() ? product.notes : "No product notes yet."}
              </p>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">Stock by location</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {totalStock} on hand
              </span>
            </div>
            {product.stockLevels.length === 0 ? (
              <EmptyPanel message="No stock is currently assigned to this product." />
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {product.stockLevels.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{row.location.name}</td>
                        <td className="px-4 py-3">{row.location.type}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Vendor pricing history</h2>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {product.vendors.length === 0 ? (
                <div className="lg:col-span-2">
                  <EmptyPanel message="No vendor mappings exist for this product." />
                </div>
              ) : (
                product.vendors.slice(0, 4).map((mapping) => (
                  <div key={mapping.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{mapping.vendor.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {mapping.vendor.country ?? "No country"}{mapping.vendorSku ? ` / SKU ${mapping.vendorSku}` : ""}
                        </p>
                      </div>
                      {mapping.isDefault && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <MiniStat label="Unit cost" value={mapping.unitCost ? formatCurrency(params.locale, mapping.unitCost.toString()) : "-"} />
                      <MiniStat label="MOQ" value={mapping.moq?.toString() ?? "-"} />
                      <MiniStat label="Lead time" value={mapping.leadTimeDays ? `${mapping.leadTimeDays}d` : "-"} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">PO</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Order Date</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {product.poItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                        No purchase-order pricing history yet.
                      </td>
                    </tr>
                  ) : (
                    product.poItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.purchaseOrder.poNumber}</td>
                        <td className="px-4 py-3">{item.purchaseOrder.vendor.name}</td>
                        <td className="px-4 py-3">{formatDate(params.locale, item.purchaseOrder.orderDate)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(params.locale, item.unitCost.toString())}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Recent movements</h2>
            {recentMovements.length === 0 ? (
              <EmptyPanel message="No receiving, transfer, or adjustment history yet." />
            ) : (
              <div className="mt-5 space-y-3">
                {recentMovements.map((movement) => (
                  <div key={movement.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                        <movement.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{movement.title}</p>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {movement.kind}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{movement.detail}</p>
                        <p className="mt-2 text-xs text-slate-400">{formatDate(params.locale, movement.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">Labels</h2>
              <Link
                href={`/${params.locale}/labels?tab=products&product=${product.id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                Open in label center
              </Link>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-[20px] border border-slate-300 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Label preview</p>
                  <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{product.compoundId}</p>
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs font-semibold tracking-[0.3em] text-slate-500">
                    BARCODE
                  </div>
                  <p className="mt-4 text-sm text-slate-600">{product.name}</p>
                </div>
              </div>
              <pre className="max-h-[280px] overflow-auto rounded-[24px] bg-slate-950 p-4 text-xs text-slate-100">
                {productZpl}
              </pre>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">Linked defects</h2>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-600">
                {product.defectItems.length} records
              </span>
            </div>
            {product.defectItems.length === 0 ? (
              <EmptyPanel message="No defect history is linked to this product." />
            ) : (
              <div className="mt-5 space-y-3">
                {product.defectItems.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-rose-600 shadow-sm">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.defectReport.reportNumber}</p>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {item.defectReport.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.quantity} units / {item.reason.name} / {item.reason.faultType}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {item.defectReport.source} / {formatDate(params.locale, item.defectReport.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
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
