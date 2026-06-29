import React, { useEffect, useState, useCallback } from 'react';
import { Search, Download, Calendar, Loader2, CheckCircle, X, Clock, Pencil, Filter, Users, User, Clock as ClockIcon, TrendingUp, Database, RefreshCw, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

const DEVICES = [
  { name: 'ALL DEVICES', serial: 'ALL', apiName: 'ALL' },
  { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
  { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
  { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
  { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
  { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' }
];

const JOINING_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch';

// IST Timezone offset (UTC+5:30)
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// Format to ISO string in its original timezone (no offset)
const formatToISTISOString = (timeStr) => {
  if (!timeStr || timeStr === '-') return null;
  if (timeStr instanceof Date) {
    const tzoffset = timeStr.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(timeStr.getTime() - tzoffset)).toISOString().slice(0, -1);
    return localISOTime;
  }

  let formatted = timeStr.trim().replace(' ', 'T');
  if (formatted.includes('+')) {
    formatted = formatted.split('+')[0];
  } else if (formatted.endsWith('Z')) {
    formatted = formatted.slice(0, -1);
  }

  const timeParts = formatted.split('T')[1] || '';
  if (timeParts.split(':').length === 2) {
    formatted = formatted + ':00';
  }
  return formatted;
};

// Parse a date-time string assuming it represents a time in IST
const parseISTToDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return null;
  try {
    let cleanStr = dateStr;
    if (cleanStr.includes('+')) {
      cleanStr = cleanStr.split('+')[0];
    } else if (cleanStr.endsWith('Z')) {
      cleanStr = cleanStr.slice(0, -1);
    }

    let formatted = cleanStr.trim().replace(' ', 'T');
    const timeParts = formatted.split('T')[1] || '';
    if (timeParts.split(':').length === 2) {
      formatted = formatted + ':00';
    }
    formatted = formatted + '+05:30';
    const d = new Date(formatted);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch (e) {
    return null;
  }
};

// Convert UTC to IST
const convertUTCToIST = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return '-';
  const d = parseISTToDate(utcDateStr);
  return d || utcDateStr;
};

// Format time in IST
const formatTimeIST = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return '-';
  try {
    const d = parseISTToDate(utcDateStr);
    if (!d) return utcDateStr;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return utcDateStr;
  }
};

// Format full date-time in IST
const formatDateTimeIST = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return '-';
  try {
    const d = parseISTToDate(utcDateStr);
    if (!d) return utcDateStr;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(d);

    const getVal = (type) => parts.find(p => p.type === type).value;
    return `${getVal('year')}-${getVal('month')}-${getVal('day')} ${getVal('hour')}:${getVal('minute')}:${getVal('second')}`;
  } catch (e) {
    return utcDateStr;
  }
};

// Format date for display (without time)
const formatDateIST = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return '-';
  try {
    const d = parseISTToDate(utcDateStr);
    if (!d) return utcDateStr;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);

    const getVal = (type) => parts.find(p => p.type === type).value;
    return `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
  } catch (e) {
    return utcDateStr;
  }
};

// Check if punch is late (after 10:10 AM IST)
const isLatePunch = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return false;
  try {
    const d = parseISTToDate(utcDateStr);
    if (!d) return false;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(d);

    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
    const totalMinutes = hour * 60 + minute;

    const thresholdMinutes = 10 * 60 + 10;
    return totalMinutes > thresholdMinutes;
  } catch (e) {
    return false;
  }
};

// Status colors and labels - compact version
const STATUS_CONFIG = {
  'Present': { color: 'bg-green-100 text-green-700', label: 'P', fullLabel: 'Present', bgColor: 'bg-green-200' },
  'Late': { color: 'bg-orange-100 text-orange-700', label: 'L', fullLabel: 'Late', bgColor: 'bg-orange-200' },
  'Absent': { color: 'bg-red-100 text-red-700', label: 'A', fullLabel: 'Absent', bgColor: 'bg-red-200' },
  'Half Day': { color: 'bg-yellow-100 text-yellow-700', label: 'H', fullLabel: 'Half Day', bgColor: 'bg-yellow-200' },
  'Holiday': { color: 'bg-purple-100 text-purple-700', label: 'Hol', fullLabel: 'Holiday', bgColor: 'bg-purple-200' },
  'Day Off': { color: 'bg-gray-100 text-gray-700', label: 'DO', fullLabel: 'Day Off', bgColor: 'bg-gray-200' },
  'On Leave': { color: 'bg-blue-100 text-blue-700', label: 'Lv', fullLabel: 'On Leave', bgColor: 'bg-blue-200' },
  'Future': { color: 'bg-transparent border-transparent', label: '-', fullLabel: '', bgColor: 'bg-transparent' }
};

const AttendanceDaily = () => {
  const getLocalDateString = (date = new Date()) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayDate = getLocalDateString();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]);
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [attendanceData, setAttendanceData] = useState([]);
  const [viewMode, setViewMode] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [employeesData, setEmployeesData] = useState([]); // Store employees table data
  const [showUnmatched, setShowUnmatched] = useState(false);

  const handleDateChange = (dateStr) => {
    if (!dateStr) return;
    setSelectedDate(dateStr);
    const newDateObj = new Date(dateStr);
    if (!isNaN(newDateObj.getTime())) {
      if (newDateObj.getMonth() !== currentMonth.getMonth() || newDateObj.getFullYear() !== currentMonth.getFullYear()) {
        setCurrentMonth(newDateObj);
      }
    }
  };
  const [employees, setEmployees] = useState([]);
  const [rawLogs, setRawLogs] = useState([]);
  const [joiningData, setJoiningData] = useState([]);
  const [deviceMapping, setDeviceMapping] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [tempStatus, setTempStatus] = useState('');
  const [tempInTime, setTempInTime] = useState('');
  const [tempOutTime, setTempOutTime] = useState('');
  const [tempManualPunches, setTempManualPunches] = useState({ "1": "", "2": "", "3": "", "4": "", "5": "" });
  const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);

  // Manual attendance marking state
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [markEmployeeId, setMarkEmployeeId] = useState('');
  const [markStatus, setMarkStatus] = useState('Present');
  const [markInTime, setMarkInTime] = useState('');
  const [markOutTime, setMarkOutTime] = useState('');

  // Fetch employees from employees table
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
      return allEmployeesData;
    } catch (error) {
      console.error('Error fetching employees table:', error);
      return [];
    }
  };

  // Check if employee exists in employees table
  const isEmployeeInTable = (employeeId) => {
    return employeesData.some(emp => emp.id === employeeId || emp.employee_id === employeeId);
  };

  // Fetch roster data from shift_roster table (stubbed out)
  const fetchRosterData = async (employeeId, date) => {
    return new Map();
  };

  // Get roster for an employee on a specific date (stubbed out)
  const getEmployeeRoster = (employeeId, date) => {
    return null;
  };

  const formatTime12h = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
      if (dateStr.includes('AM') || dateStr.includes('PM')) {
        return dateStr;
      }
      return formatTimeIST(dateStr);
    } catch (e) {
      return dateStr;
    }
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const istDate = convertUTCToIST(dateStr);
      if (istDate === '-' || typeof istDate === 'string') return dateStr;
      return istDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
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
      const inDate = parseISTToDate(inStr);
      const outDate = parseISTToDate(outStr);
      if (!inDate || !outDate || outDate <= inDate) return '00:00:00';
      return calculateHoursMins(outDate - inDate);
    } catch (e) {
      return '00:00:00';
    }
  };

  const calculateLateMinutes = (inStr, dateContext = '') => {
    if (!inStr || inStr === '-') return 0;
    try {
      const inDate = parseISTToDate(inStr);
      if (!inDate) return 0;

      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(inDate);

      const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
      const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
      const totalMinutes = hour * 60 + minute;

      const officialStartTime = 10 * 60 + 0;
      const graceTimeThreshold = 10 * 60 + 10;

      if (totalMinutes >= graceTimeThreshold) {
        return totalMinutes - officialStartTime;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  };

  // Save attendance to Supabase using UPSERT
  const saveAttendanceToDB = async (aggregatedData) => {
    if (!aggregatedData || aggregatedData.length === 0) return [];

    try {
      const dates = [...new Set(aggregatedData.map(item => item.Date))];

      // Fetch existing logs for these dates to preserve manual_punches
      const { data: existingLogs } = await supabase
        .from('attendance_logs')
        .in('attendance_date', dates);

      const rows = aggregatedData.map(item => {
        const existing = existingLogs?.find(
          r => r.employee_id === item.EmployeeID && r.attendance_date === item.Date
        );

        if (existing && existing.manual_punches && Object.values(existing.manual_punches).filter(Boolean).length > 0) {
          return {
            id: existing.id,
            employee_id: existing.employee_id,
            employee_name: existing.employee_name,
            attendance_date: existing.attendance_date,
            day: existing.day,
            designation: existing.designation,
            store_name: existing.store_name,
            device_id: existing.device_id,
            serial_number: existing.serial_number,
            in_time: existing.in_time,
            out_time: existing.out_time,
            working_hour: existing.working_hour,
            overtime: existing.overtime,
            late_minute: existing.late_minute,
            status: existing.status,
            standard_lunch: existing.standard_lunch,
            waste_time: existing.waste_time,
            punch_log: existing.punch_log,
            punch_log_status: existing.punch_log_status,
            punch_miss: existing.punch_miss,
            punch_miss_msg: existing.punch_miss_msg,
            manual_punches: existing.manual_punches,
            updated_at: existing.updated_at
          };
        }

        return {
          employee_id: item.EmployeeID,
          employee_name: item.EmployeeName,
          attendance_date: item.Date,
          day: item.Day,
          designation: item.Designation,
          store_name: item.StoreName,
          device_id: item.DeviceID,
          serial_number: item.AssignedSerial || item.SerialNumber,
          in_time: formatToISTISOString(item.InTime),
          out_time: formatToISTISOString(item.OutTime),
          working_hour: item.WorkingHour,
          overtime: item.Overtime,
          late_minute: item.LateMinute,
          status: item.Status,
          standard_lunch: item.StandardLunch,
          waste_time: item.WasteTime,
          punch_log: item.PunchLog,
          punch_log_status: item.PunchLogStatus,
          punch_miss: item.PunchMiss,
          punch_miss_msg: item.PunchMissMsg,
          updated_at: new Date()
        };
      });

      const { data, error } = await supabase
        .from('attendance_logs')
        .upsert(rows, {
          onConflict: 'employee_id,attendance_date',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log(`UPSERT complete: ${data?.length || 0} rows affected`);
      return data || [];
    } catch (err) {
      console.error('Error saving to Supabase:', err);
      throw err;
    }
  };

  // Sync only changed rows to Google Sheet
  const syncToMachineDataSheet = async (changedRows) => {
    if (!changedRows || changedRows.length === 0) return;

    setSyncing(true);
    setSyncProgress(0);
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz009j6fH3ADRbVJYJGt2QnXu6si3isPR3CHvtv06W7DOEret6CEiJWc_PbDcKY5SSs/exec';
    const SPECIFIED_SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

    let successCount = 0;
    let failCount = 0;
    const batchSize = 5;

    for (let i = 0; i < changedRows.length; i += batchSize) {
      const batch = changedRows.slice(i, i + batchSize);

      await Promise.all(batch.map(async (item) => {
        const formatTimeForSheet = (time) => {
          if (!time) return '-';
          return formatTimeIST(time);
        };

        const rowData = [
          item.employee_id || item.EmployeeID || '-',
          item.employee_name || item.EmployeeName || '-',
          item.attendance_date || item.Date || '-',
          formatTimeForSheet(item.in_time || item.InTime),
          formatTimeForSheet(item.out_time || item.OutTime),
          item.working_hour || item.WorkingHour || '-',
          item.store_name || item.StoreName || '-'
        ];

        try {
          const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              sheetName: 'Formatted_Attendance',
              spreadsheetId: SPECIFIED_SPREADSHEET_ID,
              action: 'insert',
              rowData: JSON.stringify(rowData)
            })
          });
          const result = await response.json();
          if (result.success) successCount++;
          else failCount++;
        } catch (err) {
          console.error('Sync failed for row:', item, err);
          failCount++;
        }
      }));

      setSyncProgress(Math.round((Math.min(i + batchSize, changedRows.length) / changedRows.length) * 100));
    }

    setSyncing(false);
    if (successCount > 0) {
      console.log(`Synced ${successCount} changed records to Formatted_Attendance Sheet. ${failCount} failed.`);
    }
  };

  // Fetch attendance from Supabase
  const fetchAttendanceFromDB = async (targetMonth = currentMonth) => {
    setLoading(true);
    try {
      const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

      const startDateStr = getLocalDateString(startOfMonth);
      const endDateStr = getLocalDateString(endOfMonth);

      // Paginated fetch for month data to bypass server-side 1000 row limits
      let monthData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('attendance_logs')
          .select('*')
          .gte('attendance_date', startDateStr)
          .lte('attendance_date', endDateStr)
          .order('attendance_date', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          monthData = [...monthData, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      // Fetch today's data
      const { data: todayDataRaw, error: todayError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('attendance_date', todayDate)
        .order('employee_name', { ascending: true });

      if (todayError) throw todayError;
      const todayData = todayDataRaw || [];

      const withoutToday = monthData.filter(r => r.attendance_date !== todayDate);
      const merged = [...withoutToday, ...todayData];

      console.log('🔍 [fetchAttendanceFromDB] Debugging Info:', {
        todayDate,
        startDateStr,
        endDateStr,
        monthDataLength: monthData.length,
        todayDataLength: todayData.length,
        withoutTodayLength: withoutToday.length,
        mergedLength: merged.length,
        recordsOnJune28: merged.filter(r => r.attendance_date === '2026-06-28')
      });

      setAttendanceData(merged);

      const uniqueEmployees = [
        ...new Map(
          merged.map(item => [item.employee_id, {
            id: item.employee_id,
            name: item.employee_name,
            designation: item.designation,
            store_name: item.store_name
          }])
        ).values()
      ];

      setEmployees(uniqueEmployees);

      // Fetch roster data for the selected month
      await fetchRosterData(null, startDateStr);

      console.log(`Loaded ${merged.length} records (month: ${withoutToday.length} + today: ${todayData.length})`);
    } catch (err) {
      console.error('Error fetching from Supabase:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllEmployees = async () => {
    try {
      let allLogs = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('attendance_logs')
          .select(`
            employee_id,
            employee_name,
            designation,
            store_name
          `)
          .not('employee_id', 'is', null)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allLogs = [...allLogs, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      const uniqueEmployees = [
        ...new Map(
          allLogs.map(emp => [
            emp.employee_id,
            {
              employee_id: emp.employee_id,
              employee_name: emp.employee_name,
              designation: emp.designation,
              store_name: emp.store_name
            }
          ])
        ).values()
      ];

      setAllEmployees(uniqueEmployees);

    } catch (err) {
      console.error('Error fetching attendance employees:', err);
    }
  };

  useEffect(() => {
    if (isMarkModalOpen) {
      fetchAllEmployees();
    }
  }, [isMarkModalOpen]);

  useEffect(() => {
    if (isMarkModalOpen) {
      setMarkEmployeeId('');
      setMarkStatus('Present');
      setMarkInTime(`${selectedDate}T10:00`);
      setMarkOutTime(`${selectedDate}T18:00`);
    }
  }, [isMarkModalOpen, selectedDate]);

  const handleMarkSubmit = async (e) => {
    e.preventDefault();
    if (!markEmployeeId) {
      alert('Please select an employee');
      return;
    }

    try {
      await updateAttendanceStatus(
        markEmployeeId,
        selectedDate,
        markStatus,
        markStatus === 'Absent' ? null : markInTime,
        markStatus === 'Absent' ? null : markOutTime
      );
      setIsMarkModalOpen(false);
    } catch (err) {
      console.error('Error marking attendance:', err);
    }
  };

  // Sync device logs helper for custom date range
  const syncLogsForRange = async (queryStart, queryEnd, targetMonth = currentMonth) => {
    setLoading(true);
    setError(null);

    try {
      let currentJoining = joiningData;
      if (joiningData.length === 0) {
        const jResponse = await fetch(JOINING_API_URL);
        const jResult = await jResponse.json();
        if (jResult.success) {
          const rawRows = jResult.data || jResult;
          const headers = rawRows[5];
          const dataRows = rawRows.slice(6);

          const getIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
          const empIdIdx = getIdx('Employee ID');
          const nameIdx = getIdx('Name As Per Aadhar');
          const desIdx = getIdx('Designation');
          const storeIdx = getIdx('Joining Place');

          currentJoining = dataRows.map(r => ({
            id: r[empIdIdx]?.toString().trim(),
            name: r[nameIdx]?.toString().trim(),
            designation: r[getIdx('Designation')]?.toString().trim() || r[desIdx]?.toString().trim(),
            store: r[getIdx('Joining Place')]?.toString().trim() || r[storeIdx]?.toString().trim()
          })).filter(h => h.id);
          setJoiningData(currentJoining);
        }
      }

      const MASTER_MAP_URL = `https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch`;
      const dmResponse = await fetch(MASTER_MAP_URL);
      const dmResult = await dmResponse.json();
      let currentMapping = [];
      if (dmResult.success) {
        const rows = dmResult.data.slice(1);
        currentMapping = rows.map(r => ({
          userId: r[5]?.toString().trim(),
          name: r[6]?.toString().trim(),
          deviceId: r[7]?.toString().trim(),
          serialNo: r[8]?.toString().trim(),
          storeName: r[9]?.toString().trim()
        }));
        setDeviceMapping(currentMapping);
      }

      let rawLogsData = [];
      if (selectedDevice.name === 'ALL DEVICES') {
        const otherDevices = DEVICES.filter(d => d.name !== 'ALL DEVICES');
        const allResponses = await Promise.all(
          otherDevices.map(async (device) => {
            try {
              const url = `/api/device-logs?APIKey=211616032630&SerialNumber=${device.serial}&DeviceName=${device.apiName}&FromDate=${queryStart}&ToDate=${queryEnd}`;
              const res = await fetch(url);
              if (!res.ok) return [];
              const logs = await res.json();
              return Array.isArray(logs) ? logs.map(l => ({ ...l, _DeviceName: device.name })) : [];
            } catch (e) {
              console.error(`Error fetching for ${device.name}:`, e);
              return [];
            }
          })
        );
        rawLogsData = allResponses.flat();
      } else {
        const API_URL = `/api/device-logs?APIKey=211616032630&SerialNumber=${selectedDevice.serial}&DeviceName=${selectedDevice.apiName}&FromDate=${queryStart}&ToDate=${queryEnd}`;
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        rawLogsData = Array.isArray(data) ? data.map(l => ({ ...l, _DeviceName: selectedDevice.name })) : [];
      }

      if (!rawLogsData || rawLogsData.length === 0) {
        setAttendanceData([]);
        setLoading(false);
        return;
      }

      const filteredLogs = rawLogsData.filter(log => {
        if (!log.LogDate) return false;
        const logDateStr = log.LogDate.split(' ')[0];
        return logDateStr >= queryStart && logDateStr <= queryEnd;
      });

      filteredLogs.sort((a, b) => new Date(a.LogDate) - new Date(b.LogDate));

      const grouped = {};
      filteredLogs.forEach(log => {
        if (!log.EmployeeCode || !log.LogDate) return;
        const dateStr = log.LogDate.split(' ')[0];
        const key = `${log.EmployeeCode}_${dateStr}`;

        if (!grouped[key]) {
          grouped[key] = {
            EmployeeCode: log.EmployeeCode.toString().trim(),
            Date: dateStr,
            SerialNumber: log.SerialNumber,
            SourceDeviceName: log._DeviceName,
            logs: []
          };
        }
        grouped[key].logs.push(log.LogDate);
      });

      const aggregatedData = Object.values(grouped).map(group => {
        const logs = group.logs;
        let inTime = '-';
        let outTime = '-';
        let punchMiss = 'No';
        let punchMissMsg = '';

        if (logs.length === 1) {
          const punchTime = logs[0];
          const timePart = punchTime.split(' ')[1] || '';
          const hours = parseInt(timePart.split(':')[0]) || 0;

          punchMiss = 'Yes';
          if (hours >= 15) {
            outTime = punchTime;
            punchMissMsg = 'Morning Punch Miss';
          } else {
            inTime = punchTime;
            punchMissMsg = 'Evening Punch Miss';
          }
        } else {
          inTime = logs[0];
          outTime = logs[logs.length - 1];
        }

        const serial = group.SerialNumber.toString().trim();
        const code = group.EmployeeCode.toString().trim();
        const isNumeric = !isNaN(code) && code !== '';

        const empMeta = currentJoining.find(e =>
          (e.id && e.id.toLowerCase() === code.toLowerCase()) ||
          (e.name && e.name.toLowerCase() === code.toLowerCase())
        );

        let dMap = currentMapping.find(m => m.userId && m.userId.toString().toLowerCase() === code.toLowerCase());

        if (!dMap) {
          const entryName = (empMeta?.name || code).toString().trim().toLowerCase();
          dMap = currentMapping.find(m => m.name && m.name.toString().toLowerCase() === entryName);
        }

        const displayName = dMap ? dMap.name : (empMeta ? empMeta.name : (isNumeric ? 'Unknown' : code));
        const displayCode = dMap ? dMap.userId : (empMeta ? empMeta.id : (isNumeric ? code : 'Unknown'));
        const displayStore = dMap ? dMap.storeName : (empMeta ? empMeta.store : group.SourceDeviceName);
        const displayDeviceId = dMap ? dMap.deviceId : '-';
        const displayAssignedSerial = dMap ? dMap.serialNo : serial;

        const lateMins = calculateLateMinutes(inTime);
        const workHrs = punchMiss === 'Yes' ? '00:00:00' : calculateWorkHours(inTime, outTime);

        let actualLunchMs = 0;
        if (logs.length > 2) {
          for (let i = 1; i < logs.length - 1; i += 2) {
            const lOut = parseISTToDate(logs[i]);
            const lIn = parseISTToDate(logs[i + 1]);
            if (lOut && lIn) {
              actualLunchMs += Math.max(0, lIn - lOut);
            }
          }
        }

        const standardLunchMs = 2.5 * 3600 * 1000;
        const wasteTimeMs = Math.max(0, actualLunchMs - standardLunchMs);
        const displayLunchMs = Math.min(actualLunchMs, standardLunchMs);

        const dateObj = parseISTToDate(group.Date);
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);

        let status = 'Present';
        if (lateMins > 0) status = 'Late';

        const punchLogStr = logs.map(l => formatTimeIST(l)).join(' | ');

        let punchLogStatus = 'Bahar';
        if (logs.length > 0) {
          if (logs.length % 2 === 1) {
            if (logs.length === 1) {
              const punchTime = logs[0];
              const timePart = punchTime.split(' ')[1] || '';
              const hours = parseInt(timePart.split(':')[0]) || 0;
              punchLogStatus = hours >= 15 ? 'Bahar' : 'Andar';
            } else {
              punchLogStatus = 'Andar';
            }
          } else {
            punchLogStatus = 'Bahar';
          }
        }

        return {
          EmployeeID: displayCode,
          EmployeeName: displayName,
          Date: group.Date,
          Day: dayName,
          IsWorkingDay: 'Yes',
          InTime: inTime,
          StandardLunch: calculateHoursMins(displayLunchMs),
          WasteTime: calculateHoursMins(wasteTimeMs),
          OutTime: outTime,
          PunchLog: punchLogStr,
          PunchLogStatus: punchLogStatus,
          StoreName: displayStore,
          DeviceID: displayDeviceId,
          Designation: empMeta ? empMeta.designation : '-',
          SerialNumber: serial,
          AssignedSerial: displayAssignedSerial,
          Status: status,
          WorkingHour: workHrs,
          Overtime: '0h 0m',
          LateMinute: lateMins,
          PunchMiss: punchMiss,
          PunchMissMsg: punchMissMsg
        };
      });

      const changedRows = await saveAttendanceToDB(aggregatedData);

      if (changedRows && changedRows.length > 0) {
        await syncToMachineDataSheet(changedRows);
      }

      await fetchAttendanceFromDB(targetMonth);

      const processedRawLogs = filteredLogs.map(log => {
        const code = log.EmployeeCode.toString().trim();
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
        const displayStore = dMap ? dMap.storeName : (empMeta ? empMeta.store : log._DeviceName);

        const dateObj = parseISTToDate(log.LogDate);

        return {
          date: log.LogDate.split(' ')[0],
          day: dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'long' }) : '',
          time: formatTimeIST(log.LogDate),
          employeeId: displayCode,
          employeeName: displayName,
          storeName: displayStore,
          serialNo: log.SerialNumber
        };
      });

      setRawLogs(processedRawLogs);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Sync device logs
  const syncDeviceLogs = async () => {
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const queryStart = getLocalDateString(startOfMonth);
    const queryEnd = getLocalDateString(endOfMonth);
    await syncLogsForRange(queryStart, queryEnd, currentMonth);
  };

  // Sync only today's logs
  const syncTodayLogs = async () => {
    const today = new Date();
    if (today.getMonth() !== currentMonth.getMonth() || today.getFullYear() !== currentMonth.getFullYear()) {
      setCurrentMonth(today);
    }
    setSelectedDate(todayDate);
    await syncLogsForRange(todayDate, todayDate, today);
  };

  // Helper to compute metrics from manual punches
  const calculateMetricsFromManualPunches = (punches, dateStr) => {
    const time1 = punches["1"];
    const time2 = punches["2"];
    const time3 = punches["3"];
    const time4 = punches["4"];
    const time5 = punches["5"];

    const activeTimes = [time1, time2, time3, time4, time5].filter(Boolean);

    if (activeTimes.length === 0) {
      return {
        in_time: null,
        out_time: null,
        punch_log: "-",
        punch_log_status: "Bahar",
        punch_miss: "No",
        punch_miss_msg: "",
        working_hour: "00:00:00",
        late_minute: 0
      };
    }

    const formatDateTime = (timeVal) => {
      return `${dateStr}T${timeVal}:00`;
    };

    const in_time = formatDateTime(activeTimes[0]);
    const out_time = activeTimes.length > 1 ? formatDateTime(activeTimes[activeTimes.length - 1]) : null;

    const formatTime12h = (timeVal) => {
      try {
        const [hStr, mStr] = timeVal.split(":");
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        const ampm = h >= 12 ? "PM" : "AM";
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const displayM = m.toString().padStart(2, "0");
        return `${displayH}:${displayM} ${ampm}`;
      } catch (e) {
        return timeVal;
      }
    };

    const punch_log = activeTimes.map(formatTime12h).join(" | ");
    const late_minute = calculateLateMinutes(in_time, dateStr);
    const working_hour = out_time ? calculateWorkHours(in_time, out_time, dateStr) : "00:00:00";

    const punch_miss = activeTimes.length === 1 ? "Yes" : "No";
    let punch_miss_msg = "";
    if (activeTimes.length === 1) {
      const hours = parseInt(activeTimes[0].split(":")[0], 10);
      punch_miss_msg = hours >= 15 ? "Morning Punch Miss" : "Evening Punch Miss";
    }

    const punch_log_status = activeTimes.length % 2 === 1 ? "Andar" : "Bahar";

    return {
      in_time,
      out_time,
      punch_log,
      punch_log_status,
      punch_miss,
      punch_miss_msg,
      working_hour,
      late_minute
    };
  };

  // Update attendance status
  const updateAttendanceStatus = async (employeeId, date, newStatus, inTime, outTime, manualPunches) => {
    try {
      const existingRecord = attendanceData.find(
        a => a.employee_id === employeeId && a.attendance_date === date
      );

      const updateData = {
        status: newStatus,
        updated_at: new Date()
      };

      if (manualPunches) {
        const metrics = calculateMetricsFromManualPunches(manualPunches, date);
        updateData.manual_punches = manualPunches;
        updateData.in_time = metrics.in_time;
        updateData.out_time = metrics.out_time;
        updateData.punch_log = metrics.punch_log;
        updateData.punch_log_status = metrics.punch_log_status;
        updateData.punch_miss = metrics.punch_miss;
        updateData.punch_miss_msg = metrics.punch_miss_msg;
        updateData.working_hour = metrics.working_hour;
        updateData.late_minute = metrics.late_minute;
      } else {
        if (inTime !== undefined) {
          updateData.in_time = inTime ? formatToISTISOString(inTime) : null;
        }
        if (outTime !== undefined) {
          updateData.out_time = outTime ? formatToISTISOString(outTime) : null;
        }

        if (inTime || outTime) {
          if (inTime && outTime && inTime !== '-' && outTime !== '-') {
            updateData.working_hour = calculateWorkHours(inTime, outTime, date);
            updateData.late_minute = calculateLateMinutes(inTime, date);
          }
        }
      }

      let result;
      if (existingRecord) {
        const { data, error } = await supabase
          .from('attendance_logs')
          .update(updateData)
          .eq('employee_id', employeeId)
          .eq('attendance_date', date)
          .select();

        if (error) throw error;
        result = data;
      } else {
        const employee = allEmployees.find(
          e => e.employee_id === employeeId
        );
        const { data, error } = await supabase
          .from('attendance_logs')
          .insert({
            employee_id: employeeId,
            employee_name: employee?.employee_name || '',
            designation: employee?.designation || '',
            store_name: employee?.store_name || '',
            attendance_date: date,
            status: newStatus,
            ...updateData
          })
          .select();

        if (error) throw error;
        result = data;
      }

      await fetchAttendanceFromDB();

      const changedRow = result?.map(r => ({
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        attendance_date: r.attendance_date,
        in_time: r.in_time,
        out_time: r.out_time,
        working_hour: r.working_hour,
        store_name: r.store_name
      }));

      if (changedRow) {
        await syncToMachineDataSheet(changedRow);
      }

      setEditingCell(null);
      setSelectedEmployee(null);
      setIsSlidePanelOpen(false);
      alert('Attendance updated successfully!');
    } catch (err) {
      console.error('Update failed:', err);
      alert('Error updating attendance: ' + err.message);
    }
  };

  // Handle employee selection for slide panel
  const handleEmployeeSelect = (employee, date, status, inTime, outTime) => {
    const fullRecord = attendanceData.find(
      a => a.employee_id === employee.id && a.attendance_date === date
    );

    // Get roster data for this employee on this date
    const roster = getEmployeeRoster(employee.id, date);

    setSelectedEmployee({
      ...employee,
      date: date,
      attendance: {
        status: status,
        in_time: inTime,
        out_time: outTime,
        ...fullRecord
      },
      roster: roster
    });

    setTempStatus(status);

    const formatInputVal = (t) => {
      if (!t || t === '-') return '';
      try {
        const d = parseISTToDate(t);
        if (!d) return '';

        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).formatToParts(d);

        const getVal = (type) => parts.find(p => p.type === type).value;
        let hour = getVal('hour');
        if (hour === '24') hour = '00';
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}T${hour}:${getVal('minute')}`;
      } catch (e) {
        return '';
      }
    };

    setTempInTime(formatInputVal(inTime));
    setTempOutTime(formatInputVal(outTime));

    // Populate manual punches state
    const punchesObj = fullRecord?.manual_punches || {};
    setTempManualPunches({
      "1": punchesObj["1"] || "",
      "2": punchesObj["2"] || "",
      "3": punchesObj["3"] || "",
      "4": punchesObj["4"] || "",
      "5": punchesObj["5"] || ""
    });

    setIsSlidePanelOpen(true);
  };

  // Handle save from slide panel
  const handleSaveFromSlidePanel = () => {
    if (selectedEmployee) {
      updateAttendanceStatus(
        selectedEmployee.id,
        selectedEmployee.date,
        tempStatus,
        tempInTime,
        tempOutTime,
        tempManualPunches
      );
    }
  };

  // Get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const currentDate = new Date(year, month, i);
      days.push({
        date: i,
        dayOfWeek: currentDate.getDay(),
        fullDate: getLocalDateString(currentDate),
        isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6
      });
    }

    return days;
  };

  // Get attendance status for an employee on a specific date
  const getAttendanceForDate = (employeeId, date) => {
    const record = attendanceData.find(
      a => a.employee_id === employeeId && a.attendance_date === date
    );
    if (date === '2026-06-28') {
      console.log(`🔎 [getAttendanceForDate] Lookup for ${employeeId} on ${date}:`, {
        foundRecord: record,
        totalAttendanceData: attendanceData.length
      });
    }
    if (record) {
      const isLate = record.in_time ? isLatePunch(record.in_time) : false;
      if (isLate && (record.status === 'Present' || !record.status)) {
        return { ...record, status: 'Late' };
      }
      return record;
    }
    if (date > todayDate) {
      return { status: 'Future', in_time: '-', out_time: '-' };
    }
    return { status: 'Absent', in_time: '-', out_time: '-' };
  };

  // Change month
  const changeMonth = (delta) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(nextMonth);

    const currentSelected = new Date(selectedDate);
    const day = currentSelected.getDate();
    const lastDayOfNext = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(day, lastDayOfNext);
    const nextDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay);

    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Unique store names list
  const stores = [...new Set(employees.map(emp => emp.store_name).filter(Boolean))].sort();

  // Filter employees
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStore = selectedStore === 'ALL' || emp.store_name === selectedStore;
    const isMatched = isEmployeeInTable(emp.id);
    const matchesFilterMode = showUnmatched ? !isMatched : isMatched;
    return matchesSearch && matchesStore && matchesFilterMode;
  });

  const days = getDaysInMonth(currentMonth);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    fetchEmployeesTable(); // Fetch employees table on component mount
  }, []);

  useEffect(() => {
    if (viewMode === 'daily') {
      fetchRosterData(null, selectedDate);
    }
  }, [selectedDate, viewMode]);

  useEffect(() => {
    fetchAttendanceFromDB();
  }, [currentMonth]);

  // Download Excel
  const downloadExcel = () => {
    const exportData = [];

    if (viewMode === 'daily') {
      filteredEmployees.forEach(employee => {
        const attendance = getAttendanceForDate(employee.id, selectedDate);
        const roster = getEmployeeRoster(employee.id, selectedDate);
        const dateObj = new Date(selectedDate);
        exportData.push({
          'Employee ID': employee.id,
          'Employee Name': employee.name,
          'Designation': employee.designation,
          'Store': employee.store_name,
          'Date': selectedDate,
          'Day': dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
          'Status': attendance.status === 'Future' ? '' : attendance.status,
          'IN Time': formatTimeIST(attendance.in_time),
          'OUT Time': formatTimeIST(attendance.out_time),
          'Working Hours': attendance.working_hour || '-',
          'Late Minutes': attendance.late_minute || 0,
          'Standard Lunch': attendance.standard_lunch || '-',
          'Waste Time': attendance.waste_time || '-',
          'Punch Log': attendance.punch_log || '-',
          'Roster Shift': roster?.shift_type || 'Not Assigned',
          'Roster Start Time': roster?.start_time || '-',
          'Roster End Time': roster?.end_time || '-'
        });
      });
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Daily_Attendance_${selectedDate}`);
      XLSX.writeFile(workbook, `attendance_daily_${selectedDate}.xlsx`);
    } else {
      filteredEmployees.forEach(employee => {
        days.forEach(day => {
          const attendance = getAttendanceForDate(employee.id, day.fullDate);
          const roster = getEmployeeRoster(employee.id, day.fullDate);
          exportData.push({
            'Employee ID': employee.id,
            'Employee Name': employee.name,
            'Designation': employee.designation,
            'Store': employee.store_name,
            'Date': day.fullDate,
            'Day': new Date(day.fullDate).toLocaleDateString('en-US', { weekday: 'long' }),
            'Status': attendance.status === 'Future' ? '' : attendance.status,
            'IN Time': formatTimeIST(attendance.in_time),
            'OUT Time': formatTimeIST(attendance.out_time),
            'Working Hours': attendance.working_hour || '-',
            'Late Minutes': attendance.late_minute || 0,
            'Roster Shift': roster?.shift_type || 'Not Assigned',
            'Roster Start Time': roster?.start_time || '-',
            'Roster End Time': roster?.end_time || '-'
          });
        });
      });
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Attendance_${monthNames[currentMonth.getMonth()]}_${currentMonth.getFullYear()}`);
      XLSX.writeFile(workbook, `attendance_${currentMonth.getFullYear()}_${currentMonth.getMonth() + 1}.xlsx`);
    }
  };

  return (
    <div className="p-3">
      {/* Header - Compact */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Calendar size={18} />
            {viewMode === 'calendar' ? 'Daily Attendance Calendar' : 'Daily Attendance Sheet'}
          </h1>
          <p className="text-gray-500 text-[11px] mt-0.5">
            {viewMode === 'calendar'
              ? 'View and manage employee attendance in calendar format'
              : `View and manage employee attendance for ${new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          </p>
        </div>
        <div className="flex gap-2">
          {syncing && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 border border-indigo-200 rounded-md">
              <Loader2 size={10} className="text-indigo-600 animate-spin" />
              <span className="text-[10px] text-indigo-600 font-medium">
                {syncProgress}%
              </span>
            </div>
          )}
          <button
            onClick={downloadExcel}
            disabled={filteredEmployees.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white font-medium text-xs transition-colors ${filteredEmployees.length === 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
              }`}
          >
            <Download size={12} />
            Export
          </button>
        </div>
      </div>

      {/* View Toggle - Compact */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3 border-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 p-0.5 rounded-md">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-4 py-1 text-xs font-medium rounded transition-all ${viewMode === 'daily'
                ? 'bg-white text-indigo-600 '
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Clock size={12} />
              Daily
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 h-10 py-1 text-xs font-medium rounded transition-all ${viewMode === 'calendar'
                ? 'bg-white text-indigo-600 '
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Calendar size={12} />
              Monthly
            </button>
          </div>

          <button
            onClick={() => setIsMarkModalOpen(true)}
            className="flex h-10 items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <Plus size={12} />
            Mark Attendance
          </button>

          <button
            onClick={() => setShowUnmatched(prev => !prev)}
            className={`flex h-10 items-center gap-1.5 px-3 py-1.5 font-medium text-xs transition-colors shadow-sm border rounded-md active:scale-95 transition-all ${showUnmatched
              ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
              }`}
          >
            <Filter size={12} />
            {showUnmatched ? 'Show Verified Employees' : 'Show Unmatched Employees'}
          </button>
        </div>

        {viewMode === 'daily' && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>
        )}
      </div>

      {/* Status Legend - Compact */}
      <div className="bg-gray-100 rounded-md p-2 mb-3">
        <div className="flex flex-wrap gap-3">
          <span className="text-[11px] font-medium text-gray-700">Status:</span>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${config.bgColor} border`}></div>
              <span className="text-[10px] text-gray-600">{config.fullLabel}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-orange-100 border border-orange-300"></div>
            <span className="text-[10px] text-orange-600 font-medium">Late (After 10:10 AM IST)</span>
          </div>
        </div>
      </div>

      {/* Filter Section - Compact */}
      <div className="bg-white rounded-md border border-gray-200 p-2 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Search Employee</label>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-7 pr-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Filter by Store</label>
            <div className="relative">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full appearance-none pl-2 pr-6 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white font-medium text-gray-700"
              >
                <option value="ALL">All Stores</option>
                {stores.map(store => (
                  <option key={store} value={store}>{store}</option>
                ))}
              </select>
              <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className='ml-10'>
            <label className="block w-[13vw] text-[10px] font-medium text-gray-500 mb-0.5 text-center">Month</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-semibold text-gray-800 min-w-[140px] text-center">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        /* Calendar View - Compact */
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
            <table className="w-full text-xs relative border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="sticky top-0 left-0 bg-gray-50 px-2 py-1.5 font-medium text-gray-600 text-[10px] z-30 min-w-[80px] border-">
                    Employee
                  </th>
                  {days.map((day, idx) => (
                    <th key={idx} className={`sticky top-0 bg-gray-50 px-0.5 py-1.5 font-medium text-center text-[10px] min-w-[32px] ${day.isWeekend ? 'bg-red-50' : ''} z-10`}>
                      <div className="font-semibold text-gray-700">{day.date}</div>
                      <div className="text-gray-400 text-[8px] mt-0.5">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.dayOfWeek]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={days.length + 2} className="text-center py-6">
                      <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={days.length + 2} className="text-center py-6">
                      <p className="text-red-600 text-xs mb-2">{error}</p>
                      <button
                        onClick={syncDeviceLogs}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => {
                    let presentCount = 0, lateCount = 0, absentCount = 0, halfDayCount = 0;
                    const isInEmployeesTable = isEmployeeInTable(employee.id);

                    return (
                      <tr
                        key={employee.id}
                        className={`hover:bg-gray-50 transition-colors ${isInEmployeesTable ? 'bg-blue-50 hover:bg-blue-100' : ''}`}
                      >
                        <td className={`sticky left-0 px-2 py-1.5 border-r z-10 ${isInEmployeesTable ? 'bg-blue-50' : 'bg-white'}`}>
                          <div>
                            <p className="text-xs font-medium text-gray-900">{employee.name}</p>
                            <p className="text-[9px] text-gray-500">{employee.id}</p>
                            {isInEmployeesTable && (
                              <span className="text-[8px] text-blue-600 font-medium">✓ Verified</span>
                            )}
                          </div>
                        </td>
                        {days.map((day, idx) => {
                          const attendance = getAttendanceForDate(employee.id, day.fullDate);
                          let status = attendance.status || 'Absent';
                          const config = STATUS_CONFIG[status] || STATUS_CONFIG['Absent'];

                          if (status === 'Present') presentCount++;
                          else if (status === 'Late') lateCount++;
                          else if (status === 'Absent') absentCount++;
                          else if (status === 'Half Day') halfDayCount++;

                          return (
                            <td
                              key={idx}
                              className={`px-0.5 py-1 text-center cursor-pointer transition-all hover:opacity-80 relative ${day.isWeekend ? 'bg-gray-50' : ''}`}
                              onClick={() => handleEmployeeSelect(employee, day.fullDate, status, attendance.in_time, attendance.out_time)}
                            >
                              <div className="relative inline-block">
                                <div className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${config.color} font-medium text-[10px] transition-transform hover:scale-105`}>
                                  {config.label}
                                </div>
                                {attendance?.manual_punches && Object.values(attendance.manual_punches).filter(Boolean).length > 0 && (
                                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-purple-500 rounded-full border border-white" title="Manual punch log" />
                                )}
                              </div>
                              {attendance.late_minute > 0 && (
                                <div className="text-[8px] text-gray-400 mt-0.5">
                                  {attendance.late_minute}m
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={days.length + 2} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Users size={32} className="mb-2" />
                        <p className="text-xs font-medium">No employees found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Daily List View - Compact */
        <>
          <div className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
              <table className="w-full text-xs relative border-collapse">
                <thead className=" border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[40px] z-10">#</th>
                    <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[10vw] z-10">Employee</th>
                    <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[100px] z-10">Store</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[80px] z-10">Status</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[90px] z-10">In Time (IST)</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[90px] z-10">Out Time (IST)</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[180px] z-10">Punch Logs</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[70px] z-10">Hours</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[60px] z-10">Late</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[50px] z-10">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-6">
                        <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={10} className="text-center py-6">
                        <p className="text-red-600 text-xs mb-2">{error}</p>
                        <button onClick={syncDeviceLogs} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">Retry</button>
                      </td>
                    </tr>
                  ) : filteredEmployees.length > 0 ? (
                    filteredEmployees.map((employee, idx) => {
                      const attendance = getAttendanceForDate(employee.id, selectedDate);
                      let status = attendance.status || 'Absent';
                      const config = STATUS_CONFIG[status] || STATUS_CONFIG['Absent'];
                      const isInEmployeesTable = isEmployeeInTable(employee.id);

                      return (
                        <tr
                          key={employee.id}
                          className={`hover:bg-gray-50 transition-colors ${isInEmployeesTable ? 'bg-blue-50 hover:bg-blue-100' : ''}`}
                        >
                          <td className="px-2 py-1.5 text-[10px] text-gray-500 font-medium">{idx + 1}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${isInEmployeesTable ? 'bg-blue-100 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                {employee.name ? employee.name.charAt(0).toUpperCase() : '?'}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-900">{employee.name}</p>
                                <p className="text-[9px] text-gray-500">{employee.id}</p>
                                {isInEmployeesTable && (
                                  <span className="text-[8px] text-blue-600 font-medium block">✓ Verified</span>
                                )}
                                {attendance?.manual_punches && Object.values(attendance.manual_punches).filter(Boolean).length > 0 && (
                                  <span className="inline-block mt-0.5 px-1 py-0.5 bg-purple-50 text-purple-600 rounded text-[7px] font-bold border border-purple-100">
                                    ✍ Manual ({Object.values(attendance.manual_punches).filter(Boolean).length})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-[10px] text-gray-600">{employee.store_name || '-'}</td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-medium ${config.color} ${config.bgColor}`}>
                              {config.fullLabel}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] font-mono">
                            {attendance.in_time ? formatTimeIST(attendance.in_time) : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] font-mono">
                            {attendance.out_time ? formatTimeIST(attendance.out_time) : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] font-mono text-gray-500 font-medium max-w-[220px] truncate" title={attendance.punch_log || '-'}>
                            {attendance.punch_log || '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] font-semibold">{attendance.working_hour || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-[10px]">
                            {attendance.late_minute > 0 ? (
                              <span className="text-orange-600">{attendance.late_minute}m</span>
                            ) : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => handleEmployeeSelect(employee, selectedDate, status, attendance.in_time, attendance.out_time)}
                              className="p-1 hover:bg-indigo-50 text-indigo-600 rounded transition-colors"
                            >
                              <Pencil size={10} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="text-center py-8">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Users size={32} className="mb-2" />
                          <p className="text-xs font-medium">No employees found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}

      {/* Slide Panel - Right to Left */}
      <div className={`fixed inset-0 overflow-hidden z-50 ${isSlidePanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${isSlidePanelOpen ? 'opacity-50' : 'opacity-0'}`}
          onClick={() => {
            setIsSlidePanelOpen(false);
            setSelectedEmployee(null);
          }}
        />

        {/* Slide Panel */}
        <div className={`absolute inset-y-0 right-0 max-w-6xl w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${isSlidePanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedEmployee && (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50 text-gray-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                    {selectedEmployee.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-gray-900">{selectedEmployee.name}</h3>
                    <p className="text-xs text-gray-500">ID: {selectedEmployee.id}</p>
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
              <div className="flex-1 overflow-y-auto bg-slate-50/50">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-100">
                      Attendance Details
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Department */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department</label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed" disabled>
                          <option>{selectedEmployee.designation || '--'}</option>
                        </select>
                      </div>

                      {/* Employees */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employee <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={selectedEmployee.name}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed"
                          disabled
                        />
                      </div>

                      {/* Location */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location</label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed" disabled>
                          <option>{selectedEmployee.attendance?.store_name || selectedEmployee.store_name || 'Worksuite'}</option>
                        </select>
                      </div>

                      {/* Mark Attendance By */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mark Attendance By</label>
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input type="radio" checked={true} readOnly className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300" />
                            <span>Date</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-not-allowed">
                            <input type="radio" disabled className="w-4 h-4 text-gray-300 border-gray-300" />
                            <span>Month</span>
                          </label>
                        </div>
                      </div>

                      {/* Year */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Year <span className="text-red-500">*</span></label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed" disabled>
                          <option>{new Date(selectedEmployee.date).getFullYear()}</option>
                        </select>
                      </div>

                      {/* Month */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Month <span className="text-red-500">*</span></label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed" disabled>
                          <option>{new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(selectedEmployee.date))}</option>
                        </select>
                      </div>

                      {/* Status select - custom editable field */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Attendance Status <span className="text-red-500">*</span></label>
                        <select
                          value={tempStatus}
                          onChange={(e) => setTempStatus(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-gray-800 font-medium"
                        >
                          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>{config.fullLabel}</option>
                          ))}
                        </select>
                      </div>

                      {/* Clock In */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Clock In (IST) <span className="text-red-500">*</span></label>
                        <input
                          type="datetime-local"
                          value={tempInTime}
                          onChange={(e) => setTempInTime(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                      </div>

                      {/* Clock Out */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Clock Out (IST)</label>
                        <input
                          type="datetime-local"
                          value={tempOutTime}
                          onChange={(e) => setTempOutTime(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                      </div>

                      {/* Manual Attendance Logs */}
                      <div className="md:col-span-2 lg:col-span-3 border-t border-gray-100 pt-4 mt-2">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                          Manual Punch Logs (HH:MM)
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {["1", "2", "3", "4"].map((num) => (
                            <div key={num} className="bg-slate-50 p-2.5 rounded border border-gray-200">
                              <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">
                                Punch #{num}
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="time"
                                  value={tempManualPunches[num] || ""}
                                  onChange={(e) => {
                                    setTempManualPunches(prev => {
                                      const updated = { ...prev, [num]: e.target.value };
                                      const activeVals = ["1", "2", "3", "4", "5"].map(n => updated[n]).filter(Boolean);
                                      if (activeVals.length > 0) {
                                        setTempInTime(`${selectedEmployee.date}T${activeVals[0]}`);
                                        if (activeVals.length > 1) {
                                          setTempOutTime(`${selectedEmployee.date}T${activeVals[activeVals.length - 1]}`);
                                        } else {
                                          setTempOutTime('');
                                        }
                                      } else {
                                        setTempInTime('');
                                        setTempOutTime('');
                                      }
                                      return updated;
                                    });
                                  }}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                />
                                {tempManualPunches[num] && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTempManualPunches(prev => {
                                        const updated = { ...prev, [num]: "" };
                                        const activeVals = ["1", "2", "3", "4", "5"].map(n => updated[n]).filter(Boolean);
                                        if (activeVals.length > 0) {
                                          setTempInTime(`${selectedEmployee.date}T${activeVals[0]}`);
                                          if (activeVals.length > 1) {
                                            setTempOutTime(`${selectedEmployee.date}T${activeVals[activeVals.length - 1]}`);
                                          } else {
                                            setTempOutTime('');
                                          }
                                        } else {
                                          setTempInTime('');
                                          setTempOutTime('');
                                        }
                                        return updated;
                                      });
                                    }}
                                    className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-gray-200 transition-colors"
                                    title="Delete Punch"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                          💡 Tip: The first punch will be used as the Clock In time, and the last punch will be used as the Clock Out time.
                        </p>
                      </div>

                      {/* Late (Yes/No radio) */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Late</label>
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="lateRadio"
                              checked={tempStatus === 'Late'}
                              onChange={() => setTempStatus('Late')}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="lateRadio"
                              checked={tempStatus !== 'Late'}
                              onChange={() => {
                                if (tempStatus === 'Late') setTempStatus('Present');
                              }}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </div>

                      {/* Half Day (Yes/No radio) */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Half Day</label>
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="halfDayRadio"
                              checked={tempStatus === 'Half Day'}
                              onChange={() => setTempStatus('Half Day')}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="halfDayRadio"
                              checked={tempStatus !== 'Half Day'}
                              onChange={() => {
                                if (tempStatus === 'Half Day') setTempStatus('Present');
                              }}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </div>

                      {/* Working From */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Working From <span className="text-red-500">*</span></label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white">
                          <option>Office</option>
                          <option>Home</option>
                        </select>
                      </div>

                      {/* Attendance Overwrite Checkbox */}
                      <div className="lg:col-span-3 flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          id="attendanceOverwrite"
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="attendanceOverwrite" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-1">
                          Attendance Overwrite
                          <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center cursor-help" title="Overwrite automatically calculated logs?">?</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Roster Information Section removed since shift roster is not implemented yet */}

                  {/* Punch Details and Raw Logs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Calculated Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Working Hours</span>
                          <span className="font-semibold text-gray-800">{selectedEmployee.attendance?.working_hour || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Overtime</span>
                          <span className="font-semibold text-gray-800">{selectedEmployee.attendance?.overtime || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Late Minutes</span>
                          <span className="font-semibold text-orange-600">{selectedEmployee.attendance?.late_minute || 0}m</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Standard Lunch</span>
                          <span className="font-semibold text-gray-800">{selectedEmployee.attendance?.standard_lunch || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Waste Time</span>
                          <span className="font-semibold text-gray-800">{selectedEmployee.attendance?.waste_time || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-500">Device Serial</span>
                          <span className="font-mono text-xs text-gray-800">{selectedEmployee.attendance?.serial_number || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Punch Logs (IST)</h4>
                      {selectedEmployee.attendance?.punch_log ? (
                        <div className="bg-white rounded p-3 border border-gray-200 h-[140px] overflow-y-auto">
                          <p className="text-xs font-mono text-gray-700 whitespace-pre-line leading-relaxed">
                            {selectedEmployee.attendance.punch_log}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-white rounded p-3 border border-gray-200 h-[140px] flex items-center justify-center text-gray-400 text-xs">
                          No punch logs recorded
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setIsSlidePanelOpen(false);
                    setSelectedEmployee(null);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFromSlidePanel}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <CheckCircle size={16} />
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raw Punches Section - Compact */}
      {rawLogs.length > 0 && (
        <div className="mt-3">
          <details className="bg-white rounded-md border border-gray-200">
            <summary className="px-2 py-1.5 cursor-pointer hover:bg-gray-50 text-xs font-medium text-gray-700">
              Raw Punch Logs (IST) ({rawLogs.length})
            </summary>
            <div className="overflow-x-auto p-2 border-t">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Date</th>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Day</th>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Time (IST)</th>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Employee</th>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Store</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rawLogs.slice(0, 50).map((log, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-2 py-1 text-[10px] text-gray-700">{log.date}</td>
                      <td className="px-2 py-1 text-[10px] text-gray-500">{log.day}</td>
                      <td className="px-2 py-1 text-[10px] font-mono font-medium text-indigo-600">{log.time}</td>
                      <td className="px-2 py-1 text-[10px] text-gray-900">{log.employeeName}</td>
                      <td className="px-2 py-1 text-[10px] text-gray-600">{log.storeName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* Mark Attendance Modal Popup */}
      {isMarkModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsMarkModalOpen(false)}>
          <div className="bg-white max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-fade-in text-gray-900" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <ClockIcon size={16} className="text-indigo-600" />
                Mark Attendance Manually
              </h3>
              <button
                onClick={() => setIsMarkModalOpen(false)}
                className="p-1 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleMarkSubmit} className="p-5 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Date</label>
                <input
                  type="text"
                  value={selectedDate}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 font-bold text-slate-600 cursor-not-allowed font-mono"
                  readOnly
                />
              </div>

              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Employee <span className="text-red-500">*</span></label>
                <select
                  value={markEmployeeId}
                  onChange={(e) => setMarkEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                  required
                >
                  <option value="">Select Employee</option>
                  {allEmployees.map(emp => (
                    <option
                      key={emp.employee_id}
                      value={emp.employee_id}
                    >
                      ({emp.employee_id}) {emp.employee_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Status</label>
                <div className="flex gap-4 mt-2">
                  {['Present', 'Late', 'Absent', 'Half Day'].map((st) => (
                    <label key={st} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="markStatus"
                        value={st}
                        checked={markStatus === st}
                        onChange={() => setMarkStatus(st)}
                        className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* In & Out Times */}
              {markStatus !== 'Absent' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">In Time (IST)</label>
                    <input
                      type="datetime-local"
                      value={markInTime}
                      onChange={(e) => setMarkInTime(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Out Time (IST)</label>
                    <input
                      type="datetime-local"
                      value={markOutTime}
                      onChange={(e) => setMarkOutTime(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMarkModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Save Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceDaily;