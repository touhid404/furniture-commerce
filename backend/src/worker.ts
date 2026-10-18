import { createTransport } from 'nodemailer';
import { prisma } from './db/client.js';
import { storeConfig } from './config.js';
import { deleteObject } from './services/storage.js';
let stop = false;
process.on('SIGTERM', () => {
  stop = true;
});
process.on('SIGINT', () => {
  stop = true;
});
async function run() {
  if (!process.env.SMTP_HOST) {
    console.log('SMTP is not configured. Notifications remain durably queued.');
  }
  const transport = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  while (!stop) {
    await prisma.outboxJob.updateMany({
      where: { status: 'PROCESSING', attempts: { gte: 5 }, leaseUntil: { lt: new Date() } },
      data: {
        status: 'FAILED',
        leaseUntil: null,
        error: 'Delivery lease expired after maximum attempts',
      },
    });
    const rows = await prisma.$queryRaw<
      Array<{ id: string }>
    >`UPDATE "OutboxJob" SET status='PROCESSING',"leaseUntil"=NOW()+INTERVAL '2 minutes',attempts=attempts+1 WHERE id=(SELECT id FROM "OutboxJob" WHERE (status='PENDING' OR (status='PROCESSING' AND "leaseUntil"<NOW())) AND "availableAt"<=NOW() AND attempts<5 AND (type='DELETE_MEDIA' OR ${!!process.env.SMTP_HOST}) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`;
    if (!rows.length) {
      if (process.env.WORKER_ONCE === 'true') break;
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    const j = await prisma.outboxJob.findUniqueOrThrow({
      where: { id: rows[0].id },
    });
    try {
      if (j.type === 'DELETE_MEDIA') {
        const p = j.payload as { bucket: string; key: string };
        await deleteObject(p.bucket, p.key);
      } else {
        const p = j.payload as { to: string; subject: string; text: string };
        await transport.sendMail({
          from: process.env.SMTP_FROM ?? storeConfig.brand.supportEmail,
          ...p,
          messageId: `<${j.id}@${storeConfig.storeId}.invalid>`,
        });
      }
      await prisma.outboxJob.update({
        where: { id: j.id },
        data: { status: 'SENT', leaseUntil: null, error: null },
      });
    } catch {
      await prisma.outboxJob.update({
        where: { id: j.id },
        data: {
          status: j.attempts >= 5 ? 'FAILED' : 'PENDING',
          availableAt: new Date(Date.now() + 2 ** j.attempts * 30000),
          leaseUntil: null,
          error: 'SMTP delivery failed; inspect provider configuration',
        },
      });
    }
  }
  await prisma.$disconnect();
}
void run().catch(async () => {
  console.error('Worker failed');
  await prisma.$disconnect();
  process.exitCode = 1;
});
