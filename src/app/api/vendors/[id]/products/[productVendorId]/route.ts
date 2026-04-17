import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageVendors } from "@/lib/permissions";

type RouteContext = {
  params: {
    id: string;
    productVendorId: string;
  };
};

export async function DELETE(_: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageVendors(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mapping = await prisma.productVendor.findFirst({
    where: {
      id: params.productVendorId,
      vendorId: params.id,
    },
    select: { id: true },
  });

  if (!mapping) {
    return NextResponse.json({ error: "Mapping not found." }, { status: 404 });
  }

  await prisma.productVendor.delete({ where: { id: params.productVendorId } });

  return NextResponse.json({ message: "Vendor mapping deleted." });
}
