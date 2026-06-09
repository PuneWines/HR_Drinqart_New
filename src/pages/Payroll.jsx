import React, { useState, useEffect } from 'react';
import { Search, Loader2, Download, Plus, X, Calendar, Save, Edit2, Filter, Users, DollarSign, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
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
    const [payrollRowMap, setPayrollRowMap] = useState({});
    const [historyData, setHistoryData] = useState({ headers: [], rows: [] });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [editingData, setEditingData] = useState({});
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
        totalSalary: '0',
        payDate: new Date().toISOString().split('T')[0]
    });

    const PAYROLL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1QHKttecIhZwoyh8-xo_wzqHgxIuFr9Tci8L803T1q0nKkjA1w26soUXSffkMY4E0sQ/exec';
    const JOINING_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec';

    // Summary stats
    const totalSalaryAmount = salaryData.rows?.reduce((sum, row) => {
        const totalSalIdx = salaryData.headers?.findIndex(h => h?.toString().toLowerCase().includes('total salary'));
        return sum + (parseFloat(row[totalSalIdx]) || 0);
    }, 0) || 0;

    const totalEmployees = salaryData.rows?.length || 0;

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        let date;
        if (dateStr instanceof Date) {
            date = dateStr;
        } else {
            const iso = Date.parse(dateStr);
            if (!isNaN(iso)) {
                date = new Date(iso);
            } else {
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
            const response = await fetch(`${PAYROLL_SCRIPT_URL}?sheet=PAYROLL&action=fetch&spreadsheetId=1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8`);
            const result = await response.json();
            let spreadsheetRows = [];
            let spreadsheetHeaders = [];
            if (result.success && result.data && result.data.length > 2) {
                spreadsheetHeaders = result.data[2];
                spreadsheetRows = result.data.slice(3);
            }

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

            const masterSalaryMap = {};
            const masterDesignationMap = {};
            const masterDojMap = {};
            try {
                const salRes = await fetch(`${PAYROLL_SCRIPT_URL}?sheet=MASTER&action=fetch&spreadsheetId=1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8`);
                const salData = await salRes.json();
                if (salData.success && salData.data) {
                    const salRows = salData.data.slice(1);
                    salRows.forEach(r => {
                        const empId = r[0]?.toString().trim();
                        if (!empId) return;
                        const salary = r[5];
                        const desig = r[2];
                        const doj = r[4];
                        if (salary !== undefined && salary !== '') masterSalaryMap[empId] = Number(salary) || 0;
                        if (desig !== undefined && desig !== '') masterDesignationMap[empId] = desig.toString().trim();
                        if (doj !== undefined && doj !== '') masterDojMap[empId] = doj.toString().trim();
                    });
                }
            } catch (e) {
                console.error('Failed to load data from MASTER sheet:', e);
            }

            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const attendanceAgg = {};
            const globalDailyGrouped = {};
            const logsAvailable = !(selectedYear < 2026 || (selectedYear === 2026 && selectedMonth < 4));

            const startDay = '01';
            const endDay = new Date(selectedYear, selectedMonth, 0).getDate();
            const paddedMonth = selectedMonth.toString().padStart(2, '0');
            let fromDate = `${selectedYear}-${paddedMonth}-${startDay}`;
            let toDate = `${selectedYear}-${paddedMonth}-${endDay}`;

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
                Object.keys(globalDailyGrouped).forEach(key => {
                    const code = key.split('_')[0];
                    attendanceAgg[code] = (attendanceAgg[code] || 0) + 1;
                });
            }

            const monthStr = monthNames[selectedMonth - 1];
            const yearStr = selectedYear.toString();

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

            const spreadsheetMap = {};
            const rowNumberMap = {};
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

                if (empIdIdx !== -1) row[empIdIdx] = m.userId;
                if (nameIdx !== -1) row[nameIdx] = m.name;
                if (yearIdx !== -1) row[yearIdx] = yearStr;
                if (monthIdx !== -1) row[monthIdx] = monthStr;
                if (desigIdx !== -1 && empMeta) row[desigIdx] = empMeta.designation;
                if (locIdx !== -1) row[locIdx] = m.storeName;

                const monthSalIdx2 = getIdx('Monthly Salary');
                const masterSalary = masterSalaryMap[m.userId];
                if (monthSalIdx2 !== -1 && masterSalary !== undefined) {
                    if (!row[monthSalIdx2] || row[monthSalIdx2] === '' || row[monthSalIdx2] === 0) {
                        row[monthSalIdx2] = masterSalary;
                    }
                }

                const masterDesig = masterDesignationMap[m.userId];
                if (desigIdx !== -1 && masterDesig) {
                    row[desigIdx] = masterDesig;
                }

                const masterDoj = masterDojMap[m.userId];
                const dojIdx1 = finalHeaders.findIndex(h => h && ['doi', 'doj', 'date of joining'].includes(h.toString().toLowerCase().trim()));
                if (dojIdx1 !== -1 && masterDoj) {
                    if (!row[dojIdx1] || row[dojIdx1].toString().trim() === '') {
                        row[dojIdx1] = masterDoj;
                    }
                }

                let apiCount = attendanceAgg[m.userId] || 0;
                let calculatedPresent = logsAvailable ? apiCount :
                    (existing && existing[spreadsheetHeaders.indexOf('Total Present')] ? Number(existing[spreadsheetHeaders.indexOf('Total Present')]) : 0);

                const mgmtAdjIdx2 = getIdx('Mgmt Adjustment');
                if (mgmtAdjIdx2 !== -1 && row[mgmtAdjIdx2]) {
                    calculatedPresent += (Number(row[mgmtAdjIdx2]) || 0);
                }
                if (presentIdx !== -1) row[presentIdx] = calculatedPresent;

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

                        if (empIdIdx !== -1) {
                            row[empIdIdx] = kEmpId;
                        }

                        const masterDojDirect = masterDojMap[kEmpId];
                        const dojIdx2 = finalHeaders.findIndex(h => h && ['doi', 'doj', 'date of joining'].includes(h.toString().toLowerCase().trim()));
                        if (dojIdx2 !== -1 && masterDojDirect) {
                            if (!row[dojIdx2] || row[dojIdx2].toString().trim() === '') {
                                row[dojIdx2] = masterDojDirect;
                            }
                        }

                        let apiCount = attendanceAgg[kEmpId] || 0;
                        let calculatedPresent = logsAvailable ? apiCount :
                            (existing && existing[spreadsheetHeaders.indexOf('Total Present')] ? Number(existing[spreadsheetHeaders.indexOf('Total Present')]) : 0);

                        const mgmtAdjIdx2 = getIdx('Mgmt Adjustment');
                        if (mgmtAdjIdx2 !== -1 && row[mgmtAdjIdx2]) {
                            calculatedPresent += (Number(row[mgmtAdjIdx2]) || 0);
                        }
                        if (presentIdx !== -1) row[presentIdx] = calculatedPresent;

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

    const fetchEmployees = async () => {
        try {
            const response = await fetch(
                `${JOINING_SCRIPT_URL}?sheet=JOINING&action=fetch&spreadsheetId=1d10niZ9MX1DIVpSqplzANqPylPTYiXq7TYSYSRNaBUg`
            );
            const result = await response.json();
            if (result.success && result.data) {
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
            totalSalary: joinSalary
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

            const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(formData.month);
            const daysInMonth = new Date(Number(formData.year), monthIndex + 1, 0).getDate();
            const creationDate = now.toISOString().split('T')[0];

            const rowData = [
                '',
                formData.employeeId,
                formData.employeeName,
                formData.designation,
                formData.joiningPlace,
                formData.dateOfJoining,
                formData.monthlySalary,
                daysInMonth,
                '0',
                '0',
                formData.advanceDeduction,
                formData.brackage,
                formData.medical,
                formData.totalSalary,
                formData.year,
                formData.month,
                creationDate
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
                fetchPayrollData();
                setFormData({
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
                    totalSalary: '0',
                    payDate: new Date().toISOString().split('T')[0]
                });
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

                if (mgmtAdjIdx !== -1 && presentIdx !== -1) {
                    const origTotalPresent = Number(originalRow[presentIdx]) || 0;
                    const origMgmtAdj = Number(originalRow[mgmtAdjIdx]) || 0;
                    const basePresent = origTotalPresent - origMgmtAdj;
                    const newMgmtAdj = Number(updatedRow[mgmtAdjIdx]) || 0;
                    const newTotalPresent = basePresent + newMgmtAdj;
                    updatedRow[presentIdx] = newTotalPresent;
                }

                if (totalSalIdx !== -1 && monthSalIdx !== -1 && daysMonthIdx !== -1 &&
                    presentIdx !== -1 && brackageIdx !== -1 && medicalIdx !== -1 && advDedIdx !== -1) {
                    const monthlySalary = Number(updatedRow[monthSalIdx]) || 0;
                    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
                    const totalPresent = Number(updatedRow[presentIdx]) || 0;
                    const brackage = Number(updatedRow[brackageIdx]) || 0;
                    const medical = Number(updatedRow[medicalIdx]) || 0;
                    const advance = Number(updatedRow[advDedIdx]) || 0;
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
                                colIndex: originalColIndex,
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
        const updatedMonthIdx = newHeaders.indexOf('Month');
        const month = newHeaders.splice(updatedMonthIdx, 1)[0];
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
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Update Toolbar */}
                {isSalary && selectedRows.size > 0 && (
                    <div className="flex items-center gap-3 p-4 bg-indigo-50 border-b border-indigo-100">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600">
                            <Edit2 size={16} />
                        </div>
                        <span className="text-sm font-medium text-indigo-800">{selectedRows.size} row(s) selected</span>
                        <button
                            onClick={handleUpdate}
                            disabled={isUpdating}
                            className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isUpdating ? 'Updating...' : 'Update Records'}
                        </button>
                        <button
                            onClick={() => { setSelectedRows(new Set()); setEditingData({}); }}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                <div className="overflow-x-auto h-[75vh]">
                    <table className="w-full text-sm ">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                            <tr>
                                {isSalary && (
                                    <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs w-12">Select</th>
                                )}
                                {headers.map((header, i) => (
                                    <th key={i} className="text-left px-4 py-3 font-medium text-gray-600 text-xs whitespace-nowrap">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredRows.map((row, i) => {
                                const displayRow = isSalary ? reorderRow(row, data.headers) : row;
                                const isSelected = selectedRows.has(i);
                                return (
                                    <tr key={i} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}>
                                        {isSalary && (
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleCheckbox(i, displayRow)}
                                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                />
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
                                            const isTotalSalary = header === 'total salary';

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
                                                    <td key={j} className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inputValue}
                                                            onChange={(e) => handleCellEdit(i, j, e.target.value, headers, displayRow)}
                                                            disabled={isDisabled}
                                                            className={`w-full min-w-[80px] px-2 py-1 border rounded text-sm transition-colors ${isDisabled ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'}`}
                                                        />
                                                    </td>
                                                );
                                            }

                                            let cellClassName = "px-4 py-3 text-sm ";
                                            if (isTotalSalary) {
                                                cellClassName += "font-semibold text-green-600";
                                            } else if (isPresent) {
                                                cellClassName += "font-medium text-blue-600";
                                            } else {
                                                cellClassName += "text-gray-700";
                                            }

                                            return (
                                                <td key={j} className={cellClassName}>
                                                    {isTotalSalary && displayCell ? `₹${parseFloat(displayCell).toLocaleString()}` : displayCell}
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
        <div className="p-10 pt-5 w-[80vw]">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <DollarSign size={28} />
                        Payroll Management
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Manage employee salaries, deductions, and payment history
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search records..."
                            className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Plus size={18} />
                        New Payroll
                    </button>
                    {activeTab === 'salary' && (
                        <button
                            onClick={handleSubmitPayments}
                            disabled={isSubmittingPayments || !salaryData?.rows?.length}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmittingPayments ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            {isSubmittingPayments ? 'Submitting...' : 'Submit Payments'}
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Stats Cards - Only for Salary Tab */}
            {activeTab === 'salary' && !loading && salaryData.rows?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
                                <p className="text-xs font-medium text-gray-500">Total Salary Amount</p>
                                <p className="text-2xl font-bold text-green-600 mt-1">₹{totalSalaryAmount.toLocaleString()}</p>
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg">
                                <DollarSign size={20} className="text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500">Month</p>
                                <p className="text-xl font-bold text-gray-900 mt-1">
                                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][selectedMonth - 1]}
                                </p>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Calendar size={20} className="text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-gray-500">Year</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{selectedYear}</p>
                            </div>
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <TrendingUp size={20} className="text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-200 mb-6">
                <button
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'salary'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('salary')}
                >
                    Salary Sheet
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'history'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('history')}
                >
                    Payment History
                </button>
            </div>

            {/* Month/Year Filters for Salary Tab */}
            {activeTab === 'salary' && (
                <div className="flex gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, idx) => (
                                <option key={m} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-2 text-gray-500">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        Loading payroll data...
                    </div>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <p className="text-red-600 mb-3">{error}</p>
                    <button
                        onClick={() => activeTab === 'salary' ? fetchPayrollData() : fetchHistoryData()}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                        Retry
                    </button>
                </div>
            ) : (
                <div>
                    {activeTab === 'salary' ? renderTable(salaryData, true) : renderTable(historyData, false)}
                    {((activeTab === 'salary' && salaryData.rows?.length === 0) || (activeTab === 'history' && historyData.rows?.length === 0)) && !loading && (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex flex-col items-center justify-center text-gray-400">
                                <Search size={48} className="mb-3" />
                                <p className="font-medium">No records found</p>
                                <p className="text-xs mt-1">Try adjusting your filters</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add Payroll Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
                            <h2 className="text-lg font-semibold">Add New Payroll Entry</h2>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name</label>
                                        <select
                                            name="employeeName"
                                            value={formData.employeeName}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                            required
                                        >
                                            <option value="">Select Employee</option>
                                            {employees.map((emp, i) => (
                                                <option key={i} value={emp.name}>{emp.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                                        <input
                                            type="text"
                                            name="employeeId"
                                            value={formData.employeeId}
                                            readOnly
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500"
                                            placeholder="Auto-filled"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                        <input
                                            type="text"
                                            name="year"
                                            value={formData.year}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                                        <select
                                            name="month"
                                            value={formData.month}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        >
                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                                        <input
                                            type="text"
                                            name="designation"
                                            value={formData.designation}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Joining Place</label>
                                        <input
                                            type="text"
                                            name="joiningPlace"
                                            value={formData.joiningPlace}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
                                        <input
                                            type="text"
                                            name="dateOfJoining"
                                            value={formData.dateOfJoining}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                            placeholder="YYYY-MM-DD"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary</label>
                                        <input
                                            type="number"
                                            name="monthlySalary"
                                            value={formData.monthlySalary}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Advance Deduction</label>
                                        <input
                                            type="number"
                                            name="advanceDeduction"
                                            value={formData.advanceDeduction}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Brackage</label>
                                        <input
                                            type="number"
                                            name="brackage"
                                            value={formData.brackage}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Medical</label>
                                        <input
                                            type="number"
                                            name="medical"
                                            value={formData.medical}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Salary</label>
                                        <input
                                            type="text"
                                            name="totalSalary"
                                            value={formData.totalSalary}
                                            readOnly
                                            className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm font-semibold text-green-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                                    {isSubmitting ? 'Submitting...' : 'Submit Entry'}
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