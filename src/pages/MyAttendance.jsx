import React, { useEffect, useState } from 'react';
import {
    Calendar, Clock, CheckCircle2, XCircle, Info,
    Search, Filter, Download, ArrowUpRight, ArrowDownRight,
    User, Hash, Timer, Coffee, AlertCircle, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

const DEVICES = [
    { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
    { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
    { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
    { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
    { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' }
];

const JOINING_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch';
const MASTER_MAP_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch';

const MyAttendance = () => {
    const DUMMY_ATTENDANCE = [
        {
            employeeCode: 'DEMO101', employeeName: 'Sample Employee', date: '01/04/2024',
            inTime: '09:00:00 AM', outTime: '06:00:00 PM', totalDuration: '9:00:00',
            totalWithLunchDuration: '8:00:00', lunchTime: '1:00:00', actualTotalDuration: '8:00:00',
            status: 'Present', missAdjustCondition: 'None', month: 'April', year: '2024'
        },
        {
            employeeCode: 'DEMO101', employeeName: 'Sample Employee', date: '02/04/2024',
            inTime: '09:15:00 AM', outTime: '06:15:00 PM', totalDuration: '9:00:00',
            totalWithLunchDuration: '8:00:00', lunchTime: '1:00:00', actualTotalDuration: '8:00:00',
            status: 'Present', missAdjustCondition: 'Late Entry', month: 'April', year: '2024'
        }
    ];

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const getDaysInMonth = (month, year) => {
        return new Date(year, month, 0).getDate();
    };

    const today = new Date();
    const currentMonthName = monthNames[today.getMonth()];
    const currentYearStr = today.getFullYear().toString();

    const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
    const [selectedYear, setSelectedYear] = useState(currentYearStr);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [attendanceData, setAttendanceData] = useState([]);
    const [isDemo, setIsDemo] = useState(false);

    const timeToSeconds = (timeStr) => {
        if (!timeStr || timeStr === '-' || timeStr === '0.0' || timeStr === '0') return 0;
        try {
            const str = timeStr.toString().trim();

            // Handle Numeric time (e.g., 0.465)
            if (!isNaN(str) && !str.includes(':')) {
                const val = parseFloat(str);
                if (val > 0 && val < 1) return Math.floor(val * 24 * 3600);
            }

            // Handle AM/PM formats
            const ampmMatch = str.match(/(\d{1,2}):(\d{2})(:(\d{2}))?\s*(AM|PM)/i);
            if (ampmMatch) {
                let h = parseInt(ampmMatch[1], 10);
                let m = parseInt(ampmMatch[2], 10);
                let s = ampmMatch[4] ? parseInt(ampmMatch[4], 10) : 0;
                const ampm = ampmMatch[5].toUpperCase();
                if (ampm === 'PM' && h < 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;
                return h * 3600 + m * 60 + s;
            }

            // Handle Dates or strings with colons
            if (str.includes(':')) {
                // If it looks like a full date (e.g. 1899-12-30 11:10:00)
                if (str.includes('-') || str.includes('T')) {
                    const d = new Date(str.replace(' ', 'T'));
                    if (!isNaN(d.getTime())) return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
                }

                const parts = str.match(/(\d{1,2}):(\d{2})(:(\d{2}))?/);
                if (parts) {
                    const h = parseInt(parts[1], 10);
                    const m = parseInt(parts[2], 10);
                    const s = parts[4] ? parseInt(parts[4], 10) : 0;
                    return h * 3600 + m * 60 + s;
                }
            }
        } catch (e) { return 0; }
        return 0;
    };

    const secondsToTime = (totalSecs) => {
        if (!totalSecs || totalSecs === 0) return '-';
        let s = Math.abs(totalSecs);
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = Math.floor(s % 60);
        const sign = totalSecs < 0 ? '-' : '';
        const h12 = hrs % 12 || 12;
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        return `${sign}${h12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} ${ampm}`;
    };

    const durationToSecs = (val) => {
        if (!val || val === '0' || val === '-') return 0;
        const str = val.toString().trim();
        if (str.includes('-') || str.includes('T')) {
            const d = new Date(str.replace(' ', 'T'));
            if (!isNaN(d.getTime())) return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
        }
        const parts = str.split(':');
        if (parts.length >= 2) {
            let h = parseInt(parts[0], 10);
            let m = parseInt(parts[1], 10);
            let s = parts[2] ? parseInt(parts[2], 10) : 0;
            if (h > 1000) h = 0;
            return h * 3600 + m * 60 + s;
        }
        const floatVal = parseFloat(str.replace(/:/g, '.'));
        if (!isNaN(floatVal) && floatVal < 24) return Math.floor(floatVal * 3600);
        return 0;
    };

    const formatTime12h = (dateStr) => {
        if (!dateStr || dateStr === '-') return '-';
        try {
            const parts = dateStr.trim().split(' ');
            let timePart = parts[1] || parts[0];
            if (!timePart) return dateStr;
            const hasAMPM = timePart.toLowerCase().includes('am') || timePart.toLowerCase().includes('pm');
            if (hasAMPM && !dateStr.includes('-')) return timePart.toUpperCase();
            if (!timePart.includes(':')) return dateStr;
            let [hoursPart, minutesFull] = timePart.split(':');
            let hours = parseInt(hoursPart);
            let minutes = minutesFull ? minutesFull.slice(0, 2) : '00';
            const isPM = timePart.toLowerCase().includes('pm') || hours >= 12;
            const ampm = isPM ? 'PM' : 'AM';
            const h12 = hours % 12 || 12;
            return `${h12}:${minutes.padStart(2, '0')} ${ampm}`;
        } catch (e) { return dateStr; }
    };

    const calculateHoursMins = (diffMs) => {
        if (!diffMs || isNaN(diffMs) || diffMs <= 0) return '00:00:00';
        const totalSecs = Math.floor(diffMs / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const calculateWorkHours = (inStr, outStr, dateContext = '') => {
        if (!inStr || !outStr || inStr === '-' || outStr === '-' || inStr === outStr) return '00:00:00';
        try {
            const parse = (s) => {
                if (!s || s === '-') return null;
                try {
                    if (s.includes('-') && s.includes(':')) {
                        const d = new Date(s.replace(/-/g, '/'));
                        if (!isNaN(d.getTime())) return d;
                    }
                    let cleanTime = s.trim().toUpperCase().replace(/[AP]M/g, '').trim();
                    const isPM = s.toUpperCase().includes('PM');
                    const isAM = s.toUpperCase().includes('AM');
                    const parts = cleanTime.split(':');
                    let h = parseInt(parts[0]) || 0;
                    let m = parseInt(parts[1]) || 0;
                    let sec = parseInt(parts[2]) || 0;
                    if (isPM && h < 12) h += 12;
                    if (isAM && h === 12) h = 0;
                    const baseDate = dateContext ? new Date(dateContext.replace(/-/g, '/')) : new Date();
                    baseDate.setHours(h, m, sec, 0);
                    return baseDate;
                } catch (e) { return null; }
            };
            const inDate = parse(inStr);
            const outDate = parse(outStr);
            if (!inDate || !outDate || outDate <= inDate) return '00:00:00';
            return calculateHoursMins(outDate - inDate);
        } catch (e) { return '00:00:00'; }
    };

    const calculateLateMinutesLive = (inStr, dateContext = '') => {
        if (!inStr || inStr === '-') return 0;
        try {
            const parse = (s) => {
                if (!s || s === '-') return null;
                try {
                    if (s.includes('-') && s.includes(':')) {
                        const d = new Date(s.replace(/-/g, '/'));
                        if (!isNaN(d.getTime())) return d;
                    }
                    let cleanTime = s.trim().toUpperCase().replace(/[AP]M/g, '').trim();
                    const isPM = s.toUpperCase().includes('PM');
                    const isAM = s.toUpperCase().includes('AM');
                    const parts = cleanTime.split(':');
                    let h = parseInt(parts[0]) || 0;
                    let m = parseInt(parts[1]) || 0;
                    let sec = parseInt(parts[2]) || 0;
                    if (isPM && h < 12) h += 12;
                    if (isAM && h === 12) h = 0;
                    const baseDate = dateContext ? new Date(dateContext.replace(/-/g, '/')) : new Date();
                    baseDate.setHours(h, m, sec, 0);
                    return baseDate;
                } catch (e) { return null; }
            };
            const inDate = parse(inStr);
            if (!inDate) return 0;
            const totalMinutes = inDate.getHours() * 60 + inDate.getMinutes();
            const officialStartTime = 10 * 60; // 10:00 AM
            const graceTimeThreshold = 10 * 60 + 10; // 10:10 AM
            return totalMinutes >= graceTimeThreshold ? totalMinutes - officialStartTime : 0;
        } catch (e) { return 0; }
    };

    const formatSecsToDuration = (totalSecs) => {
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = Math.floor(totalSecs % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatSheetDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return dateStr;
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        } catch (e) {
            return dateStr;
        }
    };

    const formatSheetTime = (timeStr) => {
        if (!timeStr || timeStr === '-' || timeStr === '0.0' || timeStr === '0') return timeStr;
        try {
            let extractedTime = timeStr.toString();
            if (extractedTime.includes(' ')) {
                const parts = extractedTime.split(' ');
                extractedTime = parts[parts.length - 1];
            } else if (extractedTime.includes('T')) {
                extractedTime = extractedTime.split('T')[1].split('.')[0].replace('Z', '');
            }

            const date = new Date(`1970-01-01T${extractedTime}`);
            if (isNaN(date.getTime())) {
                return timeStr;
            }
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        } catch (e) {
            return timeStr;
        }
    };

    const fetchDataSheet = async () => {
        setLoading(true);
        setError(null);

        try {
            const userData = localStorage.getItem('user');
            const user = userData ? JSON.parse(userData) : {};
            const loggedInName = (user.Name || user.name || '').toString().trim().toLowerCase();
            const loggedInCode = (user.Username || user.username || '').toString().trim().toLowerCase();

            // 1. Fetch Mapping Data
            const [jRes, dmRes] = await Promise.all([
                fetch(JOINING_API_URL).then(r => r.json()),
                fetch(MASTER_MAP_URL).then(r => r.json())
            ]);

            let currentJoining = [];
            if (jRes.success) {
                const rawRows = jRes.data || jRes;
                const headers = rawRows[5];
                const dataRows = rawRows.slice(6);
                const getIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
                currentJoining = dataRows.map(r => ({
                    id: r[getIdx('Employee ID')]?.toString().trim(),
                    name: r[getIdx('Name As Per Aadhar')]?.toString().trim(),
                    designation: r[getIdx('Designation')]?.toString().trim()
                })).filter(h => h.id);
            }

            let currentMapping = [];
            if (dmRes.success) {
                currentMapping = dmRes.data.slice(1).map(r => ({
                    userId: r[5]?.toString().trim(),
                    name: r[6]?.toString().trim(),
                    storeName: r[9]?.toString().trim()
                }));
            }

            // 2. Fetch Live Device Logs
            const yearNum = parseInt(selectedYear);
            const monthIdx = monthNames.indexOf(selectedMonth);
            const paddedMonth = (monthIdx + 1).toString().padStart(2, '0');
            const lastDay = getDaysInMonth(monthIdx + 1, yearNum);

            const queryStart = `${yearNum}-${paddedMonth}-01`;
            const queryEnd = `${yearNum}-${paddedMonth}-${lastDay}`;

            const allResponses = await Promise.all(
                DEVICES.map(async (device) => {
                    try {
                        const url = `/api/device-logs?APIKey=211616032630&SerialNumber=${device.serial}&DeviceName=${device.apiName}&FromDate=${queryStart}&ToDate=${queryEnd}`;
                        const res = await fetch(url);
                        return res.ok ? await res.json() : [];
                    } catch (e) { return []; }
                })
            );

            const rawLogs = allResponses.flat();
            const filteredLogs = rawLogs.filter(log => log.LogDate && log.LogDate.split(' ')[0] >= '2026-04-01');

            // 3. Process and Aggregate
            const grouped = {};
            filteredLogs.forEach(log => {
                if (!log.EmployeeCode || !log.LogDate) return;
                const dateStr = log.LogDate.split(' ')[0];
                const key = `${log.EmployeeCode}_${dateStr}`;
                if (!grouped[key]) grouped[key] = { id: log.EmployeeCode.toString().trim(), date: dateStr, logs: [] };
                grouped[key].logs.push(log.LogDate);
            });

            const processedData = Object.values(grouped).map(group => {
                const logs = group.logs;
                logs.sort();

                let inTime = '-';
                let outTime = '-';
                let punchMiss = 'No';

                if (logs.length === 1) {
                    const punchTime = logs[0];
                    const hours = parseInt(punchTime.split(' ')[1]?.split(':')[0]) || 0;
                    punchMiss = 'Yes';
                    if (hours >= 15) outTime = punchTime;
                    else inTime = punchTime;
                } else {
                    inTime = logs[0];
                    outTime = logs[logs.length - 1];
                }

                const code = group.id;
                const empMeta = currentJoining.find(e => (e.id && e.id.toLowerCase() === code.toLowerCase()) || (e.name && e.name.toLowerCase() === code.toLowerCase()));
                let dMap = currentMapping.find(m => (m.userId && m.userId.toString().toLowerCase() === code.toLowerCase()) || (m.name && m.name.toString().toLowerCase() === (empMeta?.name || code).toLowerCase()));

                const displayName = dMap ? dMap.name : (empMeta ? empMeta.name : code);
                const displayCode = dMap ? dMap.userId : (empMeta ? empMeta.id : code);

                const workHrs = punchMiss === 'Yes' ? '00:00:00' : calculateWorkHours(inTime, outTime, group.date);
                const lateMins = calculateLateMinutesLive(inTime, group.date);

                // Lunch Calculation (Same as Admin)
                let actualLunchMs = 0;
                if (logs.length > 2) {
                    for (let i = 1; i < logs.length - 1; i += 2) {
                        const lOut = new Date(logs[i].replace(/-/g, '/'));
                        const lIn = new Date(logs[i + 1].replace(/-/g, '/'));
                        actualLunchMs += Math.max(0, lIn - lOut);
                    }
                }
                const standardLunchMs = 2.5 * 3600 * 1000;
                const displayLunchMs = Math.min(actualLunchMs, standardLunchMs);

                let finalStatus = 'Present';
                if (punchMiss === 'Yes') {
                    finalStatus = 'Absent';
                } else {
                    const parts = workHrs.split(':');
                    const h = parseInt(parts[0]) || 0;
                    if (h < 8) {
                        finalStatus = 'Absent';
                    }
                }
                if (lateMins > 0) {
                    finalStatus = 'Late';
                }

                return {
                    employeeCode: displayCode,
                    employeeName: displayName,
                    date: group.date,
                    dateKey: group.date,
                    inTime: inTime,
                    outTime: outTime,
                    lateMinutes: lateMins > 0 ? (Math.floor(lateMins / 60) > 0 ? `${Math.floor(lateMins / 60)}h ${lateMins % 60}m` : `${lateMins}m`) : '-',
                    totalWithLunchDuration: workHrs,
                    lunchTime: calculateHoursMins(displayLunchMs),
                    status: finalStatus,
                    month: selectedMonth,
                    year: selectedYear,
                    punchMiss: punchMiss === 'Yes'
                };
            }).filter(record => {
                const rowEmployeeCode = record.employeeCode.toString().trim().toLowerCase();
                const rowEmployeeName = record.employeeName.toString().trim().toLowerCase();
                return (loggedInName && rowEmployeeName === loggedInName) || (loggedInCode && rowEmployeeCode === loggedInCode);
            });

            setAttendanceData(processedData.length > 0 ? processedData : DUMMY_ATTENDANCE);
            setIsDemo(processedData.length === 0);

        } catch (error) {
            console.error('Error fetching data:', error);
            setError(error.message);
            setAttendanceData(DUMMY_ATTENDANCE);
            setIsDemo(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDataSheet();
    }, []);

    const filteredAttendance = attendanceData.filter(record =>
        (selectedMonth === '' || record.month.toString().toLowerCase() === selectedMonth.toLowerCase()) &&
        (selectedYear === '' || record.year.toString() === selectedYear.toString())
    );

    // Deduplicate by date: each unique date only counts once
    const uniqueDates = [...new Map(filteredAttendance.map(item => [item.dateKey || item.date, item])).values()];

    // Total Days: Expected days in the selected period (1st to Today or 1st to End of Month)
    let totalDaysInRange = 0;
    if (selectedMonth && selectedYear) {
        const isCurrentMonth = selectedMonth.toString().toLowerCase() === currentMonthName.toLowerCase();
        const isCurrentYear = selectedYear.toString() === currentYearStr;

        if (isCurrentMonth && isCurrentYear) {
            // For current month, we only count up to Today
            totalDaysInRange = today.getDate();
        } else if (
            parseInt(selectedYear) < today.getFullYear() ||
            (parseInt(selectedYear) === today.getFullYear() && monthNames.indexOf(selectedMonth) < today.getMonth())
        ) {
            // For past months, count full month
            const monthIdx = monthNames.indexOf(selectedMonth) + 1;
            totalDaysInRange = getDaysInMonth(monthIdx, parseInt(selectedYear));
        }
    }

    // --- CONSOLIDATION FOR TABLE DISPLAY ---
    const consolidatedByDate = filteredAttendance.reduce((acc, curr) => {
        const key = curr.dateKey || curr.date;
        acc[key] = { ...curr };
        return acc;
    }, {});

    const displayAttendance = [];
    if (selectedMonth && selectedYear) {
        const yearNum = parseInt(selectedYear);
        const monthIdx = monthNames.indexOf(selectedMonth);
        const daysInMonth = getDaysInMonth(monthIdx + 1, yearNum);

        // Determine how many days to show: 
        // If current month/year, show up to today. If past, show full month.
        const isCurrentMonth = selectedMonth.toString().toLowerCase() === currentMonthName.toLowerCase();
        const isCurrentYear = selectedYear.toString() === currentYearStr;
        const maxDay = (isCurrentMonth && isCurrentYear) ? today.getDate() : daysInMonth;

        // Get fallback employee info from localStorage
        const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const fallbackName = savedUser.Name || savedUser.name || '-';
        const fallbackCode = savedUser.Username || savedUser.username || '-';

        for (let d = 1; d <= maxDay; d++) {
            const dateKey = `${yearNum}-${(monthIdx + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

            if (consolidatedByDate[dateKey]) {
                displayAttendance.push(consolidatedByDate[dateKey]);
            } else {
                // Find employee info from any available record
                const empInfo = filteredAttendance[0] || {};
                displayAttendance.push({
                    employeeCode: empInfo.employeeCode || fallbackCode,
                    employeeName: empInfo.employeeName || fallbackName,
                    date: `${d.toString().padStart(2, '0')}/${(monthIdx + 1).toString().padStart(2, '0')}/${yearNum}`,
                    dateKey: dateKey,
                    inTime: '-',
                    outTime: '-',
                    lateMinutes: '-',
                    totalWithLunchDuration: '-',
                    lunchTime: '-',
                    status: 'Absent',
                    month: selectedMonth,
                    year: selectedYear,
                    punchMiss: false
                });
            }
        }
    }

    // Sort by date just in case
    displayAttendance.sort((a, b) => new Date(a.dateKey).getTime() - new Date(b.dateKey).getTime());

    // Calculate final dashboard stats
    const presentDays = displayAttendance.filter(r => r.status.trim().toLowerCase() === 'present').length;
    const absentDays = displayAttendance.filter(r => r.status.trim().toLowerCase() === 'absent').length;
    const totalDays = displayAttendance.length;

    const totalSecs = filteredAttendance.reduce((sum, r) => {
        return sum + durationToSecs(r.totalWithLunchDuration || '00:00:00');
    }, 0);
    const totalDurationFormatted = formatSecsToDuration(totalSecs);

    const months = [...new Set(attendanceData.map(r => r.month))].filter(Boolean);
    const years = [...new Set(attendanceData.map(r => r.year))].filter(Boolean);

    const StatCard = ({ title, value, icon: Icon, colorClass }) => (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 transition-all hover:-translate-y-1">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${colorClass} shadow-lg`}>
                    <Icon size={24} className="text-white" />
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</p>
                    <h3 className="text-2xl font-black text-gray-900 mt-1">{value}</h3>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Attendance</h1>
                        {isDemo && (
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-200 animate-pulse">
                                Demo Mode
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 mt-1 flex items-center gap-2">
                        <Timer size={16} className="text-indigo-500" />
                        Showing records for logged-in user.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 px-2 border-r border-gray-100 mr-2">
                        <Filter size={16} className="text-indigo-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase">Filters</span>
                    </div>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none cursor-pointer"
                    >
                        <option value="">All Months</option>
                        {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none cursor-pointer border-l border-gray-100 pl-4"
                    >
                        <option value="">All Years</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Present Days" value={presentDays} icon={CheckCircle2} colorClass="bg-green-500" />
                <StatCard title="Absent Days" value={absentDays} icon={XCircle} colorClass="bg-red-500" />
                <StatCard title="Work Duration" value={totalDurationFormatted} icon={Clock} colorClass="bg-indigo-500" />
                <StatCard title="Total Records" value={totalDays} icon={FileText} colorClass="bg-blue-500" />
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-xl font-bold text-gray-800">
                        Attendance Records - {selectedMonth || 'All'} {selectedYear || 'Time'}
                    </h2>
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <Calendar size={14} className="text-indigo-500" />
                        Sheet Data: A2:J
                    </div>
                </div>

                <div className="overflow-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse relative">
                        <thead className="sticky top-0 z-20 bg-white shadow-sm ring-1 ring-gray-100">
                            <tr className="bg-white text-gray-400 uppercase text-[10px] font-black tracking-widest">
                                <th className="bg-white px-6 py-4 border-b border-gray-100 whitespace-nowrap">Emp Code</th>
                                <th className="bg-white px-6 py-4 border-b border-gray-100 whitespace-nowrap">Emp Name</th>
                                <th className="bg-white px-6 py-4 border-b border-gray-100 whitespace-nowrap">Date</th>
                                <th className="bg-white px-6 py-4 border-b border-gray-100 text-green-600 whitespace-nowrap">IN Time</th>
                                <th className="bg-white px-6 py-4 border-b border-gray-100 text-red-600 whitespace-nowrap">OUT Time</th>
                                <th className="bg-white px-6 py-4 border-b border-gray-100 whitespace-nowrap">Late Minute</th>
                                <th className="bg-white px-6 py-4 border-b border-gray-100 whitespace-nowrap">Total With Lunch Duration</th>
                                <th className="bg-white px-6 py-4 border-b border-gray-100 whitespace-nowrap">Lunch Time</th>
                                <th className="bg-white px-6 py-4 border-b border-gray-100 whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="11" className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-gray-500 font-medium font-bold">Matching User ID...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayAttendance.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <AlertCircle size={40} className="text-gray-200" />
                                            <p className="text-gray-500 font-medium">No records found for your ID in this period.</p>
                                            <button onClick={fetchDataSheet} className="text-xs font-black text-indigo-600 hover:underline">RETRY SYNC</button>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayAttendance.map((record, index) => (
                                <tr key={index} className="group hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-5 text-sm font-bold text-gray-900">{record.employeeCode}</td>
                                    <td className="px-6 py-5 text-sm font-medium text-gray-700">{record.employeeName}</td>
                                    <td className="px-6 py-5 text-sm text-gray-500 font-bold">{formatSheetDate(record.date)}</td>
                                    <td className="px-6 py-5 text-sm text-green-600 font-bold">{formatSheetTime(record.inTime)}</td>
                                    <td className="px-6 py-5 text-sm text-red-600 font-bold">{formatSheetTime(record.outTime)}</td>
                                    <td className="px-6 py-5 text-sm text-yellow-600 font-bold">{record.lateMinutes}</td>
                                    <td className="px-6 py-5 text-sm font-black text-indigo-600">{record.totalWithLunchDuration}</td>
                                    <td className="px-6 py-5 text-xs text-amber-600 font-bold flex items-center gap-1 mt-4">
                                        <Coffee size={12} /> {record.lunchTime}
                                    </td>
                                    <td className="px-6 py-5">
                                        <span
                                            title={record.punchMiss ? record.punchMissReason : ''}
                                            className={`px-3 py-1 text-[10px] font-black uppercase rounded-full cursor-help transition-all shadow-sm border ${record.status.trim().toLowerCase() === 'present' ? 'bg-green-50 text-green-700 border-green-200' :
                                                record.status.trim().toLowerCase() === 'late' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    record.status.trim().toLowerCase() === 'holiday' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                        'bg-red-50 text-red-700 border-red-200'
                                                }`}
                                        >
                                            {record.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MyAttendance;