-- Spotlight entries wait for admin approval before going public.
ALTER TABLE strips
  ADD COLUMN spotlight_status VARCHAR(16) NOT NULL DEFAULT 'none' AFTER spotlight_opt_in;

-- Existing live entries stay public.
UPDATE strips
SET spotlight_status = 'approved'
WHERE spotlight_opt_in = 1 AND spotlight_status = 'none';
