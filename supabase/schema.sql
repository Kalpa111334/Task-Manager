-- Create users table
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('admin', 'employee')),
  avatar_url text,
  skills text[] default array[]::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create tasks table
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  status text not null check (status in ('Not Started', 'In Progress', 'Paused', 'Completed')),
  assigned_to uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  estimated_time numeric not null,
  actual_time numeric,
  price numeric not null,
  due_date timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create task_proofs table
create table public.task_proofs (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  image_url text not null,
  description text,
  submitted_by uuid references public.users(id) on delete set null not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create time_logs table
create table public.time_logs (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  duration numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create chat_messages table
create table public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create notifications table
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text not null check (type in ('task', 'chat', 'system')),
  read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up row level security (RLS)
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.task_proofs enable row level security;
alter table public.time_logs enable row level security;
alter table public.chat_messages enable row level security;
alter table public.notifications enable row level security;

-- Create policies for users table
drop policy if exists "Users can view their own profile and admins can view all" on public.users;
drop policy if exists "Users can update their own profile" on public.users;
drop policy if exists "Enable insert for authenticated users only" on public.users;

create policy "Users can view their own profile and admins can view all"
  on public.users for select
  using (
    auth.uid() = id
    or (
      auth.jwt() ->> 'role' = 'admin'
    )
  );

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Enable insert for authenticated users only"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Employees can view assigned tasks and admins can view all"
  on public.tasks for select
  using (
    exists (
      select 1
      from public.users
      where id = auth.uid()
      and (
        role = 'admin'
        or id = tasks.assigned_to
      )
    )
  );

create policy "Admins can create tasks"
  on public.tasks for insert
  with check (
    exists (
      select 1
      from public.users
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Employees can update their assigned tasks"
  on public.tasks for update
  using (
    exists (
      select 1
      from public.users
      where id = auth.uid()
      and id = tasks.assigned_to
    )
  );

create policy "Users can view their own proofs and admins can view all"
  on public.task_proofs for select
  using (
    exists (
      select 1
      from public.users
      where id = auth.uid()
      and (
        role = 'admin'
        or id = task_proofs.submitted_by
      )
    )
  );

create policy "Users can create proofs for their tasks"
  on public.task_proofs for insert
  with check (
    exists (
      select 1
      from public.tasks
      where id = task_id
      and assigned_to = auth.uid()
    )
  );

create policy "Users can view their own time logs and admins can view all"
  on public.time_logs for select
  using (
    exists (
      select 1
      from public.users
      where id = auth.uid()
      and (
        role = 'admin'
        or id = time_logs.user_id
      )
    )
  );

create policy "Users can create their own time logs"
  on public.time_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own time logs"
  on public.time_logs for update
  using (auth.uid() = user_id);

create policy "Everyone can view chat messages"
  on public.chat_messages for select
  using (true);

create policy "Authenticated users can send messages"
  on public.chat_messages for insert
  with check (auth.uid() = sender_id);

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "System can create notifications"
  on public.notifications for insert
  with check (true);

create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id); 