import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import {
    Calendar,
    RefreshCw,
    Download,
    Plus,
    X,
    ChevronLeft,
    ChevronRight,
    Users,
    Clock,
    TrendingUp,
    Search,
    Filter,
    Loader2,
    CheckCircle,
    Pencil,
    User,
    Database,
    Clock as ClockIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Helper functions
const formatDate = (date, formatStr) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (formatStr === 'yyyy-MM-dd') {
        return `${year}-${month}-${day}`;
    }
    if (formatStr === 'dd MMM') {
        return `${day} ${months[date.getMonth()]}`;
    }
    if (formatStr === 'dd MMM yyyy') {
        return `${day} ${months[date.getMonth()]} ${year}`;
    }
    if (formatStr === 'EEE') {
        return days[date.getDay()];
    }
    return `${day}-${month}-${year}`;
};

const startOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

const addWeeks = (date, weeks) => {
    const d = new Date(date);
    d.setDate(d.getDate() + (weeks * 7));
    return d;
};

const subWeeks = (date, weeks) => {
    const d = new Date(date);
    d.setDate(d.getDate() - (weeks * 7));
    return d;
};

const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
};

// Shift type configurations
const SHIFT_CONFIG = {
    'General Shift': { color: 'bg-green-100 text-green-700', label: 'GS', bgColor: 'bg-green-200' },
    'Day Off': { color: 'bg-gray-100 text-gray-700', label: 'DO', bgColor: 'bg-gray-200' },
    'Holiday': { color: 'bg-red-100 text-red-700', label: 'Hol', bgColor: 'bg-red-200' },
    'Morning Shift': { color: 'bg-blue-100 text-blue-700', label: 'MS', bgColor: 'bg-blue-200' },
    'Evening Shift': { color: 'bg-purple-100 text-purple-700', label: 'ES', bgColor: 'bg-purple-200' },
    'Night Shift': { color: 'bg-indigo-100 text-indigo-700', label: 'NS', bgColor: 'bg-indigo-200' },
    'Not Assigned': { color: 'bg-red-200 text-black ', label: '+', bgColor: 'bg-gray-50' }
};

const Roster = () => {
    const [employees, setEmployees] = useState([]);
    const [rosterData, setRosterData] = useState(new Map());
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date()));
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('ALL');
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
    const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [assignForm, setAssignForm] = useState({
        employee_id: '',
        date: '',
        shift_type: 'General Shift',
        start_time: '10:00',
        end_time: '18:30',
        remark: ''
    });
    const [bulkAssignForm, setBulkAssignForm] = useState({
        employee_id: '',
        start_date: '',
        end_date: '',
        shift_type: 'General Shift',
        start_time: '10:00',
        end_time: '18:30',
        remark: '',
        days_of_week: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true,
            sunday: true
        }
    });

    // Fetch employees
    useEffect(() => {
        fetchEmployees();
    }, []);

    // Fetch roster data when week changes
    useEffect(() => {
        if (employees.length > 0) {
            fetchRosterData();
        }
    }, [currentWeekStart, employees]);

    const fetchEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('id, employee_id, name_as_per_aadhar, designation, status, joining_place')
                .eq('status', 'Active')
                .order('name_as_per_aadhar');

            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
            toast.error('Failed to fetch employees');
        }
    };

    const fetchRosterData = async () => {
        setLoading(true);
        try {
            const weekStart = formatDate(currentWeekStart, 'yyyy-MM-dd');
            const weekEnd = formatDate(addDays(currentWeekStart, 6), 'yyyy-MM-dd');

            const { data, error } = await supabase
                .from('shift_roster')
                .select('*')
                .gte('date', weekStart)
                .lte('date', weekEnd);

            if (error) throw error;

            const rosterMap = new Map();
            data?.forEach((roster) => {
                const key = `${roster.employee_id}-${roster.date}`;
                rosterMap.set(key, roster);
            });
            setRosterData(rosterMap);
        } catch (error) {
            console.error('Error fetching roster data:', error);
            toast.error('Failed to fetch roster data');
        } finally {
            setLoading(false);
        }
    };

    const getWeekDays = () => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            days.push(addDays(currentWeekStart, i));
        }
        return days;
    };

    const getEmployeeRosterForDay = (employeeId, date) => {
        const dateStr = formatDate(date, 'yyyy-MM-dd');
        const key = `${employeeId}-${dateStr}`;
        const roster = rosterData.get(key);

        if (roster) {
            return {
                date,
                shift_type: roster.shift_type,
                start_time: roster.start_time || '',
                end_time: roster.end_time || '',
                remark: roster.remark || '',
                isHoliday: roster.shift_type === 'Holiday' || roster.shift_type === 'Day Off'
            };
        }

        const isSunday = date.getDay() === 0;
        return {
            date,
            shift_type: isSunday ? 'Holiday' : 'Not Assigned',
            start_time: '',
            end_time: '',
            remark: isSunday ? 'Weekly Off' : '',
            isHoliday: isSunday
        };
    };

    const handleAssignShift = async () => {
        try {
            if (!assignForm.employee_id || !assignForm.date) {
                toast.error('Please select employee and date');
                return;
            }

            const { error } = await supabase
                .from('shift_roster')
                .upsert({
                    employee_id: assignForm.employee_id,
                    date: assignForm.date,
                    shift_type: assignForm.shift_type,
                    start_time: assignForm.start_time,
                    end_time: assignForm.end_time,
                    remark: assignForm.remark
                }, {
                    onConflict: 'employee_id,date'
                });

            if (error) throw error;

            toast.success('Shift assigned successfully');
            setShowAssignModal(false);
            setIsSlidePanelOpen(false);
            resetAssignForm();
            await fetchRosterData();
        } catch (error) {
            console.error('Error assigning shift:', error);
            toast.error('Failed to assign shift');
        }
    };

    const handleBulkAssignShift = async () => {
        try {
            if (!bulkAssignForm.employee_id || !bulkAssignForm.start_date || !bulkAssignForm.end_date) {
                toast.error('Please fill all required fields');
                return;
            }

            const startDate = new Date(bulkAssignForm.start_date);
            const endDate = new Date(bulkAssignForm.end_date);
            const shiftsToInsert = [];

            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const dayOfWeek = currentDate.getDay();
                const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];

                if (bulkAssignForm.days_of_week[dayName]) {
                    const dateStr = formatDate(currentDate, 'yyyy-MM-dd');
                    const existingKey = `${bulkAssignForm.employee_id}-${dateStr}`;
                    if (!rosterData.has(existingKey)) {
                        shiftsToInsert.push({
                            employee_id: bulkAssignForm.employee_id,
                            date: dateStr,
                            shift_type: bulkAssignForm.shift_type,
                            start_time: bulkAssignForm.start_time,
                            end_time: bulkAssignForm.end_time,
                            remark: bulkAssignForm.remark
                        });
                    }
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            if (shiftsToInsert.length === 0) {
                toast.info('No new shifts to assign. All selected dates already have shifts assigned.');
                return;
            }

            const { error } = await supabase
                .from('shift_roster')
                .upsert(shiftsToInsert, {
                    onConflict: 'employee_id,date'
                });

            if (error) throw error;

            toast.success(`Successfully assigned ${shiftsToInsert.length} shifts`);
            setShowBulkAssignModal(false);
            resetBulkAssignForm();
            await fetchRosterData();
        } catch (error) {
            console.error('Error assigning bulk shifts:', error);
            toast.error('Failed to assign bulk shifts');
        }
    };

    const resetAssignForm = () => {
        setAssignForm({
            employee_id: '',
            date: '',
            shift_type: 'General Shift',
            start_time: '10:00',
            end_time: '18:30',
            remark: ''
        });
        setSelectedEmployee(null);
        setSelectedDate(null);
    };

    const resetBulkAssignForm = () => {
        setBulkAssignForm({
            employee_id: '',
            start_date: '',
            end_date: '',
            shift_type: 'General Shift',
            start_time: '10:00',
            end_time: '18:30',
            remark: '',
            days_of_week: {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: true,
                sunday: true
            }
        });
    };

    const handleOpenAssignModal = (employeeId, date) => {
        const dateStr = formatDate(date, 'yyyy-MM-dd');
        const existing = rosterData.get(`${employeeId}-${dateStr}`);
        const employee = employees.find(emp => emp.employee_id === employeeId);

        setSelectedEmployee(employee);
        setSelectedDate(date);
        setAssignForm({
            employee_id: employeeId,
            date: dateStr,
            shift_type: existing?.shift_type || 'General Shift',
            start_time: existing?.start_time || '10:00',
            end_time: existing?.end_time || '18:30',
            remark: existing?.remark || ''
        });
        setShowAssignModal(true);
    };

    const handleOpenSlidePanel = (employee, date) => {
        const dateStr = formatDate(date, 'yyyy-MM-dd');
        const existing = rosterData.get(`${employee.employee_id}-${dateStr}`);

        setSelectedEmployee({
            ...employee,
            date: dateStr,
            roster: existing || null
        });
        setSelectedDate(date);
        setAssignForm({
            employee_id: employee.employee_id,
            date: dateStr,
            shift_type: existing?.shift_type || 'General Shift',
            start_time: existing?.start_time || '10:00',
            end_time: existing?.end_time || '18:30',
            remark: existing?.remark || ''
        });
        setIsSlidePanelOpen(true);
    };

    const handleOpenBulkAssignModal = () => {
        const today = new Date();
        const weekStart = startOfWeek(today);
        const weekEnd = addDays(weekStart, 6);

        setBulkAssignForm({
            ...bulkAssignForm,
            start_date: formatDate(weekStart, 'yyyy-MM-dd'),
            end_date: formatDate(weekEnd, 'yyyy-MM-dd')
        });
        setShowBulkAssignModal(true);
    };

    const handleDeleteRoster = async (employeeId, date) => {
        if (!confirm('Are you sure you want to delete this roster entry?')) return;

        try {
            const dateStr = formatDate(date, 'yyyy-MM-dd');
            const { error } = await supabase
                .from('shift_roster')
                .delete()
                .eq('employee_id', employeeId)
                .eq('date', dateStr);

            if (error) throw error;

            toast.success('Roster entry deleted');
            setIsSlidePanelOpen(false);
            await fetchRosterData();
        } catch (error) {
            console.error('Error deleting roster:', error);
            toast.error('Failed to delete roster entry');
        }
    };

    const downloadExcel = () => {
        const weekDays = getWeekDays();
        const exportData = [];

        filteredEmployees.forEach(employee => {
            weekDays.forEach(day => {
                const schedule = getEmployeeRosterForDay(employee.employee_id, day);
                exportData.push({
                    'Employee ID': employee.employee_id,
                    'Employee Name': employee.name_as_per_aadhar,
                    'Designation': employee.designation,
                    'Department': employee.joining_place || '-',
                    'Date': formatDate(day, 'yyyy-MM-dd'),
                    'Day': formatDate(day, 'EEE'),
                    'Shift Type': schedule.shift_type,
                    'Start Time': schedule.start_time,
                    'End Time': schedule.end_time,
                    'Remark': schedule.remark || '-'
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Shift_Roster');
        XLSX.writeFile(workbook, `shift_roster_${formatDate(currentWeekStart, 'yyyy-MM-dd')}.xlsx`);
    };

    const weekDays = getWeekDays();
    const today = new Date();

    const getDayStats = (date) => {
        let total = 0;
        let assigned = 0;
        let holiday = 0;
        const dateStr = formatDate(date, 'yyyy-MM-dd');

        employees.forEach(emp => {
            const key = `${emp.employee_id}-${dateStr}`;
            const roster = rosterData.get(key);
            if (roster) {
                total++;
                if (roster.shift_type === 'Holiday' || roster.shift_type === 'Day Off') {
                    holiday++;
                } else {
                    assigned++;
                }
            } else if (date.getDay() === 0) {
                total++;
                holiday++;
            }
        });

        return { total, assigned, holiday };
    };

    // Get unique departments
    const departments = [...new Set(employees.map(emp => emp.designation).filter(Boolean))].sort();

    // Filter employees
    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.name_as_per_aadhar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = selectedDepartment === 'ALL' || emp.designation === selectedDepartment;
        return matchesSearch && matchesDept;
    });

    return (
        <div className="p-3 pl-7 pr-5">
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <Calendar size={18} />
                        Shift Roster
                    </h1>
                    <p className="text-gray-500 text-[11px] mt-0.5">
                        Manage employee shifts and schedules in weekly view
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleOpenBulkAssignModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-xs transition-colors"
                    >
                        <Plus size={12} />
                        Bulk Assign
                    </button>
                    <button
                        onClick={fetchRosterData}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-xs transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={downloadExcel}
                        disabled={filteredEmployees.length === 0}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium text-xs transition-colors ${filteredEmployees.length === 0
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                    >
                        <Download size={12} />
                        Export
                    </button>
                </div>
            </div>

            {/* Status Legend */}
            <div className="bg-white  border border-gray-200 p-2 mb-3">
                <div className="flex flex-wrap gap-3">
                    <span className="text-[11px] font-medium text-gray-700">Shift Types:</span>
                    {Object.entries(SHIFT_CONFIG).map(([key, config]) => (
                        <div key={key} className="flex items-center gap-1">
                            <div className={`w-3 h-3 rounded ${config.bgColor} border`}></div>
                            <span className="text-[10px] text-gray-600">{key}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white  border border-gray-200 p-2 mb-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Search Employee</label>
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Filter by Department</label>
                        <div className="relative">
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="w-full appearance-none pl-2 pr-6 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white font-medium text-gray-700"
                            >
                                <option value="ALL">All Departments</option>
                                {departments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                            <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5 text-center">Week</label>
                        <div className="flex items-center justify-center gap-1">
                            <button
                                onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs font-semibold text-gray-800 min-w-[100px] text-center">
                                {formatDate(currentWeekStart, 'dd MMM')} - {formatDate(addDays(currentWeekStart, 6), 'dd MMM yyyy')}
                            </span>
                            <button
                                onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                                <ChevronRight size={14} />
                            </button>
                            <button
                                onClick={() => setCurrentWeekStart(startOfWeek(new Date()))}
                                className="ml-1 px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                                Today
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Roster Table */}
            <div className="bg-white  border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                    <table className="w-full text-xs relative border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th className="sticky top-0 left-0 bg-gray-50 px-2 py-1.5 font-medium text-gray-600 text-[10px] z-30 w-[170px] border-r">
                                    Employee
                                </th>
                                {weekDays.map((day, index) => {
                                    const stats = getDayStats(day);
                                    const isToday = isSameDay(day, today);
                                    return (
                                        <th
                                            key={index}
                                            className={`sticky top-0 bg-gray-50 px-0.5 py-1.5 font-medium text-center text-[10px] min-w-[100px] z-10 ${isToday ? 'bg-blue-50' : ''
                                                } ${day.getDay() === 0 ? 'text-red-600' : 'text-gray-700'}`}
                                        >
                                            <div className="font-semibold">{formatDate(day, 'EEE')}</div>
                                            <div className={`text-sm font-semibold ${isToday ? 'text-blue-600' : ''}`}>
                                                {formatDate(day, 'dd')}
                                            </div>
                                            <div className="text-[8px] font-normal text-gray-400 mt-0.5">
                                                {stats.total > 0 && (
                                                    <>
                                                        <span className="text-green-600">{stats.assigned}</span>
                                                        <span className="mx-0.5">/</span>
                                                        <span className="text-red-600">{stats.holiday}</span>
                                                    </>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-6">
                                        <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                                            <Loader2 size={16} className="text-indigo-600 animate-spin" />
                                            Loading roster data...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredEmployees.length > 0 ? (
                                filteredEmployees.map((employee) => (
                                    <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="sticky left-0 bg-white hover:bg-gray-50 z-10 px-2 py-1.5 border-r">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-semibold">
                                                    {employee.name_as_per_aadhar?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-gray-800">{employee.name_as_per_aadhar}</p>
                                                    <p className="text-[9px] text-gray-500">{employee.employee_id}</p>
                                                    <p className="text-[8px] text-gray-400">{employee.designation}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                            const schedule = getEmployeeRosterForDay(employee.employee_id, day);
                                            const isPast = day < new Date() && !isSameDay(day, new Date());
                                            const config = SHIFT_CONFIG[schedule.shift_type] || SHIFT_CONFIG['Not Assigned'];

                                            return (
                                                <td
                                                    key={dayIndex}
                                                    className={`px-0.5 py-1 text-center cursor-pointer transition-all hover:opacity-80 ${day.getDay() === 0 ? 'bg-gray-50' : ''
                                                        } ${isPast ? 'opacity-60' : ''}`}
                                                    onClick={() => !isPast && handleOpenSlidePanel(employee, day)}
                                                >
                                                    <div className="inline-flex items-center justify-center px-1 text-[15px] font-medium border border-transparent hover:scale-120 transition-transform">
                                                        <span className={`px-1.5 py-0.5 h-[4vh] w-[7vw] border border-gray-100 ${config.color} ${config.bgColor}`}>
                                                            {config.label}
                                                        </span>
                                                    </div>
                                                    {schedule.shift_type !== 'Not Assigned' && schedule.shift_type !== 'Holiday' && (
                                                        <div className="text-[8px] text-gray-400 mt-0.5">
                                                            {schedule.start_time} - {schedule.end_time}
                                                        </div>
                                                    )}
                                                    {schedule.remark && (
                                                        <div className="text-[7px] text-gray-400 mt-0.5 truncate max-w-[80px] mx-auto">
                                                            {schedule.remark}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="text-center py-8">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <Users size={32} className="mb-2" />
                                            <p className="text-xs font-medium">No employees found</p>
                                            <p className="text-[10px] mt-1">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-white  border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                        <Users size={14} className="text-indigo-500" />
                        <div className="text-[10px] text-gray-500">Total Employees</div>
                    </div>
                    <div className="text-lg font-bold text-gray-800 mt-1">{employees.length}</div>
                </div>
                <div className="bg-white  border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" />
                        <div className="text-[10px] text-gray-500">Assigned This Week</div>
                    </div>
                    <div className="text-lg font-bold text-green-600 mt-1">
                        {weekDays.reduce((acc, day) => {
                            const stats = getDayStats(day);
                            return acc + stats.assigned;
                        }, 0)}
                    </div>
                </div>
                <div className="bg-white  border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-red-500" />
                        <div className="text-[10px] text-gray-500">Holidays This Week</div>
                    </div>
                    <div className="text-lg font-bold text-red-600 mt-1">
                        {weekDays.reduce((acc, day) => {
                            const stats = getDayStats(day);
                            return acc + stats.holiday;
                        }, 0)}
                    </div>
                </div>
                <div className="bg-white  border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                        <Clock size={14} className="text-gray-500" />
                        <div className="text-[10px] text-gray-500">Unassigned This Week</div>
                    </div>
                    <div className="text-lg font-bold text-gray-600 mt-1">
                        {weekDays.reduce((acc, day) => {
                            const stats = getDayStats(day);
                            const totalEmployees = employees.length;
                            return acc + (totalEmployees - stats.total);
                        }, 0)}
                    </div>
                </div>
            </div>

            {/* Assign Shift Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAssignModal(false)}>
                    <div className="bg-white max-w-md w-full shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                <ClockIcon size={16} className="text-indigo-600" />
                                Assign Shift
                            </h3>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="p-1 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {selectedEmployee && (
                            <div className="p-4 border-b bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                        {selectedEmployee.name_as_per_aadhar?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-800">{selectedEmployee.name_as_per_aadhar}</div>
                                        <div className="text-[10px] text-gray-500">{selectedEmployee.designation} • {selectedEmployee.employee_id}</div>
                                        <div className="text-[10px] text-gray-500">Date: {selectedDate ? formatDate(selectedDate, 'dd MMM yyyy') : ''}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <form onSubmit={(e) => { e.preventDefault(); handleAssignShift(); }} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Shift Type</label>
                                <select
                                    value={assignForm.shift_type}
                                    onChange={(e) => setAssignForm({ ...assignForm, shift_type: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                                >
                                    <option value="General Shift">General Shift (10:00 - 18:30)</option>
                                    <option value="Day Off">Day Off</option>
                                    <option value="Holiday">Holiday</option>
                                    <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                                    <option value="Evening Shift">Evening Shift (14:00 - 22:00)</option>
                                    <option value="Night Shift">Night Shift (22:00 - 06:00)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Start Time</label>
                                    <input
                                        type="time"
                                        value={assignForm.start_time}
                                        onChange={(e) => setAssignForm({ ...assignForm, start_time: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        disabled={assignForm.shift_type === 'Day Off' || assignForm.shift_type === 'Holiday'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">End Time</label>
                                    <input
                                        type="time"
                                        value={assignForm.end_time}
                                        onChange={(e) => setAssignForm({ ...assignForm, end_time: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        disabled={assignForm.shift_type === 'Day Off' || assignForm.shift_type === 'Holiday'}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Remark (Optional)</label>
                                <input
                                    type="text"
                                    value={assignForm.remark}
                                    onChange={(e) => setAssignForm({ ...assignForm, remark: e.target.value })}
                                    placeholder="Add a remark..."
                                    className="w-full px-3 py-2 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50  transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700  transition-colors shadow-sm"
                                >
                                    Save Shift
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Assign Shift Modal */}
            {showBulkAssignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkAssignModal(false)}>
                    <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50 sticky top-0 z-10">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                <Plus size={16} className="text-emerald-600" />
                                Bulk Assign Shifts
                            </h3>
                            <button
                                onClick={() => setShowBulkAssignModal(false)}
                                className="p-1 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleBulkAssignShift(); }} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Select Employee *</label>
                                <select
                                    value={bulkAssignForm.employee_id}
                                    onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, employee_id: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                                    required
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.employee_id}>
                                            {emp.name_as_per_aadhar} - {emp.designation} ({emp.employee_id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Start Date *</label>
                                    <input
                                        type="date"
                                        value={bulkAssignForm.start_date}
                                        onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, start_date: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">End Date *</label>
                                    <input
                                        type="date"
                                        value={bulkAssignForm.end_date}
                                        onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, end_date: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Shift Type</label>
                                <select
                                    value={bulkAssignForm.shift_type}
                                    onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, shift_type: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                                >
                                    <option value="General Shift">General Shift (10:00 - 18:30)</option>
                                    <option value="Day Off">Day Off</option>
                                    <option value="Holiday">Holiday</option>
                                    <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                                    <option value="Evening Shift">Evening Shift (14:00 - 22:00)</option>
                                    <option value="Night Shift">Night Shift (22:00 - 06:00)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Start Time</label>
                                    <input
                                        type="time"
                                        value={bulkAssignForm.start_time}
                                        onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, start_time: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        disabled={bulkAssignForm.shift_type === 'Day Off' || bulkAssignForm.shift_type === 'Holiday'}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">End Time</label>
                                    <input
                                        type="time"
                                        value={bulkAssignForm.end_time}
                                        onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, end_time: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        disabled={bulkAssignForm.shift_type === 'Day Off' || bulkAssignForm.shift_type === 'Holiday'}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Remark (Optional)</label>
                                <input
                                    type="text"
                                    value={bulkAssignForm.remark}
                                    onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, remark: e.target.value })}
                                    placeholder="Add a remark..."
                                    className="w-full px-3 py-2 text-xs border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Apply to these days:</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                                        <label key={day} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={bulkAssignForm.days_of_week[day]}
                                                onChange={(e) => setBulkAssignForm({
                                                    ...bulkAssignForm,
                                                    days_of_week: {
                                                        ...bulkAssignForm.days_of_week,
                                                        [day]: e.target.checked
                                                    }
                                                })}
                                                className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                            />
                                            <span className="capitalize">{day.slice(0, 3)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkAssignModal(false)}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50  transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700  transition-colors shadow-sm"
                                >
                                    Assign Bulk Shifts
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Slide Panel - Right to Left */}
            <div className={`fixed inset-0 overflow-hidden z-50 ${isSlidePanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <div
                    className={`absolute inset-0 bg-black transition-opacity duration-300 ${isSlidePanelOpen ? 'opacity-50' : 'opacity-0'}`}
                    onClick={() => {
                        setIsSlidePanelOpen(false);
                        setSelectedEmployee(null);
                    }}
                />

                <div className={`absolute inset-y-0 right-0 max-w-3xl w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${isSlidePanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    {selectedEmployee && (
                        <div className="h-full flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                        {selectedEmployee.name_as_per_aadhar?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-base text-gray-900">{selectedEmployee.name_as_per_aadhar}</h3>
                                        <p className="text-xs text-gray-500">ID: {selectedEmployee.employee_id}</p>
                                        <p className="text-xs text-gray-500">{selectedEmployee.designation}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsSlidePanelOpen(false);
                                        setSelectedEmployee(null);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="bg-white  border border-gray-200 p-6 space-y-6">
                                    <h3 className="text-lg font-medium text-gray-900 pb-2 border-b border-gray-100">
                                        Shift Details
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
                                            <div className="px-3 py-2 text-sm bg-gray-50 rounded border border-gray-200 text-gray-700">
                                                {selectedDate ? formatDate(selectedDate, 'dd MMM yyyy') : ''}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Shift Type</label>
                                            <select
                                                value={assignForm.shift_type}
                                                onChange={(e) => setAssignForm({ ...assignForm, shift_type: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="General Shift">General Shift (10:00 - 18:30)</option>
                                                <option value="Day Off">Day Off</option>
                                                <option value="Holiday">Holiday</option>
                                                <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                                                <option value="Evening Shift">Evening Shift (14:00 - 22:00)</option>
                                                <option value="Night Shift">Night Shift (22:00 - 06:00)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Start Time</label>
                                            <input
                                                type="time"
                                                value={assignForm.start_time}
                                                onChange={(e) => setAssignForm({ ...assignForm, start_time: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                disabled={assignForm.shift_type === 'Day Off' || assignForm.shift_type === 'Holiday'}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">End Time</label>
                                            <input
                                                type="time"
                                                value={assignForm.end_time}
                                                onChange={(e) => setAssignForm({ ...assignForm, end_time: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                disabled={assignForm.shift_type === 'Day Off' || assignForm.shift_type === 'Holiday'}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Remark</label>
                                            <input
                                                type="text"
                                                value={assignForm.remark}
                                                onChange={(e) => setAssignForm({ ...assignForm, remark: e.target.value })}
                                                placeholder="Add a remark..."
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Current Shift Info */}
                                    {selectedEmployee.roster && (
                                        <div className="bg-slate-50  p-4 border border-slate-100">
                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Current Shift Details</h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                                                    <span className="text-gray-500">Shift Type</span>
                                                    <span className="font-semibold text-gray-800">{selectedEmployee.roster.shift_type}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                                                    <span className="text-gray-500">Time</span>
                                                    <span className="font-semibold text-gray-800">
                                                        {selectedEmployee.roster.start_time} - {selectedEmployee.roster.end_time}
                                                    </span>
                                                </div>
                                                {selectedEmployee.roster.remark && (
                                                    <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                                                        <span className="text-gray-500">Remark</span>
                                                        <span className="font-semibold text-gray-800">{selectedEmployee.roster.remark}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                                <button
                                    onClick={() => handleDeleteRoster(selectedEmployee.employee_id, selectedDate)}
                                    className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50  transition-colors border border-red-300"
                                >
                                    Delete Shift
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setIsSlidePanelOpen(false);
                                            setSelectedEmployee(null);
                                        }}
                                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50  transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAssignShift}
                                        className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700  transition-colors shadow-sm flex items-center gap-1.5"
                                    >
                                        <CheckCircle size={14} />
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Roster;