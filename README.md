# GNC Kumo

A React + TypeScript + Vite starter for the GNC Kumo church music and community application.

## Included in this first build
- Responsive purple, white and ash interface
- Member registration fields: name, phone, email, address, photo, favourite song, date of birth, marital status and education
- Email/password sign-in
- New members default to `pending` approval
- Member waiting screen until an administrator approves the account
- Initial member home, music library, announcements, member list and admin panel views
- Supabase schema with Row Level Security policies

## Requirements
- Node.js 20 or later
- A Supabase project

## Run locally
1. Extract the project.
2. Copy `.env.example` to `.env`.
3. Add your Supabase project URL and anon/publishable key.
4. Install and run:

```bash
npm install
npm run dev
```

## Supabase setup
1. Create a new Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication settings, configure email confirmation to suit your church's registration process.
4. In Storage, create buckets:
   - `profile-photos` (private)
   - `song-covers` (public)
   - `song-audio` (public only if songs are intended for public playback URLs)
   - `song-midi` (private unless MIDI downloads should be public)
5. Add secure Storage policies before allowing uploads. Do not make profile photos public.
6. Add the URL and anon/publishable key to `.env`.

## First administrator
For safety, public registration can only create a `member` with `pending` approval. Do not add a public admin-registration option.
After creating the trusted church owner account, assign its role from the Supabase SQL Editor using the exact account UUID:

```sql
update public.profiles
set role = 'super_admin', approval_status = 'approved'
where id = 'PASTE-TRUSTED-USER-UUID-HERE';
```

Only the trusted project owner should run this command. Never expose the Supabase `service_role` key in frontend code.

## Current limitations
This is the initial working scaffold, not the finished product. The UI for uploading music, approving members, publishing announcements and managing admins is planned for the next build stage. Do not present those controls as completed until implemented and tested. Storage upload policies and password reset/email verification flows also need to be completed before production launch.
