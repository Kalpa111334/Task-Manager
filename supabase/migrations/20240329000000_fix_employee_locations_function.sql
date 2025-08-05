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
            el.id,
            el.user_id,
            el.latitude,
            el.longitude,
            el.timestamp,
            el.battery_level,
            el.connection_status,
            el.location_accuracy,
            el.task_id
        FROM employee_locations el
        WHERE el.timestamp > NOW() - INTERVAL '24 hours'
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
    LEFT JOIN auth.users au ON au.id = l.user_id
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