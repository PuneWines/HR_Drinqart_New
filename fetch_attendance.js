import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ----------------------------------------------------
// 1. Environment Variable Loading
// ----------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach(line => {
      // Ignore comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) return;
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://tbhdogxcusrvgdcgihdv.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_7YAp6xTnnp0dt-UEXbvQow_5e3ouQYA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ----------------------------------------------------
// 2. Constants and Configuration
// ----------------------------------------------------
const DEVICES = [
  { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
  { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
  { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
  { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
  { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' }
];

const JOINING_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch';
const MASTER_MAP_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch';

// ----------------------------------------------------
// 3. Timezone and Formatting Helpers
// ----------------------------------------------------
const formatToISTISOString = (timeStr) => {
  if (!timeStr || timeStr === '-') return null;
  if (timeStr instanceof Date) {
    const tzoffset = timeStr.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(timeStr.getTime() - tzoffset)).toISOString().slice(0, -1);
    return localISOTime;
  }

  let formatted = timeStr.trim().replace(' ', 'T');
  if (formatted.includes('+')) {
    formatted = formatted.split('+')[0];
  } else if (formatted.endsWith('Z')) {
    formatted = formatted.slice(0, -1);
  }

  const timeParts = formatted.split('T')[1] || '';
  if (timeParts.split(':').length === 2) {
    formatted = formatted + ':00';
  }
  return formatted;
};

const parseISTToDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return null;
  try {
    let cleanStr = dateStr;
    if (cleanStr.includes('+')) {
      cleanStr = cleanStr.split('+')[0];
    } else if (cleanStr.endsWith('Z')) {
      cleanStr = cleanStr.slice(0, -1);
    }

    let formatted = cleanStr.trim().replace(' ', 'T');
    const timeParts = formatted.split('T')[1] || '';
    if (timeParts.split(':').length === 2) {
      formatted = formatted + ':00';
    }
    formatted = formatted + '+05:30';
    const d = new Date(formatted);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch (e) {
    return null;
  }
};

const formatTimeIST = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return '-';
  try {
    const d = parseISTToDate(utcDateStr);
    if (!d) return utcDateStr;
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
    return formatted.replace(/\u202f|\u00a0/g, ' '); // normalize non-breaking spaces
  } catch (e) {
    return utcDateStr;
  }
};

const calculateHoursMins = (diffMs) => {
  if (!diffMs || isNaN(diffMs) || diffMs <= 0) return '00:00:00';
  const totalSecs = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const calculateWorkHours = (inStr, outStr) => {
  if (!inStr || !outStr || inStr === '-' || outStr === '-' || inStr === outStr) return '00:00:00';
  try {
    const inDate = parseISTToDate(inStr);
    const outDate = parseISTToDate(outStr);
    if (!inDate || !outDate || outDate <= inDate) return '00:00:00';
    return calculateHoursMins(outDate - inDate);
  } catch (e) {
    return '00:00:00';
  }
};

const calculateLateMinutes = (inStr) => {
  if (!inStr || inStr === '-') return 0;
  try {
    const inDate = parseISTToDate(inStr);
    if (!inDate) return 0;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(inDate);

    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
    const totalMinutes = hour * 60 + minute;

    const officialStartTime = 10 * 60 + 0;      // 10:00 AM
    const graceTimeThreshold = 10 * 60 + 10;    // 10:10 AM

    if (totalMinutes >= graceTimeThreshold) {
      return totalMinutes - officialStartTime;
    }
    return 0;
  } catch (e) {
    return 0;
  }
};

// ----------------------------------------------------
// 4. Metadata Fetching Functions
// ----------------------------------------------------
async function fetchJoiningData() {
  try {
    console.log('📡 Fetching employee joining metadata from Google Sheets...');
    const res = await fetch(JOINING_API_URL);
    const jResult = await res.json();
    if (jResult.success) {
      const rawRows = jResult.data || jResult;
      const headers = rawRows[5];
      const dataRows = rawRows.slice(6);

      const getIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
      const empIdIdx = getIdx('Employee ID');
      const nameIdx = getIdx('Name As Per Aadhar');
      const desIdx = getIdx('Designation');
      const storeIdx = getIdx('Joining Place');

      return dataRows.map(r => ({
        id: r[empIdIdx]?.toString().trim(),
        name: r[nameIdx]?.toString().trim(),
        designation: r[getIdx('Designation')]?.toString().trim() || r[desIdx]?.toString().trim(),
        store: r[getIdx('Joining Place')]?.toString().trim() || r[storeIdx]?.toString().trim()
      })).filter(h => h.id);
    }
    console.warn('⚠️ Warning: Google Joining sheet API returned success: false');
    return [];
  } catch (error) {
    console.error('❌ Error fetching joining sheet:', error.message);
    return [];
  }
}

async function fetchMasterMapping() {
  try {
    console.log('📡 Fetching master device mapping from Google Sheets...');
    const res = await fetch(MASTER_MAP_URL);
    const dmResult = await res.json();
    if (dmResult.success) {
      const rows = dmResult.data.slice(1);
      return rows.map(r => ({
        userId: r[5]?.toString().trim(),
        name: r[6]?.toString().trim(),
        deviceId: r[7]?.toString().trim(),
        serialNo: r[8]?.toString().trim(),
        storeName: r[9]?.toString().trim()
      }));
    }
    console.warn('⚠️ Warning: Google Master Mapping sheet API returned success: false');
    return [];
  } catch (error) {
    console.error('❌ Error fetching master mapping:', error.message);
    return [];
  }
}

async function fetchLogsForDevice(device, date) {
  const url = `http://103.195.203.77:15167/api/v2/WebAPI/GetDeviceLogs?APIKey=211616032630&SerialNumber=${device.serial}&DeviceName=${device.apiName}&FromDate=${date}&ToDate=${date}`;
  try {
    console.log(`📡 Fetching logs for ${device.name} (${device.serial})...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`⚠️ Warning: Fetch failed for ${device.name} with HTTP status ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map(log => ({ ...log, _DeviceName: device.name }));
    }
    console.warn(`⚠️ Warning: Biometric API for ${device.name} did not return an array.`);
    return [];
  } catch (error) {
    console.error(`❌ Error fetching logs for ${device.name}:`, error.message);
    return [];
  }
}

// ----------------------------------------------------
// 5. Main Execution Flow
// ----------------------------------------------------
async function main() {
  // Validate Command Line Date
  const args = process.argv.slice(2);
  let targetDate = '';

  if (args.length > 0) {
    const dateArg = args[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
      targetDate = dateArg;
    } else {
      console.error('❌ Error: Invalid date format. Please use YYYY-MM-DD (e.g., 2026-06-27).');
      process.exit(1);
    }
  } else {
    // Default to today in IST
    const today = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(today);
    const getVal = (type) => parts.find(p => p.type === type).value;
    targetDate = `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
    console.log(`ℹ️ No date provided. Defaulting to today's date (IST): ${targetDate}`);
  }

  console.log(`🚀 Starting attendance fetch and sync process for: ${targetDate}`);

  // Fetch all metadata and device logs in parallel
  const [joiningData, masterMapping, ...deviceResponses] = await Promise.all([
    fetchJoiningData(),
    fetchMasterMapping(),
    ...DEVICES.map(dev => fetchLogsForDevice(dev, targetDate))
  ]);

  const rawLogsData = deviceResponses.flat();
  console.log(`✅ Fetched ${rawLogsData.length} raw logs from biometric devices.`);

  if (rawLogsData.length === 0) {
    console.log('ℹ️ No attendance logs found for this date. Exiting.');
    return;
  }

  // Filter logs for the specific date
  const filteredLogs = rawLogsData.filter(log => {
    if (!log.LogDate) return false;
    const logDateStr = log.LogDate.split(' ')[0];
    return logDateStr === targetDate;
  });

  console.log(`🔍 Filtered down to ${filteredLogs.length} logs matching date: ${targetDate}`);
  if (filteredLogs.length === 0) {
    console.log('ℹ️ No matching log dates after filtering. Exiting.');
    return;
  }

  // Sort logs chronologically
  filteredLogs.sort((a, b) => new Date(a.LogDate) - new Date(b.LogDate));

  // Group logs by EmployeeCode
  const grouped = {};
  filteredLogs.forEach(log => {
    if (!log.EmployeeCode || !log.LogDate) return;
    const code = log.EmployeeCode.toString().trim();
    const key = `${code}_${targetDate}`;

    if (!grouped[key]) {
      grouped[key] = {
        EmployeeCode: code,
        Date: targetDate,
        SerialNumber: log.SerialNumber,
        SourceDeviceName: log._DeviceName,
        logs: []
      };
    }
    grouped[key].logs.push(log.LogDate);
  });

  // Aggregate and calculate metrics
  const aggregatedData = Object.values(grouped).map(group => {
    const logs = group.logs;
    let inTime = '-';
    let outTime = '-';
    let punchMiss = 'No';
    let punchMissMsg = '';

    if (logs.length === 1) {
      const punchTime = logs[0];
      const timePart = punchTime.split(' ')[1] || '';
      const hours = parseInt(timePart.split(':')[0]) || 0;

      punchMiss = 'Yes';
      if (hours >= 15) {
        outTime = punchTime;
        punchMissMsg = 'Morning Punch Miss';
      } else {
        inTime = punchTime;
        punchMissMsg = 'Evening Punch Miss';
      }
    } else {
      inTime = logs[0];
      outTime = logs[logs.length - 1];
    }

    const serial = group.SerialNumber.toString().trim();
    const code = group.EmployeeCode.toString().trim();
    const isNumeric = !isNaN(code) && code !== '';

    // Metadata Lookup
    const empMeta = joiningData.find(e =>
      (e.id && e.id.toLowerCase() === code.toLowerCase()) ||
      (e.name && e.name.toLowerCase() === code.toLowerCase())
    );

    let dMap = masterMapping.find(m => m.userId && m.userId.toString().toLowerCase() === code.toLowerCase());

    if (!dMap) {
      const entryName = (empMeta?.name || code).toString().trim().toLowerCase();
      dMap = masterMapping.find(m => m.name && m.name.toString().toLowerCase() === entryName);
    }

    const displayName = dMap ? dMap.name : (empMeta ? empMeta.name : (isNumeric ? 'Unknown' : code));
    const displayCode = dMap ? dMap.userId : (empMeta ? empMeta.id : (isNumeric ? code : 'Unknown'));
    const displayStore = dMap ? dMap.storeName : (empMeta ? empMeta.store : group.SourceDeviceName);
    const displayDeviceId = dMap ? dMap.deviceId : '-';
    const displayAssignedSerial = dMap ? dMap.serialNo : serial;

    const lateMins = calculateLateMinutes(inTime);
    const workHrs = punchMiss === 'Yes' ? '00:00:00' : calculateWorkHours(inTime, outTime);

    // Lunch and Waste Time Calculation
    let actualLunchMs = 0;
    if (logs.length > 2) {
      for (let i = 1; i < logs.length - 1; i += 2) {
        const lOut = parseISTToDate(logs[i]);
        const lIn = parseISTToDate(logs[i + 1]);
        if (lOut && lIn) {
          actualLunchMs += Math.max(0, lIn - lOut);
        }
      }
    }

    const standardLunchMs = 2.5 * 3600 * 1000;
    const wasteTimeMs = Math.max(0, actualLunchMs - standardLunchMs);
    const displayLunchMs = Math.min(actualLunchMs, standardLunchMs);

    const dateObj = parseISTToDate(group.Date);
    const dayName = dateObj ? new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj) : '';

    let status = 'Present';
    if (lateMins > 0) status = 'Late';

    const punchLogStr = logs.map(l => formatTimeIST(l)).join(' | ');

    let punchLogStatus = 'Bahar';
    if (logs.length > 0) {
      if (logs.length % 2 === 1) {
        if (logs.length === 1) {
          const punchTime = logs[0];
          const timePart = punchTime.split(' ')[1] || '';
          const hours = parseInt(timePart.split(':')[0]) || 0;
          punchLogStatus = hours >= 15 ? 'Bahar' : 'Andar';
        } else {
          punchLogStatus = 'Andar';
        }
      } else {
        punchLogStatus = 'Bahar';
      }
    }

    const apiManualPunches = {
      "1": "",
      "2": "",
      "3": "",
      "4": "",
      "5": ""
    };
    logs.forEach((logStr, idx) => {
      if (idx < 5) {
        try {
          const timePart = logStr.split(' ')[1] || '';
          apiManualPunches[(idx + 1).toString()] = timePart.substring(0, 5);
        } catch (e) {
          // ignore
        }
      }
    });

    return {
      employee_id: displayCode,
      employee_name: displayName,
      attendance_date: group.Date,
      day: dayName,
      designation: empMeta ? empMeta.designation : '-',
      store_name: displayStore,
      device_id: displayDeviceId,
      serial_number: displayAssignedSerial || serial,
      in_time: formatToISTISOString(inTime),
      out_time: formatToISTISOString(outTime),
      working_hour: workHrs,
      overtime: '0h 0m',
      late_minute: lateMins,
      status: status,
      standard_lunch: calculateHoursMins(displayLunchMs),
      waste_time: calculateHoursMins(wasteTimeMs),
      punch_log: punchLogStr,
      punch_log_status: punchLogStatus,
      punch_miss: punchMiss,
      punch_miss_msg: punchMissMsg,
      manual_punches: apiManualPunches,
      updated_at: new Date()
    };
  });

  console.log(`🔄 Querying existing logs for ${targetDate} to preserve manual logs...`);
  let logsToUpsert = aggregatedData;
  try {
    const { data: existingLogs, error: fetchErr } = await supabase
      .from('attendance_logs')
      .eq('attendance_date', targetDate);

    if (!fetchErr && existingLogs && existingLogs.length > 0) {
      logsToUpsert = aggregatedData.map(row => {
        const existing = existingLogs.find(r => r.employee_id === row.employee_id);
        if (existing && existing.manual_punches && (existing.manual_punches.is_manual === true || existing.manual_punches.manual_override === true)) {
          console.log(`✍ [Manual Override Preserved] Keeping manual logs for ${existing.employee_name} (${existing.employee_id})`);
          const { id, ...existingWithoutId } = existing;
          return {
            ...existingWithoutId,
            punch_log: row.punch_log,
            punch_log_status: row.punch_log_status
          };
        }
        return row;
      });
    }
  } catch (err) {
    console.warn('⚠️ Warning: Failed to query existing logs, continuing with standard upsert:', err.message);
  }

  console.log(`🔄 Upserting ${logsToUpsert.length} records to Supabase table 'attendance_logs'...`);

  try {
    const { data, error } = await supabase
      .from('attendance_logs')
      .upsert(logsToUpsert, {
        onConflict: 'employee_id,attendance_date',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      throw error;
    }

    console.log(`\n🎉 Success! Successfully fetched, aggregated, and saved attendance.`);
    console.log(`👉 Total Records Synced: ${data?.length || 0}`);

    // Print summary table in console
    console.log('\n--- Sync Summary ---');
    console.table(aggregatedData.map(row => ({
      ID: row.employee_id,
      Name: row.employee_name,
      Store: row.store_name,
      Status: row.status,
      InTime: row.in_time ? formatTimeIST(row.in_time) : '-',
      OutTime: row.out_time ? formatTimeIST(row.out_time) : '-',
      Hours: row.working_hour,
      LateMins: row.late_minute,
      PunchMiss: row.punch_miss === 'Yes' ? '⚠️ Yes' : 'No'
    })));

  } catch (dbError) {
    console.error('❌ Database Upsert Error:', dbError.message || dbError);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Critical execution error:', err);
  process.exit(1);
});
