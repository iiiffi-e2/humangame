/**
 * Shared auth for scheduled jobs. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` when that env var is set.
 */

export function authorizeCron(
  request: Request,
  options: { secret: string; enforce: boolean },
): boolean {
  if (!options.secret) return !options.enforce;
  const header = request.headers.get('authorization');
  return header === `Bearer ${options.secret}`;
}
