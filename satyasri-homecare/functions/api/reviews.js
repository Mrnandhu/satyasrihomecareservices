// GET  /api/reviews  -> approved reviews only (what the website shows)
// POST /api/reviews  -> a customer submits a review; it waits as 'pending' until the owner approves it
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT name, location, service, rating, comment, created_at
     FROM reviews WHERE status = 'approved' ORDER BY id DESC LIMIT 24`
  ).all();
  const stats = await env.DB.prepare(
    `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS average FROM reviews WHERE status = 'approved'`
  ).all();
  const { count = 0, average = null } = stats.results[0] || {};
  return json({ ok: true, count, average, reviews: results }, 200, { 'Cache-Control': 'no-store' });
}

export async function onRequestPost({ request, env }) {
  let data;
  try { data = await request.json(); } catch { return json({ ok: false, error: 'Could not read the review.' }, 400); }

  if (data.website) return json({ ok: true }); // spam trap

  const name = clean(data.name, 60);
  const location = clean(data.location, 60);
  const service = clean(data.service, 40);
  const rating = Number(data.rating);
  const comment = String(data.comment ?? '').trim().slice(0, 800);

  if (!name) return json({ ok: false, error: 'Enter your name.' }, 400);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ ok: false, error: 'Choose a star rating.' }, 400);
  if (comment.length < 10) return json({ ok: false, error: 'Write a few words about your experience.' }, 400);

  await env.DB.prepare(
    `INSERT INTO reviews (name, location, service, rating, comment) VALUES (?, ?, ?, ?, ?)`
  ).bind(name, location, service, rating, comment).run();

  return json({ ok: true });
}

export function onRequest() {
  return json({ ok: false, error: 'Use GET or POST.' }, 405);
}
