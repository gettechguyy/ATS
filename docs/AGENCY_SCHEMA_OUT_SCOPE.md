w# Out Marketing Agency – Required Tables and Columns

This document lists **all tables and columns** required for the **out marketing agency** scope. Use it to create or verify the schema (e.g. if the `agencies` table or related columns do not exist).

---

## 1. New table: `public.agencies`

| Column       | Type      | Nullable | Default           | Description                    |
|-------------|-----------|----------|-------------------|--------------------------------|
| `id`        | uuid      | NOT NULL | gen_random_uuid() | Primary key                    |
| `name`      | text      | NOT NULL | —                 | Agency display name            |
| `type`      | text      | NOT NULL | 'out'             | Must be `'in'` or `'out'`      |
| `created_at`| timestamptz | NOT NULL | now()           | Creation timestamp             |

**Constraints:** `type` CHECK (`type` IN ('in', 'out')).

**Scope:** Out agencies only; master company (Thetechguyy) has no row here.

---

## 2. Enum: `app_role` (add one value)

- Existing: `admin`, `recruiter`, `candidate`, `manager`, `team_lead`
- **Add:** `agency_admin`

---

## 3. Existing table: `public.profiles` – add column

| Column      | Type | Nullable | Default | Description                                      |
|------------|------|----------|---------|--------------------------------------------------|
| `agency_id`| uuid | NULL     | —       | FK → `agencies(id)` ON DELETE SET NULL. User’s agency; NULL = master (Thetechguyy). |

---

## 4. Existing table: `public.candidates` – add column

| Column      | Type | Nullable | Default | Description                                                       |
|------------|------|----------|---------|-------------------------------------------------------------------|
| `agency_id`| uuid | NULL     | —       | FK → `agencies(id)` ON DELETE SET NULL. Assigned out agency; set by master admin. |

---

## 5. Indexes (recommended)

- `idx_candidates_agency_id` on `candidates(agency_id)`
- `idx_profiles_agency_id` on `profiles(agency_id)`

---

## 6. RPC / app behaviour (summary)

- **`login`**  
  Profile JSON returned to the client must include `agency_id` (from `profiles.agency_id`).

- **`create_app_user`**  
  Must accept optional 6th parameter `p_agency_id` (uuid, default NULL):
  - Master admin + `p_agency_id` + role `agency_admin` → new user is agency admin for that agency (`profiles.agency_id` = `p_agency_id`).
  - Caller is `agency_admin` + role `recruiter` → new user is recruiter in caller’s agency (`profiles.agency_id` = caller’s `agency_id`).

- **`update_app_user_password`**  
  Agency admins may update password only for users in the same agency (`profiles.agency_id` = caller’s `agency_id`).

---

## 7. SQL to create schema (run in order)

If the agency schema does not exist, run the migrations in this order:

1. **`20260223100000_agencies_and_agency_admin.sql`** – creates `agencies`, adds `agency_admin` to `app_role`, adds `agency_id` to `profiles` and `candidates`, creates indexes.
2. **`20260223100001_agency_login_create_user.sql`** – updates `login`, `create_app_user`, and `update_app_user_password` for agency support.

Or run the statements from those files manually in the Supabase SQL editor.

---

## 8. Out-agency scope summary

| Concept            | Stored where              | Notes                                      |
|--------------------|---------------------------|--------------------------------------------|
| Out agency         | `agencies` (type = 'out') | Created by Thetechguyy admin               |
| Agency admin user  | `profiles.agency_id` + `user_roles.role = 'agency_admin'` | One admin per agency, created by master   |
| Agency recruiters  | `profiles.agency_id` + `user_roles.role = 'recruiter'`   | Created by agency admin                   |
| Candidate assigned to agency | `candidates.agency_id`     | Set by master admin; agency then sees them |
| Master company     | `profiles.agency_id IS NULL` (and role admin) | Thetechguyy                              |
