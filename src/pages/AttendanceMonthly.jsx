import React, { useEffect, useState } from 'react';
import { Search, Download, Filter, RefreshCw, Loader2, Database } from 'lucide-react';
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
                return;
            }

            // Handle "All Devices" case
            if (selectedDevice.serial === 'ALL') {
                // Fetch data from all devices in parallel
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
                // Single device logic
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

    const months = [...new Set(attendanceData.map(r => r.month))].filter(Boolean);
    const years = [...new Set(attendanceData.map(r => r.year))].filter(Boolean);

    const filteredData = attendanceData.filter(item => {
        const matchesSearch =
            item.employeeName?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.employeeCode?.toString().toLowerCase().includes(searchTerm.toLowerCase());

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

    return (
        <div className="space-y-6 p-6 w-[75vw]">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Attendance Records Monthly</h1>
                <div className="flex items-center space-x-3">
                    {lastSynced && (
                        <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                            <Database size={12} className="mr-1.5 text-slate-400" />
                            <span>Synced: {new Date(lastSynced).toLocaleString('en-IN')}</span>
                        </div>
                    )}
                    <button
                        onClick={() => fetchAttendanceData(true)}
                        disabled={loading || syncing}
                        className={`flex items-center px-4 py-2 rounded-lg text-white font-medium text-sm transition-all shadow-md ${loading || syncing
                            ? 'bg-indigo-300 cursor-not-allowed shadow-none'
                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                            }`}
                    >
                        {syncing ? (
                            <Loader2 size={16} className="mr-2 animate-spin" />
                        ) : (
                            <RefreshCw size={16} className="mr-2" />
                        )}
                        {syncing ? 'Syncing...' : 'Sync Logs'}
                    </button>
                    <button
                        onClick={downloadExcel}
                        disabled={filteredData.length === 0}
                        className={`flex items-center px-4 py-2 rounded-lg text-white font-medium text-sm transition-all shadow-md ${filteredData.length === 0
                            ? 'bg-gray-400 cursor-not-allowed shadow-none'
                            : 'bg-green-600 hover:bg-green-700 shadow-green-100'
                            }`}
                    >
                        <Download size={16} className="mr-2" />
                        Download Excel
                    </button>
                </div>
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
                            onChange={(e) => {
                                const selected = e.target.value;
                                if (selected === 'ALL DEVICES') {
                                    setSelectedDevice(ALL_DEVICES_OPTION);
                                } else {
                                    setSelectedDevice(DEVICES.find(d => d.name === selected));
                                }
                            }}
                            className="w-full appearance-none pl-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700"
                        >
                            <option value="ALL DEVICES" className="font-bold text-indigo-600">📊 ALL DEVICES</option>
                            {DEVICES.map(d => (
                                <option key={d.name} value={d.name}>{d.name}</option>
                            ))}
                        </select>
                        <Filter size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    {selectedDevice.serial === 'ALL' && (
                        <p className="text-[10px] text-indigo-600 font-bold mt-1 flex items-center">
                            <Database size={10} className="mr-1" />
                            Showing data from all devices combined
                        </p>
                    )}
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

            {/* Summary Cards for All Devices View */}
            {selectedDevice.serial === 'ALL' && attendanceData.length > 0 && !loading && (
                <div className="grid grid-cols-5 gap-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-3 border border-indigo-200">
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Total Employees</p>
                        <p className="text-2xl font-black text-indigo-900 mt-1">{new Set(attendanceData.map(d => d.employeeCode)).size}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-wider">Total Present Days</p>
                        <p className="text-2xl font-black text-green-900 mt-1">{attendanceData.reduce((sum, d) => sum + (parseInt(d.presentDays) || 0), 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-3 border border-rose-200">
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Total Absent Days</p>
                        <p className="text-2xl font-black text-rose-900 mt-1">{attendanceData.reduce((sum, d) => sum + (parseInt(d.absentDays) || 0), 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3 border border-orange-200">
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-wider">Total Late Days</p>
                        <p className="text-2xl font-black text-orange-900 mt-1">{attendanceData.reduce((sum, d) => sum + (parseInt(d.lateDays) || 0), 0)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 border border-blue-200">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Devices</p>
                        <p className="text-2xl font-black text-blue-900 mt-1">{new Set(attendanceData.map(d => d.serialNo)).size}</p>
                    </div>
                </div>
            )}

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
                                            onClick={() => fetchAttendanceData()}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium shadow-sm transition-colors"
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : filteredData.length > 0 ? (
                                filteredData.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-[10px] font-bold text-gray-400">{index + 1}</td>
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