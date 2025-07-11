/*
  # Enhanced Location-Based Task Monitoring System

  1. New Tables
    - `task_locations` - Store task location requirements and geofencing data
    - `geofences` - Define geographical boundaries for tasks
    - `location_alerts` - Store real-time alerts and notifications
    - `employee_movement_history` - Track detailed movement patterns
    - `task_location_events` - Log location-based task events

  2. Security
    - Enable RLS on all new tables
    - Add appropriate policies for admin and employee access
    - Implement data encryption for sensitive location data

  3. Features
    - Geofencing capabilities
    - Real-time alert system
    - Movement history tracking
    - Task location requirements
*/

-- Create geofences table for defining geographical boundaries
CREATE TABLE IF NOT EXISTS public.geofences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    center_latitude DOUBLE PRECISION NOT NULL,
    center_longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create task_locations table to associate tasks with specific locations
CREATE TABLE IF NOT EXISTS public.task_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    geofence_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL,
    required_latitude DOUBLE PRECISION,
    required_longitude DOUBLE PRECISION,
    required_radius_meters INTEGER DEFAULT 50,
    arrival_required BOOLEAN DEFAULT false,
    departure_required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create location_alerts table for real-time notifications
CREATE TABLE IF NOT EXISTS public.location_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('task_completion', 'arrival', 'departure', 'out_of_bounds', 'deadline_reminder', 'emergency')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_read BOOLEAN DEFAULT false,
    is_acknowledged BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ
);

-- Create employee_movement_history table for detailed tracking
CREATE TABLE IF NOT EXISTS public.employee_movement_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    location_source TEXT DEFAULT 'gps' CHECK (location_source IN ('gps', 'network', 'passive')),
    battery_level INTEGER,
    is_mock_location BOOLEAN DEFAULT false
);

-- Create task_location_events table for logging location-based events
CREATE TABLE IF NOT EXISTS public.task_location_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('check_in', 'check_out', 'arrival', 'departure', 'boundary_violation')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geofence_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL,
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add location fields to existing tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS location_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_radius_meters INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS auto_check_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_check_out BOOLEAN DEFAULT false;

-- Enable RLS on all new tables
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_movement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_location_events ENABLE ROW LEVEL SECURITY;

-- Policies for geofences
CREATE POLICY "Admins can manage geofences"
    ON public.geofences FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Employees can view active geofences"
    ON public.geofences FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Policies for task_locations
CREATE POLICY "Admins can manage task locations"
    ON public.task_locations FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Employees can view their task locations"
    ON public.task_locations FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_locations.task_id
            AND tasks.assigned_to = auth.uid()
        )
    );

-- Policies for location_alerts
CREATE POLICY "Users can view their own alerts"
    ON public.location_alerts FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "System can create alerts"
    ON public.location_alerts FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update their own alerts"
    ON public.location_alerts FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Policies for employee_movement_history
CREATE POLICY "Admins can view all movement history"
    ON public.employee_movement_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Employees can insert their own movement data"
    ON public.employee_movement_history FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Employees can view their own movement history"
    ON public.employee_movement_history FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policies for task_location_events
CREATE POLICY "Admins can view all location events"
    ON public.task_location_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Employees can manage their own location events"
    ON public.task_location_events FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Function to check if a point is within a geofence
CREATE OR REPLACE FUNCTION public.is_within_geofence(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_geofence_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    geofence_record RECORD;
    distance_meters DOUBLE PRECISION;
BEGIN
    SELECT center_latitude, center_longitude, radius_meters
    INTO geofence_record
    FROM public.geofences
    WHERE id = p_geofence_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Calculate distance using Haversine formula (simplified)
    distance_meters := 6371000 * acos(
        cos(radians(geofence_record.center_latitude)) *
        cos(radians(p_latitude)) *
        cos(radians(p_longitude) - radians(geofence_record.center_longitude)) +
        sin(radians(geofence_record.center_latitude)) *
        sin(radians(p_latitude))
    );
    
    RETURN distance_meters <= geofence_record.radius_meters;
END;
$$ LANGUAGE plpgsql;

-- Function to create location alerts
CREATE OR REPLACE FUNCTION public.create_location_alert(
    p_user_id UUID,
    p_task_id UUID,
    p_alert_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_latitude DOUBLE PRECISION DEFAULT NULL,
    p_longitude DOUBLE PRECISION DEFAULT NULL,
    p_priority TEXT DEFAULT 'medium'
) RETURNS UUID AS $$
DECLARE
    alert_id UUID;
BEGIN
    INSERT INTO public.location_alerts (
        user_id, task_id, alert_type, title, message,
        latitude, longitude, priority
    ) VALUES (
        p_user_id, p_task_id, p_alert_type, p_title, p_message,
        p_latitude, p_longitude, p_priority
    ) RETURNING id INTO alert_id;
    
    RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process location updates and trigger alerts
CREATE OR REPLACE FUNCTION public.process_location_update()
RETURNS TRIGGER AS $$
DECLARE
    task_record RECORD;
    geofence_record RECORD;
    alert_id UUID;
BEGIN
    -- Check if user has active tasks with location requirements
    FOR task_record IN
        SELECT t.*, tl.geofence_id, tl.required_latitude, tl.required_longitude, tl.required_radius_meters
        FROM public.tasks t
        LEFT JOIN public.task_locations tl ON t.id = tl.task_id
        WHERE t.assigned_to = NEW.user_id
        AND t.status IN ('Not Started', 'In Progress')
        AND (t.location_required = true OR tl.id IS NOT NULL)
    LOOP
        -- Check geofence violations or arrivals
        IF task_record.geofence_id IS NOT NULL THEN
            IF public.is_within_geofence(NEW.latitude, NEW.longitude, task_record.geofence_id) THEN
                -- User entered geofence
                SELECT * INTO geofence_record FROM public.geofences WHERE id = task_record.geofence_id;
                
                -- Create arrival alert if not already present
                IF NOT EXISTS (
                    SELECT 1 FROM public.task_location_events
                    WHERE task_id = task_record.id
                    AND user_id = NEW.user_id
                    AND event_type = 'arrival'
                    AND timestamp > NOW() - INTERVAL '1 hour'
                ) THEN
                    INSERT INTO public.task_location_events (
                        task_id, user_id, event_type, latitude, longitude, geofence_id
                    ) VALUES (
                        task_record.id, NEW.user_id, 'arrival', NEW.latitude, NEW.longitude, task_record.geofence_id
                    );
                    
                    SELECT public.create_location_alert(
                        NEW.user_id,
                        task_record.id,
                        'arrival',
                        'Arrived at Task Location',
                        'You have arrived at the location for task: ' || task_record.title,
                        NEW.latitude,
                        NEW.longitude,
                        'medium'
                    ) INTO alert_id;
                END IF;
            END IF;
        END IF;
        
        -- Check task-specific location requirements
        IF task_record.required_latitude IS NOT NULL AND task_record.required_longitude IS NOT NULL THEN
            -- Calculate distance to required location
            IF 6371000 * acos(
                cos(radians(task_record.required_latitude)) *
                cos(radians(NEW.latitude)) *
                cos(radians(NEW.longitude) - radians(task_record.required_longitude)) +
                sin(radians(task_record.required_latitude)) *
                sin(radians(NEW.latitude))
            ) <= COALESCE(task_record.required_radius_meters, 100) THEN
                -- User is within required location
                IF NOT EXISTS (
                    SELECT 1 FROM public.task_location_events
                    WHERE task_id = task_record.id
                    AND user_id = NEW.user_id
                    AND event_type = 'arrival'
                    AND timestamp > NOW() - INTERVAL '1 hour'
                ) THEN
                    INSERT INTO public.task_location_events (
                        task_id, user_id, event_type, latitude, longitude
                    ) VALUES (
                        task_record.id, NEW.user_id, 'arrival', NEW.latitude, NEW.longitude
                    );
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for location processing
DROP TRIGGER IF EXISTS process_location_update_trigger ON public.employee_locations;
CREATE TRIGGER process_location_update_trigger
    AFTER INSERT ON public.employee_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.process_location_update();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_locations_user_timestamp ON public.employee_locations(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_employee_locations_coordinates ON public.employee_locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_movement_history_user_timestamp ON public.employee_movement_history(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_location_alerts_user_read ON public.location_alerts(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_task_location_events_task_user ON public.task_location_events(task_id, user_id);
CREATE INDEX IF NOT EXISTS idx_geofences_active ON public.geofences(is_active) WHERE is_active = true;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_location_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_movement_history;