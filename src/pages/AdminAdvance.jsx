import React, { useState, useEffect } from 'react';
import { Search, X, Check, Clock, Wallet, Banknote, Stethoscope, Hammer, Loader2, Filter, Users, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminAdvance = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [rejectedRequests, setRejectedRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [approvedAmount, setApprovedAmount] = useState('');
  const [approvedMonthlyDeduction, setApprovedMonthlyDeduction] = useState('');
  const [remarks, setRemarks] = useState('');

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1QHKttecIhZwoyh8-xo_wzqHgxIuFr9Tci8L803T1q0nKkjA1w26soUXSffkMY4E0sQ/exec';
  const SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

  const fetchData = async () => {
    setLoading(true);
    setTableLoading(true);
    try {
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
    } catch (error) {
      console.error('Error fetching advance data:', error);
      toast.error('Failed to load records from ADVANCE sheet');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openReviewModal = (request) => {
    setSelectedRequest(request);
    setApprovedAmount(request.apprAmount || request.amount || '');
    setApprovedMonthlyDeduction(request.apprMonthlyDeduction || request.monthlyDeduction || '');
    setRemarks(request.adminRemarks || '');
    setShowModal(true);
  };

  const handleAction = async (actionStatus) => {
    if (!selectedRequest) return;

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
  };

  const getFilteredData = () => {
    let list = pendingRequests;
    if (activeTab === 'approved') list = approvedRequests;
    if (activeTab === 'rejected') list = rejectedRequests;

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
  const totalAmount = [...pendingRequests, ...approvedRequests, ...rejectedRequests].reduce((sum, r) => sum + parseNumber(r.amount), 0);

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
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Pending Requests</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{totalPending}</p>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg">
              <Clock size={20} className="text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Approved Requests</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{totalApproved}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <Check size={20} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Rejected Requests</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{totalRejected}</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg">
              <X size={20} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Total Amount</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">₹{totalAmount.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <TrendingUp size={20} className="text-indigo-600" />
            </div>
          </div>
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
          Approved ({totalApproved})
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
      </div>

      {/* Search Bar */}
      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, ID or type..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Category</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 text-xs">Monthly Deduction</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 text-xs">Reason</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableLoading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      Loading requests...
                    </div>
                  </td>
                </tr>
              ) : getFilteredData().length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12">
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
                        ₹{parseNumber(record.status === 'Approved' && record.apprAmount ? record.apprAmount : record.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-orange-600">
                        ₹{parseNumber(record.status === 'Approved' && record.apprMonthlyDeduction ? record.apprMonthlyDeduction : record.monthlyDeduction).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                      {record.reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openReviewModal(record)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === 'pending'
                            ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {activeTab === 'pending' ? 'Review' : 'Details'}
                      </button>
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
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Wallet size={20} className="text-indigo-600" />
                {activeTab === 'pending' ? 'Review Request' : 'Request Details'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
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
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Requested Deduction</span>
                  <span className="text-sm font-semibold text-orange-600">₹{parseNumber(selectedRequest.monthlyDeduction).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Reason</span>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                    {selectedRequest.reason || '-'}
                  </p>
                </div>
              </div>

              {(activeTab === 'pending' || (activeTab !== 'pending' && selectedRequest.status === 'Approved')) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Approved Amount</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                      disabled={activeTab !== 'pending' || submitting}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Monthly Deduction</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      value={approvedMonthlyDeduction}
                      onChange={(e) => setApprovedMonthlyDeduction(e.target.value)}
                      disabled={activeTab !== 'pending' || submitting}
                      placeholder="Enter deduction"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Admin Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Add remarks (optional)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
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
                  className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction('Approved')}
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAdvance;