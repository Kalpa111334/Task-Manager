-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all locations" ON employee_locations;
DROP POLICY IF EXISTS "Employees can view their own location" ON employee_locations;
DROP POLICY IF EXISTS "Employees can insert their own location" ON employee_locations;
DROP POLICY IF EXISTS "Employees can update their own location" ON employee_locations;

-- Create updated policies
CREATE POLICY "Admins can view all locations"
ON employee_locations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Admins can insert locations for any user
CREATE POLICY "Admins can insert locations"
ON employee_locations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Employees can view their own location
CREATE POLICY "Employees can view their own location"
ON employee_locations FOR SELECT
USING (
    user_id = auth.uid()
);

-- Employees can insert their own location
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

-- Employees can update their own location
CREATE POLICY "Employees can update their own location"
ON employee_locations FOR UPDATE
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);