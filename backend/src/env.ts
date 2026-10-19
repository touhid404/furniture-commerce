import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
export function loadEnvironment() {
  const root = existsSync(resolve('config/stores')) ? resolve('.') : resolve('..');
  // One local file. Hosting-injected variables retain priority.
  config({ path: resolve(root, '.env.local'), quiet: true });
  // Render provides this automatically for web services. A configured custom
  // PUBLIC_APP_URL still takes precedence for links and allowed origins.
  if (!process.env.PUBLIC_APP_URL && process.env.RENDER_EXTERNAL_URL?.startsWith('https://'))
    process.env.PUBLIC_APP_URL = process.env.RENDER_EXTERNAL_URL;
  process.env.PROJECT_ROOT ??= root;
}
loadEnvironment();
