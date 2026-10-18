export function assertFixtureEnvironment(env = process.env) {
  const host = new URL(env.DATABASE_URL ?? 'postgresql://invalid').hostname;
  if (!env.NEON_BRANCH?.startsWith('test-') || host.startsWith('ep-quiet-frog-b5tcammn'))
    throw Error(
      'Fixture writes require a temporary test-* Neon branch and must never target production.',
    );
}
