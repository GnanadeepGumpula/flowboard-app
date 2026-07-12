-- Migration: convert tasks.assigned_to from uuid (or text) to uuid[] array
-- Run this in Supabase SQL editor. It will convert existing single-assignee values into single-element arrays.

BEGIN;

-- Ensure no dependent constraints block the change; adjust as needed.
ALTER TABLE public.tasks
  ALTER COLUMN assigned_to TYPE uuid[] USING (
    CASE
      WHEN assigned_to IS NULL THEN NULL
      ELSE ARRAY[assigned_to::uuid]
    END
  );

COMMIT;
