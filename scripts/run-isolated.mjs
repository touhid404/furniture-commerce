// Inject temporary branch credentials into child processes without changing .env.local.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { parse } from 'dotenv';
const [file, command, ...args] = process.argv.slice(2);
if (!file || !command) throw Error('Usage: node scripts/run-isolated.mjs /absolute/test.env command [args]');
const branch = parse(readFileSync(file));
if (!branch.NEON_BRANCH?.startsWith('test-') || new URL(branch.DATABASE_URL).hostname.startsWith('ep-quiet-frog-b5tcammn')) throw Error('Production fixture writes refused.');
const env = { ...process.env, ...parse(readFileSync('.env.local')), ...branch, DEMO_SEED:'true', PROJECT_ROOT:resolve('.') };
const child = spawn(command, args, {env, stdio:'inherit'});
child.on('error', () => { console.error('Failed to start isolated command.'); process.exitCode = 1; });
child.on('exit', code => {process.exitCode = code ?? 1;});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
