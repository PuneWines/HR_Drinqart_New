import React, { useEffect, useState } from 'react';
import { Search, Download, Filter, RefreshCw, Loader2, Database, Calendar, Users, Clock, TrendingUp, User, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getMonthlyAttendanceFromSupabase, syncMonthlyAttendanceFromApi } from '../services/attendanceSync';
import { supabase } from '../lib/supabase';

const DEVICES = [
    { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
    { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
    { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
    { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
    { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' }
];

const ALL_DEVICES_OPTION = { name: 'ALL DEVICES', apiName: 'ALL', serial: 'ALL' };

const formatSecsToHrsMins = (totalSecs) => {
    if (!totalSecs) return '0h 0m';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${hrs}h ${mins}m`;
};

const AttendanceMonthly = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedDevice, setSelectedDevice] = useState(ALL_DEVICES_OPTION);
    const [attendanceData, setAttendanceData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [lastSynced, setLastSynced] = useState(null);
    const [employeesData, setEmployeesData] = useState([]);
    const [matchFilter, setMatchFilter] = useState('ALL'); // 'ALL', 'MATCHED', 'UNMATCHED'
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedMonth, selectedYear, selectedDevice, matchFilter]);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];  

    const fetchAttendanceData = async (forceSync = false) => {
        setLoading(true);
        setError(null);

        try {
            if (selectedYear < 2026 || (selectedYear === 2026 && selectedMonth < 4)) {
                setAttendanceData([]);
                setLastSynced(null);
                setLoading(false);
                return;
            }

            if (selectedDevice.serial === 'ALL') {
                const allDevicesPromises = DEVICES.map(async (device) => {
                    let dbRecords = await getMonthlyAttendanceFromSupabase(selectedMonth, selectedYear, device.serial);

                    const isCurrentMonth = selectedYear === new Date().getFullYear() && selectedMonth === (new Date().getMonth() + 1);
                    let needsSync = false;

                    if (dbRecords.length === 0) {
                        needsSync = true;
                    } else if (isCurrentMonth) {
                        const lastSyncedAt = dbRecords[0]?.lastSyncedAt;
                        if (lastSyncedAt) {
                            const diffMs = new Date() - new Date(lastSyncedAt);
                            const diffHrs = diffMs / (1000 * 60 * 60);
                            if (diffHrs > 6) {
                                needsSync = true;
                            }
                        } else {
                            needsSync = true;
                        }
                    }

                    if (forceSync || needsSync) {
                        setSyncing(true);
                        try {
                            await syncMonthlyAttendanceFromApi(selectedMonth, selectedYear, device);
                            dbRecords = await getMonthlyAttendanceFromSupabase(selectedMonth, selectedYear, device.serial);
                        } catch (syncErr) {
                            console.error(`Sync error for ${device.name}:`, syncErr);
                        }
                    }

                    return dbRecords;
                });

                const allResults = await Promise.all(allDevicesPromises);
                const combinedData = allResults.flat();

                setAttendanceData(combinedData);
                setLastSynced(new Date().toISOString());
            } else {
                let dbRecords = await getMonthlyAttendanceFromSupabase(selectedMonth, selectedYear, selectedDevice.serial);

                const isCurrentMonth = selectedYear === new Date().getFullYear() && selectedMonth === (new Date().getMonth() + 1);
                let needsSync = false;

                if (dbRecords.length === 0) {
                    needsSync = true;
                } else if (isCurrentMonth) {
                    const lastSyncedAt = dbRecords[0]?.lastSyncedAt;
                    if (lastSyncedAt) {
                        const diffMs = new Date() - new Date(lastSyncedAt);
                        const diffHrs = diffMs / (1000 * 60 * 60);
                        if (diffHrs > 6) {
                            needsSync = true;
                        }
                    } else {
                        needsSync = true;
                    }
                }

                if (forceSync || needsSync) {
                    setSyncing(true);
                    try {
                        await syncMonthlyAttendanceFromApi(selectedMonth, selectedYear, selectedDevice);
                        dbRecords = await getMonthlyAttendanceFromSupabase(selectedMonth, selectedYear, selectedDevice.serial);
                    } catch (syncErr) {
                        console.error("Sync error:", syncErr);
                        if (dbRecords.length === 0) {
                            throw syncErr;
                        }
                    } finally {
                        setSyncing(false);
                    }
                }

                setAttendanceData(dbRecords);
                if (dbRecords.length > 0 && dbRecords[0]?.lastSyncedAt) {
                    setLastSynced(dbRecords[0].lastSyncedAt);
                } else {
                    setLastSynced(null);
                }
            }
        } catch (err) {
            console.error(err);
            setError(err.message);
            setAttendanceData([]);
            setLastSynced(null);
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    };

    const fetchEmployeesTable = async () => {
        try {
            let allEmployeesData = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('employees')
                    .select('*')
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allEmployeesData = [...allEmployeesData, ...data];
                    if (data.length < pageSize) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            }

            setEmployeesData(allEmployeesData);
        } catch (error) {
            console.error('Error fetching employees table:', error);
        }
    };

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

    useEffect(() => {
        fetchEmployeesTable();
    }, []);

    useEffect(() => {
        fetchAttendanceData();
    }, [selectedMonth, selectedYear, selectedDevice]);

    const isEmployeeInTable = (employeeCode) => {
        if (!employeeCode) return false;
        const cleanId = employeeCode.toString().trim().toLowerCase();
        return employeesData.some(emp => {
            const empId = emp.id?.toString().trim().toLowerCase();
            const empEmployeeId = emp.employee_id?.toString().trim().toLowerCase();
            return empId === cleanId || empEmployeeId === cleanId;
        });
    };

    const filteredData = (() => {
        // 1. Get monthly records from attendanceData that match Search, Month, and Year filters
        const baseList = attendanceData.filter(item => {
            const matchesSearch =
                (item.employeeName?.toString().toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (item.employeeCode?.toString().toLowerCase() || '').includes(searchTerm.toLowerCase());

            const matchesMonth = selectedMonth ? item.month === monthNames[selectedMonth - 1] : true;
            const matchesYear = selectedYear ? item.year?.toString() === selectedYear.toString() : true;

            const isMatched = isEmployeeInTable(item.employeeCode);
            
            let matchesFilterMode = true;
            if (matchFilter === 'MATCHED') {
                matchesFilterMode = isMatched;
            } else if (matchFilter === 'UNMATCHED') {
                matchesFilterMode = !isMatched;
            }

            return matchesSearch && matchesMonth && matchesYear && matchesFilterMode;
        });

        // 2. If showing verified or all (matchFilter is not UNMATCHED), append remaining employees from employees table
        if (matchFilter !== 'UNMATCHED') {
            const hasAttendance = (empId) => {
                return attendanceData.some(item => item.employeeCode === empId);
            };

            const remaining = employeesData
                .filter(emp => {
                    // Exclude if already in attendanceData (meaning they have monthly records)
                    if (hasAttendance(emp.employee_id)) return false;

                    // Apply search filter
                    const name = emp.name_as_per_aadhar || '';
                    const id = emp.employee_id || '';

                    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        id.toLowerCase().includes(searchTerm.toLowerCase());

                    return matchesSearch;
                })
                .map(emp => ({
                    year: selectedYear,
                    month: monthNames[selectedMonth - 1],
                    employeeCode: emp.employee_id,
                    employeeName: emp.name_as_per_aadhar,
                    designation: emp.designation,
                    storeName: emp.joining_place,
                    deviceId: '-',
                    serialNo: '-',
                    presentDays: 0,
                    absentDays: getDaysInMonth(selectedMonth, selectedYear),
                    punchMiss: 0,
                    holidays: getSundaysCount(selectedMonth, selectedYear),
                    lateDays: 0,
                    totalWorkHours: '0h 0m',
                    totalWorkSecs: 0,
                    totalLunchTime: '0h 0m',
                    totalLunchSecs: 0,
                    isRemaining: true
                }));

            return [...baseList, ...remaining];
        }

        return baseList;
    })();

    const pageSize = 15;
    const totalPages = Math.ceil(filteredData.length / pageSize);
    const activePage = Math.min(currentPage, Math.max(1, totalPages));
    const paginatedData = filteredData.slice((activePage - 1) * pageSize, activePage * pageSize);

    const downloadExcel = () => {
        const dataToExport = filteredData.map((item, idx) => ({
            'S.No.': idx + 1,
            'Month/Year': `${item.month} ${item.year}`,
            'Employee Code': item.employeeCode,
            'Employee Name': item.employeeName,
            'Designation': item.designation,
            'Store Name': item.storeName,
            'Device ID': item.deviceId,
            'Serial NO': item.serialNo,
            'Present': item.presentDays,
            'Absent': item.absentDays,
            'Late Days': item.lateDays,
            'Avg Work Hours': item.presentDays > 0 ? formatSecsToHrsMins((item.totalWorkSecs || 0) / item.presentDays) : '0h 0m',
            'Avg Lunch Time': item.presentDays > 0 ? formatSecsToHrsMins((item.totalLunchSecs || 0) / item.presentDays) : '0h 0m'
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Attendance");
        XLSX.writeFile(workbook, `attendance_${selectedMonth}_${selectedYear}${selectedDevice.serial === 'ALL' ? '_all_devices' : ''}.xlsx`);
    };

    // Summary stats for all devices
    const totalEmployees = new Set(attendanceData.map(d => d.employeeCode)).size;
    const totalPresent = attendanceData.reduce((sum, d) => sum + (parseInt(d.presentDays) || 0), 0);
    const totalAbsent = attendanceData.reduce((sum, d) => sum + (parseInt(d.absentDays) || 0), 0);
    const totalLate = attendanceData.reduce((sum, d) => sum + (parseInt(d.lateDays) || 0), 0);

    return (
        <div className="p-3">
            {/* Header - Compact */}
            <div className="flex justify-between items-center mb-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <Calendar size={18} />
                        Monthly Attendance
                    </h1>
                    <p className="text-gray-500 text-[11px] mt-0.5">
                        Track and manage employee attendance records
                    </p>
                </div>
                <div className="flex gap-2">
                    {lastSynced && (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-md">
                            <Database size={10} className="text-gray-400" />
                            <span className="text-[10px] text-gray-500">
                                Synced: {new Date(lastSynced).toLocaleString('en-IN')}
                            </span>
                        </div>
                    )}
                    <div className="relative">
                        <select
                            value={matchFilter}
                            onChange={(e) => setMatchFilter(e.target.value)}
                            className={`flex h-10 appearance-none items-center gap-1.5 pl-3 pr-8 py-1.5 font-semibold text-xs border rounded-md cursor-pointer transition-all focus:outline-none ${
                                matchFilter === 'ALL'
                                    ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                                    : matchFilter === 'MATCHED'
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                            }`}
                        >
                            <option value="ALL">All Employees</option>
                            <option value="MATCHED">Matched Only</option>
                            <option value="UNMATCHED">Unmatched Only</option>
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <ChevronDown size={12} className={
                                matchFilter === 'ALL'
                                    ? 'text-blue-700'
                                    : matchFilter === 'MATCHED'
                                    ? 'text-emerald-700'
                                    : 'text-amber-700'
                            } />
                        </div>
                    </div>

                    <button
                        onClick={downloadExcel}
                        disabled={filteredData.length === 0}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white font-medium text-xs transition-colors ${filteredData.length === 0
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        <Download size={12} />
                        Export
                    </button>
                </div>
            </div>

            {/* Filter Section - Compact */}
            <div className="bg-white  p-2 mb-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Search Employee</label>
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or code..."
                                className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Device</label>
                        <div className="relative">
                            <select
                                value={selectedDevice.name}
                                onChange={(e) => {
                                    const selected = e.target.value;
                                    if (selected === 'ALL DEVICES') {
                                        setSelectedDevice(ALL_DEVICES_OPTION);
                                    } else {
                                        const device = DEVICES.find(d => d.name === selected);
                                        if (device) setSelectedDevice(device);
                                    }
                                }}
                                className="w-full appearance-none pl-2 pr-6 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white"
                            >
                                <option value="ALL DEVICES">📊 All Devices</option>
                                {DEVICES.map(d => (
                                    <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                            <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Month</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white"
                        >
                            {monthNames.map((m, idx) => (
                                <option key={m} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>


            {/* Table - Compact */}
            <div className="bg-white rounded-md border border-gray-200 overflow-hidden ">
                <div className="overflow-x-auto h-[60vh] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-xs relative border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-12 z-10">#</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-24 z-10">Month/Year</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-24 z-10">Employee Id</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-32 z-10">Employee Name</th>

                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-24 z-10">Store</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-20 z-10">Device ID</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-28 z-10">Serial No</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-20 z-10">Present</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-20 z-10">Absent</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-16 z-10">Late</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-24 z-10">Avg Work Hrs</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-24 z-10">Avg Lunch Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="13" className="text-center py-8">
                                        <div className="flex items-center justify-center gap-1.5 text-gray-500 text-xs">
                                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            Loading...
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="13" className="text-center py-8">
                                        <p className="text-red-600 text-xs mb-2">{error}</p>
                                        <button
                                            onClick={() => fetchAttendanceData()}
                                            className="px-3 py-1 bg-indigo-600 text-white rounded text-xs"
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : paginatedData.length > 0 ? (
                                paginatedData.map((item, index) => {
                                    const isInEmployeesTable = isEmployeeInTable(item.employeeCode);
                                    const actualIndex = (activePage - 1) * pageSize + index;
                                    const employeeProfile = employeesData.find(e => e.employee_id === item.employeeCode || e.id === item.employeeCode);
                                    const candidatePhoto = employeeProfile?.candidate_photo;
                                    return (
                                        <tr
                                            key={index}
                                            className={`transition-colors ${item.isRemaining ? 'bg-blue-100 hover:bg-blue-200' : isInEmployeesTable ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50 bg-white'}`}
                                        >
                                            <td className="px-2 py-1.5 text-[10px] text-gray-500">{actualIndex + 1}</td>
                                            <td className="px-2 py-1.5 text-[10px] font-medium text-gray-700">{item.month} {item.year}</td>
                                            <td className="px-2 py-1.5 text-[10px] font-mono font-medium text-gray-900">{item.employeeCode}</td>
                                            <td className="px-2 py-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    {candidatePhoto ? (
                                                        <img
                                                            src={candidatePhoto}
                                                            alt={item.employeeName}
                                                            className="w-6 h-6 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${item.isRemaining ? 'bg-blue-200 text-blue-800' : isInEmployeesTable ? 'bg-blue-100 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                            {item.employeeName?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-[11px] font-medium text-gray-900 block">{item.employeeName}</span>
                                                        {isInEmployeesTable ? (
                                                            <span className="text-[8px] text-blue-600 font-medium block">✓ Matched</span>
                                                        ) : (
                                                            <span className="text-[8px] text-amber-600 font-medium block">⚠️ Unmatched</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-2 py-1.5 text-[10px] text-gray-600">{item.storeName || '-'}</td>
                                            <td className="px-2 py-1.5 text-[10px] font-mono text-gray-500">{item.deviceId || '-'}</td>
                                            <td className="px-2 py-1.5 text-[10px] font-mono text-gray-500">{item.serialNo || '-'}</td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className="inline-flex px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                                                    {item.presentDays}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className="inline-flex px-1.5 py-0.5 text-red-700 rounded text-[10px] font-medium">
                                                    {item.absentDays}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-center text-[10px] text-orange-600 font-medium">{item.lateDays || 0}</td>
                                            <td className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-700">
                                                {formatSecsToHrsMins(item.presentDays > 0 ? (item.totalWorkSecs || 0) / item.presentDays : 0)}
                                            </td>
                                            <td className="px-2 py-1.5 text-center text-[10px] font-semibold text-blue-600">
                                                {formatSecsToHrsMins(item.presentDays > 0 ? (item.totalLunchSecs || 0) / item.presentDays : 0)}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="13" className="text-center py-8">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <Search size={28} className="mb-2" />
                                            <p className="text-xs font-medium">No records found</p>
                                            <p className="text-[10px] mt-0.5">Adjust filters or sync data</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs">
                        <div className="text-gray-500">
                            Showing <span className="font-semibold">{(activePage - 1) * pageSize + 1}</span> to <span className="font-semibold">{Math.min(activePage * pageSize, filteredData.length)}</span> of <span className="font-semibold">{filteredData.length}</span> employees
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                disabled={activePage === 1}
                                onClick={() => setCurrentPage(activePage - 1)}
                                className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium rounded shadow-sm"
                            >
                                Previous
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => page === 1 || page === totalPages || Math.abs(page - activePage) <= 1)
                                    .map((page, index, arr) => {
                                        const showEllipsis = index > 0 && page - arr[index - 1] > 1;
                                        return (
                                            <React.Fragment key={page}>
                                                {showEllipsis && <span className="text-gray-400 px-1">...</span>}
                                                <button
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-7 h-7 flex items-center justify-center font-medium rounded transition-colors ${activePage === page
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                            </div>
                            <button
                                disabled={activePage === totalPages}
                                onClick={() => setCurrentPage(activePage + 1)}
                                className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium rounded shadow-sm"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceMonthly;