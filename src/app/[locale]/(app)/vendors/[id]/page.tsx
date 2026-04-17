import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { VendorDetailClient } from "@/components/vendors/VendorDetailClient";

export default async function VendorDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  noStore();

  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      containerTemplate: {
        select: { id: true, name: true },
      },
      products: {
        orderBy: { product: { compoundId: "asc" } },
        include: {
          product: {
            select: { id: true, compoundId: true, name: true, active: true },
          },
        },
      },
      purchaseOrders: {
        orderBy: { orderDate: "desc" },
        take: 20,
        select: {
          id: true,
          poNumber: true,
          status: true,
          orderDate: true,
          totalCost: true,
        },
      },
    },
  });

  if (!vendor) {
    notFound();
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { compoundId: "asc" },
    select: { id: true, compoundId: true, name: true },
  });

  return (
    <VendorDetailClient
      locale={params.locale}
      vendorId={vendor.id}
      vendorName={vendor.name}
      vendorInfo={{
        country: vendor.country,
        paymentTerms: vendor.paymentTerms,
        defaultLeadTimeDays: vendor.defaultLeadTimeDays,
        contactName: vendor.contactName,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        notes: vendor.notes,
        active: vendor.active,
        containerTemplateName: vendor.containerTemplate?.name ?? null,
        enableContainerConstraints: vendor.enableContainerConstraints,
      }}
      products={products}
      mappings={vendor.products.map((mapping) => ({
        id: mapping.id,
        productId: mapping.product.id,
        compoundId: mapping.product.compoundId,
        productName: mapping.product.name,
        isDefault: mapping.isDefault,
        moq: mapping.moq,
        unitCost: mapping.unitCost?.toString() ?? null,
        leadTimeDays: mapping.leadTimeDays,
        vendorSku: mapping.vendorSku,
        notes: mapping.notes,
      }))}
      purchaseOrders={vendor.purchaseOrders.map((purchaseOrder) => ({
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        status: purchaseOrder.status,
        orderDate: purchaseOrder.orderDate.toLocaleDateString(),
        totalCost: purchaseOrder.totalCost.toString(),
      }))}
    />
  );
}
