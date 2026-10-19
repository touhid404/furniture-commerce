import { refreshStoreSettings } from './services/store-settings.js';
import { app } from './app.js';
import { prisma } from './db/client.js';
import { startKeepalive } from './services/keepalive.js';

await refreshStoreSettings(true);
const port = Number(process.env.PORT ?? 3001);
const server = app.listen(port, process.env.HOST ?? '127.0.0.1', () =>
  console.log(`Commerce API listening on http://127.0.0.1:${port}`),
);
const stopKeepalive = startKeepalive();
let shuttingDown = false;
const workerController = new AbortController();
const worker =
  process.env.RUN_WORKER_IN_WEB === 'true'
    ? import('./worker.js').then(({ runWorker }) => runWorker(workerController.signal))
    : Promise.resolve();
void worker.catch(() => {
  if (!shuttingDown) {
    console.error('Embedded worker failed');
    process.exit(1);
  }
});
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  stopKeepalive();
  workerController.abort();
  const timer = setTimeout(() => process.exit(1), 10_000);
  timer.unref();
  server.close(
    () =>
      void worker
        .catch(() => undefined)
        .then(() => prisma.$disconnect())
        .then(() => process.exit(0)),
  );
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
