import React, { useEffect, useState } from 'react';
import { Search, Download, Filter, RefreshCw, Loader2, Database, Calendar, Users, Clock, TrendingUp, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getMonthlyAttendanceFromSupabase, syncMonthlyAttendanceFromApi } from '../services/attendanceSync';

const DEVICES = [
    { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
    { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
    { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
    { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
    { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' }
];

const ALL_DEVICES_OPTION = { name: 'ALL DEVICES', apiName: 'ALL', serial: 'ALL' };

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

    useEffect(() => {
        fetchAttendanceData();
    }, [selectedMonth, selectedYear, selectedDevice]);

    const filteredData = attendanceData.filter(item => {
        const matchesSearch =
            (item.employeeName?.toString().toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.employeeCode?.toString().toLowerCase() || '').includes(searchTerm.toLowerCase());

        const matchesMonth = selectedMonth ? item.month === monthNames[selectedMonth - 1] : true;
        const matchesYear = selectedYear ? item.year?.toString() === selectedYear.toString() : true;

        return matchesSearch && matchesMonth && matchesYear;
    });

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
            'Punch Miss': item.punchMiss,
            'Holidays': item.holidays,
            'Late Days': item.lateDays,
            'Total Working Hour': item.totalWorkHours,
            'Total Lunch Time': item.totalLunchTime
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
                    <button
                        onClick={() => fetchAttendanceData(true)}
                        disabled={loading || syncing}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white font-medium text-xs transition-colors ${loading || syncing
                            ? 'bg-indigo-300 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                    >
                        {syncing ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <RefreshCw size={12} />
                        )}
                        {syncing ? 'Syncing...' : 'Sync Logs'}
                    </button>
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
            <div className="bg-white rounded-md border border-gray-200 p-2 mb-3">
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

            {/* Summary Cards - Compact */}
            {selectedDevice.serial === 'ALL' && attendanceData.length > 0 && !loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    <div className="bg-white rounded-md border border-gray-200 p-2.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500">Total Employees</p>
                                <p className="text-xl font-bold text-gray-900 mt-0.5">{totalEmployees}</p>
                            </div>
                            <div className="p-1.5 bg-indigo-50 rounded-md">
                                <Users size={14} className="text-indigo-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-md border border-gray-200 p-2.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500">Total Present</p>
                                <p className="text-xl font-bold text-green-600 mt-0.5">{totalPresent}</p>
                            </div>
                            <div className="p-1.5 bg-green-50 rounded-md">
                                <Clock size={14} className="text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-md border border-gray-200 p-2.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500">Total Absent</p>
                                <p className="text-xl font-bold text-red-600 mt-0.5">{totalAbsent}</p>
                            </div>
                            <div className="p-1.5 bg-red-50 rounded-md">
                                <User size={14} className="text-red-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-md border border-gray-200 p-2.5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500">Total Late</p>
                                <p className="text-xl font-bold text-orange-600 mt-0.5">{totalLate}</p>
                            </div>
                            <div className="p-1.5 bg-orange-50 rounded-md">
                                <TrendingUp size={14} className="text-orange-600" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Table - Compact */}
            <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
                    <table className="w-full text-xs relative border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-12 z-10">#</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-24 z-10">Month/Year</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-24 z-10">Employee Code</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-32 z-10">Employee Name</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-28 z-10">Designation</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-24 z-10">Store</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-20 z-10">Device ID</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] min-w-28 z-10">Serial No</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-20 z-10">Present</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-20 z-10">Absent</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-20 z-10">Punch Miss</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-16 z-10">Holidays</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-16 z-10">Late</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-20 z-10">Work Hrs</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-20 z-10">Lunch</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="15" className="text-center py-8">
                                        <div className="flex items-center justify-center gap-1.5 text-gray-500 text-xs">
                                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            Loading...
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="15" className="text-center py-8">
                                        <p className="text-red-600 text-xs mb-2">{error}</p>
                                        <button
                                            onClick={() => fetchAttendanceData()}
                                            className="px-3 py-1 bg-indigo-600 text-white rounded text-xs"
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : filteredData.length > 0 ? (
                                filteredData.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-2 py-1.5 text-[10px] text-gray-500">{index + 1}</td>
                                        <td className="px-2 py-1.5 text-[10px] font-medium text-gray-700">{item.month} {item.year}</td>
                                        <td className="px-2 py-1.5 text-[10px] font-mono font-medium text-gray-900">{item.employeeCode}</td>
                                        <td className="px-2 py-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-medium">
                                                    {item.employeeName?.charAt(0) || '?'}
                                                </div>
                                                <span className="text-[11px] font-medium text-gray-900">{item.employeeName}</span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-1.5 text-[10px] text-gray-600">{item.designation || '-'}</td>
                                        <td className="px-2 py-1.5 text-[10px] text-gray-600">{item.storeName || '-'}</td>
                                        <td className="px-2 py-1.5 text-[10px] font-mono text-gray-500">{item.deviceId || '-'}</td>
                                        <td className="px-2 py-1.5 text-[10px] font-mono text-gray-500">{item.serialNo || '-'}</td>
                                        <td className="px-2 py-1.5 text-center">
                                            <span className="inline-flex px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                                                {item.presentDays}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <span className="inline-flex px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">
                                                {item.absentDays}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-center text-[10px] text-red-500 font-medium">{item.punchMiss || 0}</td>
                                        <td className="px-2 py-1.5 text-center text-[10px] text-indigo-600 font-medium">{item.holidays || 0}</td>
                                        <td className="px-2 py-1.5 text-center text-[10px] text-orange-600 font-medium">{item.lateDays || 0}</td>
                                        <td className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-700">{item.totalWorkHours || '0h'}</td>
                                        <td className="px-2 py-1.5 text-center text-[10px] font-semibold text-blue-600">{item.totalLunchTime || '0h'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="15" className="text-center py-8">
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
            </div>
        </div>
    );
};

export default AttendanceMonthly;