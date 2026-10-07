// Runs the real backend files in /functions inside the Vite dev server,
// with a local SQLite file standing in for the Cloudflare database.
// Used only by `npm run dev` and `npm run preview`. Not part of the live site.
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');

async function openDatabase() {
  const { DatabaseSync } = await import('node:sqlite'); // built into Node 22.5+
  mkdirSync(resolve(ROOT, '.dev-data'), { recursive: true });
  const db = new DatabaseSync(resolve(ROOT, '.dev-data/enquiries.sqlite'));
  db.exec(readFileSync(resolve(ROOT, 'schema.sql'), 'utf8'));
  // Upgrade a local database made with the older schema
  try { db.exec("ALTER TABLE enquiries ADD COLUMN caregiver TEXT NOT NULL DEFAULT ''"); } catch { /* already there */ }

  // Same shape as Cloudflare D1: DB.prepare(sql).bind(...).run() / .all()
  return {
    prepare(sql) {
      let params = [];
      const stmt = {
        bind(...args) { params = args; return stmt; },
        async run() {
          const r = db.prepare(sql).run(...params);
          return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
        },
        async all() { return { results: db.prepare(sql).all(...params) }; }
      };
      return stmt;
    }
  };
}

// URL path -> backend file (mirrors Cloudflare's /functions folder routing)
const ROUTES = {
  '/api/enquiry': 'functions/api/enquiry.js',
  '/api/reviews': 'functions/api/reviews.js',
  '/api/admin/enquiries': 'functions/api/admin/enquiries.js',
  '/api/admin/reviews': 'functions/api/admin/reviews.js'
};

const load = (file) => import(pathToFileURL(resolve(ROOT, file)).href + `?t=${Date.now()}`);

async function toWebRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const url = `http://${req.headers.host || 'localhost'}${req.url}`;
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  return new Request(url, { method: req.method, headers: req.headers, body: hasBody ? Buffer.concat(chunks) : undefined });
}

async function send(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function localApi({ adminPassword }) {
  let dbPromise;
  const middleware = async (req, res, next) => {
    if (!req.url.startsWith('/api/')) return next();
    try {
      dbPromise ??= openDatabase();
      const env = { DB: await dbPromise, ADMIN_PASSWORD: adminPassword };
      const request = await toWebRequest(req);
      const path = new URL(request.url).pathname;
      let response;

      const file = ROUTES[path];
      if (!file) {
        response = new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404 });
      } else {
        const mod = await load(file);
        const name = 'onRequest' + req.method.charAt(0) + req.method.slice(1).toLowerCase();
        const handler = mod[name] || mod.onRequest;
        const run = async () => handler ? handler({ request, env }) : new Response('Method not allowed', { status: 405 });
        if (path.startsWith('/api/admin/')) {
          const guard = await load('functions/api/admin/_middleware.js');
          response = await guard.onRequest({ request, env, next: run });
        } else {
          response = await run();
        }
      }
      await send(res, response);
    } catch (err) {
      console.error('[local api]', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
    }
  };

  return {
    name: 'satyasri-local-api',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); }
  };
}
