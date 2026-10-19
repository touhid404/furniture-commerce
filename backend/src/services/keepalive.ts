import cron from 'node-cron';
import axios from 'axios';
import { config } from '../config/config.js';

export function startKeepalive(): () => void {
  if (config.nodeEnv !== 'production') return () => undefined;

  const PING_URL = config.pingUrl;
  if (!PING_URL) {
    console.error('[CRON] Set PUBLIC_APP_URL to an HTTPS app URL to enable the ping');
    return () => undefined;
  }

  const task = cron.schedule('*/14 * * * *', async () => {
    try {
      await axios.get(PING_URL, { timeout: 10_000 });
      console.log(`Don't Sleep ........... Iam Alive MR.: ${PING_URL}`);
    } catch (err) {
      console.error('[CRON] Error pinging self:', err instanceof Error ? err.message : err);
    }
  });

  return () => task.destroy();
}
