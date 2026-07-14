import React, { useState, useEffect } from 'react';
import { Search, Loader2, Download, Calendar, Save, Users, DollarSign, TrendingUp, HelpCircle, Database, X, ChevronDown, Pencil, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

const Payroll = () => {
    const [activeTab, setActiveTab] = useState('salary');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [salaryData, setSalaryData] = useState({ headers: [], rows: [] });
    const [historyData, setHistoryData] = useState({ headers: [], rows: [] });
    const [sortOrder, setSortOrder] = useState('ASC');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedEmpIds, setSelectedEmpIds] = useState(new Set());

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isSubmittingPayments, setIsSubmittingPayments] = useState(false);
    const [isSavingToDB, setIsSavingToDB] = useState(false);
    const [showSchemaModal, setShowSchemaModal] = useState(false);

    // const PAYROLL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1QHKttecIhZwoyh8-xo_wzqHgxIuFr9Tci8L803T1q0nKkjA1w26soUXSffkMY4E0sQ/exec';
    // const SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Helper to parse date strings nicely
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        } catch {
            return dateStr;
        }
    };

    // Helper to parse Google Sheets date/timestamps
    const parseTimestampToMonthYear = (ts) => {
        if (!ts) return { month: null, year: null };
        try {
            // First check if it matches YYYY-MM
            if (/^\d{4}-\d{2}$/.test(ts.toString().trim())) {
                const parts = ts.toString().split('-');
                return { month: parseInt(parts[1], 10), year: parseInt(parts[0], 10) };
            }
            // Check if it's a date string
            const d = new Date(ts);
            if (!isNaN(d.getTime())) {
                return { month: d.getMonth() + 1, year: d.getFullYear() };
            }
            // Split by common separators
            const parts = ts.toString().split(/[\/\-\s]/);
            if (parts.length >= 2) {
                let year = parseInt(parts[0], 10);
                let month = parseInt(parts[1], 10);
                if (year < 100) { // e.g. YY-MM-DD
                    year = 2000 + year;
                }
                if (year < 1000 && parts.length >= 3) {
                    year = parseInt(parts[2], 10);
                    month = parseInt(parts[1], 10);
                }
                return { month, year };
            }
        } catch (e) {
            // ignore
        }
        return { month: null, year: null };
    };

    // Helper to calculate advance/fix advance deduction for target period
    const getAdvanceDeductionForPeriod = (adv, targetYear, targetMonth) => {
        const apprAmount = Number(adv.approved_amount) || Number(adv.amount) || 0;
        const apprMonthlyDeduction = Number(adv.approved_monthly_deduction) || Number(adv.monthly_deduction) || 0;

        if (apprAmount <= 0 || apprMonthlyDeduction <= 0) return { remaining: apprAmount, deduction: 0 };

        const dateSource = adv.starting_month || adv.created_at;
        const dateInfo = parseTimestampToMonthYear(dateSource);
        if (!dateInfo.month || !dateInfo.year) return { remaining: apprAmount, deduction: 0 };

        // Calculate months difference
        const startMonthsSinceEpoch = dateInfo.year * 12 + (dateInfo.month - 1);
        const targetMonthsSinceEpoch = targetYear * 12 + (targetMonth - 1);
        const monthsActive = targetMonthsSinceEpoch - startMonthsSinceEpoch;

        if (monthsActive < 0) {
            // Deduction hasn't started yet
            return { remaining: apprAmount, deduction: 0 };
        }

        // How much has been deducted in previous months
        const previousDeductions = monthsActive * apprMonthlyDeduction;
        const remainingBalance = Math.max(0, apprAmount - previousDeductions);

        if (remainingBalance <= 0) {
            // Already fully paid off
            return { remaining: 0, deduction: 0 };
        }

        // Deduction for this month is the minimum of monthly deduction and remaining balance
        const currentDeduction = Math.min(apprMonthlyDeduction, remainingBalance);
        return { remaining: remainingBalance, deduction: currentDeduction };
    };

    // Fetch dynamic payroll data from Supabase and Google Sheet advances
    const fetchPayrollData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch employees from Supabase
            const { data: dbEmployees, error: empError } = await supabase
                .from('employees')
                .select('employee_id, name_as_per_aadhar, date_of_joining, salary, status, mobile_no, current_account_no, ifsc_code, beneficiary_name');

            if (empError) throw empError;

            const activeEmployees = (dbEmployees || []).filter(emp => {
                if (!emp.status) return true;
                return emp.status.toLowerCase() === 'active';
            });

            // 2. Fetch daily logs for the month to find matched and unmatched employee stats
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            const totalDays = 30; // Every employee has fixed monthly Total days = 30
            const startDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

            const { data: dbLogs, error: logsError } = await supabase
                .from('attendance_logs')
                .select('employee_id, employee_name, status, attendance_date')
                .gte('attendance_date', startDateStr)
                .lte('attendance_date', endDateStr)
                .limit(10000);

            if (logsError) throw logsError;

            const getLocalDayOfWeek = (dateStr) => {
                if (!dateStr) return -1;
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const year = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const day = parseInt(parts[2], 10);
                    return new Date(year, month, day).getDay();
                }
                return new Date(dateStr).getDay();
            };

            const attendanceMap = {};
            const unmatchedMap = {};
            const verifiedIds = new Set((dbEmployees || []).map(e => e.employee_id?.toString().trim().toLowerCase()));

            (dbLogs || []).forEach(log => {
                const empId = log.employee_id?.toString().trim();
                if (!empId) return;

                const empIdLower = empId.toLowerCase();
                const status = log.status?.toString().trim().toLowerCase() || '';
                const isPresent = status === 'present' || status === 'late' || status === 'half day';

                const dayOfWeek = getLocalDayOfWeek(log.attendance_date);
                const isFriday = dayOfWeek === 5;
                const isSaturday = dayOfWeek === 6;
                const isSunday = dayOfWeek === 0;

                if (verifiedIds.has(empIdLower)) {
                    if (!attendanceMap[empIdLower]) {
                        attendanceMap[empIdLower] = { present: 0, absent: 0, hasFriday: false, hasSaturday: false, hasSunday: false };
                    }
                    if (isPresent) {
                        attendanceMap[empIdLower].present++;
                        if (isFriday) attendanceMap[empIdLower].hasFriday = true;
                        if (isSaturday) attendanceMap[empIdLower].hasSaturday = true;
                        if (isSunday) attendanceMap[empIdLower].hasSunday = true;
                    } else if (status === 'absent') {
                        attendanceMap[empIdLower].absent++;
                    }
                } else {
                    if (!unmatchedMap[empId]) {
                        unmatchedMap[empId] = {
                            id: empId,
                            name: log.employee_name || 'Unmatched Employee',
                            present: 0,
                            absent: 0,
                            hasFriday: false,
                            hasSaturday: false,
                            hasSunday: false
                        };
                    }
                    if (isPresent) {
                        unmatchedMap[empId].present++;
                        if (isFriday) unmatchedMap[empId].hasFriday = true;
                        if (isSaturday) unmatchedMap[empId].hasSaturday = true;
                        if (isSunday) unmatchedMap[empId].hasSunday = true;
                    } else if (status === 'absent') {
                        unmatchedMap[empId].absent++;
                    }
                }
            });

            // 3. Fetch advances from Supabase advance_requests table
            const advanceMap = {};
            try {
                const { data: dbAdvances, error: advError } = await supabase
                    .from('advance_requests')
                    .select('employee_id, status, type, created_at, starting_month, amount, monthly_deduction, approved_amount, approved_monthly_deduction');

                if (advError) throw advError;

                (dbAdvances || []).forEach(adv => {
                    const empId = adv.employee_id?.toString().trim().toLowerCase();
                    const status = adv.status?.toString().trim().toLowerCase();
                    if (!empId || (status !== 'approved' && status !== 'received')) return;

                    const type = adv.type?.toString().trim().toLowerCase();

                    if (!advanceMap[empId]) {
                        advanceMap[empId] = {
                            advanceDeduction: 0,
                            fixedAdvanceAmount: 0,
                            fixedAdvanceDeduction: 0
                        };
                    }

                    const { deduction } = getAdvanceDeductionForPeriod(adv, selectedYear, selectedMonth);

                    if (type === 'advance' || type === 'monthly advance') {
                        advanceMap[empId].advanceDeduction += deduction;
                    } else if (type === 'fix advance' || type === 'fixed advance' || type === 'medical amount' || type === 'fixed advanced' || type === 'fixed amount') {
                        const apprAmount = Number(adv.approved_amount) || Number(adv.amount) || 0;
                        advanceMap[empId].fixedAdvanceAmount += apprAmount;
                        advanceMap[empId].fixedAdvanceDeduction += deduction;
                    }
                });
            } catch (e) {
                console.error("Failed to load advances from Supabase:", e);
            }

            // 3b. Fetch saved payroll overrides from Supabase
            const payrollMap = {};
            try {
                const monthStr = monthNames[selectedMonth - 1];
                const { data: dbPayroll, error: payrollError } = await supabase
                    .from('payroll')
                    .select('*')
                    .eq('year', selectedYear)
                    .eq('month', monthStr);

                if (payrollError) throw payrollError;

                (dbPayroll || []).forEach(record => {
                    const code = record.employee_id?.toString().trim().toLowerCase();
                    if (code) {
                        payrollMap[code] = record;
                    }
                });
            } catch (e) {
                console.error("Failed to load saved payroll records from Supabase:", e);
            }

            // 4. Build data rows
            const headers = [
                'Name',
                'Basic salary',
                'Total days',
                'Attendance',
                'Extra 2 days',
                'Advance',
                'Brakeges',
                'Medical',
                'RTO',
                'Basic salary (Prorated)',
                'Seasonal Bonus',
                'Refferal Bonus',
                'Final Salary'
            ];

            const verifiedRows = activeEmployees.map(emp => {
                const empId = emp.employee_id?.toString().trim() || '-';
                const name = emp.name_as_per_aadhar || '-';
                const doj = emp.date_of_joining ? formatDate(emp.date_of_joining) : '-';
                const salary = Number(emp.salary) || 0;

                const empIdLower = empId.toLowerCase();
                const att = attendanceMap[empIdLower] || { present: 0, absent: 0, hasFriday: false, hasSaturday: false, hasSunday: false };
                const originalPresent = att.present;
                const extraDays = (att.hasFriday && att.hasSaturday && att.hasSunday) ? 2 : 0;

                // Load saved overrides
                const savedPayroll = payrollMap[empIdLower];
                const breakageDeduction = savedPayroll ? (Number(savedPayroll.breakage_deduction) || 0) : 0;
                const medicalDeduction = savedPayroll ? (Number(savedPayroll.medical_deduction) || 0) : 0;
                const rtoDeduction = savedPayroll ? (Number(savedPayroll.rto_deduction) || 0) : 0;
                const seasonalBonus = savedPayroll ? (Number(savedPayroll.seasonal_bonus) || 0) : 0;
                const referralBonus = savedPayroll ? (Number(savedPayroll.referral_bonus) || 0) : 0;

                const present = originalPresent;

                const adv = advanceMap[empIdLower] || { advanceDeduction: 0, fixedAdvanceAmount: 0, fixedAdvanceDeduction: 0 };
                const advDeduction = adv.advanceDeduction;

                const dailyRate = totalDays > 0 ? salary / totalDays : 0;
                const calculatedProrated = dailyRate * (present + extraDays);
                const proratedSalary = (savedPayroll && savedPayroll.prorated_salary !== null && savedPayroll.prorated_salary !== undefined)
                    ? Number(savedPayroll.prorated_salary)
                    : calculatedProrated;
                const netSalary = Math.round(Math.max(0, proratedSalary + seasonalBonus + referralBonus - advDeduction - breakageDeduction - medicalDeduction - rtoDeduction));

                return [
                    empId,                     // 0: Emp ID
                    name,                      // 1: Name
                    salary,                    // 2: Basic salary
                    totalDays,                 // 3: Total days
                    present,                   // 4: Attendance
                    extraDays,                 // 5: Extra 2 days
                    advDeduction,              // 6: Advance
                    breakageDeduction,         // 7: Brakeges
                    medicalDeduction,          // 8: Medical
                    rtoDeduction,              // 9: RTO
                    proratedSalary,            // 10: Basic salary (Prorated)
                    seasonalBonus,             // 11: Seasonal Bonus
                    referralBonus,             // 12: Refferal Bonus
                    netSalary,                 // 13: Final Salary
                    savedPayroll ? !!savedPayroll.is_verified : false, // 14: isVerified
                    doj,                       // 15: Date of joining
                    originalPresent,           // 16: originalPresent
                    extraDays,                 // 17: originalExtra
                    emp.mobile_no || '',       // 18: mobile_no
                    emp.current_account_no || '', // 19: current_account_no
                    emp.ifsc_code || '',       // 20: ifsc_code
                    emp.beneficiary_name || '' // 21: beneficiary_name
                ];
            });

            const unmatchedRows = Object.values(unmatchedMap).map(emp => {
                const empIdLower = emp.id.toLowerCase();
                const savedPayroll = payrollMap[empIdLower];

                const breakageDeduction = savedPayroll ? (Number(savedPayroll.breakage_deduction) || 0) : 0;
                const medicalDeduction = savedPayroll ? (Number(savedPayroll.medical_deduction) || 0) : 0;
                const rtoDeduction = savedPayroll ? (Number(savedPayroll.rto_deduction) || 0) : 0;
                const seasonalBonus = savedPayroll ? (Number(savedPayroll.seasonal_bonus) || 0) : 0;
                const referralBonus = savedPayroll ? (Number(savedPayroll.referral_bonus) || 0) : 0;

                const present = emp.present;
                const extraDays = (emp.hasFriday && emp.hasSaturday && emp.hasSunday) ? 2 : 0;
                const salary = 0;

                const adv = advanceMap[empIdLower] || { advanceDeduction: 0, fixedAdvanceAmount: 0, fixedAdvanceDeduction: 0 };
                const advDeduction = adv.advanceDeduction;

                const savedProrated = savedPayroll ? Number(savedPayroll.prorated_salary) : null;
                const proratedSalary = (savedProrated !== null && savedProrated !== undefined && savedPayroll) ? savedProrated : 0;
                const netSalary = Math.round(Math.max(0, proratedSalary + seasonalBonus + referralBonus - advDeduction - breakageDeduction - medicalDeduction - rtoDeduction));

                return [
                    emp.id,                    // 0: Emp ID
                    emp.name,                  // 1: Name
                    salary,                    // 2: Basic salary
                    totalDays,                 // 3: Total days
                    present,                   // 4: Attendance
                    extraDays,                 // 5: Extra 2 days
                    advDeduction,              // 6: Advance
                    breakageDeduction,         // 7: Brakeges
                    medicalDeduction,          // 8: Medical
                    rtoDeduction,              // 9: RTO
                    proratedSalary,            // 10: Basic salary (Prorated)
                    seasonalBonus,             // 11: Seasonal Bonus
                    referralBonus,             // 12: Refferal Bonus
                    netSalary,                 // 13: Final Salary
                    savedPayroll ? !!savedPayroll.is_verified : false, // 14: isVerified
                    '-',                       // 15: Date of joining
                    emp.present,               // 16: originalPresent
                    emp.extra,                 // 17: originalExtra
                    '',                        // 18: mobile_no
                    '',                        // 19: current_account_no
                    '',                        // 20: ifsc_code
                    ''                         // 21: beneficiary_name
                ];
            });

            const allRows = [...verifiedRows, ...unmatchedRows];
            setSalaryData({ headers, rows: allRows });
        } catch (err) {
            setError("Failed to fetch payroll: " + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch payout history from PAID Record sheet
    const fetchHistoryData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${PAYROLL_SCRIPT_URL}?sheet=PAID Record&action=fetch&spreadsheetId=${SPREADSHEET_ID}`);
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
                const headers = result.data[0];
                const dataRows = result.data.slice(1);
                setHistoryData({ headers, rows: dataRows });
            } else {
                setHistoryData({ headers: [], rows: [] });
            }
        } catch (err) {
            setError("Failed to fetch history records");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
        if (activeTab === 'salary') {
            fetchPayrollData();
        } else {
            fetchHistoryData();
        }
    }, [activeTab, selectedMonth, selectedYear, searchTerm]);



    // Save/Upsert current month's calculated salaries into Supabase 'payroll' table
    const handleSavePayrollToDB = async () => {
        if (!salaryData?.rows?.length) {
            toast.error("No payroll records to save.");
            return;
        }

        const selectedRows = salaryData.rows.filter(row => selectedEmpIds.has(row[0]?.toString()));
        const targetRows = selectedRows.length > 0 ? selectedRows : salaryData.rows;

        if (!window.confirm(`Upsert ${targetRows.length} record(s) into database table 'payroll'?`)) return;

        setIsSavingToDB(true);
        try {
            const monthStr = monthNames[selectedMonth - 1];

            const payrollRecords = targetRows.map(row => ({
                employee_id: row[0]?.toString() || '',
                year: Number(selectedYear),
                month: monthStr,
                total_month_days: Number(row[3]) || 0,
                total_present: Number(row[4]) || 0,
                extra_days: Number(row[5]) || 0,
                salary: Number(row[2]) || 0,
                advance_deduction: Number(row[6]) || 0,
                breakage_deduction: Number(row[7]) || 0,
                medical_deduction: Number(row[8]) || 0,
                rto_deduction: Number(row[9]) || 0,
                prorated_salary: Number(row[10]) || 0,
                seasonal_bonus: Number(row[11]) || 0,
                referral_bonus: Number(row[12]) || 0,
                net_salary: Number(row[13]) || 0,
                is_verified: !!row[14]
            }));

            const { error } = await supabase
                .from('payroll')
                .upsert(payrollRecords, { onConflict: 'employee_id,year,month' });

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation "payroll" does not exist')) {
                    toast.error("Database table 'payroll' does not exist.");
                    setShowSchemaModal(true);
                } else if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
                    toast.error("Database table 'payroll' is missing some columns. Please run migration SQL.");
                    setShowSchemaModal(true);
                } else {
                    throw error;
                }
            } else {
                toast.success(`Successfully saved ${payrollRecords.length} records to Supabase 'payroll' table!`);
            }
        } catch (e) {
            console.error(e);
            toast.error(`Failed to save to database: ${e.message}`);
        } finally {
            setIsSavingToDB(false);
        }
    };

    // Export current view table to Excel
    const handleExportExcel = () => {
        const data = activeTab === 'salary' ? salaryData : historyData;
        if (!data || !data.rows.length) {
            toast.error("No data to export.");
            return;
        }

        const selectedRows = data.rows.filter(row => selectedEmpIds.has(row[0]?.toString()));
        const targetRows = selectedRows.length > 0 ? selectedRows : data.rows;

        const cleanRows = activeTab === 'salary'
            ? targetRows.map(row => row.slice(1, data.headers.length + 1))
            : targetRows;

        const ws = XLSX.utils.aoa_to_sheet([data.headers, ...cleanRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, activeTab === 'salary' ? 'Salary Sheet' : 'Payout History');

        const fileName = activeTab === 'salary'
            ? `payroll_salary_sheet_${selectedYear}_${selectedMonth}.xlsx`
            : `payroll_history_${new Date().toISOString().split('T')[0]}.xlsx`;

        XLSX.writeFile(wb, fileName);
        toast.success("Excel exported successfully!");
    };

    // Export bank transfer details as CSV matching specified template
    const handleExportBankCSV = () => {
        if (!salaryData?.rows?.length) {
            toast.error("No payroll data to export.");
            return;
        }

        const selectedRows = salaryData.rows.filter(row => selectedEmpIds.has(row[0]?.toString()));
        const targetRows = selectedRows.length > 0 ? selectedRows : salaryData.rows;

        const headers = [
            'Client_Code', 'Product_Code', 'Payment_Type', 'Payment_Ref_No.', 'Payment_Date', 'Instrument Date',
            'Dr_Ac_No', 'Amount', 'Bank_Code_Indicator', 'Beneficiary_Code', 'Beneficiary_Name', 'Beneficiary_Bank',
            'Beneficiary_Branch / IFSC Code', 'Beneficiary_Acc_No', 'Location', 'Print_Location', 'Instrument_Number',
            'Ben_Add1', 'Ben_Add2', 'Ben_Add3', 'Ben_Add4', 'Beneficiary_Email', 'Beneficiary_Mobile',
            'Debit_Narration', 'Credit_Narration', 'Payment Details 1', 'Payment Details 2', 'Payment Details 3',
            'Payment Details 4', 'Enrichment_1', 'Enrichment_2', 'Enrichment_3', 'Enrichment_4', 'Enrichment_5',
            'Enrichment_6', 'Enrichment_7', 'Enrichment_8', 'Enrichment_9', 'Enrichment_10', 'Enrichment_11',
            'Enrichment_12', 'Enrichment_13', 'Enrichment_14', 'Enrichment_15', 'Enrichment_16', 'Enrichment_17',
            'Enrichment_18', 'Enrichment_19', 'Enrichment_20'
        ];

        const csvLines = [headers.join(',')];

        targetRows.forEach(row => {
            const amount = row[13] || 0;
            const beneficiaryName = row[21] || row[1] || '';
            const ifscCode = row[20] || '';
            const accNo = row[19] || '';
            const mobileNo = row[18] || '';
            const debitNarration = `${beneficiaryName} Salary`;

            // Build output line matching columns array index sequence
            const line = Array(headers.length).fill('');
            line[7] = amount;                                                             // Amount (column 8)
            line[10] = beneficiaryName ? `"${beneficiaryName.replace(/"/g, '""')}"` : ''; // Beneficiary_Name (column 11)
            line[12] = ifscCode ? `"${ifscCode.replace(/"/g, '""')}"` : '';               // Beneficiary_Branch / IFSC Code (column 13)
            line[13] = accNo ? `"${accNo.replace(/"/g, '""')}"` : '';                     // Beneficiary_Acc_No (column 14)
            line[22] = mobileNo ? `"${mobileNo.replace(/"/g, '""')}"` : '';               // Beneficiary_Mobile (column 23)
            line[23] = debitNarration ? `"${debitNarration.replace(/"/g, '""')}"` : '';   // Debit_Narration (column 24)

            csvLines.push(line.join(','));
        });

        // Generate download
        const blob = new Blob([csvLines.join("\r\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `payroll_bank_transfer_${selectedYear}_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Bank CSV exported successfully!");
    };

    // Filter and dynamically sort rows based on search input and sortOrder state
    const getSortedAndFilteredRows = (data) => {
        if (!data || !data.rows) return [];

        let filtered = data.rows.filter(row =>
            row.some(cell => cell && cell.toString().toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (activeTab === 'salary' && sortOrder !== 'DEFAULT') {
            filtered = [...filtered].sort((a, b) => {
                const idA = (a[0] || '').toString().trim();
                const idB = (b[0] || '').toString().trim();
                const comparison = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
                return sortOrder === 'ASC' ? comparison : -comparison;
            });
        }
        return filtered;
    };

    // Calculate Summary Totals
    const totalEmployeesCount = salaryData.rows?.length || 0;
    const totalBaseSalarySum = salaryData.rows?.reduce((sum, row) => sum + (Number(row[2]) || 0), 0) || 0;
    const totalNetPayableSum = salaryData.rows?.reduce((sum, row) => sum + (Number(row[15]) || 0), 0) || 0;
    const totalDeductionsSum = salaryData.rows?.reduce((sum, row) => sum + (Number(row[6]) || 0) + (Number(row[8]) || 0) + (Number(row[9]) || 0) + (Number(row[10]) || 0) + (Number(row[14]) || 0), 0) || 0;

    // Pagination variables
    const pageSize = 15;
    const currentData = activeTab === 'salary' ? salaryData : historyData;
    const filteredRows = getSortedAndFilteredRows(currentData);
    const totalPages = Math.ceil(filteredRows.length / pageSize);
    const activePage = Math.min(currentPage, Math.max(1, totalPages));
    const paginatedRows = filteredRows.slice((activePage - 1) * pageSize, activePage * pageSize);

    const renderPagination = () => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs">
                <div className="text-gray-500">
                    Showing <span className="font-semibold">{(activePage - 1) * pageSize + 1}</span> to <span className="font-semibold">{Math.min(activePage * pageSize, filteredRows.length)}</span> of <span className="font-semibold">{filteredRows.length}</span> records
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        disabled={activePage === 1}
                        onClick={() => setCurrentPage(activePage - 1)}
                        className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold rounded shadow-sm cursor-pointer"
                    >
                        Previous
                    </button>
                    <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => page === 1 || page === totalPages || Math.abs(page - activePage) <= 1)
                            .map((page, index, arr) => {
                                const showEllipsis = index > 0 && page - arr[index - 1] > 1;
                                return (
                                    <React.Fragment key={page}>
                                        {showEllipsis && <span className="text-gray-400 px-1">...</span>}
                                        <button
                                            onClick={() => setCurrentPage(page)}
                                            className={`px-2.5 py-1.5 font-semibold rounded border transition-all cursor-pointer ${activePage === page
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                    </div>
                    <button
                        disabled={activePage === totalPages}
                        onClick={() => setCurrentPage(activePage + 1)}
                        className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold rounded shadow-sm cursor-pointer"
                    >
                        Next
                    </button>
                </div>
            </div>
        );
    };

    const handleManualInputChange = (empId, colIndex, val) => {
        const numVal = val === '' ? 0 : Number(val);
        const empIdLower = empId?.toString().toLowerCase();

        setSalaryData(prev => {
            const updatedRows = prev.rows.map(r => {
                if (r[0]?.toString().toLowerCase() === empIdLower) {
                    const newRow = [...r];
                    newRow[colIndex] = numVal;

                    // Recalculate Final Salary
                    // Index 11: prorated salary, Index 12: seasonal bonus, Index 13: referral bonus
                    // Index 6: advance, Index 8: breakage, Index 9: medical, Index 10: RTO, Index 14: fix advance deduction
                    const prorated = Number(newRow[11]) || 0;
                    const seasonal = Number(newRow[12]) || 0;
                    const referral = Number(newRow[13]) || 0;
                    const advance = Number(newRow[6]) || 0;
                    const breakage = Number(newRow[8]) || 0;
                    const medical = Number(newRow[9]) || 0;
                    const rto = Number(newRow[10]) || 0;
                    const fixAdvDeduction = Number(newRow[14]) || 0;

                    newRow[15] = Math.round(Math.max(0, prorated + seasonal + referral - advance - breakage - medical - rto - fixAdvDeduction));
                    return newRow;
                }
                return r;
            });
            return { ...prev, rows: updatedRows };
        });
    };

    return (
        <div className="p-8 pt-4 w-full max-w-full overflow-x-hidden">
            {/* Header Area */}
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <DollarSign size={24} className="text-indigo-600" />
                        Payroll Management
                    </h1>
                    <p className="text-gray-500 text-xs mt-0.5">
                        Dynamic payroll generated directly from employees table and attendance monthly database logs
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search records..."
                            className="pl-9 pr-3 py-1.5 border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-60 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {activeTab === 'salary' && (
                        <div className="relative">
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-1.5 border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold text-slate-700 rounded cursor-pointer"
                            >
                                <option value="ASC">Sort: ID Ascending</option>
                                <option value="DESC">Sort: ID Descending</option>
                                <option value="DEFAULT">Sort: Default</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                    )}
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium text-xs transition-colors rounded shadow-sm cursor-pointer"
                    >
                        <Download size={14} />
                        Export Excel
                    </button>
                    {activeTab === 'salary' && (
                        <button
                            onClick={handleExportBankCSV}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs transition-colors rounded shadow-sm cursor-pointer"
                        >
                            <Download size={14} />
                            Export Bank CSV
                        </button>
                    )}
                    {activeTab === 'salary' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchPayrollData}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors rounded disabled:opacity-50 shadow-sm cursor-pointer"
                            >
                                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                {loading ? 'Refreshing...' : 'Refresh'}
                            </button>
                            <button
                                onClick={handleSavePayrollToDB}
                                disabled={isSavingToDB || !salaryData?.rows?.length}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors rounded disabled:opacity-50 shadow-sm cursor-pointer"
                            >
                                {isSavingToDB ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                                {isSavingToDB ? 'Saving...' : 'Save to Storage'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Stats Panels */}
            {activeTab === 'salary' && !loading && salaryData.rows?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border-b border-l border-gray-200 p-4 ">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Active Employees</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">{totalEmployeesCount}</p>
                            </div>
                            <div className="p-2 bg-indigo-50 rounded">
                                <Users size={16} className="text-indigo-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-b border-l border-gray-200 p-4 ">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Total Base Salary</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">₹{totalBaseSalarySum.toLocaleString()}</p>
                            </div>
                            <div className="p-2 bg-blue-50 rounded">
                                <DollarSign size={16} className="text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-b border-l border-gray-200 p-4 ">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Advance Deductions</p>
                                <p className="text-xl font-bold text-orange-600 mt-1">₹{totalDeductionsSum.toLocaleString()}</p>
                            </div>
                            <div className="p-2 bg-orange-50 rounded">
                                <TrendingUp size={16} className="text-orange-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-b border-l border-gray-200 p-4 ">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Total Net Payable</p>
                                <p className="text-xl font-bold text-green-600 mt-1">₹{totalNetPayableSum.toLocaleString()}</p>
                            </div>
                            <div className="p-2 bg-green-50 rounded">
                                <DollarSign size={16} className="text-green-600" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Tabs & Date Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-gray-200 mb-5">
                <div className="flex gap-4">
                    <button
                        className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition-all ${activeTab === 'salary'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('salary')}
                    >
                        Salary Sheet
                    </button>
                    <button
                        className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition-all ${activeTab === 'history'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('history')}
                    >
                        Payment History
                    </button>
                </div>

                {activeTab === 'salary' && (
                    <div className="flex gap-2 pb-2">
                        <div className="flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded">
                            <span className="text-[10px] font-semibold text-gray-500 uppercase">Month:</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="text-xs bg-transparent focus:outline-none font-medium text-gray-800"
                            >
                                {monthNames.map((m, idx) => (
                                    <option key={m} value={idx + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded">
                            <span className="text-[10px] font-semibold text-gray-500 uppercase">Year:</span>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="text-xs bg-transparent focus:outline-none font-medium text-gray-800"
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Dynamic Grid / Table */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <span className="text-xs">Loading payroll and attendance details...</span>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 p-6 text-center rounded">
                    <p className="text-red-600 text-xs mb-3">{error}</p>
                    <button
                        onClick={() => activeTab === 'salary' ? fetchPayrollData() : fetchHistoryData()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors font-medium"
                    >
                        Retry
                    </button>
                </div>
            ) : (
                <div className="bg-white border border-gray-200  overflow-hidden max-w-full">
                    {selectedEmpIds.size > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2">
                                <div className="p-1 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center">
                                    <Pencil size={12} className="animate-pulse" />
                                </div>
                                <span className="text-xs font-semibold text-indigo-900">
                                    {selectedEmpIds.size} row(s) selected
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSavePayrollToDB}
                                    disabled={isSavingToDB}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors rounded shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingToDB ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Update Records
                                </button>
                                <button
                                    onClick={() => setSelectedEmpIds(new Set())}
                                    className="text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="overflow-x-auto max-h-[61vh] scrollbar-thin max-w-full">
                        <table className="w-full min-w-[1400px] text-xs text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2.5 font-semibold text-gray-600 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={paginatedRows.length > 0 && paginatedRows.every(row => selectedEmpIds.has(row[0]?.toString()))}
                                            onChange={(e) => {
                                                const newSelected = new Set(selectedEmpIds);
                                                paginatedRows.forEach(row => {
                                                    const id = row[0]?.toString();
                                                    if (id) {
                                                        if (e.target.checked) {
                                                            newSelected.add(id);
                                                        } else {
                                                            newSelected.delete(id);
                                                        }
                                                    }
                                                });
                                                setSelectedEmpIds(newSelected);
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-4 py-2.5 font-semibold text-gray-600 w-12 text-center">S.no</th>
                                    {(activeTab === 'salary' ? salaryData.headers : historyData.headers).map((header, idx) => (
                                        <th key={idx} className="px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap text-center">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-medium">
                                {paginatedRows.map((row, idx) => {
                                    const headersList = activeTab === 'salary' ? salaryData.headers : historyData.headers;
                                    const cleanRow = activeTab === 'salary' ? row.slice(0, headersList.length) : row;
                                    const isVerified = activeTab === 'salary' ? row[16] !== false : true;
                                    const cellsToRender = activeTab === 'salary'
                                        ? headersList.map((header, j) => ({ header, cell: row[j + 1] }))
                                        : cleanRow.map((cell, j) => ({ header: headersList[j], cell }));

                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-2.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEmpIds.has(row[0]?.toString())}
                                                    onChange={(e) => {
                                                        const newSelected = new Set(selectedEmpIds);
                                                        const id = row[0]?.toString();
                                                        if (id) {
                                                            if (e.target.checked) {
                                                                newSelected.add(id);
                                                            } else {
                                                                newSelected.delete(id);
                                                            }
                                                        }
                                                        setSelectedEmpIds(newSelected);
                                                    }}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-gray-400 font-mono border-r border-gray-100">{(activePage - 1) * pageSize + idx + 1}</td>
                                            {cellsToRender.map(({ header, cell }, j) => {
                                                const headerName = header?.toLowerCase() || '';

                                                // Highlight cells based on their data type
                                                let cellClass = "px-4 py-2.5 text-slate-700 font-sans text-center";
                                                let content = cell;

                                                const isCurrency = headerName === 'basic salary' ||
                                                    headerName === 'basic salary (prorated)' ||
                                                    headerName === 'advance' ||
                                                    headerName === 'fix advance' ||
                                                    headerName === 'fix advance (deduction)' ||
                                                    headerName === 'brakeges' ||
                                                    headerName === 'medical' ||
                                                    headerName === 'rto' ||
                                                    headerName === 'seasonal bonus' ||
                                                    headerName === 'refferal bonus';

                                                if (headerName === 'emp id' || headerName.includes('id')) {
                                                    cellClass = "px-4 py-2.5 font-mono text-gray-500 font-medium text-center border-r border-gray-100";
                                                } else if (headerName === 'final salary') {
                                                    cellClass = "px-4 py-2.5 text-green-600 font-bold font-mono text-right";
                                                    content = `₹${Math.round(Number(cell) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                                                } else if (isCurrency) {
                                                    cellClass = "px-4 py-2.5 font-mono text-slate-600 text-right";
                                                    content = cell > 0 ? `₹${Number(cell).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}` : '-';
                                                } else if (headerName === 'attendance' || headerName === 'extra 2 days') {
                                                    cellClass = "px-4 py-2.5 text-indigo-600 font-bold text-center";
                                                } else if (headerName === 'total days') {
                                                    cellClass = "px-4 py-2.5 text-center text-slate-500 font-mono";
                                                }

                                                if (headerName === 'name') {
                                                    cellClass = "px-4 py-2.5 text-slate-700 font-sans text-left";
                                                    content = (
                                                        <div className="flex flex-col">
                                                            <span>{cell}</span>
                                                            {!isVerified && (
                                                                <span className="text-[9px] text-amber-600 font-semibold block mt-0.5">⚠️ Unverified</span>
                                                            )}
                                                        </div>
                                                    );
                                                } else if (headerName === 'brakeges') {
                                                    cellClass = "px-4 py-2.5 text-center";
                                                    content = (
                                                        <input
                                                            type="number"
                                                            disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                            value={cell === 0 ? '' : cell}
                                                            placeholder="0"
                                                            onChange={(e) => handleManualInputChange(row[0], 7, e.target.value)}
                                                            className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                        />
                                                    );
                                                } else if (headerName === 'medical') {
                                                    cellClass = "px-4 py-2.5 text-center";
                                                    content = (
                                                        <input
                                                            type="number"
                                                            disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                            value={cell === 0 ? '' : cell}
                                                            placeholder="0"
                                                            onChange={(e) => handleManualInputChange(row[0], 8, e.target.value)}
                                                            className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                        />
                                                    );
                                                } else if (headerName === 'rto') {
                                                    cellClass = "px-4 py-2.5 text-center";
                                                    content = (
                                                        <input
                                                            type="number"
                                                            disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                            value={cell === 0 ? '' : cell}
                                                            placeholder="0"
                                                            onChange={(e) => handleManualInputChange(row[0], 9, e.target.value)}
                                                            className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                        />
                                                    );
                                                } else if (headerName === 'seasonal bonus') {
                                                    cellClass = "px-4 py-2.5 text-center";
                                                    content = (
                                                        <input
                                                            type="number"
                                                            disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                            value={cell === 0 ? '' : cell}
                                                            placeholder="0"
                                                            onChange={(e) => handleManualInputChange(row[0], 11, e.target.value)}
                                                            className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                        />
                                                    );
                                                } else if (headerName === 'refferal bonus') {
                                                    cellClass = "px-4 py-2.5 text-center";
                                                    content = (
                                                        <input
                                                            type="number"
                                                            disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                            value={cell === 0 ? '' : cell}
                                                            placeholder="0"
                                                            onChange={(e) => handleManualInputChange(row[0], 12, e.target.value)}
                                                            className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                        />
                                                    );
                                                } else if (headerName === 'basic salary (prorated)') {
                                                    cellClass = "px-4 py-2.5 text-center";
                                                    content = (
                                                        <input
                                                            type="number"
                                                            disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                            value={cell === 0 ? '' : cell}
                                                            placeholder="0"
                                                            onChange={(e) => handleManualInputChange(row[0], 10, e.target.value)}
                                                            className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                        />
                                                    );
                                                }

                                                return (
                                                    <td key={j} className={cellClass}>
                                                        {content}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}

                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={20} className="text-center py-12 bg-gray-50/50">
                                            <div className="flex flex-col items-center justify-center text-gray-400 gap-1.5">
                                                <HelpCircle size={32} />
                                                <p className="font-semibold text-gray-600 text-xs">No payroll records found</p>
                                                <p className="text-[10px] text-gray-400">Try matching by name, id or checking your database tables</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination()}
                </div>
            )}

            {showSchemaModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden transition-all transform scale-100">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <Database size={16} className="text-indigo-600" />
                                Database Table Required
                            </h3>
                            <button
                                onClick={() => setShowSchemaModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5">
                            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                                The <code>payroll</code> table or its columns are missing from your Supabase database. Please copy the SQL code below, open your <strong>Supabase SQL Editor</strong>, paste and run it to create the table or migrate its columns.
                            </p>
                            <div className="relative bg-slate-950 rounded-lg p-3.5 mb-4">
                                <pre className="text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-48 scrollbar-thin whitespace-pre-wrap">
                                    {`CREATE TABLE IF NOT EXISTS payroll (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    month VARCHAR(50) NOT NULL,
    total_month_days INTEGER DEFAULT 0,
    total_present INTEGER DEFAULT 0,
    extra_days INTEGER DEFAULT 0,
    salary NUMERIC DEFAULT 0,
    advance_deduction NUMERIC DEFAULT 0,
    breakage_deduction NUMERIC DEFAULT 0,
    medical_deduction NUMERIC DEFAULT 0,
    rto_deduction NUMERIC DEFAULT 0,
    prorated_salary NUMERIC DEFAULT 0,
    seasonal_bonus NUMERIC DEFAULT 0,
    referral_bonus NUMERIC DEFAULT 0,
    net_salary NUMERIC DEFAULT 0,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (employee_id, year, month)
);

ALTER TABLE public.payroll 
ADD COLUMN IF NOT EXISTS extra_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rto_deduction NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS prorated_salary NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS seasonal_bonus NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_bonus NUMERIC DEFAULT 0,
DROP COLUMN IF EXISTS total_absent,
DROP COLUMN IF EXISTS advance_amount,
DROP COLUMN IF EXISTS management_adjustment,
DROP COLUMN IF EXISTS fixed_advance_amount,
DROP COLUMN IF EXISTS fixed_advance_deduction;`}
                                </pre>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS payroll (\n    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n    employee_id VARCHAR(255) NOT NULL,\n    year INTEGER NOT NULL,\n    month VARCHAR(50) NOT NULL,\n    total_month_days INTEGER DEFAULT 0,\n    total_present INTEGER DEFAULT 0,\n    extra_days INTEGER DEFAULT 0,\n    salary NUMERIC DEFAULT 0,\n    advance_deduction NUMERIC DEFAULT 0,\n    breakage_deduction NUMERIC DEFAULT 0,\n    medical_deduction NUMERIC DEFAULT 0,\n    rto_deduction NUMERIC DEFAULT 0,\n    prorated_salary NUMERIC DEFAULT 0,\n    seasonal_bonus NUMERIC DEFAULT 0,\n    referral_bonus NUMERIC DEFAULT 0,\n    net_salary NUMERIC DEFAULT 0,\n    is_verified BOOLEAN DEFAULT TRUE,\n    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,\n    UNIQUE (employee_id, year, month)\n);\n\nALTER TABLE public.payroll \nADD COLUMN IF NOT EXISTS extra_days INTEGER DEFAULT 0,\nADD COLUMN IF NOT EXISTS rto_deduction NUMERIC DEFAULT 0,\nADD COLUMN IF NOT EXISTS prorated_salary NUMERIC DEFAULT 0,\nADD COLUMN IF NOT EXISTS seasonal_bonus NUMERIC DEFAULT 0,\nADD COLUMN IF NOT EXISTS referral_bonus NUMERIC DEFAULT 0,\nDROP COLUMN IF EXISTS total_absent,\nDROP COLUMN IF EXISTS advance_amount,\nDROP COLUMN IF EXISTS management_adjustment,\nDROP COLUMN IF EXISTS fixed_advance_amount,\nDROP COLUMN IF EXISTS fixed_advance_deduction;`);
                                        toast.success("SQL copied to clipboard!");
                                    }}
                                    className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-gray-300 rounded font-medium transition-colors cursor-pointer"
                                >
                                    Copy SQL
                                </button>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowSchemaModal(false)}
                                    className="px-3.5 py-1.5 border border-gray-200 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payroll;