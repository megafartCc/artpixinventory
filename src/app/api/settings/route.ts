import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/permissions";

const editableKeys = [
  "default_receiving_location",
  "po_number_prefix",
  "slack_webhook_inventory_alerts",
  "slack_webhook_purchasing",
  "slack_webhook_quality",
  "slack_webhook_warehouse_ops",
  "slack_webhook_system_errors",
] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessSettings(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.setting.findMany({
    where: { key: { in: editableKeys as unknown as string[] } },
    select: { key: true, value: true },
  });

  return NextResponse.json({ data: settings });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessSettings(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, string>;
  const entries = Object.entries(body).filter(([key]) => editableKeys.includes(key as (typeof editableKeys)[number]));

  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value ?? "") },
      create: { key, value: String(value ?? "") },
    });
  }

  return NextResponse.json({ message: "Settings updated." });
}
