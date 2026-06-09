import React, { useEffect, useState } from 'react';
import { Search, Download, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';

const DEVICES = [
    { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
    { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
    { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
    { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
    { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' }
];

const JOINING_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch';
const LEAVE_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=Leave Management&action=fetch';

const AttendanceMonthly = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]);
    const [attendanceData, setAttendanceData] = useState([]);
    const [joiningData, setJoiningData] = useState([]);
    const [deviceMapping, setDeviceMapping] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const getDaysInMonth = (month, year) => {
        return new Date(year, month, 0).getDate();
    };

    const formatSecsToHrsMins = (totalSecs) => {
        if (!totalSecs) return '0h 0m';
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        return `${hrs}h ${mins}m`;
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

    const timeToSeconds = (timeStr) => {
        if (!timeStr || timeStr === '-' || timeStr === '0.0' || timeStr === '0') return 0;
        try {
            const timeMatch = timeStr.toString().match(/(\d+):(\d+):(\d+)/);
            if (timeMatch) {
                return parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseInt(timeMatch[3], 10);
            }
            if (timeStr.toString().includes('T')) {
                const d = new Date(timeStr);
                if (!isNaN(d.getTime())) {
                    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
                }
            }
        } catch (e) {
            return 0;
        }
        return 0;
    };

    const secondsToTime = (totalSeconds) => {
        if (!totalSeconds || totalSeconds === 0) return '-';
        const absSeconds = Math.abs(totalSeconds);
        const hours = Math.floor(absSeconds / 3600);
        const minutes = Math.floor((absSeconds % 3600) / 60);
        const seconds = absSeconds % 60;
        const sign = totalSeconds < 0 ? '-' : '';
        return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const calculateDays = (startDateStr, endDateStr) => {
        if (!startDateStr || !endDateStr) return 0;
        let startDate, endDate;
        try {
            if (startDateStr.toString().includes('/')) {
                const [startDay, startMonth, startYear] = startDateStr.toString().split('/').map(Number);
                startDate = new Date(startYear, startMonth - 1, startDay);
            } else {
                startDate = new Date(startDateStr);
            }

            if (endDateStr.toString().includes('/')) {
                const [endDay, endMonth, endYear] = endDateStr.toString().split('/').map(Number);
                endDate = new Date(endYear, endMonth - 1, endDay);
            } else {
                endDate = new Date(endDateStr);
            }
            const diffTime = endDate.getTime() - startDate.getTime();
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        } catch (e) {
            return 0;
        }
    };

    const formatTimeAMPM = (timeStr) => {
        if (!timeStr || timeStr === '-') return '-';
        if (timeStr.startsWith('-')) return timeStr;
        const parts = timeStr.toString().split(':');
        if (parts.length < 3) return timeStr;
        const h = parseInt(parts[0], 10);
        const m = parts[1];
        const s = parts[2];

        const isPM = (h % 24) >= 12;
        const ampm = isPM ? 'PM' : 'AM';
        let displayH = h % 12;
        if (displayH === 0) displayH = 12;

        return `${displayH.toString().padStart(2, '0')}:${m}:${s} ${ampm}`;
    };

    const getSundaysCount = (month, year) => {
        let count = 0;
        const days = new Date(year, month, 0).getDate();
        for (let i = 1; i <= days; i++) {
            if (new Date(year, month - 1, i).getDay() === 0) count++;
        }
        return count;
    };

    const fetchAttendanceData = async () => {
        setLoading(true);
        setError(null);

        try {
            // 1. Fetch Metadata (Joining & Master Mapping)
            let currentJoining = joiningData;
            if (joiningData.length === 0) {
                const jRes = await fetch(JOINING_API_URL);
                const jData = await jRes.json();
                if (jData.success) {
                    const raw = jData.data || jData;
                    const headers = raw[5];
                    const dataRows = raw.slice(6);
                    const getIdx = (n) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === n.toLowerCase());

                    currentJoining = dataRows.map(r => ({
                        id: r[getIdx('Employee ID')]?.toString().trim(),
                        name: r[getIdx('Name As Per Aadhar')]?.toString().trim(),
                        designation: r[getIdx('Designation')]?.toString().trim()
                    })).filter(h => h.id);
                    setJoiningData(currentJoining);
                }
            }

            const MASTER_MAP_URL = `https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch`;
            const dmRes = await fetch(MASTER_MAP_URL);
            const dmData = await dmRes.json();
            let currentMapping = [];
            if (dmData.success) {
                const rows = dmData.data.slice(1);
                currentMapping = rows.map(r => ({
                    userId: r[5]?.toString().trim(),
                    name: r[6]?.toString().trim(),
                    deviceId: r[7]?.toString().trim(),
                    serialNo: r[8]?.toString().trim(),
                    storeName: r[9]?.toString().trim()
                }));
                setDeviceMapping(currentMapping);
            }

            const startDay = '01';
            const endDay = getDaysInMonth(selectedMonth, selectedYear);
            const paddedMonth = selectedMonth.toString().padStart(2, '0');
            let fromDate = `${selectedYear}-${paddedMonth}-${startDay}`;
            let toDate = `${selectedYear}-${paddedMonth}-${endDay}`;

            if (selectedYear < 2026 || (selectedYear === 2026 && selectedMonth < 4)) {
                setAttendanceData([]);
                return;
            }

            const API_URL = `/api/device-logs?APIKey=211616032630&SerialNumber=${selectedDevice.serial}&DeviceName=${selectedDevice.apiName}&FromDate=${fromDate}&ToDate=${toDate}`;
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            const rawLogs = await response.json();
            if (!Array.isArray(rawLogs)) throw new Error('Invalid logs data');

            const logs = rawLogs.filter(log => {
                if (!log.LogDate) return false;
                const logDateStr = log.LogDate.split(' ')[0];
                return logDateStr >= '2026-04-01';
            });

            const dailyGrouped = {};
            logs.sort((a, b) => new Date(a.LogDate) - new Date(b.LogDate));

            logs.forEach(log => {
                if (!log.EmployeeCode || !log.LogDate) return;
                const dateKey = log.LogDate.split(' ')[0];
                const key = `${log.EmployeeCode}_${dateKey}`;
                if (!dailyGrouped[key]) dailyGrouped[key] = { id: log.EmployeeCode, date: dateKey, logs: [] };
                dailyGrouped[key].logs.push(log.LogDate);
            });

            const monthlyAgg = {};
            const totalSundays = getSundaysCount(selectedMonth, selectedYear);
            const totalDaysInMonth = getDaysInMonth(selectedMonth, selectedYear);

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
                        actualSerial: day.logs[0] ? selectedDevice.serial : '-'
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

            const finalData = Object.values(monthlyAgg).map((agg, idx) => {
                const code = agg.id.toString().trim();
                const empMeta = currentJoining.find(e =>
                    (e.id && e.id.toLowerCase() === code.toLowerCase()) ||
                    (e.name && e.name.toLowerCase() === code.toLowerCase())
                );

                let dMap = currentMapping.find(m => m.userId && m.userId.toString().toLowerCase() === code.toLowerCase());

                if (!dMap) {
                    const entryName = (empMeta?.name || code).toString().trim().toLowerCase();
                    dMap = currentMapping.find(m => m.name && m.name.toString().toLowerCase() === entryName);
                }

                const displayName = dMap ? dMap.name : (empMeta ? empMeta.name : (isNaN(code) ? code : 'Unknown'));
                const displayCode = dMap ? dMap.userId : (empMeta ? empMeta.id : (isNaN(code) ? 'Unknown' : code));
                const displayStore = dMap ? dMap.storeName : (empMeta ? empMeta.store : selectedDevice.name);
                const displayDeviceId = dMap ? dMap.deviceId : '-';
                const displayAssignedSerial = dMap ? dMap.serialNo : agg.actualSerial;

                const absentDays = Math.max(0, totalDaysInMonth - agg.presentDays);



                return {
                    sNo: idx + 1,
                    year: selectedYear,
                    month: monthNames[selectedMonth - 1],
                    employeeCode: displayCode,
                    employeeName: displayName,
                    designation: empMeta ? empMeta.designation : '-',
                    storeName: displayStore,
                    deviceId: displayDeviceId,
                    serialNo: displayAssignedSerial,
                    presentDays: agg.presentDays,
                    absentDays: absentDays,
                    punchMiss: agg.punchMissDays,
                    lateDays: agg.lateDays,
                    totalWorkHours: formatSecsToHrsMins(agg.totalWorkSecs),
                    totalLunchTime: formatSecsToHrsMins(agg.totalLunchSecs),
                    holidays: totalSundays
                };
            });

            setAttendanceData(finalData);
        } catch (err) {
            console.error(err);
            setError(err.message);
            setAttendanceData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendanceData();
    }, [selectedMonth, selectedYear, selectedDevice]);

    const months = [...new Set(attendanceData.map(r => r.month))].filter(Boolean);
    const years = [...new Set(attendanceData.map(r => r.year))].filter(Boolean);

    const filteredData = attendanceData.filter(item => {
        const matchesSearch =
            item.employeeName.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.employeeCode.toString().toLowerCase().includes(searchTerm.toLowerCase());

        const matchesMonth = selectedMonth ? item.month === monthNames[selectedMonth - 1] : true;
        const matchesYear = selectedYear ? item.year.toString() === selectedYear.toString() : true;

        return matchesSearch && matchesMonth && matchesYear;
    });

    const downloadExcel = () => {
        const dataToExport = filteredData.map(item => ({
            'S.No.': item.sNo,
            'Month/Year': `${item.month} ${item.year}`,
            'Employee Code': item.employeeCode,
            'Employee Name': item.employeeName,
            'Designation': item.designation,
            'Store Name': item.storeName,
            'Device ID': item.deviceId,
            'Serial NO': item.serialNo,
            'Present': item.presentDays,
            'Absent': item.absentDays,
            'Punch Miss': item.punchMiss,
            'Holidays': item.holidays,
            'Late Days': item.lateDays,
            'Total Working Hour': item.totalWorkHours,
            'Total Lunch Time': item.totalLunchTime
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Attendance");
        XLSX.writeFile(workbook, `attendance_${selectedMonth}_${selectedYear}.xlsx`);
    };

    return (
        <div className="space-y-6 p-6 w-[75vw]">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Attendance Records Monthly</h1>
                <button
                    onClick={downloadExcel}
                    disabled={filteredData.length === 0}
                    className={`flex items-center px-4 py-2 rounded-lg text-white ${filteredData.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    <Download size={20} className="mr-2" />
                    Download Excel
                </button>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[250px]">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Search Employee</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by name or code..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-sm font-medium transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                </div>

                <div className="min-w-[150px]">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Select Device</label>
                    <div className="relative">
                        <select
                            value={selectedDevice.name}
                            onChange={(e) => setSelectedDevice(DEVICES.find(d => d.name === e.target.value))}
                            className="w-full appearance-none pl-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700"
                        >
                            {DEVICES.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                        </select>
                        <Filter size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                <div className="min-w-[150px]">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Select Month</label>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="w-full pl-3 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700"
                    >
                        {monthNames.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
                    </select>
                </div>

                <div className="min-w-[100px]">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Select Year</label>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="w-full pl-3 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700"
                    >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10 transition-colors">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">S.No.</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap text-center">Month/Yr</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">Employee Code</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">Employee Name</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Designation</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Store Name</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Device ID</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Serial NO</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Present</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] text-center">Absent</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center text-red-500">Punch Miss</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center text-indigo-500">Holidays</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center text-orange-500">Late Days</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Duration</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center text-blue-600">Lunch</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="15" className="px-6 py-12 text-center">
                                        <div className="flex justify-center flex-col items-center">
                                            <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin mb-3"></div>
                                            <span className="text-gray-600 text-sm font-medium">Processing aggregated data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="15" className="px-6 py-12 text-center">
                                        <p className="text-red-500 font-medium mb-3">Error: {error}</p>
                                        <button
                                            onClick={fetchAttendanceData}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium shadow-sm transition-colors"
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : filteredData.length > 0 ? (
                                filteredData.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-[10px] font-bold text-gray-400">{item.sNo}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-[10px] font-bold text-gray-500">{item.month} {item.year}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-700">{item.employeeCode}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-indigo-600">{item.employeeName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-[10px] font-medium text-gray-500">{item.designation}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-[10px] font-bold text-gray-600">{item.storeName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-[10px] font-bold text-indigo-500">{item.deviceId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-[10px] font-bold text-gray-500">{item.serialNo}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-[10px] font-black border border-green-100">{item.presentDays} Days</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded text-[10px] font-black border border-rose-100">{item.absentDays} Days</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="text-red-600 text-[10px] font-bold underline decoration-dotted">{item.punchMiss}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-[10px] font-bold text-indigo-600">{item.holidays}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-[10px] font-bold text-orange-600">{item.lateDays}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-black text-slate-700">{item.totalWorkHours}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-bold text-blue-600">{item.totalLunchTime}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="15" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Search size={32} className="mb-2 text-gray-300" />
                                            <p className="font-medium text-lg text-gray-600">No records found</p>
                                            <p className="text-sm mt-1">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AttendanceMonthly;