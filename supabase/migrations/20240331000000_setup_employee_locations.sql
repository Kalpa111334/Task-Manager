-- Drop existing table if it exists
DROP TABLE IF EXISTS employee_locations;

-- Create the employee_locations table with proper schema
CREATE TABLE employee_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    battery_level INTEGER,
    connection_status TEXT DEFAULT 'offline',
    location_accuracy DOUBLE PRECISION,
    task_id UUID REFERENCES tasks(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_employee_locations_user_id ON employee_locations(user_id);
CREATE INDEX idx_employee_locations_timestamp ON employee_locations(timestamp);
CREATE INDEX idx_employee_locations_task_id ON employee_locations(task_id);

-- Enable RLS
ALTER TABLE employee_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all locations" ON employee_locations;
DROP POLICY IF EXISTS "Employees can view their own location" ON employee_locations;
DROP POLICY IF EXISTS "Employees can insert their own location" ON employee_locations;
DROP POLICY IF EXISTS "Employees can update their own location" ON employee_locations;

-- Create RLS policies
CREATE POLICY "Admins can view all locations"
ON employee_locations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

CREATE POLICY "Admins can insert locations"
ON employee_locations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

CREATE POLICY "Employees can view their own location"
ON employee_locations FOR SELECT
USING (
    user_id = auth.uid()
);

CREATE POLICY "Employees can insert their own location"
ON employee_locations FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'employee'
    )
);

-- Create a function to clean up old locations (keep only last 24 hours)
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
);