import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tbhdogxcusrvgdcgihdv.supabase.co';
const supabaseAnonKey = 'sb_publishable_7YAp6xTnnp0dt-UEXbvQow_5e3ouQYA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getLocalDateString = (date = new Date()) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const todayDate = getLocalDateString();

async function checkLogs() {
  try {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      console.log('Attendance logs:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

checkLogs();
