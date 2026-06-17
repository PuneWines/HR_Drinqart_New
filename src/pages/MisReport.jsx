import React, { useState, useEffect } from 'react';
import { Search, Loader2, Calendar, Filter, Download, TrendingUp, CheckCircle2, AlertCircle, Target, Users, BarChart3, PieChart } from 'lucide-react';
import * as XLSX from 'xlsx';

const MIS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyjCJ04mKT8T3aCfJjj8ENf9GXO8BcAmmDwQBEAocdEjAtuGYflKfcGzfUDXP-vD467/exec';
const SHEET_ID = '1Itgq_lJIEo1zKqsNIpRvWwGo-qCe0pglnkfu8OeAw4Y';

const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
};

const MisReport = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
    const [selectedEmployeeTasks, setSelectedEmployeeTasks] = useState([]);
    const [selectedEmployeeCompany, setSelectedEmployeeCompany] = useState('');

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedCompany('');
        setSearchTerm('');
    };

    const [reportData, setReportData] = useState([]);
    const [rawDataOriginal, setRawDataOriginal] = useState([]);
    const [companyList, setCompanyList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const parseDate = (val) => {
        if (!val) return null;
        if (typeof val === 'string' && val.length === 10 && val[4] === '-' && val[7] === '-') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    };

    const sTimestamp = startDate ? new Date(startDate).getTime() : null;
    const eTimestamp = endDate ? new Date(endDate).getTime() : null;

    const processData = (rawData) => {
        const grouped = {};
        const now = new Date();
        const currentDay = now.getDay();

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - currentDay);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const isCurrentWeek = (d) => d && d >= startOfWeek && d <= endOfWeek;

        rawData.forEach(row => {
            const company = row[2];
            const name = row[4];
            const startDateStr = row[6];

            if (!name) return;
            const compStr = company ? company.toString().trim() : '';

            if (selectedCompany && compStr !== selectedCompany) return;

            let taskDate = null;
            if (sTimestamp && eTimestamp) {
                if (!startDateStr) return;
                if (typeof startDateStr === 'string' && startDateStr.length >= 10 && startDateStr[4] === '-' && startDateStr[7] === '-') {
                    const rowTime = new Date(startDateStr.substring(0, 10)).getTime();
                    if (rowTime < sTimestamp || rowTime > eTimestamp) return;
                    taskDate = new Date(rowTime);
                } else {
                    taskDate = parseDate(startDateStr);
                    if (!taskDate || taskDate.getTime() < sTimestamp || taskDate.getTime() > eTimestamp) return;
                }
            }

            const nameStr = name.toString().trim();
            const actualRaw = row[10];
            const isActualEmpty = !actualRaw || actualRaw.toString().trim() === '';

            if (!grouped[nameStr]) {
                grouped[nameStr] = {
                    name: nameStr,
                    minDate: taskDate ? new Date(taskDate) : null,
                    maxDate: taskDate ? new Date(taskDate) : null,
                    target: 0,
                    totalWorkDone: 0,
                    pending: 0,
                    weekPending: 0,
                    onTimeCount: 0
                };
            }

            const g = grouped[nameStr];
            g.target += 1;

            if (isActualEmpty) {
                g.pending += 1;
                if (isCurrentWeek(taskDate || parseDate(startDateStr))) {
                    g.weekPending += 1;
                }
            } else {
                g.totalWorkDone += 1;
                const timeDelayVal = row[11];
                const delayStr = timeDelayVal ? timeDelayVal.toString().trim() : '';
                const isDelayed = delayStr && delayStr !== '-' && delayStr !== '0' && delayStr !== '00:00:00';
                if (!isDelayed) {
                    g.onTimeCount += 1;
                }
            }

            if (taskDate) {
                if (!g.minDate || taskDate < g.minDate) g.minDate = new Date(taskDate);
                if (!g.maxDate || taskDate > g.maxDate) g.maxDate = new Date(taskDate);
            }
        });

        const processedArr = Object.values(grouped).map(emp => {
            const target = emp.target;
            const done = emp.totalWorkDone;
            const onTime = emp.onTimeCount;

            const actualPct = target > 0 ? Math.round((done / target) * 100) : 0;
            const workNotDonePct = target > 0 ? parseFloat(((done / target) * 100 - 100).toFixed(2)) : 0;
            const workNotDoneOnTimePct = target > 0 ? parseFloat(((onTime / target) * 100 - 100).toFixed(2)) : 0;

            return {
                ...emp,
                actualWorkDonePct: actualPct,
                workNotDonePct,
                workNotDoneOnTimePct
            };
        });

        processedArr.sort((a, b) => b.actualWorkDonePct - a.actualWorkDonePct);
        setReportData(processedArr);
    };

    const handleRowClick = (employeeName) => {
        const tasks = rawDataOriginal.filter(row => {
            const name = row[4];
            const company = row[2] || '';
            const startDateStr = row[6];
            if (!name || name.toString().trim() !== employeeName) return false;

            const taskDate = parseDate(startDateStr);
            if (startDate && endDate) {
                if (!taskDate) return false;
                const sD = new Date(startDate);
                const eD = new Date(endDate);
                sD.setHours(0, 0, 0, 0);
                eD.setHours(23, 59, 59, 999);
                if (taskDate < sD || taskDate > eD) return false;
            }
            if (selectedCompany && company.toString().trim() !== selectedCompany) return false;

            return true;
        });

        tasks.sort((a, b) => {
            const d1 = parseDate(a[6]);
            const d2 = parseDate(b[6]);
            return (d2 || 0) - (d1 || 0);
        });

        const empObj = reportData.find(r => r.name === employeeName);
        const companyName = rawDataOriginal.find(r => r[4] === employeeName)?.[2] || 'Personal';

        setSelectedEmployeeName(employeeName);
        setSelectedEmployeeTasks(tasks);
        setSelectedEmployeeCompany(companyName);
        setIsModalOpen(true);
    };

    const fetchMisData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${MIS_SCRIPT_URL}?sheet=${encodeURIComponent('All Checklist')}&action=fetch&spreadsheetId=${SHEET_ID}`);
            const result = await response.json();

            if (result.success) {
                const dataRows = result.data.length > 1 ? result.data.slice(1) : [];
                setRawDataOriginal(dataRows);

                const companies = new Set();
                dataRows.forEach(row => {
                    if (row[2] && row[2].toString().trim() !== '') {
                        companies.add(row[2].toString().trim());
                    }
                });
                setCompanyList(Array.from(companies).sort());
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError("Failed to fetch dashboard data. Make sure Apps Script is deployed and enabled.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMisData();
    }, []);

    useEffect(() => {
        if (rawDataOriginal.length > 0) {
            processData(rawDataOriginal);
        }
    }, [rawDataOriginal, startDate, endDate, selectedCompany]);

    const formatDate = (dateValue) => {
        if (!dateValue) return '-';
        try {
            const yyyy = dateValue.getFullYear();
            const mm = String(dateValue.getMonth() + 1).padStart(2, '0');
            const dd = String(dateValue.getDate()).padStart(2, '0');
            return `${dd}/${mm}/${yyyy}`;
        } catch (e) {
            return '-';
        }
    };

    const formatTimeDelay = (delayStr) => {
        if (!delayStr || delayStr === '-' || delayStr === '0') return '-';
        try {
            if (typeof delayStr === 'string' && delayStr.includes(':') && !delayStr.includes('T')) {
                return delayStr;
            }
            const d = new Date(delayStr);
            const epoch = new Date('1899-12-30T00:00:00.000Z');
            const diff = d - epoch;
            if (isNaN(diff)) return delayStr;
            const totalSeconds = Math.abs(Math.floor(diff / 1000));
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const formatted = [
                hours.toString().padStart(2, '0'),
                minutes.toString().padStart(2, '0'),
                seconds.toString().padStart(2, '0')
            ].join(':');
            return (diff < 0 ? '-' : '') + formatted;
        } catch (e) {
            return delayStr;
        }
    };

    const getAvatar = (name) => {
        if (!name) return "👤";
        const lowerName = name.toLowerCase().trim();
        const femaleEndings = ['a', 'i', 'ee', 'kumari', 'devi', 'shree', 'shakti'];
        const femaleNames = ['priya', 'neha', 'pooja', 'sneha', 'anita', 'sunita', 'kavita', 'swati'];
        const isFemale = femaleEndings.some(ending => lowerName.endsWith(ending)) || femaleNames.some(f => lowerName.includes(f));
        return isFemale ? "👩" : "👨";
    };

    const ProgressBar = ({ value, color, label }) => {
        const safeValue = Math.min(Math.max(0, value), 100);
        return (
            <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${safeValue}%` }}></div>
                </div>
                <span className="text-xs font-medium text-gray-600 min-w-[45px]">{label || `${safeValue}%`}</span>
            </div>
        );
    };

    const filteredRows = reportData.filter(row =>
        row.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const summary = filteredRows.reduce((acc, curr) => {
        acc.totalTarget += curr.target;
        acc.totalDone += curr.totalWorkDone;
        acc.totalPending += curr.pending;
        acc.totalWeekPending += curr.weekPending;
        return acc;
    }, { totalTarget: 0, totalDone: 0, totalPending: 0, totalWeekPending: 0 });

    const avgEfficiency = summary.totalTarget > 0
        ? Math.round(((summary.totalTarget - summary.totalDone) / summary.totalTarget) * 100)
        : 0;

    const handleExportCSV = () => {
        if (filteredRows.length === 0) return;

        const dataToExport = filteredRows.map((row, idx) => ({
            'S.No.': idx + 1,
            'Employee Name': row.name,
            'Date Start': formatDate(row.minDate),
            'Date End': formatDate(row.maxDate),
            'Target': row.target,
            'Work Done': row.totalWorkDone,
            'Pending': row.pending,
            'Week Pending': row.weekPending,
            'Work Not Done %': `${row.workNotDonePct}%`,
            'Work Not Done On Time %': `${row.workNotDoneOnTimePct}%`,
            'Actual Work Done %': `${row.actualWorkDonePct}%`
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'MIS Report');
        XLSX.writeFile(workbook, `MIS_Report_${getTodayStr()}.xlsx`);
    };

    return (
        <div className="p-10 pt-5">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <BarChart3 size={28} />
                        MIS Dashboard
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Real-time team performance metrics based on assigned tasks
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200  text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        <Filter size={16} />
                        Clear Filters
                    </button>
                    <button
                        onClick={handleExportCSV}
                        disabled={filteredRows.length === 0}
                        className={`flex items-center gap-2 px-4 py-2  text-white font-medium text-sm transition-colors ${filteredRows.length === 0
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        <Download size={16} />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Summary Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-white  border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500">Total Target</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalTarget}</p>
                            <p className="text-xs text-gray-400 mt-1">Total tasks assigned</p>
                        </div>
                        <div className="p-2 bg-blue-50 ">
                            <Target size={20} className="text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white  border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500">Work Done</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{summary.totalDone}</p>
                            <p className="text-xs text-gray-400 mt-1">Tasks completed</p>
                        </div>
                        <div className="p-2 bg-green-50 ">
                            <CheckCircle2 size={20} className="text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white  border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500">Pending Tasks</p>
                            <p className="text-2xl font-bold text-orange-600 mt-1">{summary.totalPending}</p>
                            <p className="text-xs text-gray-400 mt-1">{summary.totalWeekPending} from this week</p>
                        </div>
                        <div className="p-2 bg-orange-50 ">
                            <AlertCircle size={20} className="text-orange-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white  border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500">Avg. Inefficiency</p>
                            <p className="text-2xl font-bold text-indigo-600 mt-1">{avgEfficiency}%</p>
                            <p className="text-xs text-gray-400 mt-1">Work not done</p>
                        </div>
                        <div className="p-2 bg-indigo-50 ">
                            <TrendingUp size={20} className="text-indigo-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white  border border-gray-200 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-gray-200  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2 border border-gray-200  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Filter Company</label>
                        <div className="relative">
                            <select
                                className="w-full appearance-none px-3 py-2 border border-gray-200  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                            >
                                <option value="">All Companies</option>
                                {companyList.map(comp => (
                                    <option key={comp} value={comp}>{comp}</option>
                                ))}
                            </select>
                            <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Search Employees</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Employee name..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-200  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white  border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Employee</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Date Start</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Date End</th>
                                <th className="text-center px-4 py-3 font-medium text-gray-600 text-xs">Target</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Work Not Done</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Not Done On Time</th>
                                <th className="text-center px-4 py-3 font-medium text-gray-600 text-xs">Done</th>
                                <th className="text-center px-4 py-3 font-medium text-gray-600 text-xs">Pending</th>
                                <th className="text-center px-4 py-3 font-medium text-gray-600 text-xs">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-12">
                                        <div className="flex items-center justify-center gap-2 text-gray-500">
                                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            Loading MIS data...
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="9" className="text-center py-12">
                                        <p className="text-red-600 mb-3">{error}</p>
                                        <button
                                            onClick={fetchMisData}
                                            className="px-4 py-2 bg-indigo-600 text-white  hover:bg-indigo-700 transition-colors text-sm"
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : filteredRows.length > 0 ? (
                                filteredRows.map((row, i) => (
                                    <tr
                                        key={i}
                                        onClick={() => handleRowClick(row.name)}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-medium">
                                                    {getAvatar(row.name)}
                                                </div>
                                                <span className="text-sm font-medium text-gray-900">{row.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.minDate)}</td>
                                        <td className="px-4 py-3 text-xs text-gray-600">{formatDate(row.maxDate)}</td>
                                        <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{row.target}</td>
                                        <td className="px-4 py-3">
                                            <ProgressBar value={Math.abs(row.workNotDonePct)} color="bg-red-500" label={`${row.workNotDonePct}%`} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <ProgressBar value={Math.abs(row.workNotDoneOnTimePct)} color="bg-orange-500" label={`${row.workNotDoneOnTimePct}%`} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                                                {row.totalWorkDone}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${row.pending > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {row.pending}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${row.actualWorkDonePct >= 95 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {row.actualWorkDonePct >= 95 ? '>95% Perf' : '<95% Perf'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="9" className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <Search size={48} className="mb-3" />
                                            <p className="font-medium">No performance records found</p>
                                            <p className="text-xs mt-1">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Task Details Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white  max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg font-medium">
                                    {getAvatar(selectedEmployeeName)}
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">{selectedEmployeeName}</h2>
                                    <p className="text-xs text-gray-500">{selectedEmployeeCompany}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                                <AlertCircle size={18} className="rotate-45" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-md font-semibold text-gray-900">Task Details</h3>
                                <span className="text-xs text-gray-500">{selectedEmployeeTasks.length} records</span>
                            </div>

                            <div className="bg-white  border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto max-h-96">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Task ID</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Name</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Frequency</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Task</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Planned</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Actual</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Delay</th>
                                                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Shop</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedEmployeeTasks.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-8 text-gray-500">No records found</td>
                                                </tr>
                                            ) : (
                                                selectedEmployeeTasks.map((task, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 text-xs font-mono text-gray-600">{task[1]}</td>
                                                        <td className="px-4 py-3 text-xs font-medium text-gray-700">{task[4]}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                                                {task[7] || 'Daily'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-700 max-w-xs truncate">{task[5]}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-500">{formatDate(parseDate(task[6]))}</td>
                                                        <td className="px-4 py-3 text-xs text-gray-500">{task[10] ? formatDate(parseDate(task[10])) : '-'}</td>
                                                        <td className={`px-4 py-3 text-xs font-medium ${task[11] && task[11] !== '-' ? 'text-red-600' : 'text-green-600'}`}>
                                                            {formatTimeDelay(task[11])}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-600">{task[2] || '-'}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 bg-gray-600 text-white  hover:bg-gray-700 transition-colors text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MisReport;