-- Enable the pg_cron extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create employee_locations table
CREATE TABLE IF NOT EXISTS employee_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    battery_level INTEGER,
    connection_status TEXT CHECK (connection_status IN ('online', 'offline')),
    location_accuracy DOUBLE PRECISION,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_locations_user_id ON employee_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_locations_timestamp ON employee_locations(timestamp);
CREATE INDEX IF NOT EXISTS idx_employee_locations_task_id ON employee_locations(task_id);

-- Add RLS policies
ALTER TABLE employee_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Employees can insert their own location" ON employee_locations;
DROP POLICY IF EXISTS "Employees can view their own locations" ON employee_locations;
DROP POLICY IF EXISTS "Admins can view all locations" ON employee_locations;

-- Allow employees to insert their own location
CREATE POLICY "Employees can insert their own location"
    ON employee_locations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow employees to view their own location history
CREATE POLICY "Employees can view their own locations"
    ON employee_locations FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow admins to view all locations
CREATE POLICY "Admins can view all locations"
    ON employee_locations FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Function to clean up old location data (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM employee_locations
    WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$;

-- Create a scheduled job to clean up old locations daily
SELECT cron.schedule(
    'cleanup-old-locations',
    '0 0 * * *', -- Run at midnight every day
    'SELECT cleanup_old_locations()'
);

-- Drop existing function before recreating
DROP FUNCTION IF EXISTS get_latest_employee_locations();

-- Create function to get latest employee locations
CREATE OR REPLACE FUNCTION get_latest_employee_locations()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ,
    battery_level INTEGER,
    connection_status TEXT,
    location_accuracy DOUBLE PRECISION,
    task_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    email TEXT,
    task_title TEXT,
    task_status TEXT,
    task_due_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH latest_locations AS (
        SELECT DISTINCT ON (el.user_id)
            el.*
        FROM employee_locations el
        WHERE el.timestamp > NOW() - INTERVAL '1 hour'
        ORDER BY el.user_id, el.timestamp DESC
    )
    SELECT
        l.id,
        l.user_id,
        l.latitude,
        l.longitude,
        l.timestamp as recorded_at,
        l.battery_level,
        l.connection_status,
        l.location_accuracy,
        l.task_id,
        u.full_name,
        u.avatar_url,
        u.email,
        t.title as task_title,
        t.status as task_status,
        t.due_date as task_due_date
    FROM latest_locations l
    LEFT JOIN users u ON u.id = l.user_id
    LEFT JOIN tasks t ON t.id = l.task_id
    WHERE (
        -- Allow users to see their own location
        auth.uid() = l.user_id
        OR
        -- Allow admins to see all locations
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );
END;
$$; 