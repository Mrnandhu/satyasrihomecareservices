// POST /api/enquiry  — saves a website enquiry into the D1 database
const SERVICES = ['Patient Care', 'Elder Care', 'Children Care', 'Maid Service', 'Cooking Service', '24/7 Home Care'];
const CAREGIVERS = ['', 'Male', 'Female'];
const REQUIREMENTS = ['', '24/7 live-in', 'Day shift (12 hours)', 'Night shift (12 hours)', 'A few hours a day'];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  const type = request.headers.get('content-type') || '';
  const isJson = type.includes('application/json');

  let data;
  try {
    data = isJson ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return json({ ok: false, error: 'Could not read the form.' }, 400);
  }

  // Spam trap: bots fill the hidden "website" field. Pretend it worked.
  if (data.website) return isJson ? json({ ok: true }) : Response.redirect(new URL('/?enquiry=sent#enquiry', request.url), 303);

  const name = clean(data.name, 80);
  const phoneDigits = clean(data.phone, 20).replace(/[^\d]/g, '').replace(/^91(?=\d{10}$)/, '');
  const service = clean(data.service, 40);
  const requirement = clean(data.requirement, 40);
  const caregiver = clean(data.caregiver, 10);
  const location = clean(data.location, 120);
  const message = String(data.message ?? '').trim().slice(0, 1000);

  if (!name) return json({ ok: false, error: 'Name is required.' }, 400);
  if (!/^[6-9]\d{9}$/.test(phoneDigits)) return json({ ok: false, error: 'Enter a valid 10-digit mobile number.' }, 400);
  if (!SERVICES.includes(service)) return json({ ok: false, error: 'Choose a service.' }, 400);
  if (!REQUIREMENTS.includes(requirement)) return json({ ok: false, error: 'Choose the hours needed.' }, 400);
  if (!CAREGIVERS.includes(caregiver)) return json({ ok: false, error: 'Choose a caregiver preference.' }, 400);

  try {
    const result = await env.DB.prepare(
      `INSERT INTO enquiries (name, phone, service, requirement, caregiver, location, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(name, phoneDigits, service, requirement, caregiver, location, message).run();

    if (!isJson) return Response.redirect(new URL('/?enquiry=sent#enquiry', request.url), 303);
    return json({ ok: true, id: result.meta?.last_row_id ?? null });
  } catch (err) {
    console.error('Enquiry insert failed', err);
    return json({ ok: false, error: 'Could not save the enquiry.' }, 500);
  }
}

export function onRequest() {
  return json({ ok: false, error: 'Use POST.' }, 405);
}
