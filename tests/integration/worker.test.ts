import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { prisma } from '../../backend/src/db/client.js';
import { storeConfig } from '../../backend/src/config.js';
if (process.env.NEON_BRANCH === 'production' || storeConfig.mode !== 'demo')
  throw new Error('Worker acceptance requires an isolated demo branch.');
const messages: string[] = [];
const smtp = net.createServer((socket) => {
  socket.setEncoding('utf8');
  socket.write('220 localhost test SMTP\r\n');
  let buffer = '',
    data = false,
    message = '';
  socket.on('data', (chunk) => {
    buffer += chunk;
    let at: number;
    while ((at = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 2);
      if (data) {
        if (line === '.') {
          messages.push(message);
          message = '';
          data = false;
          socket.write('250 message accepted\r\n');
        } else message += line + '\r\n';
        continue;
      }
      const command = line.split(' ')[0].toUpperCase();
      if (command === 'EHLO' || command === 'HELO')
        socket.write('250-localhost\r\n250 SIZE 2097152\r\n');
      else if (['MAIL', 'RCPT', 'RSET', 'NOOP'].includes(command)) socket.write('250 OK\r\n');
      else if (command === 'DATA') {
        data = true;
        socket.write('354 send message\r\n');
      } else if (command === 'QUIT') {
        socket.end('221 bye\r\n');
      } else socket.write('500 unsupported\r\n');
    }
  });
});
smtp.listen(0, '127.0.0.1');
await once(smtp, 'listening');
const addr = smtp.address();
if (!addr || typeof addr === 'string') throw new Error('SMTP failed');
try {
  await test(
    'transactional outbox reaches an SMTP receiver and expired final leases dead-letter',
    { timeout: 150_000 },
    async () => {
      const marker = `Worker acceptance ${Date.now()}`;
      const job = await prisma.outboxJob.create({
        data: {
          type: 'EMAIL',
          payload: {
            to: 'worker-test@example.invalid',
            subject: marker,
            text: 'The complete database to worker to SMTP flow works.',
          },
        },
      });
      const expired = await prisma.outboxJob.create({
        data: {
          type: 'EMAIL',
          status: 'PROCESSING',
          attempts: 5,
          leaseUntil: new Date(0),
          payload: {
            to: 'worker-test@example.invalid',
            subject: 'Expired lease',
            text: 'Do not resend',
          },
        },
      });
      const child = spawn(process.execPath, ['--import', 'tsx', 'backend/src/worker.ts'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SMTP_HOST: '127.0.0.1',
          SMTP_PORT: String(addr.port),
          SMTP_SECURE: 'false',
          SMTP_USER: '',
          SMTP_PASSWORD: '',
          SMTP_FROM: 'test@example.invalid',
          WORKER_ONCE: 'true',
        },
        stdio: 'pipe',
      });
      const timer = setTimeout(() => child.kill('SIGTERM'), 130000);
      const [exit] = await once(child, 'exit');
      clearTimeout(timer);
      assert.equal(exit, 0);
      assert.equal(
        (await prisma.outboxJob.findUniqueOrThrow({ where: { id: job.id } })).status,
        'SENT',
      );
      assert.equal(
        (await prisma.outboxJob.findUniqueOrThrow({ where: { id: expired.id } })).status,
        'FAILED',
      );
      assert.ok(messages.some((m) => m.includes(marker)));
      console.log(
        `PASS ${messages.length} messages accepted by local SMTP receiver (no external email sent).`,
      );
    },
  );
} finally {
  smtp.close();
  await prisma.$disconnect();
}
