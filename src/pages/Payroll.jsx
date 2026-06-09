import React, { useState, useEffect } from 'react';
import { Search, Loader2, Download, Plus, X, Calendar, Save, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';



const DEVICES = [
    { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
    { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
    { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
    { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
    { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' }
];

const Payroll = () => {
    const [activeTab, setActiveTab] = useState('salary');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [salaryData, setSalaryData] = useState({ headers: [], rows: [] });
    const [payrollRowMap, setPayrollRowMap] = useState({}); // "EMPID_Month_Year" -> real sheet row number
    const [historyData, setHistoryData] = useState({ headers: [], rows: [] });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employees, setEmployees] = useState([]);
    // --- Edit & Select State ---
    const [selectedRows, setSelectedRows] = useState(new Set()); // Set of rowIndexes
    const [editingData, setEditingData] = useState({});         // rowIndex -> [...cellValues]
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSubmittingPayments, setIsSubmittingPayments] = useState(false);

    const [formData, setFormData] = useState({
        employeeId: '',
        employeeName: '',
        year: new Date().getFullYear().toString(),
        month: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date()),
        designation: '',
        joiningPlace: '',
        dateOfJoining: '',
        monthlySalary: '0',
        advanceDeduction: '0',
        brackage: '0',
        medical: '0',
        totalSalary: '0',       // New field for calculation result
        payDate: new Date().toISOString().split('T')[0]
    });

    const [baseSalary, setBaseSalary] = useState(0); // To track original salary for deductions


    const PAYROLL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1QHKttecIhZwoyh8-xo_wzqHgxIuFr9Tci8L803T1q0nKkjA1w26soUXSffkMY4E0sQ/exec';


    const formatDate = (dateStr) => {
        if (!dateStr) return '';

        let date;
        if (dateStr instanceof Date) {
            date = dateStr;
        } else {
            // Try to parse common formats
            const iso = Date.parse(dateStr);
            if (!isNaN(iso)) {
                date = new Date(iso);
            } else {
                // Try dd/mm/yyyy
                const parts = dateStr.toString().split(/[\/\-]/);
                if (parts.length === 3) {
                    let [day, month, year] = parts.map(p => parseInt(p, 10));
                    if (year < 100) year += 2000;
                    date = new Date(year, month - 1, day);
                }
            }
        }

        if (!date || isNaN(date.getTime())) return dateStr;

        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const fetchPayrollData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch spreadsheet records
            const response = await fetch(`${PAYROLL_SCRIPT_URL}?sheet=PAYROLL&action=fetch&spreadsheetId=1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8`);
            const result = await response.json();
            let spreadsheetRows = [];
            let spreadsheetHeaders = [];
            if (result.success && result.data && result.data.length > 2) {
                spreadsheetHeaders = result.data[2]; // Row 3
                spreadsheetRows = result.data.slice(3); // Row 4+
            }

            // 2. Fetch Metadata (JOINING)
            const jRes = await fetch(`${JOINING_SCRIPT_URL}?sheet=JOINING&action=fetch`);
            const jData = await jRes.json();
            let joiningRows = [];
            let jHeaders = [];
            if (jData.success && jData.data && jData.data.length > 6) {
                jHeaders = jData.data[5];
                joiningRows = jData.data.slice(6);
            }
            const getJIdx = (n) => jHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === n.toLowerCase());
            const joiningMeta = joiningRows.map(r => ({
                id: r[getJIdx('Employee ID')]?.toString().trim(),
                name: r[getJIdx('Name As Per Aadhar')]?.toString().trim(),
                designation: r[getJIdx('Designation')]?.toString().trim()
            })).filter(h => h.id);

            // 3. Fetch Master Mapping (from JOINING script - for employee details)
            const MASTER_MAP_URL = `${JOINING_SCRIPT_URL}?sheet=MASTER&action=fetch`;
            const dmRes = await fetch(MASTER_MAP_URL);
            const dmData = await dmRes.json();
            let currentMapping = [];
            if (dmData.success && dmData.data) {
                const rows = dmData.data.slice(1);
                currentMapping = rows.map(r => ({
                    userId: r[5]?.toString().trim(),
                    name: r[6]?.toString().trim(),
                    storeName: r[9]?.toString().trim()
                }));
            }

            // 3b. Fetch Monthly Salary + Designation from PAYROLL MASTER sheet
            //   Col A (index 0) = EMP ID
            //   Col C (index 2) = Designation
            //   Col F (index 5) = Monthly Salary
            const masterSalaryMap = {};      // empId -> monthlySalary
            const masterDesignationMap = {}; // empId -> designation
            const masterDojMap = {};         // empId -> doj
            try {
                const salRes = await fetch(`${PAYROLL_SCRIPT_URL}?sheet=MASTER&action=fetch&spreadsheetId=1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8`);
                const salData = await salRes.json();
                if (salData.success && salData.data) {
                    const salRows = salData.data.slice(1); // skip header row
                    salRows.forEach(r => {
                        const empId = r[0]?.toString().trim(); // Column A = EMP ID
                        if (!empId) return;
                        const salary = r[5]; // Column F = Monthly Salary
                        const desig = r[2]; // Column C = Designation
                        const doj = r[4]; // Column E = DOJ
                        if (salary !== undefined && salary !== '') {
                            masterSalaryMap[empId] = Number(salary) || 0;
                        }
                        if (desig !== undefined && desig !== '') {
                            masterDesignationMap[empId] = desig.toString().trim();
                        }
                        if (doj !== undefined && doj !== '') {
                            masterDojMap[empId] = doj.toString().trim();
                        }
                    });
                }
            } catch (e) {
                console.error('Failed to load data from MASTER sheet:', e);
            }

            // 4. Fetch Attendance for all devices
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const attendanceAgg = {}; // code -> totalPresent
            const globalDailyGrouped = {};
            const logsAvailable = !(selectedYear < 2026 || (selectedYear === 2026 && selectedMonth < 4));

            const startDay = '01';
            const endDay = new Date(selectedYear, selectedMonth, 0).getDate();
            const paddedMonth = selectedMonth.toString().padStart(2, '0');
            let fromDate = `${selectedYear}-${paddedMonth}-${startDay}`;
            let toDate = `${selectedYear}-${paddedMonth}-${endDay}`;

            // Only fetch logs if in 2026-04 onwards
            if (logsAvailable) {
                await Promise.all(DEVICES.map(async (dev) => {
                    try {
                        const apiRes = await fetch(`/api/device-logs?APIKey=211616032630&SerialNumber=${dev.serial}&DeviceName=${dev.apiName}&FromDate=${fromDate}&ToDate=${toDate}`);
                        const rawLogs = await apiRes.json();
                        if (Array.isArray(rawLogs)) {
                            rawLogs.forEach(log => {
                                if (!log.EmployeeCode || !log.LogDate) return;
                                const dateKey = log.LogDate.split(' ')[0];
                                if (dateKey < '2026-04-01') return;
                                const key = `${log.EmployeeCode}_${dateKey}`;
                                globalDailyGrouped[key] = true;
                            });
                        }
                    } catch (e) {
                        console.error(`Error fetching logs for ${dev.name}`, e);
                    }
                }));

                // Convert global map to per-employee counts
                Object.keys(globalDailyGrouped).forEach(key => {
                    const code = key.split('_')[0];
                    attendanceAgg[code] = (attendanceAgg[code] || 0) + 1;
                });
            }

            // 5. Merge Strategy
            // If a row exists in spreadsheet for this Emp + Month + Year, use it.
            // Otherwise, create "virtual" row for everyone in Master/Joining.

            const monthStr = monthNames[selectedMonth - 1];
            const yearStr = selectedYear.toString();

            // Ensure specific columns are present in headers
            const requiredHeaders = ['EMP ID', 'Name of the Employee', 'Year', 'Month', 'Designation', 'Location', 'Total Present'];
            const finalHeaders = [...spreadsheetHeaders];
            requiredHeaders.forEach(rh => {
                if (finalHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === rh.toLowerCase()) === -1) {
                    finalHeaders.push(rh);
                }
            });

            const getIdx = (n) => finalHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === n.toLowerCase());

            const empIdIdx = getIdx('EMP ID');
            const nameIdx = getIdx('Name of the Employee');
            const yearIdx = getIdx('Year');
            const monthIdx = getIdx('Month');
            const desigIdx = getIdx('Designation');
            const locIdx = getIdx('Location');
            const presentIdx = getIdx('Total Present');

            // Index of spreadsheet data for quick lookup
            const spreadsheetMap = {};
            const rowNumberMap = {}; // key -> real sheet row number (1-based)
            const ssEmpIdIdx = spreadsheetHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === 'emp id');
            const ssMonthIdx = spreadsheetHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === 'month');
            const ssYearIdx = spreadsheetHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === 'year');
            spreadsheetRows.forEach((row, i) => {
                const id = ssEmpIdIdx !== -1 ? row[ssEmpIdIdx]?.toString().trim() : '';
                const m = ssMonthIdx !== -1 ? row[ssMonthIdx]?.toString().trim() : '';
                const y = ssYearIdx !== -1 ? row[ssYearIdx]?.toString().trim() : '';
                if (id && m && y) {
                    const key = `${id}_${m}_${y}`;
                    spreadsheetMap[key] = row;
                    // spreadsheetRows starts at data.slice(3), so index 0 = sheet row 4
                    rowNumberMap[key] = i + 4;
                }
            });
            setPayrollRowMap(rowNumberMap);

            const processedKeys = new Set();

            const mergedRows = currentMapping.map(m => {
                const key = `${m.userId}_${monthStr}_${yearStr}`;
                processedKeys.add(key);
                const existing = spreadsheetMap[key];

                let row = new Array(finalHeaders.length).fill('');

                // If existing row, fill what we have
                if (existing) {
                    spreadsheetHeaders.forEach((h, i) => {
                        const targetIdx = finalHeaders.indexOf(h);
                        if (targetIdx !== -1) row[targetIdx] = existing[i];
                    });
                }

                const empMeta = joiningMeta.find(j =>
                    (j.id && j.id.toLowerCase() === m.userId.toLowerCase()) ||
                    (j.name && j.name.toLowerCase() === m.name.toLowerCase())
                );

                // Populate/Override with metadata
                if (empIdIdx !== -1) row[empIdIdx] = m.userId;
                if (nameIdx !== -1) row[nameIdx] = m.name;
                if (yearIdx !== -1) row[yearIdx] = yearStr;
                if (monthIdx !== -1) row[monthIdx] = monthStr;
                if (desigIdx !== -1 && empMeta) row[desigIdx] = empMeta.designation;
                if (locIdx !== -1) row[locIdx] = m.storeName;

                // Map Monthly Salary from MASTER sheet (F column) by EMP ID
                const monthSalIdx2 = getIdx('Monthly Salary');
                const masterSalary = masterSalaryMap[m.userId];
                if (monthSalIdx2 !== -1 && masterSalary !== undefined) {
                    if (!row[monthSalIdx2] || row[monthSalIdx2] === '' || row[monthSalIdx2] === 0) {
                        row[monthSalIdx2] = masterSalary;
                    }
                }

                // Map Designation from MASTER sheet (C column) by EMP ID
                const masterDesig = masterDesignationMap[m.userId];
                if (desigIdx !== -1 && masterDesig) {
                    row[desigIdx] = masterDesig;
                }

                // Map DOJ from MASTER sheet (E column) by EMP ID
                const masterDoj = masterDojMap[m.userId];
                const dojIdx1 = finalHeaders.findIndex(h => h && ['doi', 'doj', 'date of joining'].includes(h.toString().toLowerCase().trim()));
                if (dojIdx1 !== -1 && masterDoj) {
                    if (!row[dojIdx1] || row[dojIdx1].toString().trim() === '') {
                        row[dojIdx1] = masterDoj;
                    }
                }

                // Total Present Logic:
                // Priority:
                // 1. If Logs are available (April 2026+), use API Count + Mgmt Adjustment.
                // 2. If Logs NOT available, use existing spreadsheet data.
                let apiCount = attendanceAgg[m.userId] || 0;
                let calculatedPresent = logsAvailable ? apiCount :
                    (existing && existing[spreadsheetHeaders.indexOf('Total Present')] ? Number(existing[spreadsheetHeaders.indexOf('Total Present')]) : 0);

                // Add Mgmt Adjustment if exists
                const mgmtAdjIdx2 = getIdx('Mgmt Adjustment');
                if (mgmtAdjIdx2 !== -1 && row[mgmtAdjIdx2]) {
                    calculatedPresent += (Number(row[mgmtAdjIdx2]) || 0);
                }
                if (presentIdx !== -1) row[presentIdx] = calculatedPresent;

                // Auto Calculate Total Salary
                const monthSalIdx = getIdx('Monthly Salary');
                const daysMonthIdx = getIdx('Days in a Month');
                const brackageIdx = finalHeaders.findIndex(h => h && ['brackage', 'brackege', 'breakage'].includes(h.toString().toLowerCase().trim()));
                const medicalIdx = finalHeaders.findIndex(h => h && ['medical', 'medicle'].includes(h.toString().toLowerCase().trim()));
                const advDedIdx = getIdx('Advance Deduction');
                const totalSalIdx = getIdx('Total Salary');

                if (totalSalIdx !== -1 && monthSalIdx !== -1 && daysMonthIdx !== -1 &&
                    presentIdx !== -1 && brackageIdx !== -1 && medicalIdx !== -1 && advDedIdx !== -1) {
                    const monthlySalary = Number(row[monthSalIdx]) || 0;
                    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                    row[daysMonthIdx] = daysInMonth;
                    const brackage = Number(row[brackageIdx]) || 0;
                    const medical = Number(row[medicalIdx]) || 0;
                    const advance = Number(row[advDedIdx]) || 0;
                    row[totalSalIdx] = Math.ceil((monthlySalary / daysInMonth) * calculatedPresent) - brackage - medical - advance;
                }

                return row;
            });

            // Append any rows from spreadsheet that match the month/year but are NOT in currentMapping
            Object.keys(spreadsheetMap).forEach(key => {
                const parts = key.split('_');
                if (parts.length >= 3) {
                    const kEmpId = parts[0];
                    const kMonth = parts[1];
                    const kYear = parts.slice(2).join('_');

                    if (kMonth === monthStr && kYear === yearStr && !processedKeys.has(key)) {
                        const existing = spreadsheetMap[key];
                        let row = new Array(finalHeaders.length).fill('');
                        spreadsheetHeaders.forEach((h, i) => {
                            const targetIdx = finalHeaders.indexOf(h);
                            if (targetIdx !== -1) row[targetIdx] = existing[i];
                        });

                        // Maintain explicit IDs for Paid Record
                        if (empIdIdx !== -1) {
                            row[empIdIdx] = kEmpId;
                        }

                        // Map DOJ from MASTER sheet for direct spreadsheet rows:
                        const masterDojDirect = masterDojMap[kEmpId];
                        const dojIdx2 = finalHeaders.findIndex(h => h && ['doi', 'doj', 'date of joining'].includes(h.toString().toLowerCase().trim()));
                        if (dojIdx2 !== -1 && masterDojDirect) {
                            if (!row[dojIdx2] || row[dojIdx2].toString().trim() === '') {
                                row[dojIdx2] = masterDojDirect;
                            }
                        }

                        // Total Present Logic for direct spreadsheet rows:
                        let apiCount = attendanceAgg[kEmpId] || 0;
                        let calculatedPresent = logsAvailable ? apiCount :
                            (existing && existing[spreadsheetHeaders.indexOf('Total Present')] ? Number(existing[spreadsheetHeaders.indexOf('Total Present')]) : 0);

                        const mgmtAdjIdx2 = getIdx('Mgmt Adjustment');
                        if (mgmtAdjIdx2 !== -1 && row[mgmtAdjIdx2]) {
                            calculatedPresent += (Number(row[mgmtAdjIdx2]) || 0);
                        }
                        if (presentIdx !== -1) row[presentIdx] = calculatedPresent;

                        // Auto Calculate Total Salary
                        const monthSalIdx = getIdx('Monthly Salary');
                        const daysMonthIdx = getIdx('Days in a Month');
                        const brackageIdx = finalHeaders.findIndex(h => h && ['brackage', 'brackege', 'breakage'].includes(h.toString().toLowerCase().trim()));
                        const medicalIdx = finalHeaders.findIndex(h => h && ['medical', 'medicle'].includes(h.toString().toLowerCase().trim()));
                        const advDedIdx = getIdx('Advance Deduction');
                        const totalSalIdx = getIdx('Total Salary');

                        if (totalSalIdx !== -1 && monthSalIdx !== -1 && daysMonthIdx !== -1 &&
                            presentIdx !== -1 && brackageIdx !== -1 && medicalIdx !== -1 && advDedIdx !== -1) {
                            const monthlySalary = Number(row[monthSalIdx]) || 0;
                            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                            row[daysMonthIdx] = daysInMonth;
                            const brackage = Number(row[brackageIdx]) || 0;
                            const medical = Number(row[medicalIdx]) || 0;
                            const advance = Number(row[advDedIdx]) || 0;
                            row[totalSalIdx] = Math.ceil((monthlySalary / daysInMonth) * calculatedPresent) - brackage - medical - advance;
                        }

                        mergedRows.push(row);
                    }
                }
            });

            // Remove rows with no EMP ID or Name (null/empty rows)
            const cleanedRows = mergedRows.filter(row => {
                const id = row[empIdIdx]?.toString().trim();
                const name = row[nameIdx]?.toString().trim();
                return id || name;
            });

            setSalaryData({ headers: finalHeaders, rows: cleanedRows });

        } catch (err) {
            setError("Failed to fetch data: " + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistoryData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${PAYROLL_SCRIPT_URL}?sheet=PAID Record&action=fetch&spreadsheetId=1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8`);
            const result = await response.json();
            if (result.success) {
                const allData = result.data || [];
                if (allData.length > 0) {
                    const headers = allData[0];
                    const dataRows = allData.slice(1);
                    setHistoryData({ headers, rows: dataRows });
                }
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError("Failed to fetch history data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'salary') {
            fetchPayrollData();
        } else {
            fetchHistoryData();
        }
        fetchEmployees();
    }, [activeTab, selectedMonth, selectedYear]);

    // Dedicated JOINING sheet script (same as Employee.jsx, Dashboard.jsx, LeaveManagement.jsx)
    const JOINING_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec';

    const fetchEmployees = async () => {
        try {
            const response = await fetch(
                `${JOINING_SCRIPT_URL}?sheet=JOINING&action=fetch&spreadsheetId=1d10niZ9MX1DIVpSqplzANqPylPTYiXq7TYSYSRNaBUg`
            );
            const result = await response.json();
            if (result.success && result.data) {
                // E7:E → data starts row 7 (index 6)
                // Col B (1) = ID, Col E (4) = Name, Col G (6) = DOJ, Col H (7) = Place, Col I (8) = Designation, Col J (9) = Salary
                const emps = result.data.slice(6)
                    .filter(row => row[4] && row[4].toString().trim() !== '')
                    .map(row => ({
                        id: row[1] || '',
                        name: row[4].toString().trim(),
                        dateOfJoining: row[6] ? row[6].toString().trim() : '',
                        joiningPlace: row[7] ? row[7].toString().trim() : '',
                        designation: row[8] ? row[8].toString().trim() : '',
                        salary: row[9] ? row[9].toString().trim() : '0'
                    }));
                setEmployees(emps);
            }
        } catch (err) {
            console.error('Error fetching employees from JOINING sheet:', err);
        }
    };

    const handleEmployeeChange = (name) => {
        const emp = employees.find(e => e.name === name);
        const joinSalary = emp ? (emp.salary || '0') : '0';

        setFormData(prev => ({
            ...prev,
            employeeName: name,
            employeeId: emp ? emp.id : '',
            designation: emp ? emp.designation : '',
            joiningPlace: emp ? emp.joiningPlace : '',
            dateOfJoining: emp ? (emp.dateOfJoining ? formatDate(emp.dateOfJoining) : '') : '',
            monthlySalary: joinSalary,
            advanceDeduction: '0',
            brackage: '0',
            medical: '0',
            totalSalary: joinSalary  // Initial Net is base
        }));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'employeeName') {
            handleEmployeeChange(value);
            return;
        }

        setFormData(prev => {
            const updated = { ...prev, [name]: value };

            // Total Salary = Monthly - Adv - Brack - Med
            const monthly = name === 'monthlySalary' ? Number(value) : Number(prev.monthlySalary || 0);
            const advance = name === 'advanceDeduction' ? Number(value) : Number(prev.advanceDeduction || 0);
            const brack = name === 'brackage' ? Number(value) : Number(prev.brackage || 0);
            const med = name === 'medical' ? Number(value) : Number(prev.medical || 0);

            updated.totalSalary = (monthly - advance - brack - med).toString();

            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.employeeName || !formData.employeeId) {
            toast.error("Please select an employee");
            return;
        }

        setIsSubmitting(true);
        try {
            const now = new Date();
            const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

            // A=S.N | B:P=Layout as per Image | Q=Creation Date
            const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(formData.month);
            const daysInMonth = new Date(Number(formData.year), monthIndex + 1, 0).getDate();
            const creationDate = now.toISOString().split('T')[0];

            const rowData = [
                '',                         // A (0) - S.N
                formData.employeeId,        // B (1) - EMP ID
                formData.employeeName,      // C (2) - Name of the Employee
                formData.designation,       // D (3) - Designation
                formData.joiningPlace,      // E (4) - Location
                formData.dateOfJoining,     // F (5) - DOI
                formData.monthlySalary,     // G (6) - Monthly Salary
                daysInMonth,                // H (7) - Days in a Month
                '0',                        // I (8) - Mgmt Adjustment
                '0',                        // J (9) - Total Present
                formData.advanceDeduction,  // K (10) - Advance Deduction
                formData.brackage,          // L (11) - Brackage
                formData.medical,           // M (12) - Medical
                formData.totalSalary,       // N (13) - Total Salary (Calculated)
                formData.year,              // O (14) - Year
                formData.month,             // P (15) - Month
                creationDate                // Q (16) - Creation Date (YYYY-MM-DD)
            ];

            const response = await fetch(PAYROLL_SCRIPT_URL, {
                method: 'POST',
                body: new URLSearchParams({
                    sheetName: 'PAYROLL',
                    action: 'insert',
                    spreadsheetId: '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8',
                    rowData: JSON.stringify(rowData)
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success("Payroll entry added successfully!");
                setShowModal(false);
                fetchPayrollData(); // Refresh table
                // Reset form
                setFormData(prev => ({
                    ...prev,
                    employeeId: '',
                    employeeName: '',
                    designation: '',
                    joiningPlace: '',
                    dateOfJoining: '',
                    monthlySalary: '0',
                    advanceDeduction: '0',
                    brackage: '0',
                    medical: '0',
                    totalSalary: '0',
                    payDate: new Date().toISOString().split('T')[0]
                }));
            } else {
                toast.error(result.error || "Failed to add payroll entry");
            }
        } catch (err) {
            toast.error("An error occurred during submission");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Checkbox & Edit Handlers ---
    const handleCheckbox = (rowIndex, row) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(rowIndex)) {
                next.delete(rowIndex);
                setEditingData(d => { const nd = { ...d }; delete nd[rowIndex]; return nd; });
            } else {
                next.add(rowIndex);
                setEditingData(d => ({ ...d, [rowIndex]: [...row] }));
            }
            return next;
        });
    };

    const handleCellEdit = (rowIndex, cellIndex, value, headers, originalRow) => {
        setEditingData(prev => {
            const updatedRow = [...(prev[rowIndex] || [])];
            updatedRow[cellIndex] = value;

            // --- LIVE CALCULATION LOGIC ---
            if (headers && originalRow) {
                const getIdx = (name) => headers.findIndex(h => h?.toString().toLowerCase().trim() === name.toLowerCase());

                const mgmtAdjIdx = getIdx('Mgmt Adjustment');
                const presentIdx = getIdx('Total Present');
                const monthSalIdx = getIdx('Monthly Salary');
                const daysMonthIdx = getIdx('Days in a Month');
                const brackageIdx = getIdx('Brackage');
                const medicalIdx = getIdx('Medical');
                const advDedIdx = getIdx('Advance Deduction');
                const totalSalIdx = getIdx('Total Salary');

                // 1. Calculate Total Present dynamically
                if (mgmtAdjIdx !== -1 && presentIdx !== -1) {
                    const origTotalPresent = Number(originalRow[presentIdx]) || 0;
                    const origMgmtAdj = Number(originalRow[mgmtAdjIdx]) || 0;
                    const basePresent = origTotalPresent - origMgmtAdj;
                    const newMgmtAdj = Number(updatedRow[mgmtAdjIdx]) || 0;

                    const newTotalPresent = basePresent + newMgmtAdj;
                    updatedRow[presentIdx] = newTotalPresent;
                }

                // 2. Calculate Total Salary dynamically
                if (
                    totalSalIdx !== -1 && monthSalIdx !== -1 && daysMonthIdx !== -1 &&
                    presentIdx !== -1 && brackageIdx !== -1 && medicalIdx !== -1 && advDedIdx !== -1
                ) {
                    const monthlySalary = Number(updatedRow[monthSalIdx]) || 0;
                    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                    const totalPresent = Number(updatedRow[presentIdx]) || 0;
                    const brackage = Number(updatedRow[brackageIdx]) || 0;
                    const medical = Number(updatedRow[medicalIdx]) || 0;
                    const advance = Number(updatedRow[advDedIdx]) || 0;

                    // Always sync days in month correctly
                    updatedRow[daysMonthIdx] = daysInMonth;

                    const totalSalary = Math.ceil((monthlySalary / daysInMonth) * totalPresent) + brackage + medical - advance;
                    updatedRow[totalSalIdx] = totalSalary;
                }
            }

            return { ...prev, [rowIndex]: updatedRow };
        });
    };

    const handleUpdate = async () => {
        if (selectedRows.size === 0) { toast.error("Please select at least one row to update."); return; }
        setIsUpdating(true);

        const SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

        const updates = [];
        const skipped = [];
        const originalHeaders = salaryData?.headers || [];
        const displayHeaders = getReorderedHeaders(originalHeaders);
        const empIdColIdx = originalHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === 'emp id');
        const monthColIdx = originalHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === 'month');
        const yearColIdx = originalHeaders.findIndex(h => h && h.toString().trim().toLowerCase() === 'year');

        selectedRows.forEach(rowIndex => {
            if (editingData[rowIndex]) {
                const editedRow = editingData[rowIndex];
                const originalDataRow = salaryData.rows[rowIndex] || [];
                const originalDisplayRow = reorderRow(originalDataRow, originalHeaders);

                // Resolve real sheet row by EMP ID + Month + Year (NOT by display position)
                const empId = originalDataRow[empIdColIdx]?.toString().trim();
                const month = originalDataRow[monthColIdx]?.toString().trim();
                const year = originalDataRow[yearColIdx]?.toString().trim();
                const key = `${empId}_${month}_${year}`;
                const sheetRow = payrollRowMap[key];

                if (!sheetRow) {
                    skipped.push(empId || `row ${rowIndex + 1}`);
                    return;
                }

                const changedCells = [];
                for (let j = 0; j < editedRow.length; j++) {
                    if (editedRow[j] !== originalDisplayRow[j]) {
                        const headerName = displayHeaders[j];
                        const originalColIndex = originalHeaders.indexOf(headerName);
                        if (originalColIndex !== -1) {
                            changedCells.push({
                                colIndex: originalColIndex, // 0-based column index as in headers
                                value: editedRow[j]
                            });
                        }
                    }
                }

                if (changedCells.length > 0) {
                    updates.push({ rowIndex: sheetRow, changes: changedCells });
                }
            }
        });

        if (skipped.length > 0) {
            toast.error(`No PAYROLL row exists yet for: ${skipped.join(', ')}. Use Add to create them first.`);
        }

        if (updates.length === 0) {
            toast.error("No values were changed.");
            setIsUpdating(false);
            return;
        }

        try {
            const updatePromises = [];
            for (const update of updates) {
                for (const change of update.changes) {
                    const params = new URLSearchParams({
                        action: 'updateCell',
                        sheetName: 'PAYROLL',
                        spreadsheetId: SPREADSHEET_ID,
                        rowIndex: update.rowIndex.toString(),
                        columnIndex: (change.colIndex + 1).toString(),
                        value: change.value
                    });
                    updatePromises.push(
                        fetch(`${PAYROLL_SCRIPT_URL}?${params.toString()}`)
                    );
                }
            }

            const responses = await Promise.all(updatePromises);
            const results = await Promise.all(responses.map(r => r.json()));

            const hasError = results.some(result => !result.success);

            if (!hasError) {
                toast.success(`${updates.length} row(s) updated successfully!`);
                setSelectedRows(new Set());
                setEditingData({});
                fetchPayrollData();
            } else {
                const errorMsg = results.find(r => !r.success)?.error || 'Server rejected the update';
                toast.error(`Update failed: ${errorMsg}`);
                console.error('GAS responses:', results);
            }
        } catch (e) {
            console.error('Fetch error:', e);
            toast.error(`Network error: ${e.message}`);
        }

        setIsUpdating(false);
    };

    const handleSubmitPayments = async () => {
        if (!salaryData?.rows?.length) {
            toast.error("No payroll rows to submit.");
            return;
        }
        if (!window.confirm(`Submit ${salaryData.rows.length} row(s) to PAID Record sheet?`)) return;

        setIsSubmittingPayments(true);
        const SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

        try {
            const insertPromises = salaryData.rows.map(row => {
                const rowToSubmit = [...row];
                // Find New Payroll Date / Creation Date index and clear it for PAID Record
                const newDateIdx = salaryData.headers.findIndex(h => h && (h.toString().toLowerCase().trim().includes('new payroll date') || h.toString().toLowerCase().trim() === 'creation date'));
                if (newDateIdx !== -1) {
                    rowToSubmit[newDateIdx] = '';
                }

                return fetch(PAYROLL_SCRIPT_URL, {
                    method: 'POST',
                    body: new URLSearchParams({
                        action: 'insert',
                        sheetName: 'PAID Record',
                        spreadsheetId: SPREADSHEET_ID,
                        rowData: JSON.stringify(rowToSubmit)
                    })
                }).then(r => r.json());
            });

            const results = await Promise.all(insertPromises);
            const failed = results.filter(r => !r.success);

            if (failed.length === 0) {
                toast.success(`${results.length} row(s) submitted to PAID Record.`);
                fetchHistoryData();
            } else {
                toast.error(`${failed.length} row(s) failed: ${failed[0]?.error || 'Server rejected the insert'}`);
                console.error('PAID Record insert failures:', failed);
            }
        } catch (e) {
            console.error('Submit payments error:', e);
            toast.error(`Network error: ${e.message}`);
        }

        setIsSubmittingPayments(false);
    };


    const getReorderedHeaders = (headers) => {

        if (!headers) return [];
        const nameIdx = headers.indexOf('Name of the Employee');
        const yearIdx = headers.indexOf('Year');
        const monthIdx = headers.indexOf('Month');

        if (nameIdx === -1 || yearIdx === -1 || monthIdx === -1) return headers;

        const newHeaders = [...headers];
        const year = newHeaders.splice(yearIdx, 1)[0];
        // After removing Year, the month index might change if Year was before it
        const updatedMonthIdx = newHeaders.indexOf('Month');
        const month = newHeaders.splice(updatedMonthIdx, 1)[0];

        // Find Name again in case index shifted
        const updatedNameIdx = newHeaders.indexOf('Name of the Employee');
        newHeaders.splice(updatedNameIdx + 1, 0, year, month);
        return newHeaders;
    };

    const reorderRow = (row, headers) => {
        if (!row || !headers) return row;
        const nameIdx = headers.indexOf('Name of the Employee');
        const yearIdx = headers.indexOf('Year');
        const monthIdx = headers.indexOf('Month');

        if (nameIdx === -1 || yearIdx === -1 || monthIdx === -1) return row;

        const newRow = [...row];
        const year = newRow.splice(yearIdx, 1)[0];
        const tempHeadersForMonth = [...headers];
        tempHeadersForMonth.splice(yearIdx, 1);
        const updatedMonthIdx = tempHeadersForMonth.indexOf('Month');
        const month = newRow.splice(updatedMonthIdx, 1)[0];

        const tempHeadersForName = [...tempHeadersForMonth];
        tempHeadersForName.splice(updatedMonthIdx, 1);
        const updatedNameIdx = tempHeadersForName.indexOf('Name of the Employee');

        newRow.splice(updatedNameIdx + 1, 0, year, month);
        return newRow;
    };

    const renderTable = (data, isSalary = false) => {
        if (!data || !data.headers) return null;

        const headers = isSalary ? getReorderedHeaders(data.headers) : data.headers;
        const filteredRows = data.rows.filter(row =>
            row.some(cell => cell && cell.toString().toLowerCase().includes(searchTerm.toLowerCase()))
        );

        return (
            <div>
                {/* Update Toolbar */}
                {isSalary && selectedRows.size > 0 && (
                    <div className="flex items-center gap-3 mb-4 p-4 bg-white/80 backdrop-blur border border-blue-200 rounded-2xl animate-in slide-in-from-top duration-300 shadow-xl shadow-blue-900/5">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                            <Edit2 size={16} className="ml-0.5" />
                        </div>
                        <span className="text-sm font-semibold text-blue-800">{selectedRows.size} row(s) selected for editing</span>
                        <button
                            onClick={handleUpdate}
                            disabled={isUpdating}
                            className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isUpdating ? 'Updating...' : 'Update Records'}
                        </button>
                        <button
                            onClick={() => { setSelectedRows(new Set()); setEditingData({}); }}
                            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                <div className="overflow-auto max-h-[600px] bg-white ring-1 ring-slate-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                        <thead className="bg-slate-50/90 backdrop-blur-md sticky top-0 z-20">
                            <tr>
                                {/* Action Column Header */}
                                {isSalary && (
                                    <th className="px-5 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 sticky top-0 z-20 w-12 bg-slate-50/90 backdrop-blur-md">
                                        Action
                                    </th>
                                )}
                                {headers.map((header, i) => (
                                    <th key={i} className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md whitespace-nowrap">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {filteredRows.map((row, i) => {
                                const displayRow = isSalary ? reorderRow(row, data.headers) : row;
                                const isSelected = selectedRows.has(i);
                                return (
                                    <tr key={i} className={`transition-all duration-300 group ${isSelected ? 'bg-blue-50/40 relative' : 'hover:bg-slate-50/80'} `}>
                                        {/* Checkbox Cell */}
                                        {isSalary && (
                                            <td className={`px-5 py-3 text-center whitespace-nowrap border-l-4 transition-colors ${isSelected ? 'border-blue-500' : 'border-transparent group-hover:border-slate-200'}`}>
                                                <div className="inline-flex items-center justify-center p-1 rounded-full hover:bg-white transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleCheckbox(i, displayRow)}
                                                        className="w-4 h-4 accent-blue-600 rounded-md cursor-pointer transition-transform hover:scale-110"
                                                    />
                                                </div>
                                            </td>
                                        )}
                                        {displayRow.map((cell, j) => {
                                            const header = headers[j]?.toString().toLowerCase().trim() || "";
                                            const isDateColumn = header.includes('date of joining') || header === 'doj' || header.includes('new payroll date') || header === 'creation date';
                                            const isSno = header === 's.n' || header === 's.no' || header === 'sn';
                                            const isEmpId = header === 'emp id';
                                            const isEmpName = header === 'name of the employee';
                                            const isYear = header === 'year';
                                            const isMonth = header === 'month';
                                            const isDesig = header === 'designation';
                                            const isLoc = header === 'location' || header === 'store name';
                                            const isPresent = header === 'total present';

                                            // Disable deduction fields when they are empty/null in backend
                                            const isAdvance = header === 'advance deduction';
                                            const isBreakage = header === 'brackage' || header === 'brackege' || header === 'breakage';
                                            const isMedical = header === 'medical' || header === 'medicle';
                                            const isAutoDeduction = isAdvance || isBreakage || isMedical;
                                            const hasNoValue = !cell || cell.toString().trim() === '' || cell.toString().trim().toLowerCase() === 'null';
                                            const isDeductionDisabled = isAutoDeduction && hasNoValue;

                                            const isDisabled = isEmpId || isEmpName || isSno || isYear || isMonth || isPresent || isDeductionDisabled;

                                            let displayCell = isDateColumn ? formatDate(cell) : cell;
                                            if (isSno && (!displayCell || displayCell.toString().trim() === '')) {
                                                displayCell = i + 1;
                                            }

                                            if (isSalary && isSelected) {
                                                let inputValue = (isSno ? displayCell : editingData[i]?.[j]) ?? displayCell ?? '';
                                                if (isDateColumn) inputValue = formatDate(inputValue);

                                                return (
                                                    <td key={j} className="px-2 py-2 whitespace-nowrap">
                                                        <input
                                                            type="text"
                                                            value={inputValue}
                                                            onChange={(e) => handleCellEdit(i, j, e.target.value, headers, displayRow)}
                                                            disabled={isDisabled}
                                                            className={`w-full min-w-[80px] px-3 py-1.5 border-2 rounded-xl text-sm font-medium transition-all outline-none ${isDisabled ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed' : 'bg-white text-slate-800 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm'}`}
                                                        />
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td key={j} className={`px-6 py-4 whitespace-nowrap text-sm ${isSno ? 'font-medium text-slate-400' : 'font-medium text-slate-700'}`}>
                                                    {displayCell}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };


    return (
        <div className="p-6 md:p-8 space-y-8 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen font-sans w-[83vw]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight">
                    Payroll Management
                </h1>
                <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-80 h-11">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search payroll records..."
                            className="w-full h-full pl-11 pr-4 bg-white shadow-sm border border-slate-200 rounded-full focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center justify-center gap-2 h-11 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:shadow-lg hover:shadow-blue-500/30 transition-all font-semibold active:scale-95"
                    >
                        <Plus size={18} />
                        New Payroll
                    </button>
                    {activeTab === 'salary' && (
                        <button
                            onClick={handleSubmitPayments}
                            disabled={isSubmittingPayments || !salaryData?.rows?.length}
                            className="flex items-center justify-center gap-2 h-11 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-full hover:shadow-lg hover:shadow-emerald-500/30 transition-all font-semibold active:scale-95 disabled:opacity-50 disabled:hover:shadow-none"
                        >
                            {isSubmittingPayments ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {isSubmittingPayments ? 'Submitting...' : 'Submit Payments'}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex bg-slate-200/60 backdrop-blur-md p-1 rounded-full shadow-inner w-full md:w-auto">
                    <button
                        className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${activeTab === 'salary' ? 'bg-white text-blue-700 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        onClick={() => setActiveTab('salary')}
                    >
                        Salary Sheet
                    </button>
                    <button
                        className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-semibold rounded-full transition-all duration-300 ${activeTab === 'history' ? 'bg-white text-blue-700 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        onClick={() => setActiveTab('history')}
                    >
                        History
                    </button>
                </div>

                {activeTab === 'salary' && (
                    <div className="flex items-center gap-3 bg-white px-4 py-2 border border-slate-200 rounded-full shadow-sm">
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Month</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-transparent rounded-md text-sm font-bold text-slate-700 outline-none transition-colors cursor-pointer"
                            >
                                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, idx) => (
                                    <option key={m} value={idx + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-px h-5 bg-slate-200 mx-1"></div>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Year</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-transparent rounded-md text-sm font-bold text-slate-700 outline-none transition-colors cursor-pointer"
                            >
                                {[2024, 2025, 2026].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <Loader2 className="animate-spin text-blue-600" size={44} />
                    <p className="text-slate-500 animate-pulse font-medium">Fetching payroll records...</p>
                </div>
            ) : error ? (
                <div className="p-6 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-center shadow-sm">
                    <p className="font-semibold">{error}</p>
                    <button onClick={() => activeTab === 'salary' ? fetchPayrollData() : fetchHistoryData()} className="mt-2 text-sm font-bold underline hover:text-red-700">Try Again</button>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {activeTab === 'salary' ? renderTable(salaryData, true) : renderTable(historyData, false)}
                    {((activeTab === 'salary' && salaryData.rows?.length === 0) || (activeTab === 'history' && historyData.rows?.length === 0)) && !loading && (
                        <div className="text-center py-24 bg-white/50 border border-slate-200 border-dashed rounded-2xl flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                <Search className="text-slate-300" size={24} />
                            </div>
                            <p className="text-slate-400 font-medium tracking-wide">No records found for the selected period.</p>
                        </div>
                    )}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/95 backdrop-blur-2xl border border-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white/50">
                            <h3 className="text-lg font-bold text-gray-800">Add New Payroll Entry</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 md:p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto px-2 py-1 custom-scrollbar">
                                {/* Employee ID & Name */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Employee ID</label>
                                    <input
                                        type="text"
                                        name="employeeId"
                                        value={formData.employeeId}
                                        readOnly
                                        className="w-full px-3 py-2.5 bg-slate-100/50 border border-transparent rounded-xl text-sm text-slate-500 font-medium cursor-not-allowed focus:outline-none"
                                        placeholder="Auto-filled"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Employee Name</label>
                                    <select
                                        name="employeeName"
                                        value={formData.employeeName}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium text-slate-700"
                                        required
                                    >
                                        <option value="">Select Employee</option>
                                        {employees.map((emp, i) => (
                                            <option key={i} value={emp.name}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Year & Month */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Year</label>
                                    <input
                                        type="text"
                                        name="year"
                                        value={formData.year}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Month</label>
                                    <select
                                        name="month"
                                        value={formData.month}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                    >
                                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Joining Details (Auto-filled but Editable) */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Designation</label>
                                    <input
                                        type="text"
                                        name="designation"
                                        value={formData.designation}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                        placeholder="Enter Designation"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Joining Place</label>
                                    <input
                                        type="text"
                                        name="joiningPlace"
                                        value={formData.joiningPlace}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                        placeholder="Enter Location"
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Date Of Joining</label>
                                    <div className="relative group">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                        <input
                                            type="text"
                                            name="dateOfJoining"
                                            value={formData.dateOfJoining}
                                            onChange={handleInputChange}
                                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                            placeholder="YYYY-MM-DD"
                                        />
                                    </div>
                                </div>

                                {/* Monthly Salary & Advance Deduction */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Monthly Salary</label>
                                    <input
                                        type="number"
                                        name="monthlySalary"
                                        value={formData.monthlySalary}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Advance Deduction</label>
                                    <input
                                        type="number"
                                        name="advanceDeduction"
                                        value={formData.advanceDeduction}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                    />
                                </div>

                                {/* Brackage & Medical */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Brackage</label>
                                    <input
                                        type="number"
                                        name="brackage"
                                        value={formData.brackage}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Medical</label>
                                    <input
                                        type="number"
                                        name="medical"
                                        value={formData.medical}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                    />
                                </div>

                                {/* Pay Date */}
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-xs font-semibold text-slate-700 ml-1">Pay Date</label>
                                    <div className="relative group">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                        <input
                                            type="date"
                                            name="payDate"
                                            value={formData.payDate}
                                            onChange={handleInputChange}
                                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Total Salary Box (Highlighted before Buttons - Premium Theme) */}
                            <div className="mt-6 relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 border border-white/10 rounded-2xl shadow-xl shadow-blue-900/20">
                                <div className="absolute top-0 right-0 p-12 bg-blue-500/10 blur-3xl rounded-full"></div>
                                <div className="absolute bottom-0 left-0 p-12 bg-indigo-500/10 blur-3xl rounded-full"></div>
                                <div className="relative p-4 px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="space-y-0.5 z-10 text-center md:text-left">
                                        <label className="text-xs font-bold text-blue-200 uppercase tracking-widest">Total Salary</label>
                                        <p className="text-slate-400 text-xs">Net payable after all deductions</p>
                                    </div>
                                    <div className="relative group z-10">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-blue-300">₹</span>
                                        <input
                                            type="text"
                                            name="totalSalary"
                                            value={formData.totalSalary}
                                            readOnly
                                            className="w-48 pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-2xl font-black text-white shadow-inner outline-none transition-all text-right"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row justify-end gap-3 mt-6 pt-4 border-t border-slate-100 font-medium">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-8 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all font-semibold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        'Submit Entry'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Payroll;