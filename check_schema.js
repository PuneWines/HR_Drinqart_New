import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tbhdogxcusrvgdcgihdv.supabase.co';
const supabaseAnonKey = 'sb_publishable_7YAp6xTnnp0dt-UEXbvQow_5e3ouQYA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  try {
    const testRecord = {
      employee_id: 'TEST001',
      attendance_date: '2026-06-08',
      employee_name: 'Test User',
      status: 'Present',
      store_name: 'BAWDHAN',
      serial_no: 'TEST_SERIAL',
      updated_at: new Date().toISOString()
    };

    console.log('Inserting test record...');
    const { data, error } = await supabase
      .from('attendance_daily')
      .insert(testRecord)
      .select();

    if (error) {
      console.error('Error inserting record:', error);
    } else {
      console.log('Inserted record successfully:', data);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

testInsert();
