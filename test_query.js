import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tbhdogxcusrvgdcgihdv.supabase.co';
const supabaseAnonKey = 'sb_publishable_7YAp6xTnnp0dt-UEXbvQow_5e3ouQYA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('--- EMPLOYEES SAMPLE ---');
  const { data: employees, error: empErr } = await supabase.from('employees').select('*').limit(1);
  if (empErr) console.error('employees error:', empErr);
  else console.log('employees:', employees);

  console.log('--- ATTENDANCE LOGS SAMPLE ---');
  const { data: logs, error: logsErr } = await supabase.from('attendance_logs').select('*').limit(1);
  if (logsErr) console.error('attendance_logs error:', logsErr);
  else console.log('attendance_logs:', logs);

  console.log('--- ADVANCE REQUEST SAMPLE ---');
  const { data: advRequests, error: advErr } = await supabase.from('advance_requests').select('*').limit(1);
  if (advErr) {
    console.error('advance_requests error:', advErr);
    // try singular
    const { data: advRequest, error: advReqErr } = await supabase.from('advance_request').select('*').limit(1);
    if (advReqErr) console.error('advance_request error:', advReqErr);
    else console.log('advance_request (singular):', advRequest);
  } else {
    console.log('advance_requests (plural):', advRequests);
  }

  console.log('--- PAYROLL SAMPLE ---');
  const { data: payroll, error: payrollErr } = await supabase.from('payroll').select('*').limit(1);
  if (payrollErr) console.error('payroll error:', payrollErr);
  else console.log('payroll:', payroll);
}

test();
