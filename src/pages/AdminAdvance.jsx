import React, { useState, useEffect } from 'react';
import { Search, X, Check, Clock, Wallet, Banknote, Stethoscope, Hammer, Loader2 } from 'lucide-react';
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

  // Admin inputs
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
          rowIndex: idx + 2, // +1 for header, +1 for 0-index
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
        })).reverse(); // Latest first

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

    // Status is column 7 (G)
    // [empty type] is column 8 (H)
    // Approved Amount is column 9 (I)
    // Approved Monthly Deduction is column 10 (J)
    // Admin Remarks is column 11 (K)

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
        // --- PAYROLL SYNC LOGIC ---
        if (actionStatus === 'Approved') {
          toast.loading('Syncing to PAYROLL...', { id: 'payroll_sync' });
          try {
            const PAYROLL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1QHKttecIhZwoyh8-xo_wzqHgxIuFr9Tci8L803T1q0nKkjA1w26soUXSffkMY4E0sQ/exec';
            const SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

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

              // Fetch the newly updated ADVANCE sheet row to get the calculated "Deduction Amount This Month"
              let deductionAmountThisMonth = parseNum(approvedMonthlyDeduction); // Default fallback
              try {
                const advRes = await fetch(`${SCRIPT_URL}?sheet=ADVANCE&action=fetch&spreadsheetId=${SPREADSHEET_ID}`);
                const advData = await advRes.json();
                if (advData.success && advData.data) {
                  // Find the heavily updated row matching selectedRequest.rowIndex
                  // Row indexing: result.data[0] is headers, result.data[1] is row 2...
                  // selectedRequest.rowIndex is the 1-based index we updated
                  const targetAdvRow = advData.data[selectedRequest.rowIndex - 1]; // 0-based array index
                  if (targetAdvRow && targetAdvRow.length > 12) {
                    deductionAmountThisMonth = parseNum(targetAdvRow[12]); // Column M (index 12)
                  }
                }
              } catch (e) { console.warn("Failed fetching calculated deduction amount this month", e); }

              // Fetch Master Employee Sheet to autocorrect ID (e.g. converting JN-021 to 3010)
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
                    targetRowIndex = i + 1; // Google Sheet 1-based index
                    existingAmount = parseNum(row[targetColIdx]);
                    break;
                  }
                }

                const newTotalDeduction = existingAmount + (deductionAmountThisMonth || 0);

                if (targetRowIndex !== -1) {
                  // Row exists, update existing cell
                  await fetch(`${PAYROLL_SCRIPT_URL}?action=updateCell&sheetName=PAYROLL&spreadsheetId=${SPREADSHEET_ID}&rowIndex=${targetRowIndex}&columnIndex=${targetColIdx + 1}&value=${newTotalDeduction}`);
                } else {
                  // Row doesn't exist, insert new row for this month
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
        // --- END PAYROLL SYNC ---

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

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 text-white">
              <Wallet size={28} />
            </div>
            Admin Advance & Deductions
          </h1>
          <p className="text-gray-500 mt-2 font-medium">Review and manage employee advance requests.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <nav className="flex space-x-4">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-2 px-4 text-center rounded-lg font-medium text-sm transition-colors ${activeTab === 'pending'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              Pending ({pendingRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`py-2 px-4 text-center rounded-lg font-medium text-sm transition-colors ${activeTab === 'approved'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              Approved ({approvedRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`py-2 px-4 text-center rounded-lg font-medium text-sm transition-colors ${activeTab === 'rejected'
                  ? 'bg-rose-100 text-rose-700'
                  : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              Rejected ({rejectedRequests.length})
            </button>
          </nav>

          <div className="relative max-w-sm w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, ID or type..."
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 w-full font-medium text-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {tableLoading ? (
            <div className="px-6 py-20 text-center">
              <div className="flex justify-center flex-col items-center">
                <Loader2 className="animate-spin text-indigo-500 mb-2" size={32} />
                <span className="text-gray-500 text-sm font-medium">Loading requests...</span>
              </div>
            </div>
          ) : getFilteredData().length === 0 ? (
            <div className="px-6 py-20 text-center text-gray-500 font-medium">
              No requests found.
            </div>
          ) : (
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">{activeTab === 'approved' ? 'Approv. Amount' : 'Req. Amount'}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">{activeTab === 'approved' ? 'Approv. Deduction' : 'Req. Deduction'}</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {getFilteredData().map((record, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(record.timestamp)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900">{record.empName}</div>
                      <div className="text-xs text-gray-500">{record.empId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 font-bold text-gray-700 text-sm">
                        {getTypeIcon(record.type)}
                        {record.type}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-bold text-indigo-600">₹{parseNumber(record.status === 'Approved' && record.apprAmount ? record.apprAmount : record.amount).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-bold text-rose-500">₹{parseNumber(record.status === 'Approved' && record.apprMonthlyDeduction ? record.apprMonthlyDeduction : record.monthlyDeduction).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">
                      {record.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => openReviewModal(record)}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-lg transition-colors text-sm"
                      >
                        {activeTab === 'pending' ? 'Review' : 'Details'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white shrink-0">
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                <Wallet size={20} />
                {activeTab === 'pending' ? 'Review Request' : 'Request Details'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-gray-500">Employee</span>
                  <span className="text-sm font-black text-gray-900">{selectedRequest.empName} ({selectedRequest.empId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-gray-500">Category</span>
                  <div className="flex items-center gap-1.5 text-sm font-black text-gray-900">
                    {getTypeIcon(selectedRequest.type)}
                    {selectedRequest.type}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-gray-500">Requested Amount</span>
                  <span className="text-sm font-black text-indigo-600">₹{parseNumber(selectedRequest.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-gray-500">Req. Deduction/mo</span>
                  <span className="text-sm font-black text-rose-600">₹{parseNumber(selectedRequest.monthlyDeduction).toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-sm font-bold text-gray-500 mb-1">Reason</span>
                  <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-gray-200">
                    {selectedRequest.reason}
                  </p>
                </div>
              </div>

              {activeTab === 'pending' || (activeTab !== 'pending' && selectedRequest.status === 'Approved') ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Approved Amount (₹)</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-900"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                      disabled={activeTab !== 'pending' || submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Appr. Deduction (₹)</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-900"
                      value={approvedMonthlyDeduction}
                      onChange={(e) => setApprovedMonthlyDeduction(e.target.value)}
                      disabled={activeTab !== 'pending' || submitting}
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Admin Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional remarks..."
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={activeTab !== 'pending' || submitting}
                />
              </div>
            </div>

            {activeTab === 'pending' && (
              <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0 grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleAction('Rejected')}
                  disabled={submitting}
                  className="py-3 px-4 bg-white border-2 border-rose-100 text-rose-600 hover:bg-rose-50 font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction('Approved')}
                  disabled={submitting}
                  className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 size={18} className="animate-spin" /> Processing...</>
                  ) : 'Approve'}
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
