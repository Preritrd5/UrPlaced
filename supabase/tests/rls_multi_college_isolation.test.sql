-- ==============================================================================
-- UrPlaced: Automated pgTAP RLS & Multi-College Isolation Test Suite
-- Database: PostgreSQL (pgTAP)
-- Scope: Two Colleges (Sapthagiri vs ABC College)
-- Users: Placement Head, Staff, Trainer, Student per college + Super Admin
-- Resources Tested:
--   - tenant_memberships
--   - students
--   - question_banks, questions, question_sets
--   - assessments, assessment_attempts
--   - recruitment_drives, drive_applications, placement_offers
--   - notifications
--   - storage.objects (avatars)
--   - database triggers & unique constraints
--   - Strict Option A for Platform Super Admin
-- ==============================================================================

BEGIN;
SELECT plan(92);

CREATE EXTENSION IF NOT EXISTS pgtap;

DO $$
DECLARE
    v_sapthagiri_id UUID := '00000000-0000-0000-0000-000000000001';
    v_abc_id UUID        := '00000000-0000-0000-0000-000000000002';
    v_sap_head UUID      := '11111111-1111-1111-1111-111111111111';
    v_sap_staff UUID     := '11111111-1111-1111-1111-111111111112';
    v_sap_trainer UUID   := '11111111-1111-1111-1111-111111111113';
    v_sap_student UUID   := '11111111-1111-1111-1111-111111111114';
    v_abc_head UUID      := '22222222-2222-2222-2222-222222222221';
    v_abc_staff UUID     := '22222222-2222-2222-2222-222222222222';
    v_abc_trainer UUID   := '22222222-2222-2222-2222-222222222223';
    v_abc_student UUID   := '22222222-2222-2222-2222-222222222224';
    v_super_admin UUID   := '99999999-9999-9999-9999-999999999999';
    v_sap_dept UUID      := 'ffffffff-ffff-ffff-ffff-fffffffffff1';
    v_abc_dept UUID      := 'ffffffff-ffff-ffff-ffff-fffffffffff2';
BEGIN
    -- 1. Insert Tenants
    INSERT INTO public.tenants (id, name, slug, status)
    VALUES 
        (v_sapthagiri_id, 'Sapthagiri College of Engineering', 'sapthagiri', 'ACTIVE'),
        (v_abc_id, 'ABC Institute of Technology', 'abc-tech', 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';

    -- 2. Insert Auth Users
    INSERT INTO auth.users (id, email)
    VALUES 
        (v_sap_head, 'jack.head@sapthagiri.edu.in'),
        (v_sap_staff, 'pop.staff@sapthagiri.edu.in'),
        (v_sap_trainer, 'alice.trainer@sapthagiri.edu.in'),
        (v_sap_student, 'student1@sapthagiri.edu.in'),
        (v_abc_head, 'head@abc.edu.in'),
        (v_abc_staff, 'staff@abc.edu.in'),
        (v_abc_trainer, 'trainer@abc.edu.in'),
        (v_abc_student, 'student1@abc.edu.in'),
        (v_super_admin, 'admin@urplaced.com')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Insert Profiles for all test users
    INSERT INTO public.profiles (id, email, full_name, is_platform_admin)
    VALUES 
        (v_sap_head, 'jack.head@sapthagiri.edu.in', 'Jack Head', false),
        (v_sap_staff, 'pop.staff@sapthagiri.edu.in', 'Pop Staff', false),
        (v_sap_trainer, 'alice.trainer@sapthagiri.edu.in', 'Alice Trainer', false),
        (v_sap_student, 'student1@sapthagiri.edu.in', 'SapStudent One', false),
        (v_abc_head, 'head@abc.edu.in', 'ABC Head', false),
        (v_abc_staff, 'staff@abc.edu.in', 'ABC Staff', false),
        (v_abc_trainer, 'trainer@abc.edu.in', 'ABC Trainer', false),
        (v_abc_student, 'student1@abc.edu.in', 'AbcStudent One', false),
        (v_super_admin, 'admin@urplaced.com', 'UrPlaced Super Admin', true)
    ON CONFLICT (id) DO UPDATE SET is_platform_admin = EXCLUDED.is_platform_admin;

    -- 4. Insert Tenant Memberships
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
    VALUES
        (v_sapthagiri_id, v_sap_head, 'PLACEMENT_HEAD', 'ACTIVE'),
        (v_sapthagiri_id, v_sap_staff, 'PLACEMENT_STAFF', 'ACTIVE'),
        (v_sapthagiri_id, v_sap_trainer, 'TRAINER', 'ACTIVE'),
        (v_sapthagiri_id, v_sap_student, 'STUDENT', 'ACTIVE'),
        (v_abc_id, v_abc_head, 'PLACEMENT_HEAD', 'ACTIVE'),
        (v_abc_id, v_abc_staff, 'PLACEMENT_STAFF', 'ACTIVE'),
        (v_abc_id, v_abc_trainer, 'TRAINER', 'ACTIVE'),
        (v_abc_id, v_abc_student, 'STUDENT', 'ACTIVE')
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'ACTIVE';

    -- 5. Insert Departments
    INSERT INTO public.departments (id, tenant_id, name, code, status)
    VALUES
        (v_sap_dept, v_sapthagiri_id, 'Computer Science', 'CSE', 'ACTIVE'),
        (v_abc_dept, v_abc_id, 'Computer Science', 'CSE', 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;

    -- 6. Insert Student Rosters
    INSERT INTO public.students (id, tenant_id, user_id, enrollment_number, full_name, email, department_id, graduation_year, cgpa)
    VALUES
        ('33333333-3333-3333-3333-333333333331', v_sapthagiri_id, v_sap_student, '1SG22CS001', 'SapStudent One', 'student1@sapthagiri.edu.in', v_sap_dept, 2026, 8.5),
        ('33333333-3333-3333-3333-333333333332', v_abc_id, v_abc_student, '1AB22CS001', 'AbcStudent One', 'student1@abc.edu.in', v_abc_dept, 2026, 8.5)
    ON CONFLICT (id) DO NOTHING;
END $$;

--------------------------------------------------------------------------------
-- TEST 1-4: Tenant Memberships Isolation
--------------------------------------------------------------------------------
-- Authenticate as Sapthagiri Placement Head
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

SELECT ok(
    EXISTS (SELECT 1 FROM public.tenant_memberships WHERE tenant_id = '00000000-0000-0000-0000-000000000001'),
    'Sapthagiri Head CAN see Sapthagiri members'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE tenant_id = '00000000-0000-0000-0000-000000000002'),
    'Sapthagiri Head CANNOT see ABC College members'
);

-- Authenticate as Sapthagiri Student
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111114';

SELECT is(
    (SELECT count(*)::int FROM public.tenant_memberships),
    1,
    'Sapthagiri Student can only see their own membership'
);

SELECT ok(
    (SELECT user_id FROM public.tenant_memberships LIMIT 1) = '11111111-1111-1111-1111-111111111114',
    'Sapthagiri Student membership query returns only their own user_id'
);

--------------------------------------------------------------------------------
-- TEST 5-8: Student Directory & Roster Isolation
--------------------------------------------------------------------------------
-- Authenticate as ABC Placement Head
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222221';

SELECT ok(
    EXISTS (SELECT 1 FROM public.students WHERE tenant_id = '00000000-0000-0000-0000-000000000002'),
    'ABC Head CAN see ABC student roster'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.students WHERE tenant_id = '00000000-0000-0000-0000-000000000001'),
    'ABC Head CANNOT see Sapthagiri student roster'
);

-- Cross-college modification attempt by ABC Head
WITH updated AS (
    UPDATE public.students SET full_name = 'Hacked' WHERE tenant_id = '00000000-0000-0000-0000-000000000001' RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM updated),
    0,
    'ABC Head CANNOT update Sapthagiri student records (0 rows updated)'
);

-- Authenticate as ABC Student
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222224';

SELECT is(
    (SELECT count(*)::int FROM public.students),
    1,
    'ABC Student can only see their own student profile'
);

--------------------------------------------------------------------------------
-- TEST 9-14: Question Banks, Questions & Sets Isolation
--------------------------------------------------------------------------------
-- Create Sapthagiri Question Bank as Admin
RESET ROLE;
INSERT INTO public.question_banks (id, tenant_id, name, category, sharing_policy, status)
VALUES ('44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000001', 'Sapthagiri Internal Bank', 'TECHNICAL_CORE', 'COLLEGE_PRIVATE', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.questions (id, tenant_id, bank_id, question_type, lifecycle_status)
VALUES ('55555555-5555-5555-5555-555555555551', '00000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444441', 'SINGLE_CHOICE', 'PUBLISHED')
ON CONFLICT (id) DO NOTHING;

-- Authenticate as Sapthagiri Placement Staff
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111112';

SELECT ok(
    EXISTS (SELECT 1 FROM public.question_banks WHERE id = '44444444-4444-4444-4444-444444444441'),
    'Sapthagiri Staff CAN see Sapthagiri question bank'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.questions WHERE id = '55555555-5555-5555-5555-555555555551'),
    'Sapthagiri Staff CAN see Sapthagiri questions'
);

-- Authenticate as ABC Placement Staff
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.question_banks WHERE id = '44444444-4444-4444-4444-444444444441'),
    'ABC Staff CANNOT see Sapthagiri private question bank'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.questions WHERE id = '55555555-5555-5555-5555-555555555551'),
    'ABC Staff CANNOT see Sapthagiri questions'
);

-- Cross-college insert attempt: ABC Staff attempts to insert into Sapthagiri Bank
SELECT throws_ok(
    $$ INSERT INTO public.questions (tenant_id, bank_id, question_type, lifecycle_status)
       VALUES ('00000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444441', 'SINGLE_CHOICE', 'APPROVED') $$,
    NULL,
    'ABC Staff CANNOT insert questions into Sapthagiri college bank'
);

-- Authenticate as Sapthagiri Student
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111114';

SELECT ok(
    EXISTS (SELECT 1 FROM public.question_banks WHERE id = '44444444-4444-4444-4444-444444444441'),
    'Sapthagiri Student CAN see Sapthagiri question bank under student read policy'
);

--------------------------------------------------------------------------------
-- TEST 15-20: Assessments & Assessment Attempts Isolation
--------------------------------------------------------------------------------
-- Reset Role to create question set, assessment and attempt
RESET ROLE;
INSERT INTO public.question_sets (id, tenant_id, name, purpose, status, version_number, is_locked)
VALUES ('66666666-6666-6666-6666-666666666660', '00000000-0000-0000-0000-000000000001', 'Sapthagiri Coding Set', 'ASSESSMENT', 'PUBLISHED', 1, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessments (id, tenant_id, title, purpose, question_set_id, set_version_id, allowed_attempts, review_policy, release_policy, shuffle_questions, pass_percentage, status)
VALUES ('66666666-6666-6666-6666-666666666661', '00000000-0000-0000-0000-000000000001', 'Sapthagiri Coding Test', 'ASSESSMENT', '66666666-6666-6666-6666-666666666660', 1, 1, 'IMMEDIATE', 'IMMEDIATE', false, 60.00, 'PUBLISHED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assessment_attempts (id, tenant_id, assessment_id, student_id, attempt_number, status, total_points, earned_points, score_percentage, is_passed, scoring_status, client_meta)
VALUES ('77777777-7777-7777-7777-777777777771', '00000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666661', '33333333-3333-3333-3333-333333333331', 1, 'SUBMITTED', 100, 85, 85, true, 'FINAL', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Authenticate as Sapthagiri Student
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111114';

SELECT ok(
    EXISTS (SELECT 1 FROM public.assessment_attempts WHERE id = '77777777-7777-7777-7777-777777777771'),
    'Sapthagiri Student CAN see their own assessment attempt'
);

-- Authenticate as ABC Student
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222224';

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.assessment_attempts WHERE id = '77777777-7777-7777-7777-777777777771'),
    'ABC Student CANNOT see Sapthagiri student assessment attempt'
);

-- Authenticate as Sapthagiri Placement Staff
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111112';

SELECT ok(
    EXISTS (SELECT 1 FROM public.assessment_attempts WHERE id = '77777777-7777-7777-7777-777777777771'),
    'Sapthagiri Staff CAN view Sapthagiri assessment attempt'
);

-- Authenticate as ABC Placement Staff
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.assessment_attempts WHERE id = '77777777-7777-7777-7777-777777777771'),
    'ABC Staff CANNOT view Sapthagiri assessment attempt (p07_attempts_select)'
);

WITH deleted AS (
    DELETE FROM public.assessment_attempts WHERE id = '77777777-7777-7777-7777-777777777771' RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM deleted),
    0,
    'ABC Staff CANNOT delete Sapthagiri assessment attempt (0 rows deleted)'
);

-- Authenticate as Sapthagiri Trainer
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111113';

SELECT ok(
    EXISTS (SELECT 1 FROM public.assessment_attempts WHERE id = '77777777-7777-7777-7777-777777777771'),
    'Sapthagiri Trainer CAN view Sapthagiri assessment attempt (staff role)'
);

--------------------------------------------------------------------------------
-- TEST 21-26: Recruitment Drives, Applications & Offers Isolation
--------------------------------------------------------------------------------
RESET ROLE;
INSERT INTO public.companies (id, tenant_id, name, normalized_name)
VALUES ('88888888-8888-8888-8888-888888888880', '00000000-0000-0000-0000-000000000001', 'Google', 'google')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.academic_years (id, tenant_id, name, start_date, end_date, status)
VALUES ('88888888-8888-8888-8888-888888888882', '00000000-0000-0000-0000-000000000001', '2026-2027', '2026-08-01', '2027-05-31', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recruitment_drives (id, tenant_id, company_id, academic_year_id, title, role_title, recruitment_type, status)
VALUES ('88888888-8888-8888-8888-888888888881', '00000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888880', '88888888-8888-8888-8888-888888888882', 'Google Placement Drive', 'Software Engineer', 'FULL_TIME', 'PUBLISHED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.drive_applications (id, tenant_id, drive_id, student_id, status)
VALUES ('99999999-9999-9999-9999-999999999991', '00000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888881', '33333333-3333-3333-3333-333333333331', 'REGISTERED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.placement_offers (id, tenant_id, drive_id, student_id, application_id, offer_type, compensation_amount, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888881', '33333333-3333-3333-3333-333333333331', '99999999-9999-9999-9999-999999999991', 'FULL_TIME', 2850000, 'OFFERED')
ON CONFLICT (id) DO NOTHING;

-- Authenticate as Sapthagiri Student
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111114';

SELECT ok(
    EXISTS (SELECT 1 FROM public.recruitment_drives WHERE id = '88888888-8888-8888-8888-888888888881'),
    'Sapthagiri Student CAN see published Sapthagiri drive'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.drive_applications WHERE id = '99999999-9999-9999-9999-999999999991'),
    'Sapthagiri Student CAN see own application'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.placement_offers WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    'Sapthagiri Student CAN see own placement offer'
);

-- Authenticate as ABC Student
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222224';

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.recruitment_drives WHERE id = '88888888-8888-8888-8888-888888888881'),
    'ABC Student CANNOT see Sapthagiri recruitment drive'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.drive_applications WHERE id = '99999999-9999-9999-9999-999999999991'),
    'ABC Student CANNOT see Sapthagiri student applications'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.placement_offers WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    'ABC Student CANNOT see Sapthagiri placement offers'
);

--------------------------------------------------------------------------------
-- TEST 27-30: Notifications Isolation
--------------------------------------------------------------------------------
RESET ROLE;
INSERT INTO public.notifications (id, recipient_user_id, college_id, type, title, body)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111114', '00000000-0000-0000-0000-000000000001', 'PLACEMENT_ALERT', 'Drive Alert', 'Google test scheduled')
ON CONFLICT (id) DO NOTHING;

-- Authenticate as Sapthagiri Student
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111114';

SELECT ok(
    EXISTS (SELECT 1 FROM public.notifications WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'Sapthagiri Student CAN read own notification'
);

-- Authenticate as ABC Student
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222224';

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'ABC Student CANNOT read Sapthagiri student notification'
);

-- Cross-tenant update attempt on notification
WITH updated AS (
    UPDATE public.notifications SET read_at = now() WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM updated),
    0,
    'ABC Student CANNOT update Sapthagiri student notification (0 rows updated)'
);

-- Authenticate as ABC Head
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222221';

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.notifications WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'ABC Head CANNOT read Sapthagiri notifications'
);

--------------------------------------------------------------------------------
-- TEST 31-34: Storage Isolation (Avatars bucket)
--------------------------------------------------------------------------------
RESET ROLE;
-- Ensure avatars bucket exists and is private
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', false) ON CONFLICT (id) DO UPDATE SET public = false;

-- Authenticate as Sapthagiri Head
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

-- 31. Sapthagiri Head inserts into their own folder: Format 1 (<userId>/avatar.png)
SELECT lives_ok(
    $$ INSERT INTO storage.objects (bucket_id, name, owner) 
       VALUES ('avatars', '11111111-1111-1111-1111-111111111111/avatar.png', auth.uid()) $$,
    'User CAN upload avatar into their own user ID folder (Format 1)'
);

-- 32. Sapthagiri Head inserts into Format 2 (avatars/<userId>/avatar.png)
SELECT lives_ok(
    $$ INSERT INTO storage.objects (bucket_id, name, owner) 
       VALUES ('avatars', 'avatars/11111111-1111-1111-1111-111111111111/avatar_f2.png', auth.uid()) $$,
    'User CAN upload avatar into bucket-prefixed folder (Format 2 compatibility)'
);

-- 33. Sapthagiri Head attempts to insert into another user folder: 22222222-2222-2222-2222-222222222221/avatar.png
SELECT throws_ok(
    $$ INSERT INTO storage.objects (bucket_id, name, owner) 
       VALUES ('avatars', '22222222-2222-2222-2222-222222222221/avatar.png', auth.uid()) $$,
    NULL,
    'User CANNOT upload avatar into another user folder'
);

-- 34. Sapthagiri Head updates / replaces their own avatar (Format 1)
SELECT lives_ok(
    $$ UPDATE storage.objects 
       SET metadata = '{"replaced": true, "version": 2}' 
       WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/avatar.png' $$,
    'User CAN replace / update their own avatar file'
);

-- 35. Sapthagiri Head updates / replaces their Format 2 avatar
SELECT lives_ok(
    $$ UPDATE storage.objects 
       SET metadata = '{"replaced": true, "version": 2}' 
       WHERE bucket_id = 'avatars' AND name = 'avatars/11111111-1111-1111-1111-111111111111/avatar_f2.png' $$,
    'User CAN replace / update their Format 2 avatar file'
);

-- 36. Sapthagiri Head attempts to update and reassign avatar to another user folder (WITH CHECK violation)
SELECT throws_ok(
    $$ UPDATE storage.objects 
       SET name = '22222222-2222-2222-2222-222222222221/avatar.png' 
       WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/avatar.png' $$,
    NULL,
    'User CANNOT reassign avatar file to another user folder (WITH CHECK violation)'
);

-- 37. Authenticate as ABC Head to upload ABC avatar
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222221';

SELECT lives_ok(
    $$ INSERT INTO storage.objects (bucket_id, name, owner) 
       VALUES ('avatars', '22222222-2222-2222-2222-222222222221/avatar.png', auth.uid()) $$,
    'ABC Head CAN upload to their own user ID folder'
);

-- 38. Switch back to Sapthagiri Head: attempts to delete ABC Head avatar file (Storage API context)
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
SET LOCAL "storage.allow_delete_query" = 'true';

WITH del_cross AS (
    DELETE FROM storage.objects 
    WHERE bucket_id = 'avatars' AND name = '22222222-2222-2222-2222-222222222221/avatar.png' 
    RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM del_cross),
    0,
    'User CANNOT delete another user avatar file (0 rows deleted)'
);

-- 39. Sapthagiri Head attempts to update ABC Head avatar file (0 rows updated)
WITH upd AS (
    UPDATE storage.objects 
    SET metadata = '{"hacked": true}' 
    WHERE bucket_id = 'avatars' AND name = '22222222-2222-2222-2222-222222222221/avatar.png' 
    RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM upd),
    0,
    'Sapthagiri Head CANNOT update ABC Head avatar file (0 rows updated)'
);

-- 40. Sapthagiri Head CANNOT view ABC Head avatar file (SELECT)
SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM storage.objects 
        WHERE bucket_id = 'avatars' AND name = '22222222-2222-2222-2222-222222222221/avatar.png'
    ),
    'Sapthagiri Head CANNOT view ABC Head avatar file (SELECT)'
);

-- 41. Sapthagiri Head uploads a secondary avatar file to test deletion
INSERT INTO storage.objects (bucket_id, name, owner) 
VALUES ('avatars', '11111111-1111-1111-1111-111111111111/temp_delete.png', auth.uid());

WITH del_own AS (
    DELETE FROM storage.objects 
    WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/temp_delete.png' 
    RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM del_own),
    1,
    'User CAN delete their own avatar file (1 row deleted)'
);

-- 42. Malicious second segment test:
-- Reset role to insert an object belonging to Sapthagiri Head with a nested path: 1111.../2222.../nested.png
RESET ROLE;
DELETE FROM storage.objects WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222221/nested.png';
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('avatars', '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222221/nested.png', '11111111-1111-1111-1111-111111111111');

-- Authenticate as ABC Head (2222...)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222221';
SET LOCAL "storage.allow_delete_query" = 'true';

-- 42. ABC Head attempts to update Alice's nested file where segment 2 equals ABC Head's ID
WITH upd_nested AS (
    UPDATE storage.objects 
    SET metadata = '{"hacked": true}' 
    WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222221/nested.png'
    RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM upd_nested),
    0,
    'Folder Spoofing Guard: User CANNOT update another user file even if caller ID is in segment 2'
);

-- 43. ABC Head attempts to delete Alice's nested file where segment 2 equals ABC Head's ID
WITH del_nested AS (
    DELETE FROM storage.objects 
    WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222221/nested.png'
    RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM del_nested),
    0,
    'Folder Spoofing Guard: User CANNOT delete another user file even if caller ID is in segment 2'
);

-- 44. ABC Head attempts to upload directly into another user's nested folder with caller ID in segment 2
SELECT throws_ok(
    $$ INSERT INTO storage.objects (bucket_id, name, owner) 
       VALUES ('avatars', '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222221/exploit.png', auth.uid()) $$,
    NULL,
    'Folder Spoofing Guard: User CANNOT upload into another user nested directory'
);

-- 45. Platform Super Admin CANNOT view institutional avatars under Strict Option A
SET LOCAL "request.jwt.claim.sub" = '99999999-9999-9999-9999-999999999999';

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars'
    ),
    'Strict Option A: Platform Super Admin CANNOT view institutional avatars'
);

--------------------------------------------------------------------------------
-- TEST 35-38: Trigger & Security Definer Integrity
--------------------------------------------------------------------------------
RESET ROLE;
-- Test role consistency trigger rejection: linking PLACEMENT_HEAD account to student roster
SELECT throws_ok(
    $$ INSERT INTO public.students (id, tenant_id, user_id, enrollment_number, full_name, email, department_id, graduation_year, cgpa)
       VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '1SG22CS099', 'Fake Head', 'fake@sapthagiri.edu.in', 'ffffffff-ffff-ffff-ffff-fffffffffff1', 2026, 8.5) $$,
    NULL,
    'Database trigger strictly blocks linking PLACEMENT_HEAD to a student roster record'
);

-- Test role consistency trigger rejection: linking TRAINER account to student roster
SELECT throws_ok(
    $$ INSERT INTO public.students (id, tenant_id, user_id, enrollment_number, full_name, email, department_id, graduation_year, cgpa)
       VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111113', '1SG22CS099', 'Fake Trainer', 'fake@sapthagiri.edu.in', 'ffffffff-ffff-ffff-ffff-fffffffffff1', 2026, 8.5) $$,
    NULL,
    'Database trigger strictly blocks linking TRAINER to a student roster record'
);

-- Test cross-college student trigger rejection: linking ABC user to Sapthagiri student roster
SELECT throws_ok(
    $$ INSERT INTO public.students (id, tenant_id, user_id, enrollment_number, full_name, email, department_id, graduation_year, cgpa)
       VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222224', '1SG22CS099', 'Cross Student', 'cross@abc.edu.in', 'ffffffff-ffff-ffff-ffff-fffffffffff1', 2026, 8.5) $$,
    NULL,
    'Database trigger strictly blocks linking another college student to Sapthagiri roster'
);

-- Test student deletion lifecycle trigger: deleting student membership nullifies user_id on students table
DELETE FROM public.tenant_memberships 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND user_id = '11111111-1111-1111-1111-111111111114';

SELECT ok(
    (SELECT user_id IS NULL AND tenant_id = '00000000-0000-0000-0000-000000000001' 
     FROM public.students WHERE id = '33333333-3333-3333-3333-333333333331'),
    'Membership deletion unlinks user_id (NULL) while strictly preserving original tenant_id'
);

--------------------------------------------------------------------------------
-- TEST 39-42: Invitations Table & Unique Pending Email Index
--------------------------------------------------------------------------------
-- Test 1: Insert pending invitation for Sapthagiri
INSERT INTO public.invitations (id, tenant_id, email, role, token_hash, status, expires_at)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000001', 'invite.test@example.com', 'PLACEMENT_STAFF', 'hash-12345', 'PENDING', now() + interval '7 days')
ON CONFLICT (id) DO NOTHING;

SELECT ok(
    EXISTS (SELECT 1 FROM public.invitations WHERE email = 'invite.test@example.com' AND status = 'PENDING'),
    'Pending invitation created successfully in public.invitations'
);

-- Test 2: Reject conflicting pending invitation for same email across ABC College
SELECT throws_ok(
    $$ INSERT INTO public.invitations (id, tenant_id, email, role, token_hash, status, expires_at)
       VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000002', 'invite.test@example.com', 'TRAINER', 'hash-67890', 'PENDING', now() + interval '7 days') $$,
    '23505',
    NULL,
    'Unique index idx_invitations_single_pending_email strictly blocks concurrent pending invitation across colleges'
);

-- Test 3: Multiple college membership rejection at DB level
SELECT throws_ok(
    $$ INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
       VALUES ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'PLACEMENT_STAFF', 'ACTIVE') $$,
    '23505',
    NULL,
    'Global UNIQUE(user_id) constraint on tenant_memberships strictly blocks assigning existing user to second college'
);

-- Test 4: Verify real table name is public.invitations, not public.tenant_invitations
SELECT has_table('public', 'invitations', 'Real invitations table is public.invitations');

--------------------------------------------------------------------------------
-- TEST 43-48: Strict Option A — Platform Super Admin Denial on College Data
--------------------------------------------------------------------------------
-- Authenticate as Platform Super Admin
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '99999999-9999-9999-9999-999999999999';

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.students),
    'Strict Option A: Platform Super Admin CANNOT view private student records'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id != '99999999-9999-9999-9999-999999999999'),
    'Strict Option A: Platform Super Admin CANNOT view college staff/student memberships'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.assessment_attempts),
    'Strict Option A: Platform Super Admin CANNOT view student assessment attempts'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.questions),
    'Strict Option A: Platform Super Admin CANNOT view private college questions'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.recruitment_drives),
    'Strict Option A: Platform Super Admin CANNOT view private recruitment drives'
);

WITH deleted AS (
    DELETE FROM public.students WHERE id = '33333333-3333-3333-3333-333333333332' RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM deleted),
    0,
    'Strict Option A: Platform Super Admin CANNOT delete college student records (0 rows deleted)'
);

--------------------------------------------------------------------------------
-- TEST 49-52: Platform Admin Privilege Escalation Hardening
--------------------------------------------------------------------------------
-- Authenticate as Sapthagiri Student
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111114';

-- 49. Student attempts to escalate self to is_platform_admin = true -> must throw exception
SELECT throws_ok(
    $$ UPDATE public.profiles SET is_platform_admin = true WHERE id = '11111111-1111-1111-1111-111111111114' $$,
    NULL,
    'Privilege Escalation: Authenticated user CANNOT grant themselves platform admin privileges'
);

-- 50. Student attempts to modify another user's profile
WITH updated_prof AS (
    UPDATE public.profiles SET bio = 'Hacked' WHERE id = '22222222-2222-2222-2222-222222222221' RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM updated_prof),
    0,
    'Privilege Escalation: Authenticated user CANNOT update another user profile (0 rows updated)'
);

-- 51. Student updates their own permitted profile fields -> succeeds
SELECT lives_ok(
    $$ UPDATE public.profiles SET bio = 'Aspiring Software Engineer' WHERE id = '11111111-1111-1111-1111-111111111114' $$,
    'Authenticated user CAN update their own normal profile fields (bio)'
);

-- 52. Authenticated user attempts to insert a profile with is_platform_admin = true -> must throw exception
SELECT throws_ok(
    $$ INSERT INTO public.profiles (id, email, full_name, is_platform_admin)
       VALUES ('33333333-3333-3333-3333-333333333399', 'attacker@test.com', 'Attacker', true) $$,
    NULL,
    'Privilege Escalation: Authenticated user CANNOT insert a profile with is_platform_admin = true'
);

--------------------------------------------------------------------------------
-- TEST 53-59: Comprehensive Avatar Storage Privacy
--------------------------------------------------------------------------------
-- 53. Sapthagiri Head can read their own avatar
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

SELECT ok(
    EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/avatar.png'),
    'Avatar Privacy: Sapthagiri Head CAN read their own avatar object'
);

-- 54. Sapthagiri Staff can read Sapthagiri Head's avatar (active same-college colleague)
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111112';

SELECT ok(
    EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/avatar.png'),
    'Avatar Privacy: Sapthagiri Staff CAN read colleague Sapthagiri Head avatar'
);

-- 55. Sapthagiri Staff CANNOT read ABC Head's avatar (cross-college denied)
SELECT ok(
    NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = '22222222-2222-2222-2222-222222222221/avatar.png'),
    'Avatar Privacy: Sapthagiri Staff CANNOT read ABC Head avatar'
);

-- 56. ABC Staff CANNOT read Sapthagiri Head's avatar (cross-college denied)
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';

SELECT ok(
    NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/avatar.png'),
    'Avatar Privacy: ABC Staff CANNOT read Sapthagiri Head avatar'
);

-- 57. Platform Super Admin CANNOT read college avatars
SET LOCAL "request.jwt.claim.sub" = '99999999-9999-9999-9999-999999999999';

SELECT ok(
    NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars'),
    'Avatar Privacy: Platform Super Admin CANNOT read college avatars'
);

-- 58. Unauthenticated (anon) user CANNOT read private avatars
SET LOCAL ROLE anon;
RESET "request.jwt.claim.sub";

SELECT ok(
    NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars'),
    'Avatar Privacy: Unauthenticated (anon) user CANNOT read private avatars'
);

-- 59. User CANNOT overwrite or update another user's avatar file
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

WITH updated_obj AS (
    UPDATE storage.objects SET metadata = '{"updated": true}' WHERE name = '22222222-2222-2222-2222-222222222221/avatar.png' RETURNING *
)
SELECT is(
    (SELECT count(*)::int FROM updated_obj),
    0,
    'Avatar Privacy: User CANNOT update another user avatar file (0 rows updated)'
);

--------------------------------------------------------------------------------
-- TEST 60-64: Audit Logs Separation & Non-Forgeability
--------------------------------------------------------------------------------
RESET ROLE;
INSERT INTO public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'student.claim', 'student', '33333333-3333-3333-3333-333333333331'),
    ('00000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222221', 'student.claim', 'student', '33333333-3333-3333-3333-333333333332'),
    (NULL, '99999999-9999-9999-9999-999999999999', 'platform.tenant_created', 'tenant', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- 60. Sapthagiri Head CAN view Sapthagiri audit logs
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

SELECT ok(
    EXISTS (SELECT 1 FROM public.audit_logs WHERE tenant_id = '00000000-0000-0000-0000-000000000001'),
    'Audit Log Isolation: Sapthagiri Head CAN view Sapthagiri audit logs'
);

-- 61. Sapthagiri Head CANNOT view ABC College audit logs
SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE tenant_id = '00000000-0000-0000-0000-000000000002'),
    'Audit Log Isolation: Sapthagiri Head CANNOT view ABC College audit logs'
);

-- 62. Platform Super Admin CAN view platform-level audit logs (tenant_id IS NULL)
SET LOCAL "request.jwt.claim.sub" = '99999999-9999-9999-9999-999999999999';

SELECT ok(
    EXISTS (SELECT 1 FROM public.audit_logs WHERE tenant_id IS NULL),
    'Audit Log Isolation: Platform Super Admin CAN view platform audit logs (tenant_id IS NULL)'
);

-- 63. Platform Super Admin CANNOT view college audit logs (tenant_id IS NOT NULL)
SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE tenant_id IS NOT NULL),
    'Strict Option A: Platform Super Admin CANNOT view college audit logs'
);

-- 64. Ordinary student CANNOT insert forged audit logs for another college
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111114';

SELECT throws_ok(
    $$ INSERT INTO public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id)
       VALUES ('00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111114', 'fake.action', 'test', '123') $$,
    NULL,
    'Audit Log Integrity: Ordinary user CANNOT forge audit log for another college'
);

-- 65. Authenticated user CANNOT directly insert privileged control-plane events
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

SELECT throws_ok(
    $$ INSERT INTO public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id)
       VALUES ('00000000-0000-0000-0000-000000000001', auth.uid(), 'SUBSCRIPTION_TEMPORARY_OVERRIDE_GRANTED', 'subscription', 'sub-fake-1') $$,
    NULL,
    'Audit Insert Integrity: Authenticated user CANNOT fabricate override audit events (permission denied)'
);

SELECT throws_ok(
    $$ INSERT INTO public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id)
       VALUES (NULL, auth.uid(), 'PAYMENT_VERIFIED', 'billing', 'pay-fake-1') $$,
    NULL,
    'Audit Insert Integrity: Authenticated user CANNOT forge payment verification audit events'
);

-- 66. Anonymous (anon) user CANNOT insert audit events
SET LOCAL ROLE anon;
RESET "request.jwt.claim.sub";

SELECT throws_ok(
    $$ INSERT INTO public.audit_logs (action, resource_type, resource_id)
       VALUES ('ANON_FORGED_EVENT', 'hack', '0') $$,
    NULL,
    'Audit Insert Integrity: Anonymous (anon) user CANNOT insert audit records (permission denied)'
);

-- 67. Authenticated college user CANNOT update audit records (permission denied)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

SELECT throws_ok(
    $$ UPDATE public.audit_logs SET action = 'tampered' WHERE tenant_id = '00000000-0000-0000-0000-000000000001' $$,
    NULL,
    'Audit Immutability: Authenticated user CANNOT update audit logs (permission denied)'
);

-- 68. Authenticated college user CANNOT delete audit records (permission denied)
SELECT throws_ok(
    $$ DELETE FROM public.audit_logs WHERE tenant_id = '00000000-0000-0000-0000-000000000001' $$,
    NULL,
    'Audit Immutability: Authenticated user CANNOT delete audit logs (permission denied)'
);

-- 69. Platform Super Admin CANNOT update audit records through client API
SET LOCAL "request.jwt.claim.sub" = '99999999-9999-9999-9999-999999999999';

SELECT throws_ok(
    $$ UPDATE public.audit_logs SET action = 'tampered' WHERE tenant_id IS NULL $$,
    NULL,
    'Audit Immutability: Platform Super Admin CANNOT update audit logs (permission denied)'
);

-- 70. Platform Super Admin CANNOT delete audit records through client API
SELECT throws_ok(
    $$ DELETE FROM public.audit_logs WHERE tenant_id IS NULL $$,
    NULL,
    'Audit Immutability: Platform Super Admin CANNOT delete audit logs (permission denied)'
);

-- 71-74. service_role privilege and immutability checks
RESET ROLE;
SET LOCAL ROLE service_role;

-- 71. service_role CAN insert legitimate events
SELECT lives_ok(
    $$ INSERT INTO public.audit_logs (tenant_id, actor_id, action, resource_type, resource_id)
       VALUES ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'placement.drive_created', 'recruitment_drive', 'drive-101') $$,
    'Audit Append: service_role CAN insert legitimate audit records'
);

-- 72. service_role CANNOT update existing audit records
SELECT throws_ok(
    $$ UPDATE public.audit_logs SET action = 'tampered' WHERE tenant_id = '00000000-0000-0000-0000-000000000001' $$,
    NULL,
    'Audit Immutability: service_role CANNOT update audit records (permission denied)'
);

-- 73. service_role CANNOT delete existing audit records
SELECT throws_ok(
    $$ DELETE FROM public.audit_logs WHERE tenant_id = '00000000-0000-0000-0000-000000000001' $$,
    NULL,
    'Audit Immutability: service_role CANNOT delete audit records (permission denied)'
);

-- 74. service_role CANNOT truncate audit records
SELECT throws_ok(
    $$ TRUNCATE public.audit_logs $$,
    NULL,
    'Audit Immutability: service_role CANNOT truncate audit records (permission denied)'
);

--------------------------------------------------------------------------------
-- TEST 65-70: Extended Strict Option A Isolation on College Operations Data
--------------------------------------------------------------------------------
RESET ROLE;
-- Insert test records for college operational tables
INSERT INTO public.canonical_skills (id, name, normalized_name, category)
VALUES ('12121212-1212-1212-1212-121212121212', 'Binary Search', 'binary-search', 'DATA_STRUCTURES_ALGORITHMS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.question_versions (id, tenant_id, question_id, version_number, prompt, difficulty, review_status, fingerprint)
VALUES ('13131313-1313-1313-1313-131313131313', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555551', 1, 'Implement binary search', 'MEDIUM', 'VERIFIED_CORRECT', 'fp-binary-search-1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mastery_evidence_records (id, tenant_id, student_id, skill_id, evidence_question_id, evidence_version_id, is_correct, points_earned)
VALUES ('14141414-1414-1414-1414-141414141414', '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333331', '12121212-1212-1212-1212-121212121212', '55555555-5555-5555-5555-555555555551', '13131313-1313-1313-1313-131313131313', true, 10.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mistake_review_targets (id, tenant_id, student_id, question_id, version_id, primary_reason, status)
VALUES ('15151515-1515-1515-1515-151515151515', '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333331', '55555555-5555-5555-5555-555555555551', '13131313-1313-1313-1313-131313131313', 'INCORRECT_ANSWER', 'NEEDS_REVIEW')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.preparation_practice_sessions (id, tenant_id, student_id, topic, questions_practiced, correct_count, time_spent_seconds)
VALUES ('16161616-1616-1616-1616-161616161616', '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333331', 'Dynamic Programming', 5, 4, 300)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.question_defect_reports (id, tenant_id, question_id, version_id, reported_by, defect_type, description, status)
VALUES ('17171717-1717-1717-1717-171717171717', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555551', '13131313-1313-1313-1313-131313131313', '11111111-1111-1111-1111-111111111114', 'AMBIGUOUS_PROMPT', 'Unclear test cases', 'PENDING')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.student_behavioral_responses (id, tenant_id, student_id, prompt, category, response_text)
VALUES ('18181818-1818-1818-1818-181818181818', '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333331', 'Tell me about a conflict in a team', 'HR_INTERVIEW', 'I resolved the disagreement through transparent dialogue.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.historical_recruitment_records (id, tenant_id, company_id, role_title, recruitment_year, recruitment_cycle, sharing_scope, reliability_label)
VALUES ('19191919-1919-1919-1919-191919191919', '00000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888880', 'Senior Engineer', '2025', 'CAMPUS_2025', 'COLLEGE_PRIVATE', 'OFFICIAL_CONFIRMED')
ON CONFLICT (id) DO NOTHING;

-- Authenticate as Platform Super Admin
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '99999999-9999-9999-9999-999999999999';

-- 65. Platform Super Admin CANNOT view mastery evidence records
SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.mastery_evidence_records),
    'Strict Option A: Platform Super Admin CANNOT view student mastery evidence records'
);

-- 66. Platform Super Admin CANNOT view mistake review targets
SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.mistake_review_targets),
    'Strict Option A: Platform Super Admin CANNOT view student mistake review targets'
);

-- 67. Platform Super Admin CANNOT view preparation practice sessions
SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.preparation_practice_sessions),
    'Strict Option A: Platform Super Admin CANNOT view student preparation practice sessions'
);

-- 68. Platform Super Admin CANNOT view question defect reports
SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.question_defect_reports),
    'Strict Option A: Platform Super Admin CANNOT view college question defect reports'
);

-- 69. Platform Super Admin CANNOT view student behavioral responses
SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.student_behavioral_responses),
    'Strict Option A: Platform Super Admin CANNOT view student behavioral responses'
);

-- 70. Platform Super Admin CANNOT view private college historical recruitment records
SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.historical_recruitment_records WHERE id = '19191919-1919-1919-1919-191919191919'),
    'Strict Option A: Platform Super Admin CANNOT view college-private historical recruitment records'
);

SELECT * FROM finish();
ROLLBACK;
