import { createTransport } from "nodemailer";
import { prisma } from "./db/client.js";
import { storeConfig } from "./config.js";
let stop = false;
process.on("SIGTERM", () => {
  stop = true;
});
process.on("SIGINT", () => {
  stop = true;
});
async function run() {
  if (!process.env.SMTP_HOST) {
    console.log("SMTP is not configured. Notifications remain durably queued.");
    await prisma.$disconnect();
    return;
  }
  const transport = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  while (!stop) {
    const rows = await prisma.$queryRaw<
      Array<{ id: string }>
    >`UPDATE "OutboxJob" SET status='PROCESSING',"leaseUntil"=NOW()+INTERVAL '2 minutes',attempts=attempts+1 WHERE id=(SELECT id FROM "OutboxJob" WHERE (status='PENDING' OR (status='PROCESSING' AND "leaseUntil"<NOW())) AND "availableAt"<=NOW() AND attempts<5 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`;
    if (!rows.length) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    const j = await prisma.outboxJob.findUniqueOrThrow({
      where: { id: rows[0].id },
    });
    try {
      const p = j.payload as { to: string; subject: string; text: string };
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? storeConfig.brand.supportEmail,
        ...p,
        messageId: `<${j.id}@${storeConfig.storeId}.invalid>`,
      });
      await prisma.outboxJob.update({
        where: { id: j.id },
        data: { status: "SENT", leaseUntil: null, error: null },
      });
    } catch {
      await prisma.outboxJob.update({
        where: { id: j.id },
        data: {
          status: j.attempts >= 5 ? "FAILED" : "PENDING",
          availableAt: new Date(Date.now() + 2 ** j.attempts * 30000),
          leaseUntil: null,
          error: "SMTP delivery failed; inspect provider configuration",
        },
      });
    }
  }
  await prisma.$disconnect();
}
void run().catch(async () => {
  console.error("Worker failed");
  await prisma.$disconnect();
  process.exitCode = 1;
});
