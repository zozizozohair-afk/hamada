-- Asset Management System Schema for Supabase (Updated for Movement Report)

-- 1. Asset Categories (تصنيف الأصول)
create table if not exists asset_categories (
  id bigint primary key generated always as identity,
  name text not null unique,
  useful_life_years int not null,
  annual_depreciation_rate numeric(5,2) not null,
  created_at timestamptz default now()
);

-- 2. Assets (سجل الأصول الرئيسي)
-- Enhanced to track initial balances and lifecycle
create table if not exists assets (
  id bigint primary key generated always as identity,
  asset_code text not null unique, -- رمز الأصل (Account Code)
  name text not null, -- اسم الأصل
  category_id bigint references asset_categories(id),
  
  purchase_date date not null,
  start_depreciation_date date not null,
  
  -- Cost Basis
  initial_cost numeric(15,2) not null, -- التكلفة التاريخية عند الشراء
  salvage_value numeric(15,2) default 0, -- القيمة المتبقية
  
  -- Depreciation Parameters
  depreciation_method text default 'Straight Line',
  depreciation_rate numeric(5,2) not null, -- نسبة الإهلاك %
  useful_life_months int not null, -- العمر الإنتاجي بالأشهر
  
  -- Opening Balances (For Migration/Manual Set)
  opening_accum_depreciation numeric(15,2) default 0, -- مجمع الإهلاك الافتتاحي (قبل النظام)
  
  status text check (status in ('Active', 'Retired', 'Sold')) default 'Active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Asset Transactions (حركات الأصول - إضافات / استبعادات)
-- To calculate "Additions" and "Disposals" columns dynamically
create table if not exists asset_transactions (
  id bigint primary key generated always as identity,
  asset_id bigint references assets(id) on delete cascade,
  transaction_date date not null,
  transaction_type text check (transaction_type in ('Addition', 'Disposal', 'Revaluation')) not null,
  amount numeric(15,2) not null, -- المبلغ (Additions positive, Disposals usually positive representing cost removed)
  notes text,
  created_at timestamptz default now()
);

-- 4. Depreciation Schedule (سجل الإهلاك الدوري)
-- To calculate "Period Depreciation" and "Closing Accum Depreciation"
create table if not exists depreciation_schedule (
  id bigint primary key generated always as identity,
  asset_id bigint references assets(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  amount numeric(15,2) not null, -- مصروف الإهلاك لهذه الفترة
  is_posted boolean default false,
  created_at timestamptz default now()
);

-- 5. Helper View for The "Asset Movement Report" (التقرير المطلوب)
-- This view aggregates data to match the image columns exactly
drop view if exists asset_movement_report;

create or replace view asset_movement_report as
select 
  a.id,
  a.asset_code,
  a.name,
  
  -- 1. Cost Analysis
  a.initial_cost as opening_balance,
  
  coalesce((select sum(amount) from asset_transactions t where t.asset_id = a.id and t.transaction_type = 'Addition' and extract(year from t.transaction_date) = extract(year from current_date)), 0) as additions,
  
  coalesce((select sum(amount) from asset_transactions t where t.asset_id = a.id and t.transaction_type = 'Disposal' and extract(year from t.transaction_date) = extract(year from current_date)), 0) as disposals,
  
  -- Closing Cost Calculation
  (a.initial_cost + 
   coalesce((select sum(amount) from asset_transactions t where t.asset_id = a.id and t.transaction_type = 'Addition'), 0) - 
   coalesce((select sum(amount) from asset_transactions t where t.asset_id = a.id and t.transaction_type = 'Disposal'), 0)
  ) as book_balance_end,
  
  -- 2. Depreciation Info
  a.depreciation_rate,
  a.useful_life_months as depreciation_duration,
  
  -- 3. Accumulated Depreciation Analysis
  a.opening_accum_depreciation as accum_dep_opening,
  
  -- Current Period Depreciation (Sum of schedule for this year)
  coalesce((select sum(amount) from depreciation_schedule ds where ds.asset_id = a.id and extract(year from ds.period_end) = extract(year from current_date)), 0) as period_depreciation,
  
  -- Total Accum Dep Closing
  (a.opening_accum_depreciation + 
   coalesce((select sum(amount) from depreciation_schedule ds where ds.asset_id = a.id), 0)
  ) as accum_dep_closing,

  -- Net Book Value
  (
    (a.initial_cost + 
     coalesce((select sum(amount) from asset_transactions t where t.asset_id = a.id and t.transaction_type = 'Addition'), 0) - 
     coalesce((select sum(amount) from asset_transactions t where t.asset_id = a.id and t.transaction_type = 'Disposal'), 0)
    ) - 
    (a.opening_accum_depreciation + 
     coalesce((select sum(amount) from depreciation_schedule ds where ds.asset_id = a.id), 0)
    )
  ) as net_book_value

from assets a;
