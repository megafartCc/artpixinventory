import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const [
    products,
    purchaseOrders,
    vendors,
    machines,
    locations,
    transfers,
    defects,
    credits,
    counts,
  ] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { compoundId: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, compoundId: true, name: true },
      take: 5,
    }),
    prisma.purchaseOrder.findMany({
      where: { poNumber: { contains: query, mode: "insensitive" } },
      include: { vendor: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.vendor.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, country: true },
      take: 5,
    }),
    prisma.machine.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      include: { location: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.location.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, type: true },
      take: 5,
    }),
    prisma.transfer.findMany({
      where: { reference: { contains: query, mode: "insensitive" } },
      orderBy: { startedAt: "desc" },
      select: { id: true, reference: true, status: true },
      take: 5,
    }),
    prisma.defectReport.findMany({
      where: { reportNumber: { contains: query, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, reportNumber: true, status: true },
      take: 5,
    }),
    prisma.vendorCredit.findMany({
      where: { creditNumber: { contains: query, mode: "insensitive" } },
      include: { vendor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.countSession.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { location: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: { location: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
  ]);

  const items = [
    ...products.map((product) => ({
      id: `product-${product.id}`,
      label: product.compoundId,
      subtitle: `${product.name} / Product`,
      href: `/products/${product.id}`,
      kind: "Product",
    })),
    ...purchaseOrders.map((po) => ({
      id: `po-${po.id}`,
      label: po.poNumber,
      subtitle: `${po.vendor.name} / Purchase Order`,
      href: `/purchase-orders/${po.id}`,
      kind: "Purchase Order",
    })),
    ...vendors.map((vendor) => ({
      id: `vendor-${vendor.id}`,
      label: vendor.name,
      subtitle: `${vendor.country ?? "No country"} / Vendor`,
      href: `/vendors/${vendor.id}`,
      kind: "Vendor",
    })),
    ...machines.map((machine) => ({
      id: `machine-${machine.id}`,
      label: machine.name,
      subtitle: `${machine.location.name} / Machine`,
      href: `/machines/${machine.id}`,
      kind: "Machine",
    })),
    ...locations.map((location) => ({
      id: `location-${location.id}`,
      label: location.name,
      subtitle: `${location.type} / Location`,
      href: `/locations`,
      kind: "Location",
    })),
    ...transfers.map((transfer) => ({
      id: `transfer-${transfer.id}`,
      label: transfer.reference,
      subtitle: `${transfer.status} / Transfer`,
      href: `/transfers/${transfer.id}`,
      kind: "Transfer",
    })),
    ...defects.map((defect) => ({
      id: `defect-${defect.id}`,
      label: defect.reportNumber,
      subtitle: `${defect.status} / Defect report`,
      href: `/defects`,
      kind: "Defect",
    })),
    ...credits.map((credit) => ({
      id: `credit-${credit.id}`,
      label: credit.creditNumber,
      subtitle: `${credit.vendor.name} / Vendor credit`,
      href: `/credits/${credit.id}`,
      kind: "Vendor Credit",
    })),
    ...counts.map((count) => ({
      id: `count-${count.id}`,
      label: count.name,
      subtitle: `${count.location.name} / Inventory count`,
      href: `/counts/${count.id}`,
      kind: "Count",
    })),
  ].slice(0, 16);

  return NextResponse.json({ items });
}
