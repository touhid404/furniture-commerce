import axios from 'axios';
import cron, { type ScheduledTask } from 'node-cron';

export const keepaliveSchedule = '*/14 * * * *';

export function createKeepaliveTask(
  request: typeof axios.get = axios.get,
): ScheduledTask | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;

  const rawUrl = process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
  let origin: URL;
  try {
    origin = new URL(rawUrl ?? '');
    if (origin.protocol !== 'https:') throw new Error('HTTPS required');
  } catch {
    console.warn('[CRON] Skipping health check: no valid HTTPS app URL is configured');
    return undefined;
  }
  const url = new URL('/api/v1/health/live', origin).href;

  return cron.createTask(
    keepaliveSchedule,
    async () => {
      try {
        await request(url, { timeout: 10_000, maxRedirects: 0 });
        console.info(`Don't Sleep ........... I am alive: ${url}`);
      } catch (error) {
        console.warn(
          `[CRON] Public health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
    { timezone: 'UTC', noOverlap: true, unref: true },
  );
}

export function startKeepalive(): () => void {
  const task = createKeepaliveTask();
  task?.start();
  return () => task?.destroy();
}
