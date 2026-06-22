INSERT INTO document_requirement_rules
  (doc_type, student_category, is_required, is_reusable,
   requires_fresh_upload, description, is_active)
VALUES
  ('guardian_photo', 'ALL', true, false, true,
   'Guardian photo — required fresh every year', true),
  ('student_photo', 'ALL', true, false, true,
   'Student photo — required fresh every year', true),
  ('national_id_front', 'NEW', true, false, true,
   'National ID front — fresh upload for new students', true),
  ('national_id_front', 'EXISTING', true, true, false,
   'National ID front — reused from previous enrollment', true),
  ('national_id_front', 'RETURNING', true, true, false,
   'National ID front — reused from most recent enrollment', true),
  ('national_id_back', 'NEW', true, false, true,
   'National ID back — fresh upload for new students', true),
  ('national_id_back', 'EXISTING', true, true, false,
   'National ID back — reused from previous enrollment', true),
  ('national_id_back', 'RETURNING', true, true, false,
   'National ID back — reused from most recent enrollment', true),
  ('birth_certificate', 'NEW', true, false, true,
   'Birth certificate — fresh upload for new students', true),
  ('birth_certificate', 'EXISTING', true, true, false,
   'Birth certificate — reused from previous enrollment', true),
  ('birth_certificate', 'RETURNING', true, true, false,
   'Birth certificate — reused from most recent enrollment', true),
  ('grade_certificate', 'NEW', true, false, true,
   'Grade certificate — required for new students', true),
  ('grade_certificate', 'EXISTING', false, false, false,
   'Grade certificate — not required for existing students', true),
  ('grade_certificate', 'RETURNING', true, false, true,
   'Grade certificate — required fresh for returning students (gap proof)', true);



   -- National exam certificate rules
-- Grade 6 exam cert required when entering Grade 7
-- Grade 8 exam cert required when entering Grade 9
-- Always fresh — never reused

INSERT INTO document_requirement_rules
  (doc_type, student_category, is_required, is_reusable,
   requires_fresh_upload, applies_when_entering_grade_id, description, is_active)
SELECT
  'grade_6_exam_cert', 'ALL', true, false, true,
  g.id,
  'Grade 6 national exam certificate — required when entering Grade 7',
  true
FROM grades g WHERE g.name = 'Grade 7';

INSERT INTO document_requirement_rules
  (doc_type, student_category, is_required, is_reusable,
   requires_fresh_upload, applies_when_entering_grade_id, description, is_active)
SELECT
  'grade_8_exam_cert', 'ALL', true, false, true,
  g.id,
  'Grade 8 national exam certificate — required when entering Grade 9',
  true
FROM grades g WHERE g.name = 'Grade 9';