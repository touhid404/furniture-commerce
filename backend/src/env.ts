import { config } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
export function loadEnvironment() {
  const root = existsSync(resolve("config/stores"))
    ? resolve(".")
    : resolve("..");
  if (process.env.APP_ENV_FILE)
    config({ path: resolve(root, process.env.APP_ENV_FILE), quiet: true });
  else if (existsSync(resolve(root, ".env.development.local")))
    config({ path: resolve(root, ".env.development.local"), quiet: true });
  config({ path: resolve(root, ".env.local"), quiet: true });
  config({ path: resolve(root, ".env"), quiet: true });
  process.env.PROJECT_ROOT ??= root;
}
loadEnvironment();
