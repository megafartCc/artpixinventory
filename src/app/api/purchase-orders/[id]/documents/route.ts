import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManagePurchaseOrders } from "@/lib/permissions";
import { purchaseOrderDocumentSchema } from "@/lib/purchase-order-schemas";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManagePurchaseOrders(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (!po) {
    return NextResponse.json(
      { error: "Purchase order not found." },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = purchaseOrderDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid document payload." },
      { status: 400 }
    );
  }

  const document = await prisma.pODocument.create({
    data: {
      purchaseOrderId: params.id,
      label: parsed.data.label,
      fileName: parsed.data.fileName,
      fileUrl: parsed.data.fileUrl,
      fileSize:
        parsed.data.fileSize === null ? null : Number(parsed.data.fileSize),
    },
    select: {
      id: true,
      label: true,
      fileName: true,
      fileUrl: true,
      uploadedAt: true,
    },
  });

  return NextResponse.json({
    data: document,
    message: "Document uploaded.",
  });
}
