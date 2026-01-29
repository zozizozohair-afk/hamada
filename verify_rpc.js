
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssiijxqixxlqsylpmtgo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzaWlqeHFpeHhscXN5bHBtdGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNDc2NDYsImV4cCI6MjA3MjgyMzY0Nn0.8Csplw0vlNtThVxDkdYjXAHlWPGsEFDrXK_3wCHyxIo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
  const { data, error } = await supabase.rpc('get_asset_report_v2', {
    p_start_date: '2025-01-01',
    p_end_date: '2025-12-31'
  });

  if (error) {
    console.error('Error calling RPC:', error);
  } else {
    if (data && data.length > 0) {
      console.log('First row keys:', Object.keys(data[0]));
      console.log('First row sample:', {
        purchase_date: data[0].purchase_date,
        start_depreciation_date: data[0].start_depreciation_date
      });
    } else {
      console.log('No data returned from RPC');
    }
  }
}

checkRpc();
