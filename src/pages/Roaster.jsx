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
    Clock as ClockIcon,
    LayoutGrid,
    CalendarRange,
    Trash2
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

const Roster = () => {
    const [viewMode, setViewMode] = useState('weekly'); // 'weekly' or 'range'
    const [employees, setEmployees] = useState([]);
    const [rosterData, setRosterData] = useState(new Map());
    const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date()));
    const [dateRange, setDateRange] = useState({
        fromDate: new Date(),
        toDate: addDays(new Date(), 6)
    });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const ROWS_PER_PAGE = 15;
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
    const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);
    const [isEditSlidePanelOpen, setIsEditSlidePanelOpen] = useState(false);
    const [editSlideForm, setEditSlideForm] = useState({
        employee_id: '',
        employee_name: '',
        start_date: '',
        end_date: '',
        shift_type: 'General Shift',
        start_time: '09:30',
        end_time: '19:30',
        remark: ''
    });
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [assignForm, setAssignForm] = useState({
        employee_id: '',
        date: '',
        shift_type: 'General Shift',
        start_time: '09:30',
        end_time: '19:30',
        remark: ''
    });
    const [bulkAssignForm, setBulkAssignForm] = useState({
        employee_id: '',
        start_date: '',
        end_date: '',
        shift_type: 'General Shift',
        start_time: '09:30',
        end_time: '19:30',
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

    const [customShifts, setCustomShifts] = useState([]);
    const [showManageShiftsModal, setShowManageShiftsModal] = useState(false);

    const [editingShiftId, setEditingShiftId] = useState(null);
    const [shiftForm, setShiftForm] = useState({
        shift_name: '',
        start_time: '',
        end_time: '',
        label: '',
        color_preset: 'Slate/Gray'
    });

    const COLOR_PRESETS = [
        { name: 'Green', color: 'bg-green-100 text-green-700', bg_color: 'bg-green-200' },
        { name: 'Blue', color: 'bg-blue-100 text-blue-700', bg_color: 'bg-blue-200' },
        { name: 'Purple', color: 'bg-purple-100 text-purple-700', bg_color: 'bg-purple-200' },
        { name: 'Indigo', color: 'bg-indigo-100 text-indigo-700', bg_color: 'bg-indigo-200' },
        { name: 'Red', color: 'bg-red-100 text-red-700', bg_color: 'bg-red-200' },
        { name: 'Orange', color: 'bg-orange-100 text-orange-700', bg_color: 'bg-orange-200' },
        { name: 'Amber', color: 'bg-amber-100 text-amber-700', bg_color: 'bg-amber-200' },
        { name: 'Teal', color: 'bg-teal-100 text-teal-700', bg_color: 'bg-teal-200' },
        { name: 'Rose', color: 'bg-rose-100 text-rose-700', bg_color: 'bg-rose-200' },
        { name: 'Slate/Gray', color: 'bg-gray-100 text-gray-700', bg_color: 'bg-gray-200' }
    ];

    const handleSaveShift = async (e) => {
        e.preventDefault();
        try {
            if (!shiftForm.shift_name || !shiftForm.label) {
                toast.error('Shift Name and Shorthand Label are required');
                return;
            }

            const preset = COLOR_PRESETS.find(p => p.name === shiftForm.color_preset) || COLOR_PRESETS[0];

            const payload = {
                shift_name: shiftForm.shift_name,
                label: shiftForm.label,
                start_time: shiftForm.start_time || null,
                end_time: shiftForm.end_time || null,
                color: preset.color,
                bg_color: preset.bg_color
            };

            if (editingShiftId) {
                const { error } = await supabase
                    .from('custom_shift')
                    .update(payload)
                    .eq('id', editingShiftId);

                if (error) throw error;
                toast.success('Shift updated successfully');
            } else {
                const { error } = await supabase
                    .from('custom_shift')
                    .insert(payload);

                if (error) throw error;
                toast.success('Shift created successfully');
            }

            resetShiftForm();
            await fetchCustomShifts();
        } catch (error) {
            console.error('Error saving custom shift:', error);
            toast.error(error.message || 'Failed to save shift');
        }
    };

    const handleDeleteCustomShift = async (id, shiftName) => {
        if (shiftName === 'General Shift' || shiftName === 'Day Off' || shiftName === 'Holiday') {
            toast.error('Standard system shifts cannot be deleted');
            return;
        }

        if (!confirm(`Are you sure you want to delete the shift "${shiftName}"?`)) return;

        try {
            const { error } = await supabase
                .from('custom_shift')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Shift deleted successfully');
            await fetchCustomShifts();

            if (editingShiftId === id) {
                resetShiftForm();
            }
        } catch (error) {
            console.error('Error deleting custom shift:', error);
            toast.error('Failed to delete shift');
        }
    };

    const handleEditClick = (shift) => {
        const preset = COLOR_PRESETS.find(p => p.color === shift.color) || COLOR_PRESETS[0];
        setEditingShiftId(shift.id);
        setShiftForm({
            shift_name: shift.shift_name,
            start_time: shift.start_time ? shift.start_time.slice(0, 5) : '',
            end_time: shift.end_time ? shift.end_time.slice(0, 5) : '',
            label: shift.label,
            color_preset: preset.name
        });
    };

    const resetShiftForm = () => {
        setEditingShiftId(null);
        setShiftForm({
            shift_name: '',
            start_time: '',
            end_time: '',
            label: '',
            color_preset: 'Slate/Gray'
        });
    };

    const fetchCustomShifts = async () => {
        try {
            const { data, error } = await supabase
                .from('custom_shift')
                .select('*')
                .order('id');
            if (error) throw error;
            setCustomShifts(data || []);
        } catch (error) {
            console.error('Error fetching custom shifts:', error);
            toast.error('Failed to fetch custom shifts');
        }
    };

    const getShiftConfig = (shiftType) => {
        const found = customShifts.find(s => s.shift_name === shiftType);
        if (found) {
            return {
                color: found.color,
                label: found.label,
                bgColor: found.bg_color,
                start_time: found.start_time,
                end_time: found.end_time
            };
        }

        if (shiftType === 'Not Assigned') {
            return { color: 'bg-red-200 text-black', label: '+', bgColor: 'bg-gray-50' };
        }
        if (shiftType === 'Day Off') {
            return { color: 'bg-gray-100 text-gray-700', label: 'DO', bgColor: 'bg-gray-200' };
        }
        if (shiftType === 'Holiday') {
            return { color: 'bg-red-100 text-red-700 ', label: 'Hol', bgColor: 'bg-red-200' };
        }
        if (shiftType === 'General Shift') {
            return { color: 'bg-green-100 text-green-700', label: 'GS', bgColor: 'bg-green-200' };
        }
        if (shiftType === 'Morning Shift') {
            return { color: 'bg-blue-100 text-blue-700', label: 'MS', bgColor: 'bg-blue-200' };
        }
        if (shiftType === 'Evening Shift') {
            return { color: 'bg-purple-100 text-purple-700', label: 'ES', bgColor: 'bg-purple-200' };
        }
        if (shiftType === 'Night Shift') {
            return { color: 'bg-indigo-100 text-indigo-700', label: 'NS', bgColor: 'bg-indigo-200' };
        }

        return { color: 'bg-indigo-100 text-indigo-700', label: shiftType?.slice(0, 3).toUpperCase() || 'S', bgColor: 'bg-indigo-200' };
    };

    // Fetch employees and custom shifts
    useEffect(() => {
        fetchEmployees();
        fetchCustomShifts();
    }, []);

    // Fetch roster data when week or date range changes
    useEffect(() => {
        if (employees.length > 0) {
            fetchRosterData();
        }
    }, [currentWeekStart, dateRange, viewMode, employees]);

    // Reset to page 1 whenever search / department filter / view changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedDepartment, viewMode]);

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
            let fromDate, toDate;

            if (viewMode === 'weekly') {
                fromDate = formatDate(currentWeekStart, 'yyyy-MM-dd');
                toDate = formatDate(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
            } else {
                fromDate = formatDate(dateRange.fromDate, 'yyyy-MM-dd');
                toDate = formatDate(dateRange.toDate, 'yyyy-MM-dd');
            }

            const { data, error } = await supabase
                .from('shift_roster')
                .select('*')
                .gte('date', fromDate)
                .lte('date', toDate);

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

    const getDisplayDays = () => {
        if (viewMode === 'weekly') {
            const days = [];
            for (let i = 0; i < 7; i++) {
                days.push(addDays(currentWeekStart, i));
            }
            return days;
        } else {
            const days = [];
            let currentDate = new Date(dateRange.fromDate);
            while (currentDate <= dateRange.toDate) {
                days.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }
            return days;
        }
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

        return {
            date,
            shift_type: 'Not Assigned',
            start_time: '',
            end_time: '',
            remark: '',
            isHoliday: false
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
            start_time: '09:30',
            end_time: '19:30',
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
            start_time: '09:30',
            end_time: '19:30',
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
            start_time: existing?.start_time || '09:30',
            end_time: existing?.end_time || '19:30',
            remark: existing?.remark || ''
        });
        setIsSlidePanelOpen(true);
    };

    const handleOpenEditSlidePanel = (employee) => {
        let startDate, endDate;
        if (viewMode === 'weekly') {
            startDate = currentWeekStart;
            endDate = addDays(currentWeekStart, 6);
        } else {
            startDate = dateRange.fromDate;
            endDate = dateRange.toDate;
        }

        setEditSlideForm({
            employee_id: employee.employee_id,
            employee_name: employee.name_as_per_aadhar || employee.name || '',
            start_date: formatDate(startDate, 'yyyy-MM-dd'),
            end_date: formatDate(endDate, 'yyyy-MM-dd'),
            shift_type: 'General Shift',
            start_time: '09:30',
            end_time: '19:30',
            remark: ''
        });
        setIsEditSlidePanelOpen(true);
    };

    // Delete all roster entries for an employee between firstAssigned and lastAssigned dates
    const handleDeleteRosterRange = async (employee, firstAssigned, lastAssigned) => {
        if (!firstAssigned) {
            toast.error('No shifts assigned for this employee in the current period.');
            return;
        }

        const startStr = formatDate(firstAssigned, 'yyyy-MM-dd');
        const endStr = lastAssigned ? formatDate(lastAssigned, 'yyyy-MM-dd') : startStr;

        const confirmed = window.confirm(
            `Delete ALL roster entries for ${employee.name_as_per_aadhar || employee.employee_id}\nfrom ${startStr} to ${endStr}?\n\nThis action cannot be undone.`
        );
        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('shift_roster')
                .delete()
                .eq('employee_id', employee.employee_id)
                .gte('date', startStr)
                .lte('date', endStr);

            if (error) throw error;

            toast.success(`Deleted roster for ${employee.name_as_per_aadhar || employee.employee_id} (${startStr} → ${endStr})`);
            await fetchRosterData();
        } catch (err) {
            console.error('Error deleting roster range:', err);
            toast.error('Failed to delete roster entries. Please try again.');
        }
    };

    const handleSaveEditSlideRoster = async () => {
        try {
            if (!editSlideForm.employee_id || !editSlideForm.start_date || !editSlideForm.end_date) {
                toast.error('Please select start date, end date and shift type');
                return;
            }

            const startDate = new Date(editSlideForm.start_date);
            const endDate = new Date(editSlideForm.end_date);

            if (endDate < startDate) {
                toast.error('End date cannot be before start date');
                return;
            }

            const shiftsToInsert = [];
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const dateStr = formatDate(currentDate, 'yyyy-MM-dd');
                shiftsToInsert.push({
                    employee_id: editSlideForm.employee_id,
                    date: dateStr,
                    shift_type: editSlideForm.shift_type,
                    start_time: editSlideForm.start_time,
                    end_time: editSlideForm.end_time,
                    remark: editSlideForm.remark
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }

            const { error } = await supabase
                .from('shift_roster')
                .upsert(shiftsToInsert, {
                    onConflict: 'employee_id,date'
                });

            if (error) throw error;

            toast.success(`Successfully assigned shifts to ${editSlideForm.employee_name}`);
            setIsEditSlidePanelOpen(false);
            await fetchRosterData();
        } catch (error) {
            console.error('Error assigning weekly range shifts:', error);
            toast.error('Failed to assign shifts');
        }
    };

    const handleOpenBulkAssignModal = () => {
        let startDate, endDate;
        if (viewMode === 'weekly') {
            startDate = currentWeekStart;
            endDate = addDays(currentWeekStart, 6);
        } else {
            startDate = dateRange.fromDate;
            endDate = dateRange.toDate;
        }

        setBulkAssignForm({
            ...bulkAssignForm,
            start_date: formatDate(startDate, 'yyyy-MM-dd'),
            end_date: formatDate(endDate, 'yyyy-MM-dd')
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
        const displayDays = getDisplayDays();
        const exportData = [];

        filteredEmployees.forEach(employee => {
            displayDays.forEach(day => {
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

        let fileName;
        if (viewMode === 'weekly') {
            fileName = `shift_roster_${formatDate(currentWeekStart, 'yyyy-MM-dd')}.xlsx`;
        } else {
            fileName = `shift_roster_${formatDate(dateRange.fromDate, 'yyyy-MM-dd')}_to_${formatDate(dateRange.toDate, 'yyyy-MM-dd')}.xlsx`;
        }
        XLSX.writeFile(workbook, fileName);
    };

    const displayDays = getDisplayDays();
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

    // Reset to page 1 when filters or view changes
    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / ROWS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const pagedEmployees = filteredEmployees.slice(
        (safeCurrentPage - 1) * ROWS_PER_PAGE,
        safeCurrentPage * ROWS_PER_PAGE
    );

    // Pagination helpers
    const handlePageChange = (page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));

    // Pagination controls component (rendered below each table)
    const PaginationBar = () => (
        filteredEmployees.length > ROWS_PER_PAGE ? (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50 text-[10px] text-gray-500">
                <span>{filteredEmployees.length} employees &bull; Page {safeCurrentPage} of {totalPages}</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => handlePageChange(safeCurrentPage - 1)}
                        disabled={safeCurrentPage === 1}
                        className="px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                    >
                        &#8249; Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                        .reduce((acc, p, idx, arr) => {
                            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                            acc.push(p);
                            return acc;
                        }, [])
                        .map((p, idx) =>
                            p === '...' ? (
                                <span key={`ellipsis-${idx}`} className="px-1">…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => handlePageChange(p)}
                                    className={`px-2 py-0.5 rounded border font-semibold transition-colors ${p === safeCurrentPage
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'border-gray-200 hover:bg-gray-100'
                                        }`}
                                >
                                    {p}
                                </button>
                            )
                        )
                    }
                    <button
                        onClick={() => handlePageChange(safeCurrentPage + 1)}
                        disabled={safeCurrentPage === totalPages}
                        className="px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                    >
                        Next &#8250;
                    </button>
                </div>
            </div>
        ) : null
    );

    // Handle date range change
    const handleDateRangeChange = (type, value) => {
        const newFromDate = type === 'from' ? new Date(value) : dateRange.fromDate;
        const newToDate = type === 'to' ? new Date(value) : dateRange.toDate;

        if (newFromDate > newToDate) {
            toast.error('From date cannot be after to date');
            return;
        }

        setDateRange({
            fromDate: newFromDate,
            toDate: newToDate
        });
    };

    // Quick range presets
    const setQuickRange = (days) => {
        const fromDate = new Date();
        const toDate = addDays(fromDate, days - 1);
        setDateRange({ fromDate, toDate });
    };

    return (
        <div className="p-3 pl-7 pr-5 pd-0">
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <Calendar size={18} />
                        Shift Roster
                    </h1>
                    <p className="text-gray-500 text-[11px] mt-0.5">
                        Manage employee shifts and schedules
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowManageShiftsModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded font-medium text-xs transition-colors"
                    >
                        <Database size={12} />
                        Manage Shifts
                    </button>
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

            {/* View Mode Tabs */}
            <div className="flex items-center gap-2 mb-3">
                <button
                    onClick={() => setViewMode('weekly')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${viewMode === 'weekly'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <LayoutGrid size={14} />
                    Roster View
                </button>
                <button
                    onClick={() => setViewMode('range')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${viewMode === 'range'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <CalendarRange size={14} />
                    Date Range View
                </button>
            </div>

            {/* Status Legend */}
            {/* <div className="bg-white border border-gray-200 p-2 mb-3 rounded-sm">
                <div className="flex flex-wrap gap-3 items-center">
                    <span className="text-[11px] font-semibold text-gray-700">Shift Types:</span>
                    {customShifts.map((shift) => (
                        <div key={shift.shift_name} className="flex items-center gap-1">
                            <div className={`w-3 h-3 rounded-full ${shift.bg_color || 'bg-gray-200'} border border-gray-300`}></div>
                            <span className="text-[10px] text-gray-600 font-medium">
                                {shift.shift_name}
                                {shift.start_time ? ` (${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)})` : ''}
                            </span>
                        </div>
                    ))}
                    {!customShifts.some(s => s.shift_name === 'Not Assigned') && (
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-gray-50 border border-gray-300"></div>
                            <span className="text-[10px] text-gray-600 font-medium">Not Assigned</span>
                        </div>
                    )}
                </div>
            </div> */}

            {/* Filters */}
            <div className="bg-white  p-2 mb-3">
                {viewMode === 'weekly' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">From Date</label>
                            <input
                                type="date"
                                value={formatDate(dateRange.fromDate, 'yyyy-MM-dd')}
                                onChange={(e) => handleDateRangeChange('from', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">To Date</label>
                            <input
                                type="date"
                                value={formatDate(dateRange.toDate, 'yyyy-MM-dd')}
                                onChange={(e) => handleDateRangeChange('to', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                        </div>

                        <div className="md:col-span-4">
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                <span className="text-[10px] font-medium text-gray-500">Quick Ranges:</span>
                                <button
                                    onClick={() => setQuickRange(7)}
                                    className="px-2 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                >
                                    Week
                                </button>
                                <button
                                    onClick={() => setQuickRange(14)}
                                    className="px-2 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                >
                                    Fortnight
                                </button>
                                <button
                                    onClick={() => setQuickRange(30)}
                                    className="px-2 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                >
                                    Month
                                </button>
                                <button
                                    onClick={() => setQuickRange(1)}
                                    className="px-2 py-0.5 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                                >
                                    Today
                                </button>
                                <span className="text-[10px] text-gray-400 ml-auto">
                                    {displayDays.length} days • {formatDate(dateRange.fromDate, 'dd MMM yyyy')} - {formatDate(dateRange.toDate, 'dd MMM yyyy')}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Roster Table - Weekly View */}
            {viewMode === 'weekly' ? (
                <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto max-h-[67vh]">
                        <table className="w-full text-xs relative border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
                                <tr>
                                    <th className="sticky top-0 left-0 bg-gray-50 px-3 py-2 font-medium text-gray-600 text-[10px] z-30 w-[200px] border-r border-gray-200">
                                        Employee
                                    </th>
                                    <th className="sticky top-0 bg-gray-50 px-3 py-2 font-medium text-gray-600 text-[10px] z-10 w-[120px] text-center">
                                        Start Date
                                    </th>
                                    <th className="sticky top-0 bg-gray-50 px-3 py-2 font-medium text-gray-600 text-[10px] z-10 w-[120px] text-center">
                                        End Date
                                    </th>
                                    <th className="sticky top-0 bg-gray-50 px-3 py-2 font-medium text-gray-600 text-[10px] z-10 w-[180px] text-center">
                                        Assigned Shift
                                    </th>
                                    <th className="sticky top-0 bg-gray-50 px-3 py-2 font-medium text-gray-600 text-[10px] z-10 w-[100px] text-center">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-6">
                                            <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                                                <Loader2 size={16} className="text-indigo-600 animate-spin" />
                                                Loading roster data...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredEmployees.length > 0 ? (
                                    pagedEmployees.map((employee) => {
                                        // Get all shifts for this employee in the week
                                        const weekDays = [];
                                        for (let i = 0; i < 7; i++) {
                                            const day = addDays(currentWeekStart, i);
                                            weekDays.push(day);
                                        }

                                        // Find first and last day with assigned shift
                                        let firstAssigned = null;
                                        let lastAssigned = null;
                                        let assignedShifts = [];

                                        weekDays.forEach(day => {
                                            const schedule = getEmployeeRosterForDay(employee.employee_id, day);
                                            if (schedule.shift_type !== 'Not Assigned') {
                                                if (!firstAssigned) {
                                                    firstAssigned = day;
                                                }
                                                lastAssigned = day;
                                                assignedShifts.push({ day, schedule });
                                            }
                                        });

                                        // Determine the shift to display
                                        let shiftDisplay = 'Not Assigned';
                                        let shiftTimes = '';
                                        let shiftColor = '';

                                        if (assignedShifts.length > 0) {
                                            // Get the most common shift or the first one
                                            const shiftTypes = assignedShifts.map(s => s.schedule.shift_type);
                                            const shiftCounts = shiftTypes.reduce((acc, shift) => {
                                                acc[shift] = (acc[shift] || 0) + 1;
                                                return acc;
                                            }, {});

                                            const mostCommonShift = Object.keys(shiftCounts).reduce((a, b) =>
                                                shiftCounts[a] > shiftCounts[b] ? a : b
                                            );

                                            shiftDisplay = mostCommonShift;
                                            const firstShift = assignedShifts.find(s => s.schedule.shift_type === mostCommonShift);
                                            if (firstShift && firstShift.schedule.start_time) {
                                                shiftTimes = `${firstShift.schedule.start_time.slice(0, 5)} - ${firstShift.schedule.end_time.slice(0, 5)}`;
                                            }
                                            const config = getShiftConfig(mostCommonShift);
                                            shiftColor = config.color;
                                        }

                                        const hasShift = assignedShifts.length > 0;
                                        const startDateDisplay = firstAssigned ? formatDate(firstAssigned, 'dd MMM yyyy') : '-';
                                        const endDateDisplay = lastAssigned ? formatDate(lastAssigned, 'dd MMM yyyy') : '-';

                                        return (
                                            <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="sticky left-0 bg-white hover:bg-gray-50 z-10 px-3 py-2 border-r border-gray-200">
                                                    <div className="flex items-center gap-2">
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
                                                <td className="px-3 py-2 text-center text-xs font-medium text-gray-700">
                                                    {startDateDisplay}
                                                </td>
                                                <td className="px-3 py-2 text-center text-xs font-medium text-gray-700">
                                                    {endDateDisplay}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {hasShift ? (
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className={`px-3 py-1 text-xs font-medium rounded ${shiftColor || 'bg-green-100 text-green-700'} border border-gray-100`}>
                                                                {shiftDisplay}
                                                            </span>
                                                            {shiftTimes && (
                                                                <span className="text-[9px] text-gray-500 mt-0.5">
                                                                    {shiftTimes}
                                                                </span>
                                                            )}
                                                            <span className="text-[8px] text-gray-400 mt-0.5">
                                                                {assignedShifts.length} day{assignedShifts.length > 1 ? 's' : ''} assigned
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => handleOpenEditSlidePanel(employee)}
                                                            title="Edit shift assignment"
                                                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-50"
                                                        >
                                                            Edit
                                                        </button>
                                                        {hasShift && (
                                                            <button
                                                                onClick={() => handleDeleteRosterRange(employee, firstAssigned, lastAssigned)}
                                                                title={`Delete roster from ${startDateDisplay} to ${endDateDisplay}`}
                                                                className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 transition-colors border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                                                            >
                                                                <Trash2 size={11} />
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8">
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
                    <PaginationBar />
                </div>
            ) : (
                /* Date Range View - Original Table with days as columns */
                <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto max-h-[80vh]">
                        <table className="w-full text-xs relative border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
                                <tr>
                                    <th className="sticky top-0 left-0 bg-gray-50 px-2 py-1.5 font-medium text-gray-600 text-[10px] z-30 w-[170px] border-r border-gray-200">
                                        Employee
                                    </th>
                                    {displayDays.map((day, index) => {
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
                                        <td colSpan={displayDays.length + 1} className="text-center py-6">
                                            <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                                                <Loader2 size={16} className="text-indigo-600 animate-spin" />
                                                Loading roster data...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredEmployees.length > 0 ? (
                                    pagedEmployees.map((employee) => (
                                        <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="sticky left-0 bg-white hover:bg-gray-50 z-10 px-2 py-1.5 border-r border-gray-200">
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
                                            {displayDays.map((day, dayIndex) => {
                                                const schedule = getEmployeeRosterForDay(employee.employee_id, day);
                                                const isPast = day < new Date() && !isSameDay(day, new Date());
                                                const config = getShiftConfig(schedule.shift_type);

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
                                                        {schedule.shift_type !== 'Not Assigned' && schedule.shift_type !== 'Holiday' && schedule.start_time && (
                                                            <div className="text-[8px] text-gray-400 mt-0.5">
                                                                {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
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
                                        <td colSpan={displayDays.length + 1} className="text-center py-8">
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
                    <PaginationBar />
                </div>
            )}



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
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const shift = customShifts.find(s => s.shift_name === val);
                                        setAssignForm({
                                            ...assignForm,
                                            shift_type: val,
                                            start_time: shift && shift.start_time ? shift.start_time.slice(0, 5) : '',
                                            end_time: shift && shift.end_time ? shift.end_time.slice(0, 5) : ''
                                        });
                                    }}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                                >
                                    {customShifts.map((shift) => (
                                        <option key={shift.id} value={shift.shift_name}>
                                            {shift.shift_name} {shift.start_time ? `(${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Start Time</label>
                                    <input
                                        type="time"
                                        value={assignForm.start_time}
                                        onChange={(e) => setAssignForm({ ...assignForm, start_time: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        disabled={(() => {
                                            const shift = customShifts.find(s => s.shift_name === assignForm.shift_type);
                                            return shift ? (!shift.start_time) : (assignForm.shift_type === 'Day Off' || assignForm.shift_type === 'Holiday');
                                        })()}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">End Time</label>
                                    <input
                                        type="time"
                                        value={assignForm.end_time}
                                        onChange={(e) => setAssignForm({ ...assignForm, end_time: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        disabled={(() => {
                                            const shift = customShifts.find(s => s.shift_name === assignForm.shift_type);
                                            return shift ? (!shift.start_time) : (assignForm.shift_type === 'Day Off' || assignForm.shift_type === 'Holiday');
                                        })()}
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
                                    className="w-full px-3 py-2 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
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
                                    className="w-full px-3 py-2 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
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
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">End Date *</label>
                                    <input
                                        type="date"
                                        value={bulkAssignForm.end_date}
                                        onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, end_date: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Shift Type</label>
                                <select
                                    value={bulkAssignForm.shift_type}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const shift = customShifts.find(s => s.shift_name === val);
                                        setBulkAssignForm({
                                            ...bulkAssignForm,
                                            shift_type: val,
                                            start_time: shift && shift.start_time ? shift.start_time.slice(0, 5) : '',
                                            end_time: shift && shift.end_time ? shift.end_time.slice(0, 5) : ''
                                        });
                                    }}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                                >
                                    {customShifts.map((shift) => (
                                        <option key={shift.id} value={shift.shift_name}>
                                            {shift.shift_name} {shift.start_time ? `(${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Start Time</label>
                                    <input
                                        type="time"
                                        value={bulkAssignForm.start_time}
                                        onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, start_time: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        disabled={(() => {
                                            const shift = customShifts.find(s => s.shift_name === bulkAssignForm.shift_type);
                                            return shift ? (!shift.start_time) : (bulkAssignForm.shift_type === 'Day Off' || bulkAssignForm.shift_type === 'Holiday');
                                        })()}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">End Time</label>
                                    <input
                                        type="time"
                                        value={bulkAssignForm.end_time}
                                        onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, end_time: e.target.value })}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                                        disabled={(() => {
                                            const shift = customShifts.find(s => s.shift_name === bulkAssignForm.shift_type);
                                            return shift ? (!shift.start_time) : (bulkAssignForm.shift_type === 'Day Off' || bulkAssignForm.shift_type === 'Holiday');
                                        })()}
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
                                    className="w-full px-3 py-2 text-xs border border-gray-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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
                                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
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
                                <div className="bg-white border border-gray-200 p-6 space-y-6">
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
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const shift = customShifts.find(s => s.shift_name === val);
                                                    setAssignForm({
                                                        ...assignForm,
                                                        shift_type: val,
                                                        start_time: shift && shift.start_time ? shift.start_time.slice(0, 5) : '',
                                                        end_time: shift && shift.end_time ? shift.end_time.slice(0, 5) : ''
                                                    });
                                                }}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                            >
                                                {customShifts.map((shift) => (
                                                    <option key={shift.id} value={shift.shift_name}>
                                                        {shift.shift_name} {shift.start_time ? `(${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Start Time</label>
                                            <input
                                                type="time"
                                                value={assignForm.start_time}
                                                onChange={(e) => setAssignForm({ ...assignForm, start_time: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                disabled={(() => {
                                                    const shift = customShifts.find(s => s.shift_name === assignForm.shift_type);
                                                    return shift ? (!shift.start_time) : (assignForm.shift_type === 'Day Off' || assignForm.shift_type === 'Holiday');
                                                })()}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">End Time</label>
                                            <input
                                                type="time"
                                                value={assignForm.end_time}
                                                onChange={(e) => setAssignForm({ ...assignForm, end_time: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                disabled={(() => {
                                                    const shift = customShifts.find(s => s.shift_name === assignForm.shift_type);
                                                    return shift ? (!shift.start_time) : (assignForm.shift_type === 'Day Off' || assignForm.shift_type === 'Holiday');
                                                })()}
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
                                        <div className="bg-slate-50 p-4 border border-slate-100">
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
                                    className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors border border-red-300"
                                >
                                    Delete Shift
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setIsSlidePanelOpen(false);
                                            setSelectedEmployee(null);
                                        }}
                                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAssignShift}
                                        className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
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

            {/* Slide Panel - Right to Left for Weekly Range Roster Edit */}
            <div className={`fixed inset-0 overflow-hidden z-50 ${isEditSlidePanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                <div
                    className={`absolute inset-0 bg-black transition-opacity duration-300 ${isEditSlidePanelOpen ? 'opacity-50' : 'opacity-0'}`}
                    onClick={() => {
                        setIsEditSlidePanelOpen(false);
                    }}
                />

                <div className={`absolute inset-y-0 right-0 max-w-3xl w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${isEditSlidePanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    {isEditSlidePanelOpen && (
                        <div className="h-full flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                        {editSlideForm.employee_name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-base text-gray-900">{editSlideForm.employee_name}</h3>
                                        <p className="text-xs text-gray-500">ID: {editSlideForm.employee_id}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsEditSlidePanelOpen(false);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="bg-white border border-gray-200 p-6 space-y-6">
                                    <h3 className="text-lg font-medium text-gray-900 pb-2 border-b border-gray-100">
                                        Assign Shift Range
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Start Date</label>
                                            <input
                                                type="date"
                                                value={editSlideForm.start_date}
                                                onChange={(e) => setEditSlideForm({ ...editSlideForm, start_date: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">End Date</label>
                                            <input
                                                type="date"
                                                value={editSlideForm.end_date}
                                                onChange={(e) => setEditSlideForm({ ...editSlideForm, end_date: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Shift Type</label>
                                            <select
                                                value={editSlideForm.shift_type}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const shift = customShifts.find(s => s.shift_name === val);
                                                    setEditSlideForm({
                                                        ...editSlideForm,
                                                        shift_type: val,
                                                        start_time: shift && shift.start_time ? shift.start_time.slice(0, 5) : '',
                                                        end_time: shift && shift.end_time ? shift.end_time.slice(0, 5) : ''
                                                    });
                                                }}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                            >
                                                {customShifts.map((shift) => (
                                                    <option key={shift.id} value={shift.shift_name}>
                                                        {shift.shift_name} {shift.start_time ? `(${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Start Time</label>
                                            <input
                                                type="time"
                                                value={editSlideForm.start_time}
                                                onChange={(e) => setEditSlideForm({ ...editSlideForm, start_time: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                disabled={(() => {
                                                    const shift = customShifts.find(s => s.shift_name === editSlideForm.shift_type);
                                                    return shift ? (!shift.start_time) : (editSlideForm.shift_type === 'Day Off' || editSlideForm.shift_type === 'Holiday');
                                                })()}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">End Time</label>
                                            <input
                                                type="time"
                                                value={editSlideForm.end_time}
                                                onChange={(e) => setEditSlideForm({ ...editSlideForm, end_time: e.target.value })}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                                disabled={(() => {
                                                    const shift = customShifts.find(s => s.shift_name === editSlideForm.shift_type);
                                                    return shift ? (!shift.start_time) : (editSlideForm.shift_type === 'Day Off' || editSlideForm.shift_type === 'Holiday');
                                                })()}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Remark</label>
                                            <input
                                                type="text"
                                                value={editSlideForm.remark}
                                                onChange={(e) => setEditSlideForm({ ...editSlideForm, remark: e.target.value })}
                                                placeholder="Add a remark..."
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end p-4 border-t bg-gray-50 gap-2">
                                <button
                                    onClick={() => {
                                        setIsEditSlidePanelOpen(false);
                                    }}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEditSlideRoster}
                                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                                >
                                    <CheckCircle size={14} />
                                    Assign Shift
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Manage Custom Shifts Modal */}
            {showManageShiftsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowManageShiftsModal(false); resetShiftForm(); }}>
                    <div className="bg-white max-w-4xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                    <Database size={16} className="text-slate-700" />
                                    Manage Custom Shifts
                                </h3>
                                <p className="text-[10px] text-gray-500 mt-0.5">Create, edit and delete shifts with custom times and styles</p>
                            </div>
                            <button
                                onClick={() => { setShowManageShiftsModal(false); resetShiftForm(); }}
                                className="p-1 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body - Two columns */}
                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                            {/* Left: Shift List */}
                            <div className="flex-1 p-4 overflow-y-auto border-r border-gray-100 bg-gray-50/30">
                                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1">
                                    <ClockIcon size={12} className="text-indigo-600" />
                                    Active Shifts ({customShifts.length})
                                </h4>
                                <div className="space-y-2">
                                    {customShifts.map((shift) => {
                                        const isSystem = ['General Shift', 'Day Off', 'Holiday'].includes(shift.shift_name);
                                        return (
                                            <div key={shift.id} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded hover:border-gray-300 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded ${shift.color} border border-gray-100 min-w-[36px] text-center`}>
                                                        {shift.label}
                                                    </span>
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-800">{shift.shift_name}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                            {shift.start_time ? `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}` : 'Non-timed (Day Off/Holiday)'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEditClick(shift)}
                                                        className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                        title="Edit Shift"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCustomShift(shift.id, shift.shift_name)}
                                                        className={`p-1 rounded transition-colors ${isSystem ? 'text-gray-300 cursor-not-allowed' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
                                                        disabled={isSystem}
                                                        title={isSystem ? 'System shifts cannot be deleted' : 'Delete Shift'}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right: Form */}
                            <div className="w-full md:w-80 p-5 bg-white flex flex-col justify-between overflow-y-auto">
                                <form onSubmit={handleSaveShift} className="space-y-4">
                                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider border-b pb-2">
                                        {editingShiftId ? 'Edit Shift Details' : 'Create Custom Shift'}
                                    </h4>

                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Shift Name *</label>
                                        <input
                                            type="text"
                                            value={shiftForm.shift_name}
                                            onChange={(e) => setShiftForm({ ...shiftForm, shift_name: e.target.value })}
                                            placeholder="e.g. Afternoon Shift"
                                            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Shorthand Label *</label>
                                            <input
                                                type="text"
                                                value={shiftForm.label}
                                                onChange={(e) => setShiftForm({ ...shiftForm, label: e.target.value.toUpperCase() })}
                                                placeholder="e.g. AS"
                                                maxLength={4}
                                                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-center font-bold"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Color Theme</label>
                                            <select
                                                value={shiftForm.color_preset}
                                                onChange={(e) => setShiftForm({ ...shiftForm, color_preset: e.target.value })}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                            >
                                                {COLOR_PRESETS.map((p) => (
                                                    <option key={p.name} value={p.name}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="p-2.5 bg-gray-50 rounded border border-gray-150 flex items-center justify-between">
                                        <span className="text-[10px] text-gray-500">Live Preview:</span>
                                        {(() => {
                                            const activePreset = COLOR_PRESETS.find(p => p.name === shiftForm.color_preset) || COLOR_PRESETS[0];
                                            return (
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded ${activePreset.color} border border-gray-200`}>
                                                    {shiftForm.label || 'PRE'}
                                                </span>
                                            );
                                        })()}
                                    </div>

                                    <div className="border-t pt-3 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Configure timings</span>
                                            <span className="text-[8px] text-gray-400">(leave blank for non-timed)</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wider">Start Time</label>
                                                <input
                                                    type="time"
                                                    value={shiftForm.start_time}
                                                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-gray-500 mb-0.5 uppercase tracking-wider">End Time</label>
                                                <input
                                                    type="time"
                                                    value={shiftForm.end_time}
                                                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-2 border-t justify-end">
                                        {editingShiftId && (
                                            <button
                                                type="button"
                                                onClick={resetShiftForm}
                                                className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors flex items-center gap-1.5"
                                        >
                                            <CheckCircle size={12} />
                                            {editingShiftId ? 'Update Shift' : 'Add Shift'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Roster;