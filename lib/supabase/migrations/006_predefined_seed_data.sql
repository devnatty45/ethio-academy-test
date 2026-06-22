-- Seed predefined rejection reasons per document type
INSERT INTO predefined_rejection_reasons (doc_type, reason_text, is_active)
VALUES
  -- Guardian photo
  ('guardian_photo', 'Photo is blurry or unclear', true),
  ('guardian_photo', 'Face is not clearly visible', true),
  ('guardian_photo', 'Photo does not match submitted ID', true),

  -- Student photo
  ('student_photo', 'Photo is blurry or unclear', true),
  ('student_photo', 'Face is not clearly visible', true),
  ('student_photo', 'Photo appears to be of a different person', true),

  -- National ID front
  ('national_id_front', 'ID is expired', true),
  ('national_id_front', 'Image is blurry or unreadable', true),
  ('national_id_front', 'Wrong document submitted', true),
  ('national_id_front', 'Name does not match enrollment form', true),

  -- National ID back
  ('national_id_back', 'Image is blurry or unreadable', true),
  ('national_id_back', 'Wrong document submitted', true),
  ('national_id_back', 'Back of ID is missing or incomplete', true),

  -- Birth certificate
  ('birth_certificate', 'Date of birth does not match enrollment form', true),
  ('birth_certificate', 'Image is blurry or unreadable', true),
  ('birth_certificate', 'Wrong document submitted', true),
  ('birth_certificate', 'Name does not match enrollment form', true),
  ('birth_certificate', 'Document appears to be altered', true),

  -- Grade certificate
  ('grade_certificate', 'Image is blurry or unreadable', true),
  ('grade_certificate', 'Certificate is from wrong academic year', true),
  ('grade_certificate', 'Name does not match student profile', true),
  ('grade_certificate', 'Grade shown does not match expected level', true),
  ('grade_certificate', 'Wrong document submitted', true),

  -- Grade 6 exam cert
  ('grade_6_exam_cert', 'Image is blurry or unreadable', true),
  ('grade_6_exam_cert', 'Name does not match student profile', true),
  ('grade_6_exam_cert', 'Certificate appears to be altered', true),
  ('grade_6_exam_cert', 'Wrong exam year on certificate', true),

  -- Grade 8 exam cert
  ('grade_8_exam_cert', 'Image is blurry or unreadable', true),
  ('grade_8_exam_cert', 'Name does not match student profile', true),
  ('grade_8_exam_cert', 'Certificate appears to be altered', true),
  ('grade_8_exam_cert', 'Wrong exam year on certificate', true);