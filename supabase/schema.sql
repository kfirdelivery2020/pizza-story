-- Pizza Story – טיוטת סכמה ל-Supabase (עדיין לא הורצה על שום פרויקט)
-- כניסת מנהלים: Supabase Auth (אימייל+סיסמה) + טבלת staff להרשאות; לקוחות לא צריכים התחברות.

create table branches (
  id uuid primary key default gen_random_uuid(),
  city text unique not null,
  region text not null,
  active boolean not null default false,           -- מופיע ללקוחות (הנהלה מרכזית)
  address text not null default '',
  phone text not null default '',
  hours jsonb not null default '[]',               -- [{"days":"א׳–ה׳","hours":"11:00–23:00"}]
  is_open boolean not null default true,           -- פתוח להזמנות (מנהל סניף)
  pay_cash boolean not null default true,
  pay_credit boolean not null default false,
  pay_simply boolean not null default false
);

create table products (                             -- תפריט ראשי (הנהלה מרכזית)
  id bigint generated always as identity primary key,
  category text not null,
  name text not null,
  description text not null default '',
  price numeric(8,2) not null check (price >= 0),
  image_url text,
  is_pizza boolean not null default false,
  hidden boolean not null default false
);

create table branch_out_of_stock (                  -- זמינות לפי סניף (מנהל סניף)
  branch_id uuid references branches on delete cascade,
  product_id bigint references products on delete cascade,
  primary key (branch_id, product_id)
);

create table staff (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('network', 'branch')),
  branch_id uuid references branches,
  check ((role = 'branch') = (branch_id is not null))
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  branch_id uuid not null references branches,
  mode text not null check (mode in ('delivery', 'pickup')),
  customer jsonb not null,                          -- שם, טלפון, כתובת
  items jsonb not null,
  payment_method text not null check (payment_method in ('cash', 'credit', 'simply')),
  subtotal numeric(8,2) not null, delivery numeric(8,2) not null, handling numeric(8,2) not null, total numeric(8,2) not null,
  status text not null default 'חדשה' check (status in ('חדשה', 'בהכנה', 'מוכנה', 'נמסרה')),
  created_at timestamptz not null default now()
);

-- helpers (security definer כדי למנוע רקורסיית RLS על staff)
create function is_network() returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from staff where user_id = auth.uid() and role = 'network') $$;
create function is_branch_staff(b uuid) returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from staff where user_id = auth.uid() and role = 'branch' and branch_id = b) $$;

alter table branches enable row level security;
alter table products enable row level security;
alter table branch_out_of_stock enable row level security;
alter table staff enable row level security;
alter table orders enable row level security;

-- לקוחות (אנונימי): קריאה בלבד של סניפים פעילים, מוצרים גלויים וזמינות
create policy branches_read on branches for select using (active or is_network() or is_branch_staff(id));
create policy products_read on products for select using (not hidden or is_network());
create policy stock_read on branch_out_of_stock for select using (true);

-- הנהלה מרכזית: ניהול מלא של סניפים ותפריט
create policy branches_net on branches for all using (is_network()) with check (is_network());
create policy products_net on products for all using (is_network()) with check (is_network());
-- shortcut: מנהל סניף יכול לעדכן את כל שדות הסניף שלו (גם כתובת/שעות); לצמצם לעמודות הפעלה/תשלום בלבד דרך RPC/טריגר
create policy branches_mgr on branches for update using (is_branch_staff(id)) with check (is_branch_staff(id));
create policy stock_write on branch_out_of_stock for all using (is_network() or is_branch_staff(branch_id)) with check (is_network() or is_branch_staff(branch_id));

create policy staff_self on staff for select using (user_id = auth.uid() or is_network());

-- הזמנות: לקוח אנונימי יכול רק ליצור; צוות הסניף והרשת קוראים ומעדכנים סטטוס
-- shortcut: הלקוח שולח מחירים מהדפדפן; לפני הפקה להעביר ליצירת הזמנה דרך פונקציית שרת שמחשבת מחיר מחדש
create policy orders_insert on orders for insert with check (
  exists (select 1 from branches b where b.id = branch_id and b.active and b.is_open));
create policy orders_read on orders for select using (is_network() or is_branch_staff(branch_id));
create policy orders_update on orders for update using (is_network() or is_branch_staff(branch_id)) with check (is_network() or is_branch_staff(branch_id));

-- תמונות מוצר: ליצור bucket ציבורי product-images בהגדרות Storage, והעלאה רק ל-is_network()
