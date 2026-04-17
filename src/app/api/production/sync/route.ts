import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAnyRole } from "@/lib/permissions";
import { runProductionQueueCheck } from "@/jobs/production-queue-check";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasAnyRole(session.user.role, ["ADMIN", "MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runProductionQueueCheck();

    return NextResponse.json({
      data: result,
      message: "Production queue sync completed.",
    });
  } catch (error) {
    console.error("POST /api/production/sync failed", error);
    return NextResponse.json({ error: "Failed to sync production queue." }, { status: 500 });
  }
}
