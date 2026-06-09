import React, { useState, useEffect } from 'react';
import { Search, Loader2, Calendar, Filter, Download, TrendingUp, CheckCircle2, AlertCircle, Target } from 'lucide-react';
import * as XLSX from 'xlsx';

const MIS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyjCJ04mKT8T3aCfJjj8ENf9GXO8BcAmmDwQBEAocdEjAtuGYflKfcGzfUDXP-vD467/exec';
const SHEET_ID = '1Itgq_lJIEo1zKqsNIpRvWwGo-qCe0pglnkfu8OeAw4Y';

const getAWeekAgoStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
};

const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
};

const MisReport = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');

    // Modal state
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
        // Faster check for YYYY-MM-DD format before creating Date object
        if (typeof val === 'string' && val.length === 10 && val[4] === '-' && val[7] === '-') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    };

    // Pre-calculate date timestamps for faster filtering
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
            const company = row[2]; // Column C (Shop Name)
            const name = row[4];    // Column E (Name)
            const startDateStr = row[6]; // Column G (Task Start Date)

            // --- FAST FILTER FIRST ---
            if (!name) return;
            const compStr = company ? company.toString().trim() : '';

            // Company Filter
            if (selectedCompany && compStr !== selectedCompany) return;

            // Date Filter (Optimized with timestamps)
            let taskDate = null;
            if (sTimestamp && eTimestamp) {
                if (!startDateStr) return;
                // Simple string check before full parse if it's YYYY-MM-DD
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
            const actualRaw = row[10];   // Column K (Actual)
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

                // Calculate "On Time" status
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
        // Filter rawDataOriginal based on employee name and existing dashboard filters
        const tasks = rawDataOriginal.filter(row => {
            const name = row[4];
            const company = row[2] || '';
            const startDateStr = row[6];
            if (!name || name.toString().trim() !== employeeName) return false;

            const taskDate = parseDate(startDateStr);
            // Main filters also apply to modal content
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

        // Sort by date descending (latest tasks first)
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
            // Check if it's already in duration format (HH:MM:SS)
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
            <div className="flex items-center space-x-3 w-32">
                <div className="w-24 bg-gray-100/80 rounded-full h-2 min-w-[5rem] overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
                        style={{ width: `${safeValue}%` }}
                    ></div>
                </div>
                <span className="text-xs font-black text-gray-500 tabular-nums min-w-[30px]">{label || `${safeValue}%`}</span>
            </div>
        );
    };

    const PerformanceBadge = ({ percentage }) => {
        const isHigh = percentage >= 95;
        return (
            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full shadow-sm ${isHigh ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'} border`}>
                {isHigh ? '>95% Perf' : '<95% Perf'}
            </span>
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

        // --- Header definitions with individual colors matching the design ---
        const headerConfig = [
            { label: 'Date Start', bgColor: '2E6E8E', fontColor: 'FFFFFF' },
            { label: 'Date End', bgColor: '2E6E8E', fontColor: 'FFFFFF' },
            { label: 'Name', bgColor: '2E6E8E', fontColor: 'FFFFFF' },
            { label: 'Target', bgColor: 'FFE600', fontColor: '000000' },
            { label: 'Actual Work Done', bgColor: '4472C4', fontColor: 'FFFFFF' },
            { label: '% Work Not Done', bgColor: 'FFFFFF', fontColor: '000000' },
            { label: '% Work Not Done On Time', bgColor: '203864', fontColor: 'FFFFFF' },
            { label: 'Total Work Done', bgColor: '4472C4', fontColor: 'FFFFFF' },
            { label: 'Week Pending', bgColor: 'F4CCCC', fontColor: '000000' },
        ];

        // --- Data rows ---
        const dataRows = filteredRows.map(row => [
            formatDate(row.minDate),
            formatDate(row.maxDate),
            row.name,
            row.target,
            row.totalWorkDone,
            `${row.workNotDonePct}%`,
            `${row.workNotDoneOnTimePct}%`,
            row.totalWorkDone,
            row.weekPending
        ]);

        // --- Build worksheet ---
        const wsData = [headerConfig.map(h => h.label), ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // --- Apply header cell styles ---
        const makeCellStyle = (bgColor, fontColor) => ({
            fill: { patternType: 'solid', fgColor: { rgb: bgColor } },
            font: { bold: true, color: { rgb: fontColor }, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } },
            }
        });

        headerConfig.forEach((h, colIdx) => {
            const cellAddr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
            if (!ws[cellAddr]) ws[cellAddr] = { v: h.label, t: 's' };
            ws[cellAddr].s = makeCellStyle(h.bgColor, h.fontColor);
        });

        // --- Data cell light style ---
        const dataCellStyle = {
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: 'E0E0E0' } },
                bottom: { style: 'thin', color: { rgb: 'E0E0E0' } },
                left: { style: 'thin', color: { rgb: 'E0E0E0' } },
                right: { style: 'thin', color: { rgb: 'E0E0E0' } },
            }
        };
        dataRows.forEach((row, rowIdx) => {
            row.forEach((_, colIdx) => {
                const cellAddr = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
                if (ws[cellAddr]) ws[cellAddr].s = dataCellStyle;
            });
        });

        // --- Column widths ---
        ws['!cols'] = [
            { wch: 14 }, // Date Start
            { wch: 14 }, // Date End
            { wch: 22 }, // Name
            { wch: 10 }, // Target
            { wch: 18 }, // Actual Work Done
            { wch: 18 }, // % Work Not Done
            { wch: 24 }, // % Work Not Done On Time
            { wch: 18 }, // Total Work Done
            { wch: 14 }, // Week Pending
        ];

        // --- Row height for header ---
        ws['!rows'] = [{ hpt: 36 }];

        // --- Create workbook and download as .xlsx ---
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'MIS Report');
        XLSX.writeFile(wb, `MIS_Report_${getTodayStr()}.xlsx`, { bookType: 'xlsx', cellStyles: true });
    };

    const SummaryCard = ({ title, value, icon: Icon, color, subtext }) => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between group hover:shadow-md transition-all duration-300">
            <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-2xl font-black text-gray-900">{value}</h3>
                {subtext && <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-tight">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-xl ${color} shadow-sm group-hover:scale-110 transition-transform`}>
                <Icon size={20} className="text-white" />
            </div>
        </div>
    );

    return (
        <div className="space-y-6 page-content p-6 flex-1 bg-gray-50/30 p-15">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">MIS Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Real-time team performance metrics based on assigned tasks.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleClearFilters}
                        className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-600 px-5 py-2.5 rounded-xl font-bold text-sm border border-gray-200 transition-all active:scale-95"
                    >
                        <Filter size={18} />
                        <span>Clear Filters</span>
                    </button>
                    <button
                        onClick={handleExportCSV}
                        disabled={filteredRows.length === 0}
                        className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-slate-200 transition-all hover:scale-105 active:scale-95"
                    >
                        <Download size={18} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Target"
                    value={summary.totalTarget}
                    icon={Target}
                    color="bg-blue-600"
                    subtext="Total tasks assigned"
                />
                <SummaryCard
                    title="Work Done"
                    value={summary.totalDone}
                    icon={CheckCircle2}
                    color="bg-green-600"
                    subtext="Tasks completed successfully"
                />
                <SummaryCard
                    title="Pending Tasks"
                    value={summary.totalPending}
                    icon={AlertCircle}
                    color="bg-orange-600"
                    subtext={`Includes ${summary.totalWeekPending} tasks from this week`}
                />
                <SummaryCard
                    title="Avg. Inefficiency"
                    value={`${avgEfficiency}%`}
                    icon={TrendingUp}
                    color="bg-indigo-600"
                    subtext="Percentage of total work not done"
                />
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row gap-4 items-end flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-full relative max-w-[160px]">
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Start Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner text-gray-800 font-medium text-sm"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="text-gray-400 font-black mt-6">-</div>
                    <div className="w-full relative max-w-[160px]">
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">End Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner text-gray-800 font-medium text-sm"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="w-full relative max-w-[200px]">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Filter Company</label>
                    <div className="relative">
                        <select
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner appearance-none text-gray-800 font-medium text-sm"
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value)}
                        >
                            <option value="">All Companies</option>
                            {companyList.map(comp => (
                                <option key={comp} value={comp}>{comp}</option>
                            ))}
                        </select>
                        <Filter size={16} className="absolute left-3.5 top-[13px] text-gray-400" />
                    </div>
                </div>

                <div className="w-full relative max-w-[250px] ml-auto">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Search Employees</label>
                    <input
                        type="text"
                        placeholder="Employee name..."
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner hover:shadow hover:bg-white text-gray-800 font-medium text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden relative">
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="min-w-full divide-y divide-gray-200 w-full mb-10">
                        <thead className="bg-[#f8fafc] sticky top-0 z-30 shadow-sm border-b">
                            <tr>
                                <th className="px-6 py-5 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest sticky left-0 z-40 bg-[#f8fafc]">NAME</th>
                                <th className="px-6 py-5 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest">DATE START</th>
                                <th className="px-6 py-5 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest">DATE END</th>
                                <th className="px-6 py-5 text-center text-[11px] font-black text-gray-500 uppercase tracking-widest">TARGET</th>
                                <th className="px-6 py-5 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest">% WORK NOT DONE</th>
                                <th className="px-6 py-5 text-left text-[11px] font-black text-gray-500 uppercase tracking-widest">% WORK NOT DONE ON TIME</th>
                                <th className="px-6 py-5 text-center text-[11px] font-black text-gray-500 uppercase tracking-widest">TOTAL DONE</th>
                                <th className="px-6 py-5 text-center text-[11px] font-black text-gray-500 uppercase tracking-widest">PENDING</th>
                                <th className="px-6 py-5 text-center text-[11px] font-black text-gray-500 uppercase tracking-widest">STATUS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-28 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-blue-600 font-bold tracking-widest text-sm uppercase animate-pulse">Aggregating Statistics...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-16 text-center text-red-500 font-bold bg-red-50">
                                        <div className="text-xl mb-2">⚠️</div>
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredRows.length > 0 ? (
                                filteredRows.map((row, i) => (
                                    <tr
                                        key={i}
                                        onClick={() => handleRowClick(row.name)}
                                        className="group hover:bg-blue-50/60 transition-all cursor-pointer active:scale-[0.99] origin-center"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap sticky left-0 z-10 bg-white group-hover:bg-[#f3f8ff] border-r border-gray-100 transition-colors">
                                            <div className="flex items-center space-x-4">
                                                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center text-xl shadow-sm border border-white shrink-0 group-hover:scale-105 transition-transform">
                                                    {getAvatar(row.name)}
                                                </div>
                                                <div className="text-sm font-extrabold text-gray-900 group-hover:text-blue-700 transition-colors">{row.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold tabular-nums">{formatDate(row.minDate)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold tabular-nums">{formatDate(row.maxDate)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-base font-black text-slate-800">{row.target}</td>

                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <ProgressBar value={Math.abs(row.workNotDonePct)} color="bg-rose-500" label={`${row.workNotDonePct}%`} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <ProgressBar value={Math.abs(row.workNotDoneOnTimePct)} color="bg-orange-500" label={`${row.workNotDoneOnTimePct}%`} />
                                        </td>

                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="px-4 py-1.5 text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 rounded-lg shadow-inner">
                                                {row.totalWorkDone}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-4 py-1.5 text-xs font-black rounded-lg border shadow-inner ${row.pending > 0 ? 'text-orange-700 bg-orange-50 border-orange-100' : 'text-gray-400 bg-gray-50 border-gray-100'}`}>
                                                {row.pending}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <PerformanceBadge percentage={row.actualWorkDonePct} />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="9" className="px-6 py-24 text-center">
                                        <div className="text-4xl text-gray-300 mb-4 opacity-50">📋</div>
                                        <p className="font-bold text-gray-400 uppercase tracking-widest text-sm">No performance records found.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Task Details Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col scale-in animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-center space-x-5">
                                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg border-2 border-white">
                                    {getAvatar(selectedEmployeeName)}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-none">{selectedEmployeeName}</h2>
                                    <div className="flex items-center mt-2 space-x-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">{selectedEmployeeCompany}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-200 shadow-sm transition-all active:scale-90"
                            >
                                <AlertCircle className="rotate-45" size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 flex flex-col p-8 space-y-6 bg-gray-50/30 overflow-hidden">

                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Task Details</h4>
                                <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                                    {selectedEmployeeTasks.length} Records Found
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1 flex flex-col">
                                <div className="overflow-auto flex-1">
                                    <table className="min-w-full divide-y divide-gray-100 relative">
                                        <thead className="bg-[#f8fafc] sticky top-0 z-20 shadow-sm transition-all italic">

                                            <tr>
                                                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">TASK ID</th>
                                                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">NAME</th>
                                                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">FREQ</th>
                                                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">TASK</th>
                                                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">PLANNED</th>
                                                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">ACTUAL</th>
                                                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">TIME DELAY</th>
                                                <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">SHOP</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {selectedEmployeeTasks.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="px-6 py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No records found for the given criteria.</td>
                                                </tr>
                                            ) : (
                                                selectedEmployeeTasks.map((task, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-5 py-4 whitespace-nowrap text-xs font-black text-slate-800">{task[1]}</td>
                                                        <td className="px-5 py-4 whitespace-nowrap text-[11px] font-bold text-gray-500 uppercase">{task[4]}</td>
                                                        <td className="px-5 py-4 whitespace-nowrap">
                                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-black uppercase rounded border border-gray-200">
                                                                {task[7] || 'Daily'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 text-xs font-bold text-gray-700 min-w-[200px] leading-relaxed">
                                                            <span className="text-blue-600/60 mr-1">{task[5]?.split(' ')[0]}</span>
                                                            {task[5]?.split(' ').slice(1).join(' ')}
                                                        </td>
                                                        <td className="px-5 py-4 whitespace-nowrap text-xs font-bold text-gray-400">{formatDate(parseDate(task[6]))}</td>
                                                        <td className="px-5 py-4 whitespace-nowrap text-xs font-bold text-gray-400">{task[10] ? formatDate(parseDate(task[10])) : '-'}</td>
                                                        <td className={`px-5 py-4 whitespace-nowrap text-xs font-black ${task[11] && task[11] !== '-' ? 'text-red-500' : 'text-green-500'}`}>
                                                            {formatTimeDelay(task[11])}
                                                        </td>

                                                        <td className="px-5 py-4 whitespace-nowrap text-[11px] font-black text-gray-800 uppercase tracking-wider">{task[2] || '-'}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-8 py-4 border-t border-gray-100 bg-white flex justify-end">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-md active:scale-95"
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