# Royalty Nexus

Website for **Royalty Nexus Foundation Trust**, a public trust that runs environmental campaigns online and in the field, and for **Royalty Nexus Private Wealth**, its private wealth management arm.

It's plain HTML, CSS and JavaScript. There's no build step and no dependencies.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Homepage with a layered morning landscape and parallax scrolling (the sun rises as you scroll, with drifting clouds, mist and birds). It has foundation stats, the four pillars, live campaign cards with online/offline/hybrid filters, how to take part, a sunset-lake scene, and the Private Wealth section with a confidential enquiry form. |
| `register.html` | Public campaign registration. Picks the campaign from `?c=<id>`, offers in-person or online depending on the campaign, checks capacity and duplicate emails, and issues a registration ID. |
| `verify.html` | Public certificate check (`?id=RN-2026-XXXXXX`). Shows the certificate and whether it's valid or revoked, and it can be printed or saved as a PDF. |
| `admin/login.html` | Administrator sign-in. |
| `admin/dashboard.html` | Admin console (details below). |

### Admin console

- **Overview:** totals and how many places are filled for upcoming campaigns.
- **Campaigns:** create and edit campaigns (category, online/offline/hybrid, date, venue, joining link, capacity, service hours), and close, reopen, complete or delete them. New campaigns show up on the homepage straight away.
- **Registrations:** filter and search registrations, add walk-in or paper sign-ups, mark people as attended, issue a certificate to one person or to every attendee, and export to CSV.
- **Certificates:** view and print any certificate, copy its verification link, revoke it, and export to CSV.
- **Wealth enquiries:** private-client leads from the website, each with a status (new → contacted → onboarded / closed).
- **Settings:** change the admin email and password, download a full JSON backup, and reset the demo data.

Default admin account: `admin@royaltynexus.org` / `RoyalNexus@2026`. **Change it under Settings as soon as you sign in.**

## Running locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly from disk also works, but a local server behaves more like a real host.

## ⚠️ Before going live: add a backend

All data (campaigns, registrations, certificates, enquiries and the admin password hash) is stored in the visitor's browser (`localStorage`). This is fine for a demo or for one admin working on one computer. **In production it means a volunteer's registration on their phone will never reach the admin's laptop,** and anyone could view or change the admin login from their browser's developer tools.

To run this for the public, connect a server-side database and auth, for example Supabase or Firebase. All data access goes through the `RN` object in `js/store.js`, so only that file needs rewriting. The pages don't need to change. On the backend you'll need:

- Tables for `campaigns`, `registrations`, `certificates` and `enquiries`
- Row-level security: anyone can insert registrations and enquiries and read open campaigns and certificates by ID; only admins can do everything else
- Real admin authentication in place of the client-side password hash

## Structure

```
index.html  register.html  verify.html
admin/      login.html, dashboard.html
css/        style.css (public site), admin.css, certificate.css
js/         store.js (data layer), scene.js (landscape + parallax),
            main.js (homepage), register.js, admin.js
assets/     favicon.svg
```

## Real forest photography

Put photos in `assets/photos/` (`forest-hero.jpg`, `forest-lake.jpg`, `forest-canopy.jpg`) and each scene switches from the drawn landscape to the photo, with parallax, a slow zoom, mist and light rays on top. Until a photo is there, that scene keeps the drawing. See `assets/photos/README.md` for which photo goes where.

For moving footage, put looping clips in `assets/video/` (`forest-hero.webm`/`.mp4`, `forest-lake.webm`/`.mp4`). A clip plays muted in the background with the same overlays and takes priority over the photo. See `assets/video/README.md`.

The site currently ships with motion-graphic forest loops and matching stills, rendered by `tools/motion/`. That tool also makes a 26-second branded promo video. See `tools/motion/README.md` to re-render or edit them.

Motion is turned off automatically for visitors who have `prefers-reduced-motion` set.
