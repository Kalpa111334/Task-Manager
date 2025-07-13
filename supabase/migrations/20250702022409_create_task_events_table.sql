-- Create task_events table to track task-related events
CREATE TABLE task_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'check_in', 
      'check_out', 
      'start', 
      'pause', 
      'resume', 
      'complete', 
      'approve', 
      'reject'
    )
  ),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  location_latitude NUMERIC(10, 8),
  location_longitude NUMERIC(11, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an index to improve query performance
CREATE INDEX idx_task_events_task_id ON task_events(task_id);
CREATE INDEX idx_task_events_user_id ON task_events(user_id);
CREATE INDEX idx_task_events_event_type ON task_events(event_type);
CREATE INDEX idx_task_events_timestamp ON task_events(timestamp); 