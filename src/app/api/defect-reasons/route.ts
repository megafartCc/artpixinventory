import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canManageDefects } from "@/lib/permissions";
import { defectReasonSchema } from "@/lib/defect-schemas";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageDefects(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reasons = await prisma.defectReason.findMany({
    where: { active: true },
    orderBy: [{ faultType: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ data: reasons });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageDefects(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = defectReasonSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid defect reason payload." },
      { status: 400 }
    );
  }

  try {
    const reason = await prisma.defectReason.create({
      data: {
        name: parsed.data.name,
        faultType: parsed.data.faultType,
      },
    });

    return NextResponse.json({ data: reason, message: "Defect reason created." });
  } catch (error) {
    console.error("POST /api/defect-reasons failed", error);
    return NextResponse.json({ error: "Failed to create defect reason." }, { status: 500 });
  }
}
