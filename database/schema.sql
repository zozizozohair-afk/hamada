-- Asset Management System Schema for Supabase

-- 1. Asset Categories (تصنيف الأصول)
-- Defines the default policies for each category (Useful Life, Depreciation Rate)
create table asset_categories (
  id bigint primary key generated always as identity,
  name text not null unique, -- e.g., 'Buildings', 'Vehicles'
  useful_life_years int not null, -- Default useful life in years
  annual_depreciation_rate numeric(5,2) not null, -- e.g., 20.00 for 20%
  created_at timestamptz default now()
);

-- 2. Assets (سجل الأصول)
-- Main table for fixed assets
create table assets (
  id bigint primary key generated always as identity,
  asset_code text not null unique, -- رمز الأصل
  name text not null, -- اسم الأصل
  category_id bigint references asset_categories(id), -- التصنيف
  
  -- Purchase Info
  purchase_date date not null, -- تاريخ الشراء
  purchase_cost numeric(15,2) not null, -- تكلفة الشراء
  salvage_value numeric(15,2) default 0, -- القيمة المتبقية (Scrap Value)
  
  -- Depreciation Settings
  start_depreciation_date date not null, -- تاريخ بدء الإهلاك
  useful_life_months int not null, -- العمر الإنتاجي بالشهور (calculated from category or overridden)
  depreciation_method text default 'Straight Line', -- طريقة الإهلاك (currently only Straight Line)
  
  -- Status
  status text check (status in ('Active', 'Retired', 'Sold')) default 'Active',
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Depreciation Schedule / Logs (سجل الإهلاك)
-- Stores calculated depreciation for each period (usually monthly or annually)
create table depreciation_schedule (
  id bigint primary key generated always as identity,
  asset_id bigint references assets(id) on delete cascade,
  
  period_date date not null, -- The end date of the period (e.g., 2024-01-31)
  period_month int, -- 1-12
  period_year int, -- e.g., 2024
  
  depreciation_amount numeric(15,2) not null, -- مصروف الإهلاك للفترة
  accumulated_depreciation numeric(15,2) not null, -- الإهلاك المجمع حتى هذه الفترة
  net_book_value numeric(15,2) not null, -- صافي القيمة الدفترية after this deduction
  
  is_posted boolean default false, -- Whether this has been posted to GL (General Ledger)
  
  unique(asset_id, period_date)
);

-- Indexes for performance
create index idx_assets_category on assets(category_id);
create index idx_depreciation_asset on depreciation_schedule(asset_id);
create index idx_depreciation_period on depreciation_schedule(period_date);

-- Example Data Seeding (Optional)
-- insert into asset_categories (name, useful_life_years, annual_depreciation_rate) values ('Vehicles', 5, 20);
