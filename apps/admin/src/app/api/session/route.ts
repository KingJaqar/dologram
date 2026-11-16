import { requireApiSession } from '../../../server/guards';

/** Passive session validation; does not refresh idle expiry or expose identifiers. */
export async function GET() {
  const denial = await requireApiSession();
  return denial ?? Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
