/*
  # Fix Realtime Publication Error

  1. Check if supabase_realtime publication exists before adding tables
  2. Create publication if it doesn't exist
  3. Add tables to realtime publication safely
*/

-- Check if supabase_realtime publication exists, create if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Safely add tables to realtime publication
DO $$
BEGIN
    -- Add location_alerts table if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'location_alerts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.location_alerts;
    END IF;

    -- Add task_location_events table if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'task_location_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_location_events;
    END IF;

    -- Add employee_movement_history table if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'employee_movement_history'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_movement_history;
    END IF;
END $$;