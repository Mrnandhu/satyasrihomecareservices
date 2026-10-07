# Satyasri Home Care Services website

Mobile-first website + enquiry dashboard.
Built with **Vite** (npm), hosted free on **Cloudflare Pages** with a **D1** database.
Deployment is done from GitHub through the Cloudflare dashboard, with no Wrangler/CLI needed.

```
index.html              the website
admin/index.html        enquiry dashboard (yoursite.com/admin/)
src/                    JavaScript and CSS (Vite bundles and minifies these)
public/assets/img/      photos and logo (copied as-is)
public/robots.txt, sitemap.xml, _headers
functions/api/          backend that runs on Cloudflare
  enquiry.js            saves form enquiries
  admin/_middleware.js  password check for the dashboard
  admin/enquiries.js    list / update status / notes / delete
  reviews.js            public: submit a review, list approved reviews
  admin/reviews.js      owner: approve / hide / delete reviews
dev/api-plugin.js       runs the backend locally during `npm run dev`
schema.sql              database table
```

## 1. Run it on your computer

Install **Node.js 22 LTS** from nodejs.org, then in this folder:

```bash
npm install
npm run dev
```

- Website: http://localhost:5173
- Dashboard: http://localhost:5173/admin/ (password `test1234`)
- **Test on your phone:** connect the phone to the same Wi-Fi and open the "Network" address Vite prints (like `http://192.168.1.5:5173`).

The enquiry form and dashboard work fully in dev mode. Test enquiries are saved in `.dev-data/enquiries.sqlite` (delete that folder to start fresh). To change the local password, copy `.env.example` to `.env.local` and edit it.

Other commands: `npm run build` creates the final site in `dist/`, and `npm run preview` serves that build to check it.

## 2. Placeholders to update

Search the project for `PLACEHOLDER` to find what's left. Business details (8+ years, 2000+ services, the About story) are already filled in.

| What | Where |
|---|---|
| Real domain (replace `www.satyasrihomecare.com`) | `index.html` (top), `public/robots.txt`, `public/sitemap.xml` |
| WhatsApp number (currently 7093533484) | `src/site.js`, first lines |
| "Why choose us" points and FAQ answers | `index.html`. Confirm each with the owner |

### Images
All images live in `public/assets/img/`. To change one, save the new file with **the same file name**.

| File | Used for | Size | Status |
|---|---|---|---|
| hero.jpg | Main photo at the top | 4:3 (e.g. 1200x900) | done |
| patient-care.jpg, elder-care.jpg, children-care.jpg, maid-service.jpg, cooking-service.jpg, home-care-247.jpg | Service cards | 800x600 | done |
| about.jpg | About section (owner photo) | 900x990 portrait | done |
| og-image.jpg | Preview when the link is shared on WhatsApp | 1200x630 | done |
| logo.png | Full logo (footer) | transparent PNG | done |
| logo-icon.png, favicon-48.png, favicon-192.png, apple-touch-icon.png | Crown + SS icon (header, browser tab, phone home screen) | square PNG | done |

Keep photos under ~150 KB each (squoosh.app) so the site loads fast on mobile data.

## 3. Go live (Cloudflare dashboard, one time)

**a. Put the code on GitHub.** Create a private repository and upload/push this folder (`node_modules`, `dist` and `.dev-data` are already excluded by `.gitignore`).

**b. Create the database.** Cloudflare dashboard > **Storage & Databases > D1 SQL Database > Create**. Name it `satyasri-enquiries`. Open it, go to the **Console** tab, paste everything from `schema.sql`, and run it. (If you created the database with an older version of this project, first run `migrate-v2.sql`, then `schema.sql`.)

**c. Create the site.** **Workers & Pages > Create > Pages > Connect to Git**, choose the repository, then set:
- Framework preset: **Vite** (or None)
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `NODE_VERSION` = `22`

Click **Save and Deploy**.

**d. Connect the database and password.** In the Pages project, go to **Settings**:
- **Bindings > Add > D1 database**: variable name `DB`, database `satyasri-enquiries`.
- **Variables and Secrets > Add**: type **Secret**, name `ADMIN_PASSWORD`, value = a strong password for the owner.

Then **Deployments > latest > Retry deployment** so the new settings take effect.

**e. Test.** Open `https://<project>.pages.dev`, send an enquiry, then open `/admin/`, sign in, and check it appears.

## 4. Connect the GoDaddy domain

1. Cloudflare: **Add a domain**, enter it, choose the **Free** plan.
2. In GoDaddy: **My Products > Domain > DNS > Nameservers > Change > I'll use my own nameservers**, paste Cloudflare's two nameservers, save.
3. Wait until Cloudflare shows the domain as **Active**.
4. Pages project > **Custom domains**: add `yourdomain.com` and `www.yourdomain.com`.
5. Update the domain placeholders (section 2) and push to GitHub.

## 5. Updating later

Edit text or replace photos, then push to GitHub. Cloudflare rebuilds and publishes automatically in about a minute. Enquiries live in the database, so updates never delete them.

## 6. Dashboard guide (for the owner)

Open `yourdomain.com/admin/` and sign in.

- Tabs show **New**, **Contacted** and **Completed** counts. Tap one to filter.
- **Call** and **WhatsApp** contact the customer directly, and move a New enquiry to Contacted automatically.
- Change status any time with the New / Contacted / Completed buttons.
- Notes save when you tap outside the box.
- **Download CSV** exports everything for Excel or Google Sheets.
- Tick "Keep me signed in" only on the owner's own phone.

### Reviews
Customer reviews only appear on the website after you approve them, so the site never shows fake or placeholder reviews. While no review is approved, the website shows a "Write a review" invitation instead of review cards.

1. After finishing a job, open the **Reviews** tab and tap **Send on WhatsApp** (or **Copy link**). The link opens the review form directly on the customer's phone.
2. New reviews arrive under **Waiting**. A number on the Reviews button shows how many are waiting.
3. Tap **Show on website** to publish one, **Hide** to keep it off the site, or **Delete** to remove spam.
4. The website shows the average star rating and the published reviews automatically.

To change the password: Settings > Variables and Secrets > edit `ADMIN_PASSWORD`, then retry the latest deployment.

## 7. Google Maps listing

The map, "Get directions" button and office address link point to the existing Google listing
"SATYA SRI HOME CARE SERVICES" (place ID `ChIJ-QGohAObyzsRvJDDM3zVU0Q`).
If the listing is ever renamed or moved, update those links in `index.html` (search for `place_id`).

## 8. After launch (free, recommended)

- **Google Business Profile** for the Clock Tower address, with the website link. This brings the most calls for a local service.
- **Google Search Console**: add the domain and submit `https://yourdomain.com/sitemap.xml`.
