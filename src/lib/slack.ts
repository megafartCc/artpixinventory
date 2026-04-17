import { NotificationType } from "@prisma/client";
import prisma from "@/lib/prisma";

const channelToWebhookEnv: Record<string, string> = {
  "#inventory-alerts": "SLACK_WEBHOOK_INVENTORY_ALERTS",
  "#purchasing": "SLACK_WEBHOOK_PURCHASING",
  "#quality": "SLACK_WEBHOOK_QUALITY",
  "#warehouse-ops": "SLACK_WEBHOOK_WAREHOUSE_OPS",
  "#system-errors": "SLACK_WEBHOOK_SYSTEM_ERRORS",
};

export async function sendSlackNotification(input: {
  type: NotificationType;
  channel: keyof typeof channelToWebhookEnv;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const notification = await prisma.notification.create({
    data: {
      type: input.type,
      channel: input.channel,
      message: input.message,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      sent: false,
    },
  });

  const settingKey = `slack_webhook_${input.channel.replace("#", "").replaceAll("-", "_")}`;
  const setting = await prisma.setting.findUnique({
    where: { key: settingKey },
    select: { value: true },
  });

  const webhookUrl =
    setting?.value || process.env[channelToWebhookEnv[input.channel] as keyof NodeJS.ProcessEnv] || "";

  if (!webhookUrl) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { failCount: { increment: 1 } },
    });
    return { sent: false };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.message }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}`);
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        sent: true,
        sentAt: new Date(),
      },
    });

    return { sent: true };
  } catch (error) {
    console.error("sendSlackNotification failed", error);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { failCount: { increment: 1 } },
    });
    return { sent: false };
  }
}
