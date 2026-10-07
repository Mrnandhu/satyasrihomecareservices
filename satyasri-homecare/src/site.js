(() => {
  // PLACEHOLDER: confirm which number is on WhatsApp (91 + 10 digits, no spaces or +)
  const WHATSAPP_NUMBER = '917093533484';
  const WA_GREETING = 'Hello Satyasri Home Care, I would like to know about your services.';
  const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

  document.querySelectorAll('.js-wa').forEach(a => {
    a.href = waLink(WA_GREETING); a.target = '_blank'; a.rel = 'noopener';
  });

  // Header shadow once the page scrolls
  const topbar = document.getElementById('topbar');
  const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  // Live clock in Indian time
  const timeEl = document.getElementById('clockTime');
  const noteEl = document.getElementById('clockNote');
  const notes = [
    [0, 5, "Middle of the night, and we're still answering."],
    [5, 9, 'Early morning. Call now to plan help for today.'],
    [9, 18, "We're available. Call any time."],
    [18, 22, 'Night shift caregivers available.'],
    [22, 24, "It's late, and we're still answering."]
  ];
  function tick() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
    const m = notes.find(([a, b]) => hour >= a && hour < b);
    if (m) noteEl.textContent = m[2];
  }
  if (timeEl) { tick(); setInterval(tick, 15000); }

  // Mobile menu
  const menuBtn = document.querySelector('.menu');
  const nav = document.getElementById('nav');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.topbar')) setMenu(false); });

  // "Enquire" / "Book this shift" buttons pre-fill the form
  const form = document.getElementById('enquiryForm');
  document.querySelectorAll('.js-enquire').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!form) return;
      form.elements.service.value = btn.dataset.service || '';
      if (btn.dataset.req) form.elements.requirement.value = btn.dataset.req;
      const pref = form.querySelector(`input[name="caregiver"][value="${btn.dataset.pref || ''}"]`);
      if (pref) pref.checked = true;
      document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => form.elements.name.focus({ preventScroll: true }), 600);
    });
  });

  // Enquiry form
  const status = document.getElementById('formStatus');
  const phoneOk = (v) => /^(?:\+?91)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ''));
  const mark = (el, bad) => el.setAttribute('aria-invalid', bad ? 'true' : 'false');

  function showDone(name) {
    form.innerHTML = `
      <div class="form__done">
        <div class="done__icon"><svg class="ico"><use href="#i-check"/></svg></div>
        <h3>Request received</h3>
        <p class="done__msg"></p>
        <p>For anything urgent, call <a href="tel:+917093533484">70935 33484</a>.</p>
      </div>`;
    form.querySelector('.done__msg').textContent = `Thank you${name ? ', ' + name : ''}. We'll call you back soon.`;
  }

  if (form) {
    if (new URLSearchParams(location.search).get('enquiry') === 'sent') showDone('');

    // Clear the red state as soon as the person fixes a field
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') mark(e.target, false); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = form.elements;
      const name = f.name.value.trim(), phone = f.phone.value.trim(), service = f.service.value;
      mark(f.name, !name); mark(f.phone, !phoneOk(phone)); mark(f.service, !service);

      if (!name || !phoneOk(phone) || !service) {
        status.className = 'form__status is-error';
        status.textContent = !name ? 'Enter your name.' : !phoneOk(phone) ? 'Enter a valid 10-digit mobile number.' : 'Select the service you need.';
        (form.querySelector('[aria-invalid="true"]') || f.name).focus();
        return;
      }

      const data = Object.fromEntries(new FormData(form));
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Sending...';
      status.className = 'form__status'; status.textContent = '';

      try {
        const res = await fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.error || 'Server error');
        showDone(name);
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        btn.disabled = false; btn.textContent = 'Request a callback';
        const msg = `Hello, I'm ${name}. I need ${service}${data.requirement ? ' (' + data.requirement + ')' : ''}${data.location ? ' in ' + data.location : ''}. My number: ${phone}. ${data.message || ''}`.trim();
        status.className = 'form__status is-error';
        status.innerHTML = 'Could not send the request. <a target="_blank" rel="noopener">Send it on WhatsApp</a> or call 70935 33484.';
        status.querySelector('a').href = waLink(msg);
      }
    });
  }

  // ================= Reviews =================
  // Only reviews approved by the owner come back from /api/reviews.
  // With none approved, the review cards stay hidden and only "Write a review" shows.
  const list = document.getElementById('reviewList');
  const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  const monthYear = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  const palettes = ['var(--grad-brand)', 'var(--grad-cta)', 'linear-gradient(135deg,#F59E0B,#E11D48)', 'linear-gradient(135deg,#0E8C9B,#2563EB)', 'linear-gradient(135deg,#C0267D,#6D28D9)'];

  function reviewCard(r, i) {
    const fig = document.createElement('figure');
    fig.className = 'review';
    fig.innerHTML = `
      <div class="review__stars"></div>
      <span class="review__service"></span>
      <blockquote></blockquote>
      <button class="review__more" type="button" hidden>Read more</button>
      <figcaption>
        <span class="review__avatar"></span>
        <span><b></b><small></small></span>
      </figcaption>`;
    // textContent only: review text comes from the public
    const st = fig.querySelector('.review__stars');
    st.textContent = stars(r.rating);
    st.setAttribute('aria-label', `${r.rating} out of 5 stars`);
    const svc = fig.querySelector('.review__service');
    if (r.service) svc.textContent = r.service; else svc.remove();
    const q = fig.querySelector('blockquote');
    q.textContent = `“${r.comment}”`;
    if (r.comment.length > 260) {
      q.classList.add('is-clamped');
      const more = fig.querySelector('.review__more');
      more.hidden = false;
      more.addEventListener('click', () => { q.classList.toggle('is-clamped'); more.textContent = q.classList.contains('is-clamped') ? 'Read more' : 'Show less'; });
    }
    const av = fig.querySelector('.review__avatar');
    av.textContent = (r.name.trim()[0] || '?').toUpperCase();
    av.style.background = palettes[i % palettes.length];
    fig.querySelector('figcaption b').textContent = r.name;
    fig.querySelector('figcaption small').textContent = [r.location, monthYear(r.created_at)].filter(Boolean).join(', ');
    return fig;
  }

  async function loadReviews() {
    if (!list) return;
    try {
      const res = await fetch('/api/reviews');
      const data = await res.json();
      if (!data.ok || !data.count) return; // nothing approved yet: keep cards hidden
      list.replaceChildren(...data.reviews.map(reviewCard));
      list.hidden = false;
      document.getElementById('reviewSwipe').hidden = data.reviews.length < 2;
      document.getElementById('reviewsTitle').textContent = 'What Families Say';
      document.getElementById('reviewsLead').textContent = 'Real reviews from families we have cared for.';
      document.getElementById('ratingAvg').textContent = `${Number(data.average).toFixed(1)} / 5`;
      document.getElementById('ratingCount').textContent = `from ${data.count} review${data.count > 1 ? 's' : ''}`;
      document.getElementById('ratingStars').textContent = stars(Math.round(data.average));
      document.getElementById('ratingSummary').hidden = false;
    } catch { /* offline or API missing: section simply shows the invitation */ }
  }
  loadReviews();

  // Review pop-up
  const dialog = document.getElementById('reviewDialog');
  const rForm = document.getElementById('reviewForm');
  const rBodyHTML = document.getElementById('reviewBody')?.innerHTML;

  function openReview() {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    setTimeout(() => dialog.querySelector('#r5, input[name="rating"]')?.focus(), 50);
  }
  function closeReview() {
    if (dialog.open) dialog.close();
    if (location.hash === '#write-review') history.replaceState(null, '', location.pathname + location.search);
  }
  document.querySelectorAll('.js-review-open').forEach(b => b.addEventListener('click', openReview));
  dialog?.addEventListener('click', (e) => {
    if (e.target.closest('.js-review-close') || e.target === dialog) closeReview();
  });
  // Owner can send customers a direct link: yoursite.com/#write-review
  if (location.hash === '#write-review') openReview();
  window.addEventListener('hashchange', () => { if (location.hash === '#write-review') openReview(); });

  rForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = rForm.elements;
    const rating = Number(rForm.querySelector('input[name="rating"]:checked')?.value || 0);
    const name = f.name.value.trim(), comment = f.comment.value.trim();
    const rStatus = document.getElementById('reviewStatus');
    rForm.querySelector('.stars-input').classList.toggle('is-invalid', !rating);
    mark(f.name, !name); mark(f.comment, comment.length < 10);
    if (!rating || !name || comment.length < 10) {
      rStatus.className = 'form__status is-error';
      rStatus.textContent = !rating ? 'Tap the stars to choose a rating.' : !name ? 'Enter your name.' : 'Write a few words about your experience.';
      return;
    }
    const btn = rForm.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Submitting...';
    rStatus.className = 'form__status'; rStatus.textContent = '';
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, name, comment, location: f.location.value, service: f.service.value, website: f.website.value })
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || 'Server error');
      document.getElementById('reviewBody').innerHTML = `
        <div class="form__done">
          <div class="done__icon"><svg class="ico"><use href="#i-check"/></svg></div>
          <h3>Thank you for your review</h3>
          <p>It will appear on the website once our team has checked it.</p>
          <button class="btn btn--blue js-review-close" type="button">Close</button>
        </div>`;
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Submit review';
      rStatus.className = 'form__status is-error';
      rStatus.textContent = err.message && err.message !== 'Server error' ? err.message : 'Could not submit the review. Please try again.';
    }
  });
  // After a successful submit, put a fresh empty form back for next time
  dialog?.addEventListener('close', () => {
    if (!dialog.querySelector('.stars-input') && rBodyHTML) document.getElementById('reviewBody').innerHTML = rBodyHTML;
  });

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
