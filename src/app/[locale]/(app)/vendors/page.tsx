import { unstable_noStore as noStore } from "next/cache";
import prisma from "@/lib/prisma";
import { VendorsClient } from "@/components/vendors/VendorsClient";

export default async function VendorsPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();

  const [vendors, templates] = await Promise.all([
    prisma.vendor.findMany({
      orderBy: { name: "asc" },
      include: {
        containerTemplate: {
          select: { id: true, name: true },
        },
        _count: {
          select: { products: true, purchaseOrders: true },
        },
      },
    }),
    prisma.containerTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <VendorsClient
      locale={params.locale}
      templates={templates}
      initialVendors={vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        contactName: vendor.contactName,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        country: vendor.country,
        paymentTerms: vendor.paymentTerms,
        defaultLeadTimeDays: vendor.defaultLeadTimeDays,
        enableContainerConstraints: vendor.enableContainerConstraints,
        containerTemplateId: vendor.containerTemplateId,
        containerTemplateName: vendor.containerTemplate?.name ?? null,
        notes: vendor.notes,
        active: vendor.active,
        productCount: vendor._count.products,
        purchaseOrderCount: vendor._count.purchaseOrders,
      }))}
    />
  );
}
