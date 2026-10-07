// GET    /api/admin/reviews           -> all reviews (pending, approved, hidden)
// PATCH  /api/admin/reviews           -> { id, status: 'approved' | 'hidden' | 'pending' }
// DELETE /api/admin/reviews?id=123
const STATUSES = ['pending', 'approved', 'hidden'];
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, location, service, rating, comment, status, created_at FROM reviews ORDER BY id DESC LIMIT 1000`
  ).all();
  return json({ ok: true, reviews: results });
}

export async function onRequestPatch({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return json({ ok: false, error: 'Missing review id.' }, 400);
  if (!STATUSES.includes(body.status)) return json({ ok: false, error: 'Unknown status.' }, 400);
  const res = await env.DB.prepare('UPDATE reviews SET status = ? WHERE id = ?').bind(body.status, id).run();
  if (!res.meta?.changes) return json({ ok: false, error: 'Review not found.' }, 404);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return json({ ok: false, error: 'Missing review id.' }, 400);
  await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
