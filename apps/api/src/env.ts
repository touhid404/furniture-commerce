import { config } from 'dotenv';
import { resolve } from 'node:path';

export function loadEnvironment() {
  // Deployment-injected values win, then Neon .env.local, then .env.
  config({ path: resolve('.env.local'), quiet: true });
  config({ path: resolve('.env'), quiet: true });
}

loadEnvironment();
