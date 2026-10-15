
# Touchline Market: live listings setup

The storefront works in demo mode until Supabase is configured. Supabase stores listings and uploaded images, enforces admin-only changes with database policies, and sends listing changes to visitors in real time.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com/).
2. Open **Project Settings > API** and copy the Project URL and the publishable key (or legacy `anon` key).
3. Open `supabase-config.js` and put those values in `url` and `publishableKey`.
4. Never use or paste the `service_role` key in this website. It bypasses security policies.

The URL and publishable/anon key are intended for browser use. Database row-level security is what restricts edits.

## 2. Create the database and image storage

1. In the Supabase dashboard, open **SQL Editor**.
2. Open `supabase/schema.sql`, paste the whole file into a new query, and run it.
3. Confirm it completes successfully. It creates the listings table, admin policies, a public-read/private-write image bucket, and Realtime publication access.

## 3. Create your administrator login

1. In Supabase, open **Authentication > Users** and add a user with an email and password. Disable public signups in **Authentication > Providers > Email** if the option is available.
2. Copy that user's UUID from the Users list.
3. In **SQL Editor**, replace `YOUR_AUTH_USER_UUID` below and run:

```sql
insert into public.admin_users (user_id)
values ('YOUR_AUTH_USER_UUID');
```

Only users in `admin_users` can create or edit listings and upload/delete listing images. The admin page does not offer public account registration.

## 4. Run and publish

For local testing, open the project through a local web server (for example, VS Code Live Server); do not use `file://` for Supabase authentication. Add your local URL to **Authentication > URL Configuration > Redirect URLs**. Then open `admin.html`, sign in, and add a test listing. Confirm it appears on `market.html`, then edit its price or status to test live updates.

Publish the complete folder to a static host such as Netlify, Cloudflare Pages, or GitHub Pages. Add the deployed site URL to the Supabase redirect URL allowlist. Keep `index.html`, `market.html`, `admin.html`, scripts, styles, `account1.jpg`, and `supabase-config.js` together. Do not publish `supabase/schema.sql` as a public page; it is okay to keep the SQL file in your source repository.

## Managing listings

Open `admin.html` and sign in. Add/edit the title, platform, squad rating, price/currency, players, description, WhatsApp number (international digits only), visibility, and one or more account screenshots. **Draft** listings stay private, **Active** listings appear in the market, and **Sold** listings are hidden from buyers. Images must be JPG, PNG, or WebP and no larger than 8 MB each.

Visitors see database-backed listings and listing changes without refreshing once Realtime is enabled. If Supabase is not configured, the site continues to show its clearly labeled sample listings.
