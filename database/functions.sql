-- Function to generate Asset Movement Report for a specific date range
-- Handles opening balances dynamically based on purchase dates and transaction history

CREATE OR REPLACE FUNCTION get_asset_report_v2(p_start_date date, p_end_date date)
RETURNS TABLE (
  id bigint,
  asset_code text,
  name text,
  purchase_date date,          -- Added for display
  start_depreciation_date date, -- Added for display
  opening_balance numeric,
  additions numeric,
  disposals numeric,
  book_balance_end numeric,
  depreciation_rate numeric,
  depreciation_duration int,
  accum_dep_opening numeric,
  period_depreciation numeric,
  accum_dep_closing numeric,
  net_book_value numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.asset_code,
    a.name,
    a.purchase_date,
    a.start_depreciation_date,
    
    -- 1. Cost Opening Balance
    -- Logic: Initial Cost (if purchased before start) + Additions (before start) - Disposals (before start)
    (
      CASE 
        WHEN a.purchase_date < p_start_date THEN a.initial_cost 
        ELSE 0 
      END +
      COALESCE((SELECT SUM(t.amount) FROM asset_transactions t WHERE t.asset_id = a.id AND t.transaction_type = 'Addition' AND t.transaction_date < p_start_date), 0) -
      COALESCE((SELECT SUM(t.amount) FROM asset_transactions t WHERE t.asset_id = a.id AND t.transaction_type = 'Disposal' AND t.transaction_date < p_start_date), 0)
    )::numeric(15,2) as opening_balance,
    
    -- 2. Additions (Period)
    -- Logic: Initial Cost (if purchased during period) + Additions (during period)
    (
      CASE 
        WHEN a.purchase_date BETWEEN p_start_date AND p_end_date THEN a.initial_cost 
        ELSE 0 
      END +
      COALESCE((SELECT SUM(t.amount) FROM asset_transactions t WHERE t.asset_id = a.id AND t.transaction_type = 'Addition' AND t.transaction_date BETWEEN p_start_date AND p_end_date), 0)
    )::numeric(15,2) as additions,
    
    -- 3. Disposals (Period)
    COALESCE((SELECT SUM(t.amount) FROM asset_transactions t WHERE t.asset_id = a.id AND t.transaction_type = 'Disposal' AND t.transaction_date BETWEEN p_start_date AND p_end_date), 0)::numeric(15,2) as disposals,
    
    -- 4. Book Balance End
    -- Logic: Opening + Additions - Disposals
    (
      -- Re-calculating full balance at end date for accuracy
      a.initial_cost +
      COALESCE((SELECT SUM(t.amount) FROM asset_transactions t WHERE t.asset_id = a.id AND t.transaction_type = 'Addition' AND t.transaction_date <= p_end_date), 0) -
      COALESCE((SELECT SUM(t.amount) FROM asset_transactions t WHERE t.asset_id = a.id AND t.transaction_type = 'Disposal' AND t.transaction_date <= p_end_date), 0)
    )::numeric(15,2) as book_balance_end,
    
    -- 5. Depreciation Info
    a.depreciation_rate,
    a.useful_life_months as depreciation_duration,
    
    -- 6. Accum Dep Opening
    -- Logic: Opening Manual Balance + Scheduled Dep (before start)
    (
      a.opening_accum_depreciation +
      COALESCE((SELECT SUM(ds.amount) FROM depreciation_schedule ds WHERE ds.asset_id = a.id AND ds.period_end < p_start_date), 0)
    )::numeric(15,2) as accum_dep_opening,
    
    -- 7. Period Depreciation
    -- Logic: Scheduled Dep (during period)
    -- Note: If depreciation hasn't been run/generated for this period, this will be 0.
    -- We assume the 'depreciation_schedule' is populated.
    COALESCE((SELECT SUM(ds.amount) FROM depreciation_schedule ds WHERE ds.asset_id = a.id AND ds.period_end BETWEEN p_start_date AND p_end_date), 0)::numeric(15,2) as period_depreciation,
    
    -- 8. Accum Dep Closing
    (
      a.opening_accum_depreciation +
      COALESCE((SELECT SUM(ds.amount) FROM depreciation_schedule ds WHERE ds.asset_id = a.id AND ds.period_end <= p_end_date), 0)
    )::numeric(15,2) as accum_dep_closing,

    -- 9. Net Book Value
    (
      (a.initial_cost + 
       COALESCE((SELECT SUM(t.amount) FROM asset_transactions t WHERE t.asset_id = a.id AND t.transaction_type = 'Addition' AND t.transaction_date <= p_end_date), 0) - 
       COALESCE((SELECT SUM(t.amount) FROM asset_transactions t WHERE t.asset_id = a.id AND t.transaction_type = 'Disposal' AND t.transaction_date <= p_end_date), 0)
      ) - 
      (a.opening_accum_depreciation + 
       COALESCE((SELECT SUM(ds.amount) FROM depreciation_schedule ds WHERE ds.asset_id = a.id AND ds.period_end <= p_end_date), 0)
      )
    )::numeric(15,2) as net_book_value

  FROM assets a
  WHERE 
    -- Only show assets that were purchased on or before the end date
    a.purchase_date <= p_end_date
    -- And haven't been fully disposed/retired before the start date (optional, but keeps report clean)
    -- AND (a.status != 'Retired' OR ... logic to check disposal date ...)
  ORDER BY a.asset_code;
END;
$$;
