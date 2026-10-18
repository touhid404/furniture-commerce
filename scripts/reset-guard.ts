export function assertResetAllowed(
  args: string[],
  env: Record<string, string | undefined>,
  mode: string,
) {
  if (env.CI || env.NODE_ENV === 'production' || mode !== 'demo')
    throw Error('Reset is allowed only from a local demo operator process.');
  const branch = env.NEON_BRANCH;
  if (!branch || !['production', 'dev-commerce-platform'].includes(branch))
    throw Error('Unknown reset branch.');
  if (
    !args.includes('--confirm-project=quiet-boat-96833475') ||
    !args.includes(`--confirm-branch=${branch}`)
  )
    throw Error('Explicit project and matching branch confirmation required.');
  if (branch === 'production' && !args.includes('--allow-production'))
    throw Error('Production reset refused without a separate explicit production override.');
  const pooled = new URL(env.DATABASE_URL ?? ''),
    direct = new URL(env.DATABASE_URL_UNPOOLED ?? '');
  if (
    !direct.hostname.endsWith('.neon.tech') ||
    direct.hostname.includes('-pooler') ||
    pooled.hostname.replace('-pooler', '') !== direct.hostname
  )
    throw Error('Database connection pair is invalid.');
  const production = 'ep-quiet-frog-b5tcammn';
  if (!args.includes(`--confirm-host=${direct.hostname}`))
    throw Error('Confirm the verified Neon endpoint host explicitly.');
  if (branch === 'production' && !direct.hostname.startsWith(production + '.'))
    throw Error('Production endpoint does not match this project.');
  // Production endpoint is checked against current Neon metadata at invocation by the operator.
  if (branch !== 'production' && direct.hostname.startsWith(production))
    throw Error('Development reset cannot target the production endpoint.');
}
