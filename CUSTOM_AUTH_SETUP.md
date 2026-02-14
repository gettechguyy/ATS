# Custom Auth Setup

This app uses **your own auth** (no Supabase Auth): users are stored in `app_users` with hashed passwords, and session is kept in **localStorage** under the key `app_session`.

## 1. Run the migration

In **Supabase Dashboard → SQL Editor**, run the migration:

`supabase/migrations/20260215000000_custom_auth_app_users.sql`

Or, if you use the Supabase CLI: `supabase db push` (or run the SQL file manually).

## 2. Create your first admin user

After the migration, create one admin so you can log in and add more users from **User Management**:

In **Supabase → SQL Editor**, run (change email/password as needed):

```sql
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.app_users (email, password_hash)
  VALUES ('admin@example.com', crypt('changeme123', gen_salt('bf')))
  RETURNING id INTO v_id;
  INSERT INTO public.profiles (user_id, full_name, email, is_active)
  VALUES (v_id, 'Admin', 'admin@example.com', true);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_id, 'admin');
END $$;
```

Then sign in at `/login` with **admin@example.com** / **changeme123** and change the password or add more users from **Admin → User Management**.

## 3. Roles and permissions

- **Admin**: Full access. Only admins can add **candidates**, and only admins can open **User Management** to add/update users and change roles.
- **Recruiter**: Can add **submissions**, manage **interviews**, and track **offers**. Cannot add candidates.
- **Candidate / Student**: Can log in with valid email/password (created by admin). Can view their linked candidate data, submissions, interviews, offers.
- **Manager**: Can view submissions, interviews, offers (read-only as configured).

Session is restored from **localStorage** on reload; no Supabase Auth is used.
