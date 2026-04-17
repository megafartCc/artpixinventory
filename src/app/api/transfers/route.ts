import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageTransfers } from "@/lib/permissions";
import { transferStartSchema } from "@/lib/transfer-schemas";
import { generateNextReference } from "@/lib/inventory-utils";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageTransfers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = transferStartSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid transfer payload." },
      { status: 400 }
    );
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const reference =
      parsed.data.reference ??
      (await generateNextReference(async (prefix) => {
        const latest = await tx.transfer.findFirst({
          where: { reference: { startsWith: prefix } },
          orderBy: { reference: "desc" },
          select: { reference: true },
        });

        return latest?.reference ?? null;
      }, "TRF"));

    return tx.transfer.create({
      data: {
        reference,
        createdById: session.user.id,
      },
      select: {
        id: true,
        reference: true,
      },
    });
  });

  return NextResponse.json({
    data: transfer,
    message: "Transfer started.",
  });
}
