import { supabase } from '../lib/supabase';

const JOINING_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch';
const MASTER_MAP_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch';

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
};

const getSundaysCount = (month, year) => {
    let count = 0;
    const days = new Date(year, month, 0).getDate();
    for (let i = 1; i <= days; i++) {
        if (new Date(year, month - 1, i).getDay() === 0) count++;
    }
    return count;
};

const calculateLateMinutes = (timeStr) => {
    if (!timeStr || timeStr === '-') return 0;
    try {
        const timePart = timeStr.split(' ')[1];
        if (!timePart) return 0;
        const [h, m] = timePart.split(':').map(Number);
        const totalMins = h * 60 + m;
        const threshold = 10 * 60 + 10; // 10:10 AM
        const base = 10 * 60 + 0; // 10:00 AM
        if (totalMins > threshold) return totalMins - base;
        return 0;
    } catch (e) { return 0; }
};

const formatSecsToHrsMins = (totalSecs) => {
    if (!totalSecs) return '0h 0m';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${hrs}h ${mins}m`;
};

/**
 * Fetch logs and metadata, aggregate, and sync/upsert to Supabase
 * @param {number} month - 1-based month (1-12)
 * @param {number} year - year
 * @param {object} device - { name, apiName, serial }
 * @returns {Promise<Array>} the final normalized records upserted to Supabase
 */
export const syncMonthlyAttendanceFromApi = async (month, year, device) => {
    if (year < 2026 || (year === 2026 && month < 4)) {
        return [];
    }

    // 1. Fetch metadata in parallel
    const [joiningRes, masterRes] = await Promise.all([
        fetch(JOINING_API_URL),
        fetch(MASTER_MAP_URL)
    ]);

    const joiningDataRaw = await joiningRes.json();
    const masterDataRaw = await masterRes.json();

    let joiningData = [];
    if (joiningDataRaw.success) {
        const raw = joiningDataRaw.data || joiningDataRaw;
        const headers = raw[5];
        const dataRows = raw.slice(6);
        const getIdx = (n) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === n.toLowerCase());

        joiningData = dataRows.map(r => ({
            id: r[getIdx('Employee ID')]?.toString().trim(),
            name: r[getIdx('Name As Per Aadhar')]?.toString().trim(),
            designation: r[getIdx('Designation')]?.toString().trim()
        })).filter(h => h.id);
    }

    let deviceMapping = [];
    if (masterDataRaw.success) {
        const rows = masterDataRaw.data.slice(1);
        deviceMapping = rows.map(r => ({
            userId: r[5]?.toString().trim(),
            name: r[6]?.toString().trim(),
            deviceId: r[7]?.toString().trim(),
            serialNo: r[8]?.toString().trim(),
            storeName: r[9]?.toString().trim()
        }));
    }

    // 2. Fetch biometric device logs
    const startDay = '01';
    const endDay = getDaysInMonth(month, year);
    const paddedMonth = month.toString().padStart(2, '0');
    const fromDate = `${year}-${paddedMonth}-${startDay}`;
    const toDate = `${year}-${paddedMonth}-${endDay}`;

    const API_URL = `/api/device-logs?APIKey=211616032630&SerialNumber=${device.serial}&DeviceName=${device.apiName}&FromDate=${fromDate}&ToDate=${toDate}`;
    const logsResponse = await fetch(API_URL);
    if (!logsResponse.ok) {
        throw new Error(`Device logs API status: ${logsResponse.status}`);
    }
    const rawLogs = await logsResponse.json();
    if (!Array.isArray(rawLogs)) {
        throw new Error('Invalid logs data from API');
    }

    // Filter logs for strictly >= 2026-04-01
    const logs = rawLogs.filter(log => {
        if (!log.LogDate) return false;
        const logDateStr = log.LogDate.split(' ')[0];
        return logDateStr >= '2026-04-01';
    });

    // 3. Group and aggregate daily logs
    const dailyGrouped = {};
    logs.sort((a, b) => new Date(a.LogDate) - new Date(b.LogDate));

    logs.forEach(log => {
        if (!log.EmployeeCode || !log.LogDate) return;
        const dateKey = log.LogDate.split(' ')[0];
        const key = `${log.EmployeeCode}_${dateKey}`;
        if (!dailyGrouped[key]) {
            dailyGrouped[key] = { id: log.EmployeeCode, date: dateKey, logs: [] };
        }
        dailyGrouped[key].logs.push(log.LogDate);
    });

    const monthlyAgg = {};
    const totalSundays = getSundaysCount(month, year);
    const totalDaysInMonth = getDaysInMonth(month, year);

    Object.values(dailyGrouped).forEach(day => {
        const id = day.id.toString().trim();
        if (!monthlyAgg[id]) {
            monthlyAgg[id] = {
                id,
                presentDays: 0,
                lateDays: 0,
                punchMissDays: 0,
                totalWorkSecs: 0,
                totalLunchSecs: 0,
                holidayDays: 0,
                userId: id,
                actualSerial: day.logs[0] ? device.serial : '-'
            };
        }

        const agg = monthlyAgg[id];
        agg.presentDays += 1;

        const inTime = day.logs[0];
        const outTime = day.logs[day.logs.length - 1];

        if (calculateLateMinutes(inTime) > 0) agg.lateDays += 1;
        if (day.logs.length === 1) agg.punchMissDays += 1;
        else {
            const start = new Date(inTime.replace(/-/g, '/'));
            const end = new Date(outTime.replace(/-/g, '/'));
            agg.totalWorkSecs += (end - start) / 1000;
            if (day.logs.length >= 4) {
                const lStart = new Date(day.logs[1].replace(/-/g, '/'));
                const lEnd = new Date(day.logs[2].replace(/-/g, '/'));
                agg.totalLunchSecs += (lEnd - lStart) / 1000;
            }
        }
    });

    // 4. Map to final structures
    const finalData = Object.values(monthlyAgg).map((agg, idx) => {
        const code = agg.id.toString().trim();
        const empMeta = joiningData.find(e =>
            (e.id && e.id.toLowerCase() === code.toLowerCase()) ||
            (e.name && e.name.toLowerCase() === code.toLowerCase())
        );

        let dMap = deviceMapping.find(m => m.userId && m.userId.toString().toLowerCase() === code.toLowerCase());

        if (!dMap) {
            const entryName = (empMeta?.name || code).toString().trim().toLowerCase();
            dMap = deviceMapping.find(m => m.name && m.name.toString().toLowerCase() === entryName);
        }

        const displayName = dMap ? dMap.name : (empMeta ? empMeta.name : (isNaN(code) ? code : 'Unknown'));
        const displayCode = dMap ? dMap.userId : (empMeta ? empMeta.id : (isNaN(code) ? 'Unknown' : code));
        const displayStore = dMap ? dMap.storeName : (empMeta ? empMeta.store : device.name);
        const displayDeviceId = dMap ? dMap.deviceId : '-';
        const displayAssignedSerial = dMap ? dMap.serialNo : agg.actualSerial;

        const absentDays = Math.max(0, totalDaysInMonth - agg.presentDays);

        return {
            year: year,
            month: monthNames[month - 1],
            employee_code: displayCode,
            employee_name: displayName,
            designation: empMeta ? empMeta.designation : '-',
            store_name: displayStore,
            device_id: displayDeviceId,
            serial_no: device.serial,
            present_days: agg.presentDays,
            absent_days: absentDays,
            punch_miss: agg.punchMissDays,
            late_days: agg.lateDays,
            total_work_hours: formatSecsToHrsMins(agg.totalWorkSecs),
            total_work_secs: agg.totalWorkSecs,
            total_lunch_time: formatSecsToHrsMins(agg.totalLunchSecs),
            total_lunch_secs: agg.totalLunchSecs,
            holidays: totalSundays
        };
    });

    // 5. Idempotent batch upsert to Supabase
    if (finalData.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < finalData.length; i += batchSize) {
            const batch = finalData.slice(i, i + batchSize);
            const { error } = await supabase
                .from('attendance_monthly')
                .upsert(batch, { onConflict: 'year,month,employee_code,serial_no' });

            if (error) {
                console.error('Error batch upserting to Supabase:', error);
                throw new Error(`Supabase Upsert Error: ${error.message}`);
            }
        }
    }

    return finalData;
};

/**
 * Fetch monthly attendance stats directly from Supabase
 * @param {number} month - 1-based month (1-12)
 * @param {number} year - year
 * @param {string} serialNo - device serial number
 * @returns {Promise<Array>} the records stored in Supabase
 */
export const getMonthlyAttendanceFromSupabase = async (month, year, serialNo) => {
    const monthName = monthNames[month - 1];
    const { data, error } = await supabase
        .from('attendance_monthly')
        .select('*')
        .eq('year', year)
        .eq('month', monthName)
        .eq('serial_no', serialNo);

    if (error) {
        console.error('Error reading from Supabase:', error);
        throw error;
    }

    // Map database snake_case columns back to camelCase structures expected by UI
    return (data || []).map((row, idx) => ({
        sNo: idx + 1,
        year: row.year,
        month: row.month,
        employeeCode: row.employee_code,
        employeeName: row.employee_name,
        designation: row.designation,
        storeName: row.store_name,
        deviceId: row.device_id,
        serialNo: row.serial_no,
        presentDays: row.present_days,
        absentDays: row.absent_days,
        punchMiss: row.punch_miss,
        lateDays: row.late_days,
        totalWorkHours: row.total_work_hours,
        totalWorkSecs: row.total_work_secs,
        totalLunchTime: row.total_lunch_time,
        totalLunchSecs: row.total_lunch_secs,
        holidays: row.holidays,
        lastSyncedAt: row.last_synced_at
    }));
};
