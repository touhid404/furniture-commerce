import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
export function loadEnvironment() {
  const root = existsSync(resolve('config/stores')) ? resolve('.') : resolve('..');
  // One local file. Hosting-injected variables retain priority.
  config({ path: resolve(root, '.env.local'), quiet: true });
  process.env.PROJECT_ROOT ??= root;
}
loadEnvironment();
