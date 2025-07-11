-- Create deleted_users table to store permanently deleted user information
create table if not exists public.deleted_users (
    id uuid primary key,
    email text not null,
    full_name text not null,
    role text not null,
    avatar_url text,
    skills text[],
    created_at timestamp with time zone,
    deleted_at timestamp with time zone default timezone('utc'::text, now()) not null,
    deleted_by uuid references public.users(id),
    deletion_reason text
);

-- Enable RLS
alter table public.deleted_users enable row level security;

-- Create policy for admins to view deleted users
create policy "Admins can view deleted users"
    on public.deleted_users for select
    to authenticated
    using (
        exists (
            select 1 from public.users
            where users.id = auth.uid()
            and users.role = 'admin'
        )
    );

-- Create policy for admins to insert into deleted_users
create policy "Admins can insert deleted users"
    on public.deleted_users for insert
    to authenticated
    with check (
        exists (
            select 1 from public.users
            where users.id = auth.uid()
            and users.role = 'admin'
        )
    );

-- Function to move user to deleted_users before deletion
create or replace function public.process_user_deletion()
returns trigger as $$
begin
    -- Insert the user data into deleted_users
    insert into public.deleted_users (
        id,
        email,
        full_name,
        role,
        avatar_url,
        skills,
        created_at,
        deleted_by
    )
    values (
        old.id,
        old.email,
        old.full_name,
        old.role,
        old.avatar_url,
        old.skills,
        old.created_at,
        auth.uid()
    );
    return old;
end;
$$ language plpgsql security definer;

-- Create trigger to handle user deletion
create trigger on_user_delete
    before delete on public.users
    for each row
    execute function public.process_user_deletion(); 