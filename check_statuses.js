import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tbhdogxcusrvgdcgihdv.supabase.co';
const supabaseAnonKey = 'sb_publishable_7YAp6xTnnp0dt-UEXbvQow_5e3ouQYA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('Distinct statuses in attendance_logs:');
  const { data: statuses, error } = await supabase
    .from('attendance_logs')
    .select('status');
  
  if (error) {
    console.error(error);
  } else {
    const counts = {};
    statuses.forEach(row => {
      const s = row.status;
      counts[s] = (counts[s] || 0) + 1;
    });
    console.log(counts);
  }

  console.log('Distinct types in advance_requests:');
  const { data: advTypes, error: advError } = await supabase
    .from('advance_requests')
    .select('type');
  
  if (advError) {
    console.error(advError);
  } else {
    const counts = {};
    advTypes.forEach(row => {
      const t = row.type;
      counts[t] = (counts[t] || 0) + 1;
    });
    console.log(counts);
  }
}

check();
