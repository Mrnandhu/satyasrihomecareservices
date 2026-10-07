// GET    /api/admin/enquiries            -> list enquiries (newest first)
// PATCH  /api/admin/enquiries            -> { id, status?, notes? }
// DELETE /api/admin/enquiries?id=123     -> delete one (for spam)
const STATUSES = ['new', 'contacted', 'completed'];
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, phone, service, requirement, caregiver, location, message, status, notes, created_at, updated_at
     FROM enquiries ORDER BY id DESC LIMIT 2000`
  ).all();
  return json({ ok: true, enquiries: results });
}

export async function onRequestPatch({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400); }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return json({ ok: false, error: 'Missing enquiry id.' }, 400);

  const sets = [], binds = [];
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return json({ ok: false, error: 'Unknown status.' }, 400);
    sets.push('status = ?'); binds.push(body.status);
  }
  if (body.notes !== undefined) {
    sets.push('notes = ?'); binds.push(String(body.notes).slice(0, 2000));
  }
  if (!sets.length) return json({ ok: false, error: 'Nothing to update.' }, 400);

  sets.push("updated_at = datetime('now')");
  const res = await env.DB.prepare(`UPDATE enquiries SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...binds, id).run();
  if (!res.meta?.changes) return json({ ok: false, error: 'Enquiry not found.' }, 404);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return json({ ok: false, error: 'Missing enquiry id.' }, 400);
  await env.DB.prepare('DELETE FROM enquiries WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
