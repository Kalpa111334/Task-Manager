-- Add timing fields to tasks table
alter table public.tasks
add column started_at timestamp with time zone,
add column completed_at timestamp with time zone,
add column total_pause_duration interval default '0'::interval,
add column last_pause_at timestamp with time zone;

-- Create time_logs table for detailed time tracking
create table if not exists public.time_logs (
    id uuid default uuid_generate_v4() primary key,
    task_id uuid references public.tasks(id) on delete cascade not null,
    action text not null check (action in ('start', 'pause', 'resume', 'complete')),
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on time_logs
alter table public.time_logs enable row level security;

-- Create policies for time_logs
create policy "Users can view their own time logs"
    on public.time_logs for select
    to authenticated
    using (
        exists (
            select 1 from public.tasks
            where tasks.id = time_logs.task_id
            and tasks.assigned_to = auth.uid()
        )
    );

create policy "Users can create time logs for their tasks"
    on public.time_logs for insert
    to authenticated
    with check (
        exists (
            select 1 from public.tasks
            where tasks.id = time_logs.task_id
            and tasks.assigned_to = auth.uid()
        )
    );

-- Function to calculate real working time
create or replace function calculate_working_time(
    p_started_at timestamp with time zone,
    p_completed_at timestamp with time zone,
    p_total_pause_duration interval
) returns interval as $$
begin
    if p_started_at is null then
        return interval '0';
    end if;
    
    return (
        coalesce(p_completed_at, now()) - p_started_at - coalesce(p_total_pause_duration, interval '0')
    );
end;
$$ language plpgsql; 