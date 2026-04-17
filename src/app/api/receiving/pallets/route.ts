import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageReceiving } from "@/lib/permissions";
import { palletCreateSchema } from "@/lib/receiving-schemas";
import { generateNextPalletNumber, buildPalletZpl } from "@/lib/label-utils";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageReceiving(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = palletCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid pallet payload." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receivingSession = await tx.receivingSession.findUnique({
        where: { id: parsed.data.receivingSessionId },
        include: {
          items: {
            select: { productId: true, receivedQty: true },
          },
          pallets: {
            include: {
              items: {
                select: { productId: true, quantity: true },
              },
            },
          },
        },
      });

      if (!receivingSession) {
        throw new Error("Receiving session not found.");
      }

      const availableByProduct = new Map<string, number>();
      for (const item of receivingSession.items) {
        availableByProduct.set(
          item.productId,
          (availableByProduct.get(item.productId) ?? 0) + item.receivedQty
        );
      }

      for (const pallet of receivingSession.pallets) {
        for (const item of pallet.items) {
          availableByProduct.set(
            item.productId,
            (availableByProduct.get(item.productId) ?? 0) - item.quantity
          );
        }
      }

      for (const item of parsed.data.items) {
        const available = availableByProduct.get(item.productId) ?? 0;
        if (item.quantity > available) {
          throw new Error("Pallet quantity exceeds received quantity remaining to palletize.");
        }
      }

      const palletNumber = await generateNextPalletNumber(async (prefix) => {
        const latest = await tx.pallet.findFirst({
          where: { palletNumber: { startsWith: prefix } },
          orderBy: { palletNumber: "desc" },
          select: { palletNumber: true },
        });

        return latest?.palletNumber ?? null;
      });

      const pallet = await tx.pallet.create({
        data: {
          palletNumber,
          receivingSessionId: receivingSession.id,
          status: "READY",
          items: {
            create: parsed.data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  compoundId: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return pallet;
    });

    return NextResponse.json({
      data: {
        id: result.id,
        palletNumber: result.palletNumber,
        zpl: buildPalletZpl({
          palletNumber: result.palletNumber,
          lines: result.items.map(
            (item) => `${item.product.compoundId} x${item.quantity}`
          ),
        }),
      },
      message: "Pallet created.",
    });
  } catch (error) {
    console.error("POST /api/receiving/pallets failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create pallet.",
      },
      { status: 500 }
    );
  }
}
