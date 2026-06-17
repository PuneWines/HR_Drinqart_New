import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tbhdogxcusrvgdcgihdv.supabase.co';
const supabaseAnonKey = 'sb_publishable_7YAp6xTnnp0dt-UEXbvQow_5e3ouQYA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  try {
    const baseRecord = {
      employee_id: 'TEST_' + Math.floor(Math.random() * 10000),
      name_as_per_aadhar: 'Test User',
      father_name: 'Father User',
      dob: '1995-01-01',
      gender: 'Male',
      mobile_no: '9999999999',
      date_of_joining: '2026-06-01',
      joining_place: 'BAWDHAN',
      designation: 'Employee',
      aadhar_no: '123412341234',
      current_account_no: '1234567890',
      ifsc_code: 'SBIN0001234',
      branch_name: 'Main Branch',
      payment_mode: 'Bank Transfer',
      aadhar_front_image: 'http://example.com/front.jpg',
      aadhar_back_image: 'http://example.com/back.jpg',
      candidate_photo: 'http://example.com/photo.jpg',
      pan_card_image: 'http://example.com/pan.jpg',
      bank_passbook_image: 'http://example.com/passbook.jpg'
    };

    console.log('1. Trying insert with status: "Active"...');
    const res1 = await supabase.from('employees').insert({ ...baseRecord, status: 'Active' });
    console.log('Status "Active" result:', res1.error ? res1.error.message : 'Success!');

    console.log('2. Trying insert with status: null...');
    const res2 = await supabase.from('employees').insert({ ...baseRecord, employee_id: baseRecord.employee_id + '_2', status: null });
    console.log('Status null result:', res2.error ? res2.error.message : 'Success!');

    console.log('3. Trying insert with status omitted...');
    const res3 = await supabase.from('employees').insert({ ...baseRecord, employee_id: baseRecord.employee_id + '_3' });
    console.log('Status omitted result:', res3.error ? res3.error.message : 'Success!');

    console.log('4. Trying insert with status: "active" (lowercase)...');
    const res4 = await supabase.from('employees').insert({ ...baseRecord, employee_id: baseRecord.employee_id + '_4', status: 'active' });
    console.log('Status "active" result:', res4.error ? res4.error.message : 'Success!');

  } catch (err) {
    console.error('Exception:', err);
  }
}

testInsert();
