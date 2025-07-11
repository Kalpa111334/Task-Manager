-- Add photo proof related fields to tasks table
ALTER TABLE tasks
ADD COLUMN proof_photo_url TEXT,
ADD COLUMN completion_notes TEXT; 