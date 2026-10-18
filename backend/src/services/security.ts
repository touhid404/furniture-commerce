export function allowedRequestOrigin(
  origin: string,
  publicUrl: string,
  requestOrigin: string,
  demo: boolean,
): boolean {
  let normalized: string;
  try {
    normalized = new URL(origin).origin;
  } catch {
    return false;
  }
  if (normalized !== origin || normalized === 'null') return false;
  const allowed = new Set([new URL(publicUrl).origin, requestOrigin]);
  if (demo)
    for (const local of [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:3001',
      'http://localhost:3001',
    ])
      allowed.add(local);
  return allowed.has(origin);
}
