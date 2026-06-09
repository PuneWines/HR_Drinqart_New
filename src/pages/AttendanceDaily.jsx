import React, { useEffect, useState } from 'react';
import { Search, Download, Calendar, Loader2, CheckCircle, X, Clock, Pencil, Filter, Users, User, Clock as ClockIcon, TrendingUp, Database } from 'lucide-react';
import * as XLSX from 'xlsx';

const DEVICES = [
  { name: 'ALL DEVICES', serial: 'ALL', apiName: 'ALL' },
  { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
  { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
  { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
  { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
  { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' }
];

const JOINING_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch';

const AttendanceDaily = () => {
  const todayDate = new Date().toISOString().split('T')[0];
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState(todayDate);
  const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [rawLogs, setRawLogs] = useState([]);
  const [rawSearchId, setRawSearchId] = useState('');
  const [rawSearchStore, setRawSearchStore] = useState('');
  const [joiningData, setJoiningData] = useState([]);
  const [deviceMapping, setDeviceMapping] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [tempInTime, setTempInTime] = useState('');
  const [tempOutTime, setTempOutTime] = useState('');

  const formatTime12h = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
      const parts = dateStr.trim().split(' ');
      let timePart = parts[1] || parts[0];
      if (!timePart) return dateStr;

      const hasAMPM = timePart.toLowerCase().includes('am') || timePart.toLowerCase().includes('pm');
      if (hasAMPM && !dateStr.includes('-')) {
        return timePart.toUpperCase();
      }

      if (!timePart.includes(':')) return dateStr;

      let [hoursPart, minutesFull] = timePart.split(':');
      let hours = parseInt(hoursPart);
      let minutes = minutesFull ? minutesFull.slice(0, 2) : '00';

      const isPM = timePart.toLowerCase().includes('pm') || hours >= 12;
      const ampm = isPM ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;

      return `${h12}:${minutes.padStart(2, '0')} ${ampm}`;
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
      const parse = (s) => {
        if (!s || s === '-') return null;
        try {
          if (s.includes('-') && s.includes(':')) {
            const d = new Date(s.replace(/-/g, '/'));
            if (!isNaN(d.getTime())) return d;
          }

          let cleanTime = s.trim().toUpperCase();
          const isPM = cleanTime.includes('PM');
          const isAM = cleanTime.includes('AM');
          cleanTime = cleanTime.replace(/[AP]M/g, '').trim();

          const parts = cleanTime.split(':');
          let h = parseInt(parts[0]) || 0;
          let m = parseInt(parts[1]) || 0;
          let sec = parseInt(parts[2]) || 0;

          if (isPM && h < 12) h += 12;
          if (isAM && h === 12) h = 0;

          const baseDate = dateContext ? new Date(dateContext.replace(/-/g, '/')) : new Date();
          baseDate.setHours(h, m, sec, 0);
          return baseDate;
        } catch (e) {
          return null;
        }
      };

      const inDate = parse(inStr);
      const outDate = parse(outStr);
      if (!inDate || !outDate || outDate <= inDate) return '00:00:00';
      return calculateHoursMins(outDate - inDate);
    } catch (e) {
      return '00:00:00';
    }
  };

  const calculateOvertime = (workHoursStr) => {
    if (!workHoursStr || workHoursStr === '0h 0m' || workHoursStr === '00:00:00') return '0h 0m';
    try {
      let h = 0, m = 0;
      if (workHoursStr.includes(':')) {
        const parts = workHoursStr.split(':').map(Number);
        h = parts[0] || 0;
        m = parts[1] || 0;
      } else {
        const parts = workHoursStr.split(' ').map(s => parseInt(s) || 0);
        h = parts[0] || 0;
        m = parts[1] || 0;
      }
      const totalMinutes = h * 60 + m;
      const standardMinutes = 8 * 60;
      if (totalMinutes <= standardMinutes) return '0h 0m';
      const otMinutes = totalMinutes - standardMinutes;
      return `${Math.floor(otMinutes / 60)}h ${otMinutes % 60}m`;
    } catch (e) { return '0h 0m'; }
  };

  const calculateLateMinutes = (inStr, dateContext = '') => {
    if (!inStr || inStr === '-') return 0;
    try {
      const parse = (s) => {
        if (!s || s === '-') return null;
        try {
          if (s.includes('-') && s.includes(':')) {
            const d = new Date(s.replace(/-/g, '/'));
            if (!isNaN(d.getTime())) return d;
          }
          let cleanTime = s.trim().toUpperCase();
          const isPM = cleanTime.includes('PM');
          const isAM = cleanTime.includes('AM');
          cleanTime = cleanTime.replace(/[AP]M/g, '').trim();

          const parts = cleanTime.split(':');
          let h = parseInt(parts[0]) || 0;
          let m = parseInt(parts[1]) || 0;
          let sec = parseInt(parts[2]) || 0;

          if (isPM && h < 12) h += 12;
          if (isAM && h === 12) h = 0;

          const baseDate = dateContext ? new Date(dateContext.replace(/-/g, '/')) : new Date();
          baseDate.setHours(h, m, sec, 0);
          return baseDate;
        } catch (e) {
          return null;
        }
      };

      const inDate = parse(inStr);
      if (!inDate) return 0;

      const hours = inDate.getHours();
      const minutes = inDate.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      const officialStartTime = 10 * 60 + 0;
      const graceTimeThreshold = 10 * 60 + 10;

      if (totalMinutes > graceTimeThreshold) {
        return totalMinutes - officialStartTime;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  };

  const syncToMachineDataSheet = async (data) => {
    if (!data || data.length === 0) return;

    setSyncing(true);
    setSyncProgress(0);
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz009j6fH3ADRbVJYJGt2QnXu6si3isPR3CHvtv06W7DOEret6CEiJWc_PbDcKY5SSs/exec';
    const SPECIFIED_SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

    let successCount = 0;
    let failCount = 0;
    const batchSize = 5;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      await Promise.all(batch.map(async (item) => {
        const rowData = [
          item.EmployeeID || item.EmployeeCode || '-',
          item.EmployeeName || '-',
          item.Date || '-',
          formatTime12h(item.InTime),
          formatTime12h(item.OutTime),
          item.WorkingHour || '-',
          item.StoreName || '-'
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

      setSyncProgress(Math.round((Math.min(i + batchSize, data.length) / data.length) * 100));
    }

    setSyncing(false);
    if (successCount > 0) {
      console.log(`Synced ${successCount} records to Formatted_Attendance Sheet. ${failCount} failed.`);
    }
  };

  const handleStartEdit = (item) => {
    setEditingId(`${item.EmployeeID}_${item.Date}`);
    setTempInTime(item.InTime === '-' ? '' : item.InTime);
    setTempOutTime(item.OutTime === '-' ? '' : item.OutTime);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTempInTime('');
    setTempOutTime('');
  };

  const handleSaveEdit = async (item) => {
    setLoading(true);
    try {
      const newInTime = tempInTime || item.InTime;
      const newOutTime = tempOutTime || item.OutTime;

      const newLateMins = calculateLateMinutes(newInTime, item.Date);
      const newWorkHrs = calculateWorkHours(newInTime, newOutTime, item.Date);
      const newOvertimeHrs = calculateOvertime(newWorkHrs);

      const isInEdited = newInTime !== item.InTime;
      const isOutEdited = newOutTime !== item.OutTime;

      const updatedItem = {
        ...item,
        InTime: newInTime,
        OutTime: newOutTime,
        LateMinute: newLateMins,
        WorkingHour: newWorkHrs,
        Overtime: newOvertimeHrs,
        IsInEdited: isInEdited || item.IsInEdited,
        IsOutEdited: isOutEdited || item.IsOutEdited,
        Status: newLateMins > 0 ? 'Late' : 'Present'
      };

      const newData = [...attendanceData];
      const dataIndex = attendanceData.findIndex(d => d.EmployeeID === item.EmployeeID && d.Date === item.Date);
      if (dataIndex !== -1) {
        newData[dataIndex] = updatedItem;
        setAttendanceData(newData);
      }

      const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz009j6fH3ADRbVJYJGt2QnXu6si3isPR3CHvtv06W7DOEret6CEiJWc_PbDcKY5SSs/exec';
      const SPECIFIED_SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

      const rowData = [
        updatedItem.EmployeeID,
        updatedItem.EmployeeName,
        updatedItem.Date,
        formatTime12h(updatedItem.InTime),
        formatTime12h(updatedItem.OutTime),
        updatedItem.WorkingHour,
        updatedItem.StoreName,
        'MANUAL_EDIT'
      ];

      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          sheetName: 'Formatted_Attendance',
          spreadsheetId: SPECIFIED_SPREADSHEET_ID,
          action: 'insert',
          rowData: JSON.stringify(rowData)
        })
      });

      setEditingId(null);
      alert('Attendance updated successfully!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Error saving changes');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeviceLogs = async () => {
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

      const queryStart = startDate || '2026-04-01';
      const queryEnd = endDate || '2026-04-30';

      let rawLogs = [];
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
        rawLogs = allResponses.flat();
      } else {
        const API_URL = `/api/device-logs?APIKey=211616032630&SerialNumber=${selectedDevice.serial}&DeviceName=${selectedDevice.apiName}&FromDate=${queryStart}&ToDate=${queryEnd}`;
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        rawLogs = Array.isArray(data) ? data.map(l => ({ ...l, _DeviceName: selectedDevice.name })) : [];
      }

      if (!rawLogs || rawLogs.length === 0) {
        setAttendanceData([]);
        return;
      }

      const filteredLogs = rawLogs.filter(log => {
        if (!log.LogDate) return false;
        const logDateStr = log.LogDate.split(' ')[0];
        return logDateStr >= '2026-04-01';
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
        let lunchOut = '-';
        let lunchIn = '-';
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
          if (logs.length >= 4) {
            lunchOut = logs[1];
            lunchIn = logs[2];
          } else if (logs.length === 3) {
            lunchOut = logs[1];
          }
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
        const workHrs = punchMiss === 'Yes' ? '0h 0m' : calculateWorkHours(inTime, outTime);
        const overtimeHrs = calculateOvertime(workHrs);

        let actualLunchMs = 0;
        if (logs.length > 2) {
          for (let i = 1; i < logs.length - 1; i += 2) {
            const lOut = new Date(logs[i].replace(/-/g, '/'));
            const lIn = new Date(logs[i + 1].replace(/-/g, '/'));
            actualLunchMs += Math.max(0, lIn - lOut);
          }
        }

        const standardLunchMs = 2.5 * 3600 * 1000;
        const wasteTimeMs = Math.max(0, actualLunchMs - standardLunchMs);
        const displayLunchMs = Math.min(actualLunchMs, standardLunchMs);

        const dateObj = new Date(group.Date);
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);
        const isWorkingDay = 'Yes';

        let status = 'Present';
        if (lateMins > 0) status = 'Late';

        const punchLogStr = logs.map(l => formatTime12h(l)).join(' | ');

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
          IsWorkingDay: isWorkingDay,
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
          Overtime: overtimeHrs,
          LateMinute: lateMins,
          PunchMiss: punchMiss,
          PunchMissMsg: punchMissMsg
        };
      });

      aggregatedData.sort((a, b) => new Date(b.InTime) - new Date(a.InTime));
      setAttendanceData(aggregatedData);

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
        const displayDeviceId = dMap ? dMap.deviceId : '-';
        const displayAssignedSerial = dMap ? dMap.serialNo : log.SerialNumber;

        const dateObj = new Date(log.LogDate.replace(/-/g, '/'));

        return {
          date: log.LogDate.split(' ')[0],
          day: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
          time: log.LogDate.split(' ')[1] || '',
          employeeId: displayCode,
          employeeName: displayName,
          storeName: displayStore,
          deviceId: displayDeviceId,
          serialNo: displayAssignedSerial
        };
      });

      setRawLogs(processedRawLogs);

      syncToMachineDataSheet(aggregatedData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceLogs();
  }, [startDate, endDate, selectedDevice]);

  const filteredData = attendanceData.filter(item => {
    const matchesSearch =
      (item.EmployeeID && item.EmployeeID.toString().toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.EmployeeName && item.EmployeeName.toString().toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.SerialNumber && item.SerialNumber.toString().toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  const filteredRawLogs = rawLogs.filter(log => {
    const matchesGeneral = log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.employeeId.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.serialNo.toString().toLowerCase().includes(searchTerm.toLowerCase());

    const matchesId = !rawSearchId || log.employeeId.toString() === rawSearchId;
    const matchesStore = !rawSearchStore || log.storeName === rawSearchStore;

    return matchesGeneral && matchesId && matchesStore;
  });

  const uniqueIds = [...new Set(rawLogs.map(l => l.employeeId))].filter(Boolean).sort();
  const uniqueStores = [...new Set(rawLogs.map(l => l.storeName))].filter(Boolean).sort();

  const downloadExcel = () => {
    const dataToExport = filteredData.map((item, index) => ({
      'S.No.': index + 1,
      'Date': item.Date,
      'Day': item.Day,
      'Working Day': item.IsWorkingDay,
      'Employee ID': item.EmployeeID,
      'Employee Name': item.EmployeeName,
      'Designation': item.Designation,
      'IN Time': formatTime12h(item.InTime),
      'Lunch Time': item.StandardLunch,
      'Waste Time': item.WasteTime,
      'OUT Time': formatTime12h(item.OutTime),
      'Punch Logs': item.PunchLog,
      'Punch Log Status': item.PunchLogStatus,
      'Status': item.Status,
      'Working Hour': item.WorkingHour,
      'Late Minute': item.LateMinute,
      'Punch Miss': item.PunchMiss,
      'Store Name': item.StoreName,
      'Device ID': item.DeviceID,
      'Serial NO': item.AssignedSerial
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Device Logs");
    XLSX.writeFile(workbook, `device_logs_${startDate || 'all'}_to_${endDate || 'all'}.xlsx`);
  };

  // Summary stats
  const totalEmployees = new Set(attendanceData.map(d => d.EmployeeID)).size;
  const totalPresent = attendanceData.filter(d => d.Status === 'Present').length;
  const totalLate = attendanceData.filter(d => d.Status === 'Late').length;

  return (
    <div className="p-5  pt-2">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock size={28} />
            Daily Attendance
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Track and manage daily employee attendance logs
          </p>
        </div>
        <div className="flex gap-3">
          {syncing && (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
              <Loader2 size={14} className="text-indigo-600 animate-spin" />
              <span className="text-xs text-indigo-600 font-medium">
                Syncing... {syncProgress}%
              </span>
            </div>
          )}
          <button
            onClick={downloadExcel}
            disabled={filteredData.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors ${filteredData.length === 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
              }`}
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search Employee</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ID or serial..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Select Device</label>
            <div className="relative">
              <select
                value={selectedDevice.name}
                onChange={(e) => {
                  const device = DEVICES.find(d => d.name === e.target.value);
                  setSelectedDevice(device);
                }}
                className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
              >
                {DEVICES.map(d => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
              <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {attendanceData.length > 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Total Employees</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalEmployees}</p>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Users size={20} className="text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Total Records</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{attendanceData.length}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Database size={20} className="text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Present Today</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{totalPresent}</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <User size={20} className="text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">Late Arrivals</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{totalLate}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <TrendingUp size={20} className="text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Attendance Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">S.No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Day</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">IN Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">OUT Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Work Hours</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Store</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      Loading attendance data...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="10" className="text-center py-12">
                    <p className="text-red-600 mb-3">{error}</p>
                    <button
                      onClick={fetchDeviceLogs}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700">{item.Date}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{item.Day}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                          {item.EmployeeName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.EmployeeName}</p>
                          <p className="text-xs text-gray-500">{item.EmployeeID}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === `${item.EmployeeID}_${item.Date}` ? (
                        <input
                          type="text"
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          value={tempInTime}
                          onChange={(e) => setTempInTime(e.target.value)}
                        />
                      ) : (
                        <span className="text-xs font-mono text-indigo-600 font-medium">
                          {formatTime12h(item.InTime)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === `${item.EmployeeID}_${item.Date}` ? (
                        <input
                          type="text"
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          value={tempOutTime}
                          onChange={(e) => setTempOutTime(e.target.value)}
                        />
                      ) : (
                        <span className="text-xs font-mono text-red-600 font-medium">
                          {formatTime12h(item.OutTime)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">{item.WorkingHour}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${item.Status === 'Present' ? 'bg-green-100 text-green-700' :
                        item.Status === 'Late' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                        {item.Status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{item.StoreName || '-'}</td>
                    <td className="px-4 py-3">
                      {editingId === `${item.EmployeeID}_${item.Date}` ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSaveEdit(item)}
                            className="p-1 text-green-600 hover:text-green-700"
                            title="Save"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-red-600 hover:text-red-700"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1 text-indigo-600 hover:text-indigo-700"
                          title="Edit Time"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <Search size={48} className="mb-3" />
                      <p className="font-medium">No attendance records found</p>
                      <p className="text-xs mt-1">Try adjusting your filters or sync data</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Raw Punches Section */}
      {rawLogs.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Raw Punch Logs</h2>
            <div className="flex gap-2">
              <div className="relative">
                <input
                  list="rawIds"
                  placeholder="Filter by ID..."
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={rawSearchId}
                  onChange={(e) => setRawSearchId(e.target.value)}
                />
                <datalist id="rawIds">
                  {uniqueIds.map(id => <option key={id} value={id} />)}
                </datalist>
              </div>
              <div className="relative">
                <input
                  list="rawStores"
                  placeholder="Filter by store..."
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={rawSearchStore}
                  onChange={(e) => setRawSearchStore(e.target.value)}
                />
                <datalist id="rawStores">
                  {uniqueStores.map(store => <option key={store} value={store} />)}
                </datalist>
              </div>
              {(rawSearchId || rawSearchStore) && (
                <button
                  onClick={() => { setRawSearchId(''); setRawSearchStore(''); }}
                  className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Day</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Store</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRawLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 text-xs text-gray-700">{log.date}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{log.day}</td>
                      <td className="px-4 py-2 text-xs font-mono font-medium text-indigo-600">{formatTime12h(log.time)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium">
                            {log.employeeName?.charAt(0) || '?'}
                          </div>
                          <span className="text-xs font-medium text-gray-900">{log.employeeName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">{log.storeName}</td>
                      <td className="px-4 py-2 text-xs font-mono text-gray-500">{log.serialNo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceDaily;