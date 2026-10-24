# Sodhi Visuals + Admin CMS

Static site on Netlify + Supabase (Auth, Postgres with RLS, Storage). **No service-role key is used anywhere**: the browser only holds the public anon key, and every write is allowed or refused by Postgres/Storage policies that check the `admins` table.

## One-time setup
1. **Supabase**: create a project. Auth > Sign In/Providers: keep Email, **turn OFF "Allow new users to sign up"** (no public registration). Optionally enable CAPTCHA and lower the Auth rate limits.
2. Auth > Users > **Add user** (your email + a long password, "Auto confirm").
3. SQL Editor: run `supabase/schema.sql`, then the last commented line with your email (this is the admin allowlist).
4. Netlify > Site configuration > Environment variables:
   - `SUPABASE_URL` — public (Project Settings > API > Project URL)
   - `SUPABASE_ANON_KEY` — public (the anon/publishable key)
   - Never add the `service_role` key. It is not needed.
5. Push this folder to Git (or drag-and-drop deploys won't run the build command, so use Git/Netlify CLI), deploy, then open `/admin`.
6. Auth > URL Configuration: set Site URL to your `*.netlify.app` address.

## Notes
- Public site shows only `status = published` (enforced by RLS, not by the page). With no config it falls back to the labelled placeholder projects.
- Videos: paste YouTube/Vimeo links. Only images (JPG/PNG/WebP/GIF, 10 MB) are uploaded; Storage enforces this server-side.
- Deleting a project does not delete its image files (Media Library > Delete).
- Add your existing real projects through the admin; the old placeholders are not migrated.

## Security checks to run after deploy (not yet run)
```
curl "$URL/rest/v1/projects?select=*" -H "apikey: $ANON"                      # only published rows
curl -X POST "$URL/rest/v1/projects" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"title":"x"}'   # must fail
```
Also sign in with a second, non-allowlisted user: `/admin` must refuse, and the same POST using that user's token must fail.
Search the deployed JS for `service_role` (must be absent).
