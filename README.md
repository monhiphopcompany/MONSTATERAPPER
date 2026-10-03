# MON HIPHOP — GitHub Pages + Supabase CMS

This version separates the public website and Admin page and stores content in Supabase instead of browser-only `localStorage`.

## Files
- `index.html` — public website.
- `admin.html` — separate Admin login + CMS.
- `config.js` — Supabase URL and browser-safe anon/public key. Fill this before deploying.
- `config.example.js` — template for `config.js`.
- `supabase-schema.sql` — database + RLS + Realtime setup.
- `script.js` — public cloud content loader and Realtime sync.
- `admin.js` — authenticated Admin CRUD, Google Drive link handling, and local-data migration.

## 1. Create Supabase project
1. Create a project at Supabase.
2. Open **SQL Editor** and run all of `supabase-schema.sql`.
3. Go to **Authentication → Users** and create the Admin user (email + password). Keep public sign-ups disabled.
4. Copy that user's UUID.
5. Run this SQL once, replacing the UUID:

```sql
insert into public.admin_users (user_id) values ('PASTE_AUTH_USER_UUID_HERE');
```

## 2. Configure the website
Open `config.js` and replace:

```js
window.MON_HIPHOP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY"
};
```

Get these values from **Supabase → Project Settings → API**.

**Never use the `service_role` key in `config.js`.** The browser should only contain the anon/public key; Row Level Security protects the database.

## 3. Deploy to GitHub Pages
1. Create a GitHub repository.
2. Upload all files in this folder to the repository root.
3. Commit and push.
4. Open **Settings → Pages**.
5. Select **Deploy from a branch**, choose the main branch and `/ (root)`.
6. Open the generated GitHub Pages URL.

Public website:
- `https://YOUR-USER.github.io/YOUR-REPO/`

Admin:
- `https://YOUR-USER.github.io/YOUR-REPO/admin.html`

## 4. Google Drive images
The existing workflow is preserved:
1. Upload the image to Google Drive.
2. Set sharing to **Anyone with the link — Viewer**.
3. Paste the sharing link into Admin.
4. Admin stores the Drive link and converts the file ID to an image URL for the public card.

This does **not** upload files directly to Drive through OAuth. It continues using Google Drive sharing links, so no Google secret is exposed in GitHub Pages.

## 5. Cloud sync behavior
- Admin changes are stored in Supabase.
- Every device loads the same cloud data.
- Public pages subscribe to Supabase Realtime, so open pages refresh their content after Admin changes.
- Admin pages also refresh when another Admin changes content.
- Browser `localStorage` is no longer the source of truth.
- The Admin button **IMPORT OLD LOCAL DATA** can migrate content from the previous `monHipHopContentV1` local storage into Supabase.

## Security notes
- GitHub Pages is public; `config.js` is therefore public by design.
- Only use the Supabase anon/public key in the frontend.
- Do not put database passwords, service-role keys, Google OAuth client secrets, or private Drive credentials in this repository.
- Admin write access is protected by Supabase Authentication + the `admin_users` table + Row Level Security.
