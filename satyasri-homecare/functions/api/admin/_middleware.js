// Protects every /api/admin/* route with the ADMIN_PASSWORD secret.
// The dashboard sends it as:  Authorization: Bearer <password>
const json = (body, status) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function sameSecret(a, b) {
  // Compare SHA-256 hashes byte by byte so timing doesn't leak the password
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b))
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function onRequest({ request, env, next }) {
  if (!env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'ADMIN_PASSWORD is not set on Cloudflare. Run: npx wrangler pages secret put ADMIN_PASSWORD' }, 500);
  }
  const header = request.headers.get('Authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!given || !(await sameSecret(given, env.ADMIN_PASSWORD))) {
    await new Promise(r => setTimeout(r, 700)); // slow down password guessing
    return json({ ok: false, error: 'Wrong password.' }, 401);
  }

  if (!env.DB) {
    return json({ ok: false, error: 'Password OK, but the database is not connected to the site (missing "DB" binding). Check wrangler.toml and redeploy.' }, 500);
  }

  try {
    const res = await next();
    const out = new Response(res.body, res); // copy so headers are editable
    out.headers.set('Cache-Control', 'no-store');
    return out;
  } catch (err) {
    // Show the real reason in the dashboard instead of a blank 500
    console.error('Admin API error:', err);
    return json({ ok: false, error: 'Server error: ' + (err && err.message ? err.message : String(err)) }, 500);
  }
}
