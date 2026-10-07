(() => {
  const API = '/api/admin/enquiries';
  const KEY = 'satyasri_admin_pw';
  let password = sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || '';
  let all = [];
  let filter = 'all';

  const $ = (id) => document.getElementById(id);
  const loginView = $('loginView'), appView = $('appView'), list = $('list'), msg = $('msg');

  async function api(method, body, query = '', url = API) {
    const res = await fetch(url + query, {
      method,
      headers: { 'Authorization': 'Bearer ' + password, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { signOut('Wrong password, or your session ended. Sign in again.'); throw new Error('401'); }
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function signOut(text = '') {
    password = '';
    sessionStorage.removeItem(KEY); localStorage.removeItem(KEY);
    appView.hidden = true; loginView.hidden = false;
    $('loginErr').textContent = text;
    $('pw').value = ''; $('pw').focus();
  }

  // D1 stores UTC as "YYYY-MM-DD HH:MM:SS"; show it in Indian time
  const toDate = (s) => new Date(s.replace(' ', 'T') + 'Z');
  const fmt = (s) => toDate(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  function ago(s) {
    const mins = Math.round((Date.now() - toDate(s)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const h = Math.round(mins / 60); if (h < 24) return `${h} hr ago`;
    const d = Math.round(h / 24); return `${d} day${d > 1 ? 's' : ''} ago`;
  }
  const prettyPhone = (p) => p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p;

  async function load() {
    msg.className = 'msg'; msg.textContent = 'Loading...';
    try {
      const data = await api('GET');
      all = data.enquiries;
      msg.textContent = '';
      render();
    } catch (e) {
      if (e.message !== '401') { msg.className = 'msg is-error'; msg.textContent = 'Could not load enquiries: ' + e.message; }
    }
  }

  function counts() {
    const c = { all: all.length, new: 0, contacted: 0, completed: 0 };
    all.forEach(e => c[e.status]++);
    Object.entries(c).forEach(([k, v]) => $('c-' + k).textContent = v);
    $('badge-enq').hidden = !c.new; $('badge-enq').textContent = c.new;
  }

  function render() {
    counts();
    const q = $('search').value.trim().toLowerCase();
    const svc = $('serviceFilter').value;
    const rows = all.filter(e =>
      (filter === 'all' || e.status === filter) &&
      (!svc || e.service === svc) &&
      (!q || [e.name, e.phone, e.location, e.message, e.notes].join(' ').toLowerCase().includes(q))
    );

    list.innerHTML = '';
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = all.length ? 'No enquiries match these filters.' : 'No enquiries yet. New ones from the website form will appear here.';
      list.appendChild(li);
      return;
    }
    const tpl = $('rowTpl');
    rows.forEach(e => list.appendChild(buildRow(tpl.content.firstElementChild.cloneNode(true), e)));
  }

  function buildRow(li, e) {
    li.dataset.status = e.status;
    // textContent everywhere: enquiry text comes from the public and must never be treated as HTML
    li.querySelector('.card__name').textContent = e.name;
    li.querySelector('.card__date').textContent = `${fmt(e.created_at)} (${ago(e.created_at)})`;
    li.querySelector('.f-service').textContent = e.service;
    li.querySelector('.f-req').textContent = e.requirement || 'Not sure yet';
    li.querySelector('.f-care').textContent = e.caregiver ? `${e.caregiver} preferred` : 'No preference';
    li.querySelector('.f-loc').textContent = e.location || '—';
    li.querySelector('.f-phone').textContent = prettyPhone(e.phone);
    li.querySelector('.card__msg').textContent = e.message || '';

    li.querySelector('.a-call').href = 'tel:+91' + e.phone;
    const waText = `Hello ${e.name}, this is Satyasri Home Care Services regarding your enquiry for ${e.service}.`;
    li.querySelector('.a-wa').href = `https://wa.me/91${e.phone}?text=${encodeURIComponent(waText)}`;

    li.querySelectorAll('.status button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.status === e.status));
      b.addEventListener('click', async () => {
        if (b.dataset.status === e.status) return;
        const prev = e.status;
        e.status = b.dataset.status; render();
        try { await api('PATCH', { id: e.id, status: e.status }); }
        catch (err) { e.status = prev; render(); if (err.message !== '401') alert('Status not saved: ' + err.message); }
      });
    });

    // Contacting someone moves a "new" enquiry to "contacted" automatically
    const markContacted = () => {
      if (e.status !== 'new') return;
      e.status = 'contacted';
      api('PATCH', { id: e.id, status: 'contacted' }).catch(() => {});
      setTimeout(render, 300);
    };
    li.querySelector('.a-call').addEventListener('click', markContacted);
    li.querySelector('.a-wa').addEventListener('click', markContacted);

    const notes = li.querySelector('textarea');
    notes.value = e.notes || '';
    notes.addEventListener('change', async () => {
      try { await api('PATCH', { id: e.id, notes: notes.value }); e.notes = notes.value; }
      catch (err) { if (err.message !== '401') alert('Note not saved: ' + err.message); }
    });

    li.querySelector('.a-del').addEventListener('click', async () => {
      if (!confirm(`Delete the enquiry from ${e.name}? This cannot be undone.`)) return;
      try { await api('DELETE', null, '?id=' + e.id); all = all.filter(x => x.id !== e.id); render(); }
      catch (err) { if (err.message !== '401') alert('Not deleted: ' + err.message); }
    });
    return li;
  }

  function downloadCsv() {
    const cols = ['id', 'created_at', 'name', 'phone', 'service', 'requirement', 'caregiver', 'location', 'message', 'status', 'notes'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...all.map(e => cols.map(c => esc(c === 'created_at' ? fmt(e[c]) : e[c])).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
    a.download = `satyasri-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ================= Reviews =================
  const RAPI = '/api/admin/reviews';
  let reviews = [];
  let rfilter = 'pending';
  const rlist = $('rlist'), rmsg = $('rmsg');
  const starText = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);

  // Link customers can open to write a review
  const reviewUrl = `${location.origin}/#write-review`;
  $('reviewLink').value = reviewUrl;
  $('shareLinkBtn').href = 'https://wa.me/?text=' + encodeURIComponent(
    `Thank you for choosing Satyasri Home Care Services. We'd be grateful if you could share your experience here: ${reviewUrl}`);
  $('copyLinkBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(reviewUrl); }
    catch { $('reviewLink').select(); document.execCommand('copy'); }
    $('copyLinkBtn').textContent = 'Copied';
    setTimeout(() => $('copyLinkBtn').textContent = 'Copy link', 1500);
  });

  async function loadReviews() {
    try {
      const data = await api('GET', null, '', RAPI);
      reviews = data.reviews;
      rmsg.textContent = '';
      renderReviews();
    } catch (e) {
      if (e.message !== '401') { rmsg.className = 'msg is-error'; rmsg.textContent = 'Could not load reviews: ' + e.message; }
    }
  }

  function renderReviews() {
    const c = { pending: 0, approved: 0, hidden: 0 };
    reviews.forEach(r => c[r.status]++);
    Object.entries(c).forEach(([k, v]) => $('rc-' + k).textContent = v);
    $('badge-rev').hidden = !c.pending; $('badge-rev').textContent = c.pending;

    const rows = reviews.filter(r => r.status === rfilter);
    rlist.innerHTML = '';
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = {
        pending: 'No reviews waiting. Send the review link above to customers after their service.',
        approved: 'No reviews on the website yet. Approve a waiting review to show it.',
        hidden: 'No hidden reviews.'
      }[rfilter];
      rlist.appendChild(li);
      return;
    }
    const tpl = $('reviewTpl');
    rows.forEach(r => {
      const li = tpl.content.firstElementChild.cloneNode(true);
      li.dataset.status = r.status;
      li.querySelector('.card__name').textContent = r.name;
      li.querySelector('.card__date').textContent = `${fmt(r.created_at)} (${ago(r.created_at)})`;
      li.querySelector('.rstars').textContent = starText(r.rating);
      li.querySelector('.rstars').setAttribute('aria-label', `${r.rating} out of 5 stars`);
      li.querySelector('.rmeta').textContent = [r.service, r.location].filter(Boolean).join(', ');
      li.querySelector('.rtext').textContent = r.comment;

      const approve = li.querySelector('.a-approve'), hide = li.querySelector('.a-hide');
      approve.hidden = r.status === 'approved';
      hide.hidden = r.status === 'hidden';
      const setStatus = async (status) => {
        const prev = r.status; r.status = status; renderReviews();
        try { await api('PATCH', { id: r.id, status }, '', RAPI); }
        catch (err) { r.status = prev; renderReviews(); if (err.message !== '401') alert('Not saved: ' + err.message); }
      };
      approve.addEventListener('click', () => setStatus('approved'));
      hide.addEventListener('click', () => setStatus('hidden'));
      li.querySelector('.a-rdel').addEventListener('click', async () => {
        if (!confirm(`Delete the review from ${r.name}? This cannot be undone.`)) return;
        try { await api('DELETE', null, '?id=' + r.id, RAPI); reviews = reviews.filter(x => x.id !== r.id); renderReviews(); }
        catch (err) { if (err.message !== '401') alert('Not deleted: ' + err.message); }
      });
      rlist.appendChild(li);
    });
  }

  document.querySelectorAll('[data-rfilter]').forEach(t => t.addEventListener('click', () => {
    rfilter = t.dataset.rfilter;
    document.querySelectorAll('[data-rfilter]').forEach(x => x.setAttribute('aria-selected', String(x === t)));
    renderReviews();
  }));

  // Switch between Enquiries and Reviews
  document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.view;
    document.querySelectorAll('.view-btn').forEach(x => x.toggleAttribute('aria-current', x === b));
    document.querySelectorAll('.view-btn[aria-current]').forEach(x => x.setAttribute('aria-current', 'page'));
    $('enquiriesView').hidden = v !== 'enquiries';
    $('reviewsView').hidden = v !== 'reviews';
    $('csvBtn').hidden = v !== 'enquiries';
  }));

  // Events
  $('loginForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    password = $('pw').value;
    $('loginErr').textContent = '';
    try {
      const data = await api('GET');
      (($('remember').checked) ? localStorage : sessionStorage).setItem(KEY, password);
      all = data.enquiries;
      loginView.hidden = true; appView.hidden = false;
      render();
      loadReviews();
    } catch (e) {
      if (e.message !== '401') $('loginErr').textContent = e.message;
    }
  });
  $('logoutBtn').addEventListener('click', () => signOut());
  $('refreshBtn').addEventListener('click', () => { load(); loadReviews(); });
  $('csvBtn').addEventListener('click', downloadCsv);
  $('search').addEventListener('input', render);
  $('serviceFilter').addEventListener('change', render);
  document.querySelectorAll('[data-filter]').forEach(t => t.addEventListener('click', () => {
    filter = t.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-selected', String(x === t)));
    render();
  }));
  // Pick up new enquiries when the owner comes back to the tab
  document.addEventListener('visibilitychange', () => { if (!document.hidden && password && !appView.hidden) { load(); loadReviews(); } });

  if (password) { loginView.hidden = true; appView.hidden = false; load(); loadReviews(); }
  else $('pw').focus();
})();
