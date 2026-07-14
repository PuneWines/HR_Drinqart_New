import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tbhdogxcusrvgdcgihdv.supabase.co';
const supabaseAnonKey = 'sb_publishable_7YAp6xTnnp0dt-UEXbvQow_5e3ouQYA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEVICES = [
    { name: 'BAWDHAN', serial: 'C26238441B1E342D' },
    { name: 'HINJEWADI', serial: 'AMDB25061400335' },
    { name: 'WAGHOLI', serial: 'AMDB25061400343' },
    { name: 'AKOLE', serial: 'C262CC13CF202038' },
    { name: 'MUMBAI', serial: 'C2630450C32A2327' }
];

async function updateSerials() {
  try {
    const { data: employees } = await supabase
      .from('employees')
      .select('employee_id, joining_place');
      
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('id, employee_id, serial_number, store_name, device_id')
      .or('serial_number.eq.-,serial_number.is.null,serial_number.eq.');
      
    console.log(`Fetched ${employees.length} employees.`);
    console.log(`Found ${logs.length} logs with empty/missing serial numbers.`);
    
    for (const log of logs) {
      const emp = employees.find(e => e.employee_id === log.employee_id);
      const storeName = log.store_name || emp?.joining_place || '';
      console.log(`Log EmployeeID: ${log.employee_id}, StoreName: "${storeName}" (from log: "${log.store_name}", from emp: "${emp?.joining_place}")`);
      
      const dev = DEVICES.find(d => d.name.toUpperCase() === storeName.toUpperCase());
      if (dev) {
        const { error: updateErr } = await supabase
          .from('attendance_logs')
          .update({
            serial_number: dev.serial,
            device_id: dev.name
          })
          .eq('id', log.id);
          
        if (updateErr) {
          console.error(`Failed to update log ${log.id}:`, updateErr.message);
        } else {
          console.log(`Updated log ${log.id} to serial ${dev.serial}`);
        }
      } else {
        console.log(`No device match found for "${storeName}"`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

updateSerials();
