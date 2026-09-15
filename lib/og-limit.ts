import { clientIp, rateLimit } from '@/lib/anti-cheat/rate-limit';

const OG_LIMIT = 30;
const OG_WINDOW_SECONDS = 60;

/** Per-IP cap for the public OG image route. */
export async function allowOgRequest(request: Request): Promise<boolean> {
  const result = await rateLimit(`og:ip:${clientIp(request.headers)}`, OG_LIMIT, OG_WINDOW_SECONDS);
  return result.ok;
}
