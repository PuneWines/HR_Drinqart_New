import React, { useState, useEffect } from 'react';
import { Search, X, Check, Clock, Wallet, Banknote, Stethoscope, Hammer, Loader2, Filter, Users, TrendingUp, Database, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const formatStartingMonth = (monthStr) => {
  if (!monthStr) return '-';
  try {
    const [year, month] = monthStr.split('-');
    if (year && month) {
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  } catch (e) {
    // ignore
  }
  return monthStr;
};

const AdminAdvance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [rejectedRequests, setRejectedRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [fixedReceivedRequests, setFixedReceivedRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [submitStatus, setSubmitStatus] = useState('Pending');
  const [addModalType, setAddModalType] = useState('Pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [approvedAmount, setApprovedAmount] = useState('');
  const [approvedMonthlyDeduction, setApprovedMonthlyDeduction] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  const [employeesList, setEmployeesList] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmpId, setNewEmpId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDeduction, setNewDeduction] = useState('');
  const [newType, setNewType] = useState('Monthly Advance');
  const [newReason, setNewReason] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const getCurrentMonthStr = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  };
  const [newStartingMonth, setNewStartingMonth] = useState(getCurrentMonthStr());
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1QHKttecIhZwoyh8-xo_wzqHgxIuFr9Tci8L803T1q0nKkjA1w26soUXSffkMY4E0sQ/exec';
  // const SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

  const fetchData = async () => {
    setLoading(true);
    setTableLoading(true);
    try {
      /* Commented out the Google Sheets integration:
      const response = await fetch(`${SCRIPT_URL}?sheet=ADVANCE&action=fetch&spreadsheetId=${SPREADSHEET_ID}`);
      const result = await response.json();
      if (result.success) {
        const rawRows = result.data || [];
        const dataRows = (rawRows.length > 0 && Array.isArray(rawRows[0])) ? rawRows.slice(1) : rawRows;

        const allRecords = dataRows.map((row, idx) => ({
          rowIndex: idx + 2,
          timestamp: row[0],
          empId: row[1],
          empName: row[2],
          amount: row[3],
          monthlyDeduction: row[4],
          reason: row[5],
          status: row[6] || 'Pending',
          type: row[7] || 'Advance',
          apprAmount: row[8] || '',
          apprMonthlyDeduction: row[9] || '',
          adminRemarks: row[10] || ''
        })).reverse();

        setPendingRequests(allRecords.filter(r => r.status?.toLowerCase() === 'pending'));
        setApprovedRequests(allRecords.filter(r => r.status?.toLowerCase() === 'approved'));
        setRejectedRequests(allRecords.filter(r => r.status?.toLowerCase() === 'rejected'));
      }
      */

      // 1. Fetch active employees to resolve names
      const { data: dbEmployees, error: empError } = await supabase
        .from('employees')
        .select('employee_id, name_as_per_aadhar');

      if (empError) throw empError;
      setEmployeesList(dbEmployees || []);

      const employeeMap = {};
      (dbEmployees || []).forEach(emp => {
        if (emp.employee_id) {
          employeeMap[emp.employee_id.toLowerCase().trim()] = emp.name_as_per_aadhar;
        }
      });

      // 2. Fetch advance requests from Supabase
      const { data: advances, error: advError } = await supabase
        .from('advance_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (advError) {
        if (advError.code === '42P01' || advError.message?.includes('relation "advance_requests" does not exist')) {
          setShowSchemaModal(true);
          throw new Error("Table 'advance_requests' does not exist in Supabase.");
        } else {
          throw advError;
        }
      }

      const allRecords = (advances || []).map(adv => ({
        id: adv.id,
        timestamp: adv.created_at,
        empId: adv.employee_id,
        empName: employeeMap[adv.employee_id?.toLowerCase().trim()] || 'Unknown Employee',
        amount: adv.amount,
        monthlyDeduction: adv.monthly_deduction,
        reason: adv.reason,
        status: adv.status || 'Pending',
        type: adv.type || 'Advance',
        apprAmount: adv.approved_amount || '',
        apprMonthlyDeduction: adv.approved_monthly_deduction || '',
        adminRemarks: adv.admin_remarks || '',
        startingMonth: adv.starting_month || ''
      }));

      setPendingRequests(allRecords.filter(r => r.status?.toLowerCase() === 'pending'));
      setApprovedRequests(allRecords.filter(r => 
        r.status?.toLowerCase() === 'approved' && 
        (r.type?.toLowerCase() === 'monthly advance' || r.type?.toLowerCase() === 'advance')
      ));
      setRejectedRequests(allRecords.filter(r => r.status?.toLowerCase() === 'rejected'));
      setReceivedRequests(allRecords.filter(r => 
        (r.type?.toLowerCase() === 'fixed amount' || r.type?.toLowerCase() === 'fixed advance' || r.type?.toLowerCase() === 'fixed advanced' || r.type?.toLowerCase() === 'fix advance' || r.type?.toLowerCase() === 'medical amount' || r.type?.toLowerCase() === 'brackage') &&
        r.status?.toLowerCase() === 'approved'
      ));
      setFixedReceivedRequests(allRecords.filter(r => 
        (r.type?.toLowerCase() === 'fixed amount' || r.type?.toLowerCase() === 'fixed advance' || r.type?.toLowerCase() === 'fixed advanced' || r.type?.toLowerCase() === 'fix advance' || r.type?.toLowerCase() === 'medical amount' || r.type?.toLowerCase() === 'brackage') &&
        r.status?.toLowerCase() === 'received'
      ));

    } catch (error) {
      console.error('Error fetching advance data:', error);
      toast.error(error.message || 'Failed to load records from Supabase');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!newEmpId) {
      toast.error("Please select an employee");
      return;
    }
    if (!newAmount || Number(newAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const isFixed = newType === 'Fixed Amount';
    const deductionValue = isFixed ? Number(newAmount) : Number(newDeduction);

    if (!isFixed) {
      if (!newDeduction || Number(newDeduction) <= 0) {
        toast.error("Please enter a valid monthly deduction");
        return;
      }
      if (Number(newDeduction) > Number(newAmount)) {
        toast.error("Monthly deduction cannot be greater than the total amount");
        return;
      }
    }

    setIsSubmittingNew(true);
    try {
      const { error } = await supabase
        .from('advance_requests')
        .insert({
          employee_id: newEmpId,
          amount: Number(newAmount),
          monthly_deduction: deductionValue,
          type: newType,
          reason: newReason,
          starting_month: newStartingMonth || null,
          status: addModalType
        });

      if (error) throw error;

      toast.success("Advance request created successfully!");
      setShowAddModal(false);
      // Reset form
      setNewEmpId('');
      setNewAmount('');
      setNewDeduction('');
      setNewType('Monthly Advance');
      setNewReason('');
      setNewStartingMonth(getCurrentMonthStr());
      setEmpSearch('');
      setAddModalType('Pending');
      // Reload table
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit request: " + err.message);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleDeleteRequest = async (id) => {
    if (!window.confirm("Are you sure you want to delete this advance request?")) return;

    try {
      const { error } = await supabase
        .from('advance_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Request deleted successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete request: " + err.message);
    }
  };

  const openReviewModal = (request) => {
    setSelectedRequest(request);
    setApprovedAmount(request.apprAmount || request.amount || '');
    
    const isFixed = ['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(request.type?.toLowerCase());
    setApprovedMonthlyDeduction(isFixed ? (request.apprAmount || request.amount || '') : (request.apprMonthlyDeduction || request.monthlyDeduction || ''));
    
    setRemarks(request.adminRemarks || '');
    setShowModal(true);
  };

  const handleAction = async (actionStatus) => {
    if (!selectedRequest) return;

    /* Commented out the Google Sheets update code:
    const updates = [
      { col: 7, val: actionStatus },
      { col: 11, val: remarks }
    ];

    if (actionStatus === 'Approved') {
      updates.push({ col: 9, val: approvedAmount });
      updates.push({ col: 10, val: approvedMonthlyDeduction });
    }

    setSubmitting(true);
    try {
      const updatePromises = updates.map(update => {
        return fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            sheetName: 'ADVANCE',
            action: 'updateCell',
            spreadsheetId: SPREADSHEET_ID,
            rowIndex: selectedRequest.rowIndex.toString(),
            columnIndex: update.col.toString(),
            value: update.val
          }).toString()
        });
      });

      const responses = await Promise.all(updatePromises);
      const results = await Promise.all(responses.map(r => r.json()));
      const hasError = results.some(result => !result.success);

      if (!hasError) {
        if (actionStatus === 'Approved') {
          toast.loading('Syncing to PAYROLL...', { id: 'payroll_sync' });
          try {
            const PAYROLL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1QHKttecIhZwoyh8-xo_wzqHgxIuFr9Tci8L803T1q0nKkjA1w26soUXSffkMY4E0sQ/exec';
            const currentMonth = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
            const currentYear = new Date().getFullYear().toString();

            const pRes = await fetch(`${PAYROLL_SCRIPT_URL}?sheet=PAYROLL&action=fetch&spreadsheetId=${SPREADSHEET_ID}`);
            const pData = await pRes.json();

            if (pData.success && pData.data && pData.data.length > 2) {
              const headers = pData.data[2];
              const parseNum = (val) => {
                const num = Number(String(val).replace(/[^0-9.-]+/g, ''));
                return isNaN(num) ? 0 : num;
              };
              const getIdx = (name) => headers.findIndex(h => h?.toString().trim().toLowerCase() === name.toLowerCase());

              const empIdIdx = getIdx('EMP ID');
              const nameIdx = getIdx('Name of the Employee');
              const monthIdx = getIdx('Month');
              const yearIdx = getIdx('Year');

              let deductionAmountThisMonth = parseNum(approvedMonthlyDeduction);
              try {
                const advRes = await fetch(`${SCRIPT_URL}?sheet=ADVANCE&action=fetch&spreadsheetId=${SPREADSHEET_ID}`);
                const advData = await advRes.json();
                if (advData.success && advData.data) {
                  const targetAdvRow = advData.data[selectedRequest.rowIndex - 1];
                  if (targetAdvRow && targetAdvRow.length > 12) {
                    deductionAmountThisMonth = parseNum(targetAdvRow[12]);
                  }
                }
              } catch (e) { console.warn("Failed fetching calculated deduction amount this month", e); }

              let correctedEmpId = selectedRequest.empId?.toString().trim();
              try {
                const mRes = await fetch('https://docs.google.com/spreadsheets/d/1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8/export?format=csv&gid=1348558181');
                const mText = await mRes.text();
                const mRows = mText.split('\n');
                for (let i = 1; i < mRows.length; i++) {
                  const cols = mRows[i].split(',');
                  if (cols.length >= 2 && cols[1].trim().toLowerCase() === selectedRequest.empName?.toString().toLowerCase().trim()) {
                    if (cols[0].trim()) correctedEmpId = cols[0].trim();
                    break;
                  }
                }
              } catch (e) { console.warn("Failed resolving master ID", e); }

              let targetColName = 'Advance Deduction';
              if (selectedRequest.type === 'Brackage') targetColName = 'Brackage';
              if (selectedRequest.type === 'Medical Amount') targetColName = 'Medical';

              const targetColIdx = getIdx(targetColName);

              if (empIdIdx !== -1 && targetColIdx !== -1) {
                let targetRowIndex = -1;
                let existingAmount = 0;

                for (let i = 3; i < pData.data.length; i++) {
                  const row = pData.data[i];
                  if (
                    row[empIdIdx]?.toString().trim() === correctedEmpId &&
                    row[monthIdx]?.toString().toLowerCase() === currentMonth.toLowerCase() &&
                    row[yearIdx]?.toString() === currentYear
                  ) {
                    targetRowIndex = i + 1;
                    existingAmount = parseNum(row[targetColIdx]);
                    break;
                  }
                }

                const newTotalDeduction = existingAmount + (deductionAmountThisMonth || 0);

                if (targetRowIndex !== -1) {
                  await fetch(`${PAYROLL_SCRIPT_URL}?action=updateCell&sheetName=PAYROLL&spreadsheetId=${SPREADSHEET_ID}&rowIndex=${targetRowIndex}&columnIndex=${targetColIdx + 1}&value=${newTotalDeduction}`);
                } else {
                  const newRowData = new Array(headers.length).fill('');
                  if (empIdIdx !== -1) newRowData[empIdIdx] = correctedEmpId;
                  if (nameIdx !== -1) newRowData[nameIdx] = selectedRequest.empName;
                  if (monthIdx !== -1) newRowData[monthIdx] = currentMonth;
                  if (yearIdx !== -1) newRowData[yearIdx] = currentYear;
                  newRowData[targetColIdx] = newTotalDeduction;

                  await fetch(PAYROLL_SCRIPT_URL, {
                    method: 'POST',
                    body: new URLSearchParams({
                      sheetName: 'PAYROLL',
                      action: 'insert',
                      spreadsheetId: SPREADSHEET_ID,
                      rowData: JSON.stringify(newRowData)
                    })
                  });
                }
              }
            }
            toast.success('Synced to PAYROLL successfully!', { id: 'payroll_sync' });
          } catch (e) {
            console.error("Payroll sync error:", e);
            toast.error('Approved, but PAYROLL sync failed.', { id: 'payroll_sync' });
          }
        }

        toast.success(`Request ${actionStatus.toLowerCase()} successfully!`);
        setShowModal(false);
        fetchData();
      } else {
        toast.error('Failed to update some fields');
      }
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Something went wrong during update');
    } finally {
      setSubmitting(false);
    }
    */

    setSubmitting(true);
    try {
      const updateData = {
        status: actionStatus,
        admin_remarks: remarks
      };

      const isFixed = ['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase());

      if (actionStatus === 'Approved' || actionStatus === 'Received') {
        if (!isFixed) {
          if (Number(approvedMonthlyDeduction) > Number(approvedAmount)) {
            toast.error("Approved monthly deduction cannot be greater than the approved amount");
            setSubmitting(false);
            return;
          }
          updateData.approved_amount = Number(approvedAmount) || 0;
          updateData.approved_monthly_deduction = Number(approvedMonthlyDeduction) || 0;
        } else {
          updateData.approved_amount = Number(approvedAmount) || 0;
          updateData.approved_monthly_deduction = Number(approvedAmount) || 0; // Same as approved amount (one-time deduction)
        }
      }

      const { error: updateError } = await supabase
        .from('advance_requests')
        .update(updateData)
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      toast.success(`Request ${actionStatus.toLowerCase()} successfully!`);
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to update status in Supabase: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredData = () => {
    let list = pendingRequests;
    if (activeTab === 'approved') list = approvedRequests;
    if (activeTab === 'rejected') list = rejectedRequests;
    if (activeTab === 'received') list = receivedRequests;
    if (activeTab === 'fixed_received') list = fixedReceivedRequests;

    return list.filter(item =>
      item.empName?.toString().toLowerCase().includes(searchTerm?.toLowerCase() || '') ||
      item.empId?.toString().toLowerCase().includes(searchTerm?.toLowerCase() || '') ||
      item.type?.toString().toLowerCase().includes(searchTerm?.toLowerCase() || '')
    );
  };

  const parseNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).replace(/[^0-9.-]+/g, '');
    const num = Number(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Medical Amount': return <Stethoscope size={16} className="text-blue-500" />;
      case 'Brackage': return <Hammer size={16} className="text-orange-500" />;
      default: return <Banknote size={16} className="text-emerald-500" />;
    }
  };

  // Summary stats
  const totalPending = pendingRequests.length;
  const totalApproved = approvedRequests.length;
  const totalRejected = rejectedRequests.length;
  const totalReceived = receivedRequests.length;
  const totalFixedReceived = fixedReceivedRequests.length;
  const totalAmount = [...pendingRequests, ...approvedRequests, ...rejectedRequests, ...receivedRequests, ...fixedReceivedRequests].reduce((sum, r) => sum + parseNumber(r.amount), 0);

  return (
    <div className="p-10 pt-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet size={28} />
            Admin Advance & Deductions
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Review and manage employee advance requests
          </p>
        </div>
        <div className="flex gap-2">
         
          <button
            onClick={() => {
              setAddModalType('Pending');
              setNewType('Monthly Advance');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={14} />
            Add Request
          </button>
        </div>
      </div>



      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'pending'
            ? 'border-orange-500 text-orange-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Pending ({totalPending})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'approved'
            ? 'border-green-500 text-green-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Approved Monthly Advance ({totalApproved})
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'rejected'
            ? 'border-red-500 text-red-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Rejected ({totalRejected})
        </button>
        <button
          onClick={() => setActiveTab('received')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'received'
            ? 'border-teal-500 text-teal-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Fixed Advanced ({totalReceived})
        </button>
        <button
          onClick={() => setActiveTab('fixed_received')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'fixed_received'
            ? 'border-emerald-500 text-emerald-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Fixed Advanced Received ({totalFixedReceived})
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, ID or type..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200  text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white  border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Category</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Amount</th>
                {!(activeTab === 'received' || activeTab === 'fixed_received') && (
                  <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Monthly Deduction</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Starting Month</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Reason</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableLoading ? (
                <tr>
                  <td colSpan={activeTab === 'received' || activeTab === 'fixed_received' ? "7" : "8"} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      Loading requests...
                    </div>
                  </td>
                </tr>
              ) : getFilteredData().length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'received' || activeTab === 'fixed_received' ? "7" : "8"} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <Search size={48} className="mb-3" />
                      <p className="font-medium">No requests found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                getFilteredData().map((record, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(record.timestamp)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                          {record.empName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{record.empName}</p>
                          <p className="text-xs text-gray-500">{record.empId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(record.type)}
                        <span className="text-sm text-gray-700">{record.type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-indigo-600">
                        ₹{parseNumber((record.status === 'Approved' || record.status === 'Received') && record.apprAmount ? record.apprAmount : record.amount).toLocaleString()}
                      </span>
                    </td>
                    {!(activeTab === 'received' || activeTab === 'fixed_received') && (
                      <td className="px-4 py-3 text-right">
                        {['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(record.type?.toLowerCase()) ? (
                          <span className="text-xs text-gray-400 font-medium italic">One-time</span>
                        ) : (
                          <span className="text-sm font-semibold text-orange-600">
                            ₹{parseNumber((record.status === 'Approved' || record.status === 'Received') && record.apprMonthlyDeduction ? record.apprMonthlyDeduction : record.monthlyDeduction).toLocaleString()}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {formatStartingMonth(record.startingMonth)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                      {record.reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openReviewModal(record)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors rounded ${
                            activeTab === 'pending'
                              ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                              : activeTab === 'received'
                              ? 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {activeTab === 'pending' ? 'Review' : activeTab === 'received' ? 'Receive' : 'Details'}
                        </button>
                        <button
                          onClick={() => handleDeleteRequest(record.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Delete Request"
                        >
                          {/* <Trash2 size={14} /> */}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white  max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Wallet size={20} className="text-indigo-600" />
                {activeTab === 'pending' ? 'Review Request' : activeTab === 'received' ? 'Receive Request' : 'Request Details'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50  p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Employee</span>
                  <span className="text-sm font-medium text-gray-900">{selectedRequest.empName} ({selectedRequest.empId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Category</span>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(selectedRequest.type)}
                    <span className="text-sm font-medium text-gray-900">{selectedRequest.type}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Requested Amount</span>
                  <span className="text-sm font-semibold text-indigo-600">₹{parseNumber(selectedRequest.amount).toLocaleString()}</span>
                </div>
                {!['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase()) && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Requested Deduction</span>
                    <span className="text-sm font-semibold text-orange-600">₹{parseNumber(selectedRequest.monthlyDeduction).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Starting Month</span>
                  <span className="text-sm font-semibold text-gray-800">{formatStartingMonth(selectedRequest.startingMonth)}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Reason</span>
                  <p className="text-sm text-gray-700 bg-white p-3  border border-gray-200">
                    {selectedRequest.reason || '-'}
                  </p>
                </div>
              </div>

              {(activeTab === 'pending' || (activeTab !== 'pending' && (selectedRequest.status === 'Approved' || selectedRequest.status === 'Received'))) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className={['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase()) ? "col-span-2" : ""}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Approved Amount</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      value={approvedAmount}
                      onChange={(e) => {
                        setApprovedAmount(e.target.value);
                        if (['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase())) {
                          setApprovedMonthlyDeduction(e.target.value);
                        }
                      }}
                      disabled={activeTab !== 'pending' || submitting}
                      placeholder="Enter amount"
                    />
                  </div>
                  {!['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase()) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Deduction</label>
                      <input
                        type="number"
                        className={`w-full px-3 py-2 border text-sm focus:ring-1 ${approvedAmount && approvedMonthlyDeduction && Number(approvedMonthlyDeduction) > Number(approvedAmount)
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50/30'
                            : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                          }`}
                        value={approvedMonthlyDeduction}
                        onChange={(e) => setApprovedMonthlyDeduction(e.target.value)}
                        disabled={activeTab !== 'pending' || submitting}
                        placeholder="Enter deduction"
                      />
                      {approvedAmount && approvedMonthlyDeduction && Number(approvedMonthlyDeduction) > Number(approvedAmount) && (
                        <p className="text-[10px] text-red-500 font-semibold mt-1">
                          Monthly deduction cannot exceed approved amount (₹{Number(approvedAmount).toLocaleString()})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Admin Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Add remarks (optional)..."
                  className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={activeTab !== 'pending' || submitting}
                />
              </div>
            </div>

            {activeTab === 'pending' && (
              <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
                <button
                  onClick={() => handleAction('Rejected')}
                  disabled={submitting}
                  className="px-4 py-2 text-red-600 border border-red-300  hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                {(selectedRequest.type?.toLowerCase() === 'fixed amount' || 
                  selectedRequest.type?.toLowerCase() === 'fixed advance' || 
                  selectedRequest.type?.toLowerCase() === 'fixed advanced' || 
                  selectedRequest.type?.toLowerCase() === 'fix advance' || 
                  selectedRequest.type?.toLowerCase() === 'medical amount' || 
                  selectedRequest.type?.toLowerCase() === 'brackage') ? (
                  <button
                    onClick={() => handleAction('Approved')}
                    disabled={submitting}
                    className="px-4 py-2 bg-teal-600 text-white  hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Approve Fixed Advance
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction('Approved')}
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white  hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Approve
                  </button>
                )}
              </div>
            )}

            {activeTab === 'received' && (
              <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
                <button
                  onClick={() => handleAction('Received')}
                  disabled={submitting}
                  className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Mark as Received
                </button>
              </div>
            )}
          </div>
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
                The <code>advance_requests</code> table is missing from your Supabase database. Please copy the SQL code below, open your <strong>Supabase SQL Editor</strong>, paste and run it to create the table.
              </p>
              <div className="relative bg-slate-950 rounded-lg p-3.5 mb-4">
                <pre className="text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-48 scrollbar-thin whitespace-pre-wrap">
                  {`CREATE TABLE IF NOT EXISTS advance_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    amount NUMERIC NOT NULL,
    monthly_deduction NUMERIC NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Received')),
    type VARCHAR(100) DEFAULT 'Advance',
    approved_amount NUMERIC,
    approved_monthly_deduction NUMERIC,
    admin_remarks TEXT,
    starting_month VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- For existing databases, run this:
ALTER TABLE advance_requests DROP CONSTRAINT IF EXISTS advance_requests_status_check;
ALTER TABLE advance_requests ADD CONSTRAINT advance_requests_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Received'));`}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS advance_requests (\n    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n    employee_id VARCHAR(255) NOT NULL,\n    amount NUMERIC NOT NULL,\n    monthly_deduction NUMERIC NOT NULL,\n    reason TEXT,\n    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Received')),\n    type VARCHAR(100) DEFAULT 'Advance',\n    approved_amount NUMERIC,\n    approved_monthly_deduction NUMERIC,\n    admin_remarks TEXT,\n    starting_month VARCHAR(50),\n    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL\n);\n\nALTER TABLE advance_requests DROP CONSTRAINT IF EXISTS advance_requests_status_check;\nALTER TABLE advance_requests ADD CONSTRAINT advance_requests_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Received'));`);
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

      {/* Add Request Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white max-w-lg w-full rounded-lg overflow-hidden shadow-2xl transition-all transform scale-100 animate-in fade-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-slate-50 sticky top-0 z-10">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                <Plus size={16} className={addModalType === 'Approved' ? 'text-teal-600' : 'text-indigo-600'} />
                {addModalType === 'Approved' ? 'Record Fixed Advance' : 'New Advance Request'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest}>
              <div className="p-6 space-y-4">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Select Employee <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Type name or employee ID to search..."
                    value={isEmpDropdownOpen ? empSearch : (employeesList.find(emp => emp.employee_id === newEmpId) ? `${employeesList.find(emp => emp.employee_id === newEmpId).name_as_per_aadhar} (${newEmpId})` : empSearch)}
                    onFocus={() => setIsEmpDropdownOpen(true)}
                    onChange={(e) => {
                      setEmpSearch(e.target.value);
                      setIsEmpDropdownOpen(true);
                      setNewEmpId('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-white font-medium text-slate-700 cursor-pointer"
                  />
                  {/* Hidden input to enforce required html validation for employee selection */}
                  <input type="hidden" name="employee_id" required value={newEmpId} />

                  {isEmpDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsEmpDropdownOpen(false)} />
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto text-xs">
                        {employeesList.filter(emp => {
                          const searchLower = empSearch.toLowerCase();
                          const nameLower = (emp.name_as_per_aadhar || '').toLowerCase();
                          const idLower = (emp.employee_id || '').toLowerCase();
                          return nameLower.includes(searchLower) || idLower.includes(searchLower);
                        }).length === 0 ? (
                          <div className="px-3 py-2 text-gray-400 text-center">No employees found</div>
                        ) : (
                          employeesList
                            .filter(emp => {
                              const searchLower = empSearch.toLowerCase();
                              const nameLower = (emp.name_as_per_aadhar || '').toLowerCase();
                              const idLower = (emp.employee_id || '').toLowerCase();
                              return nameLower.includes(searchLower) || idLower.includes(searchLower);
                            })
                            .map(emp => (
                              <div
                                key={emp.employee_id}
                                onClick={() => {
                                  setNewEmpId(emp.employee_id);
                                  setEmpSearch(`${emp.name_as_per_aadhar || 'No Name'} (${emp.employee_id})`);
                                  setIsEmpDropdownOpen(false);
                                }}
                                className="px-3 py-2 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 font-medium cursor-pointer transition-colors"
                              >
                                {emp.name_as_per_aadhar || 'No Name'} ({emp.employee_id})
                              </div>
                            ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type / Category <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={newType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewType(val);
                        if (val === 'Fixed Amount') {
                          setNewDeduction(newAmount);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-white font-medium text-slate-700 cursor-pointer"
                    >
                      <option value="Monthly Advance">Monthly Advance</option>
                      <option value="Fixed Amount">Fixed Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Starting Month <span className="text-red-500">*</span></label>
                    <input
                      type="month"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-white font-medium text-slate-700 cursor-pointer"
                      value={newStartingMonth}
                      onChange={(e) => setNewStartingMonth(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                      value={newAmount}
                      onChange={(e) => {
                        setNewAmount(e.target.value);
                        if (newType === 'Fixed Amount') {
                          setNewDeduction(e.target.value);
                        }
                      }}
                      placeholder="Enter amount"
                    />
                  </div>
                        {newType !== 'Fixed Amount' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Monthly Deduction (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-1 text-xs ${newAmount && newDeduction && Number(newDeduction) > Number(newAmount)
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50/30'
                            : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                          }`}
                        value={newDeduction}
                        onChange={(e) => setNewDeduction(e.target.value)}
                        placeholder="Enter monthly deduction"
                      />
                      {newAmount && newDeduction && Number(newDeduction) > Number(newAmount) && (
                        <p className="text-[10px] text-red-500 font-semibold mt-1">
                          Monthly deduction cannot exceed total amount (₹{Number(newAmount).toLocaleString()})
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Enter reason for advance request..."
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs resize-none"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all disabled:opacity-50 ${
                    addModalType === 'Approved' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSubmittingNew ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {addModalType === 'Approved' ? 'Record Fixed Advance' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAdvance;