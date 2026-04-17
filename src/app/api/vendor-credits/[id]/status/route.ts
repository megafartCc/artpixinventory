import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageVendorCredits } from "@/lib/permissions";
import { vendorCreditStatusSchema } from "@/lib/vendor-credit-schemas";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageVendorCredits(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = vendorCreditStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status payload." }, { status: 400 });
  }

  const credit = await prisma.vendorCredit.update({
    where: { id: params.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ data: credit, message: "Vendor credit status updated." });
}
