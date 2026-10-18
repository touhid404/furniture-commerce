import { app } from './app.js';
import { prisma } from './db/client.js';

const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, '127.0.0.1', () => console.log(`Commerce API listening on http://127.0.0.1:${port}`));
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const timer = setTimeout(() => process.exit(1), 10_000);
  timer.unref();
  server.close(() => void prisma.$disconnect().then(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
