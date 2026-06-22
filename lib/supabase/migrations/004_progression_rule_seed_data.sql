-- Seed default grade progression rules
-- These reflect the actual school structure

INSERT INTO grade_progression_rules
  (from_grade_id, from_branch_id, to_grade_id, to_branch_id, is_active)
SELECT
  fg.id, fb.id, tg.id, tb.id, true
FROM (VALUES
  ('Nursery',  'KETA',    'KG1',      'KETA'),
  ('KG1',      'KETA',    'KG2',      'KETA'),
  ('KG2',      'KETA',    'Grade 1',  'KETA'),
  ('Grade 1',  'KETA',    'Grade 2',  'KETA'),
  ('Grade 2',  'KETA',    'Grade 3',  'KETA'),
  ('Grade 3',  'KETA',    'Grade 4',  'KETA'),
  ('Grade 4',  'KETA',    'Grade 5',  'ASKO'),
  ('Grade 1',  'ASKO',    'Grade 2',  'ASKO'),
  ('Grade 2',  'ASKO',    'Grade 3',  'ASKO'),
  ('Grade 3',  'ASKO',    'Grade 4',  'ASKO'),
  ('Grade 4',  'ASKO',    'Grade 5',  'ASKO'),
  ('Grade 5',  'ASKO',    'Grade 6',  'ASKO'),
  ('Grade 6',  'ASKO',    'Grade 7',  'ASKO'),
  ('Grade 7',  'ASKO',    'Grade 8',  'ASKO'),
  ('Grade 8',  'ASKO',    'Grade 9',  'CHERETA'),
  ('Grade 9',  'CHERETA', 'Grade 10', 'CHERETA'),
  ('Grade 10', 'CHERETA', 'Grade 11', 'CHERETA'),
  ('Grade 11', 'CHERETA', 'Grade 12', 'CHERETA')
) AS v(fg_name, fb_code, tg_name, tb_code)
JOIN grades fg ON fg.name = v.fg_name
JOIN branches fb ON fb.code = v.fb_code
JOIN grades tg ON tg.name = v.tg_name
JOIN branches tb ON tb.code = v.tb_code
ON CONFLICT DO NOTHING;