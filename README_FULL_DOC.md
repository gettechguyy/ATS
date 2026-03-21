# HireTrack - Full App Workflow Documentation (Non-Technical)

This document explains how the app works from end-to-end, including every main page in the left navigation bar. It is written so a non-technical manager can review the full flow, spot loose ends, and discuss next improvements with the team.

## 1. What the app is used for

The app helps a recruiting team manage a pipeline from:

1. Creating candidates
2. Assigning candidates to recruiters (and optionally to team leads / agencies)
3. Recording job applications (called "Submissions" in the app)
4. Moving each submission through key workflow stages:
   - Applied
   - Vendor Responded
   - Screen Call
   - Interview
   - Offered
   - Rejected (or otherwise not moved forward)
5. Tracking offers and outcomes

The app is role-based. Different roles see different data and can perform different actions.

## 2. Roles in the app

Below is the practical “what you can do” view (based on the UI behaviors and page visibility).

1. **Admin (master admin)**
   - Manages everything: candidates, assignments, submissions, agencies, and users
   - Can create agency admins and manage agencies
   - Can also manage user roles, create accounts, and create candidate invites
2. **Manager**
   - Typically has read-only or limited access compared to admin
   - Can see key pipeline dashboards and lists depending on configuration
3. **Team Lead**
   - Sees candidates and submissions that belong under their team scope
4. **Agency Admin**
   - Manages agency-level access
   - Can see candidates and submissions for their agency
   - Can enable/disable agency logins (via Agencies page toggle)
5. **Recruiter**
   - Works mostly inside their assigned candidates
   - Can add new submissions (applications) and move them through the workflow
   - Can schedule screens and update outcomes
6. **Candidate**
   - Sees their own candidate page (read-only)
   - Sees their own submissions and interview/offer progress

## 3. How login works (simple explanation)

1. Users sign in using the **Login** page.
2. Admin creates accounts and invites candidates:
   - Recruiters / admins: created with an email + password
   - Candidates: created as invites (with a set-password link)
3. **Agency inactivity blocks login**
   - Admin can mark an agency as inactive on the **Agencies** page.
   - Users belonging to an inactive agency should not be able to log in.

## 4. Navigation (left sidebar pages)

Once logged in, the user sees these main sections:

1. Dashboard
2. Candidates
3. My Profile (only for Candidates)
4. Applications (Submissions list / pipeline management)
5. Submission (Vendor Responded list)
6. Screens
7. Interviews
8. Offers
9. Agencies (Admin only)
10. User Management (Admin + certain internal roles)
11. Invites (Admin)

## 5. End-to-end workflow (big picture)

### Step A: Create and assign candidates

Go to **Candidates** page.

Typical actions:
1. Create a candidate (Admin/Manager features depending on role)
2. Assign a recruiter (and optionally assign an agency and/or team lead through User Management)
3. Open the candidate detail page by clicking the eye icon.

The candidate record has its own status (example: New, Ready For Assign, Ready For Marketing, In Marketing, Placed, etc.).

### Step B: Add Applications (Submissions)

Go to **Applications**.

How it looks:
- For non-candidates, the screen is grouped by candidate.
- You can expand a candidate row (chevron) to see all their submissions in a side list.

What you do here:
1. **Add Application**: select candidate + client + position, then create a new submission.
2. For each submission in the expanded list:
   - Change status using the status dropdown
   - Upload vendor job description where needed
   - Schedule screens (and upload screen resume/questions)

### Step C: Vendor Responded stage

When status becomes **Vendor Responded**:
- The app supports capturing vendor details such as:
  - Rate
  - Rate type
  - Job type (Remote/Hybrid/On-site)
  - Job description (text or file upload)
  - City/State if not Remote

There is a dedicated page:
- **Submission (Vendor Responded)** (filtered list)

Recruiters/Admin can:
1. View only Vendor Responded submissions
2. Update submission status from a dropdown
3. Use the **Add** button to create a new Vendor Responded submission, including capturing required vendor details.

### Step D: Screen Call stage

Go to **Screens**.

What you do:
1. See all submissions in Screen Call stage.
2. Update outcome (Positive/Negative/DidNotHappen) for candidate and/or recruiter depending on role.
3. If recruiter marks the screen as Positive, the app provides a button to **Add Interview**.

### Step E: Interview stage

Go to **Interviews**.

What you do:
1. View scheduled interviews (round, scheduled time, mode, status)
2. Use the eye button to open the submission detail page.
3. In the submission detail page, you can schedule interviews and update interview outcomes.

### Step F: Offers stage

Go to **Offers**.

What you do:
1. View offers with acceptance status (Pending/Accepted/Declined).
2. Update status using a dropdown.
3. Use the eye icon to open the related submission detail page.

## 6. Page-by-page documentation

### 6.1 Dashboard

Purpose:
- Provides quick counts and trends for the selected date range.

Key behaviors:
- Admin/Agency Admin can filter by candidate, technology, recruiter, and date range.
- Recruiters see their own progress.
- Candidates see their own dashboard.

What the user sees:
- “Cards” summarizing total candidates, pipeline counts, screen calls, interviews, offers, and placements.

### 6.2 Candidates

Purpose:
- Manage candidate records and assignments.

Key features:
1. Search and filter by:
   - Candidate status
   - Technology (based on data in your candidate pool)
   - Agency and recruiter
2. Different roles see different candidate pools:
   - Admin sees all candidates
   - Recruiter sees assigned candidates
   - Agency admin sees candidates in their agency
3. Activity table:
   - Eye icon opens candidate detail
   - Admin may delete or edit depending on UI

### 6.3 Candidate Detail

Purpose:
- One page that contains the candidate’s full profile and pipeline.

Sections include:
1. **Applications**: list of submissions for that candidate
2. **Education** (add/edit education records)
3. **Professional Details**:
   - Technology
   - Experience years
   - Primary skills
   - Target role
   - Expected salary
   - Interview availability
   - Client references
4. **Marketing Details**:
   - Unlocks only when candidate data is complete enough (education + experience + professional + basic)
   - Contains marketing contact fields and notes

File uploads:
- Candidate resume upload, cover letter upload, and other document upload components.

Role-based access:
- Recruiters can see professional details (read-only), and the section is expanded by default for assigned visibility.

### 6.4 Applications (Submissions page)

Purpose:
- Main operational page to manage submissions through the pipeline.

Key components:
1. Top search
2. Status filter dropdown
3. Candidate filter dropdown (for non-candidate roles)
4. Expandable candidate rows to open a side sheet with all submissions for that candidate.

Actions you can take:
1. Add Application
2. Change submission status
3. Upload vendor job description
4. Schedule screen calls and upload screen resume/questions
5. Use eye icon to open a submission detail page.

Status flow in this UI:
- As status changes, some actions become available (vendor -> screen -> interview -> offer).

### 6.5 Submission (Vendor Responded) page

Purpose:
- A focused view of only Vendor Responded submissions.

Key features:
1. **Search submissions** (text search across candidate name, client name, position)
2. **Filter by candidate** dropdown
3. Status dropdown per row (so you can move Vendor Responded items forward/backward)
4. **Add** button:
   - Admin/Recruiter can add a new submission already in Vendor Responded status
   - Required vendor fields are collected:
     - Rate
     - Rate type
     - Job type
     - Job description (text or uploaded document)
     - City/State if not Remote
5. Eye icon opens submission detail.

### 6.6 Screens

Purpose:
- Tracks screen calls scheduling and outcomes.

Key behaviors:
1. Shows screen scheduled time, mode, and links to resume/questions.
2. Lets recruiter/admin mark outcomes (Positive/Negative/DidNotHappen).
3. If recruiter marks Positive, there is an option to add an interview.

### 6.7 Interviews

Purpose:
- Shows scheduled interviews and their current state.

Key behaviors:
- List shows round number, scheduled date/time, interview mode and status.
- Eye icon takes you to submission detail, where you can manage interviews.

### 6.8 Offers

Purpose:
- Shows offer records and whether they are accepted/declined/pending.

Key behaviors:
- Status dropdown for each offer.
- Eye icon opens submission detail.

### 6.9 Agencies (Admin only)

Purpose:
- Create and manage agencies and agency admins.

Key features:
1. Create new agencies
2. Create agency admin user for an agency
3. Edit agency name
4. Toggle agency active/inactive:
   - Inactive agencies should block logins for their users

### 6.10 User Management (Admin/Team internal)

Purpose:
- Manage users and roles and team lead assignments.

Key features:
1. Tabs for Team / Candidates (depending on design)
2. Create users or invites:
   - Candidate accounts are created via invite token flow
   - Recruiters/admins created directly with password
3. Toggle user active/inactive
4. Change roles
5. Assign candidates to team leads
6. Set or change passwords (admin tools)

### 6.11 Invites (Admin)

Purpose:
- Lists candidate invites that are pending/used.

Key actions:
- Copy set-password links for pending invites.

### 6.12 Login

Purpose:
- Standard sign-in page.

### 6.13 Set Password

Purpose:
- Invited candidates set their password using the token.

### 6.14 My Profile (Candidate redirect)

Purpose:
- Candidate is redirected to their own candidate detail page.

## 7. Uploads and required documents (high-level)

The app includes document upload steps at different stages:

1. Candidate stage
   - Resume / cover letter uploads in candidate detail sections
2. Vendor response stage
   - Vendor job description:
     - Can be typed in a field
     - Or uploaded as a document
3. Screen call stage
   - Screen resume and screen questions uploads
4. Interview stage
   - Interview questions upload

## 8. What “status change” means in practical terms

Each pipeline action is tracked using a status field:

Common submission statuses:
- Applied
- Vendor Responded
- Screen Call
- Interview
- Rejected
- Offered

In the UI:
- You can update status using dropdowns.
- When you move a submission out of a page’s filter scope (for example: out of “Vendor Responded”), it may disappear from that filtered page after refresh.

## 9. Loose ends / discussion prompts for the team

Use this section in your next team meeting to identify what still needs clarification or improvements.

1. Confirm exact role permissions for Manager and Team Lead (what is view-only vs editable).
2. Confirm whether status changes should immediately refresh all relevant pages (cross-page navigation behavior).
3. Confirm required fields at every stage (for example: what is required when creating a Vendor Responded submission).
4. Confirm agency inactive behavior end-to-end (login block + assignment restrictions).
5. Confirm search + filter behaviors on every pipeline list page (especially candidate-scoped search).

## 10. Appendix: Page routes (for reference)

- `/` : Dashboard
- `/candidates` : Candidates list
- `/candidates/:id` : Candidate Detail
- `/submissions` : Applications (Submissions)
- `/submissions/:id` : Submission Detail
- `/submissions-vendor` : Vendor Responded submissions
- `/screens` : Screen Calls
- `/interviews` : Interviews list
- `/offers` : Offers list
- `/admin/agencies` : Agencies (Admin)
- `/admin/users` : User Management (Admin)
- `/admin/invites` : Invites (Admin)

