-- Create restaurants table
create table public.restaurants (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  active boolean default true
);

-- Create history table for tracking choices
create table public.history (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  restaurant_id uuid references public.restaurants(id) not null,
  user_name text,
  weather text,
  day_of_week integer, -- 0 = Sunday, 1 = Monday, etc.
  is_suggestion_hit boolean default false
);

-- Enable Row Level Security (RLS)
alter table public.restaurants enable row level security;
alter table public.history enable row level security;

-- Create policies to allow public read/write (since we are not doing auth yet)
-- WARNING: This is for development/internal tool use only.
create policy "Allow public read access" on public.restaurants for select using (true);
create policy "Allow public insert access" on public.restaurants for insert with check (true);
create policy "Allow public update access" on public.restaurants for update using (true);

create policy "Allow public read access" on public.history for select using (true);
create policy "Allow public insert access" on public.history for insert with check (true);
