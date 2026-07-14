import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tbhdogxcusrvgdcgihdv.supabase.co';
const supabaseAnonKey = 'sb_publishable_7YAp6xTnnp0dt-UEXbvQow_5e3ouQYA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- DISTINCT ATTENDANCE LOG STATUSES ---');
  const { data: logs, error: logsErr } = await supabase
    .from('attendance_logs')
    .select('status');
  if (logsErr) {
    console.error('Error fetching statuses:', logsErr);
  } else {
    const statuses = [...new Set(logs.map(l => l.status))];
    console.log('Unique statuses found:', statuses);
  }

  console.log('--- DISTINCT ADVANCE REQUEST TYPES & COLUMNS ---');
  const { data: advs, error: advErr } = await supabase
    .from('advance_requests')
    .select('*')
    .limit(5);
  if (advErr) {
    console.error('Error fetching advance requests:', advErr);
  } else {
    console.log('Advance requests sample:', advs);
  }
}

check();
