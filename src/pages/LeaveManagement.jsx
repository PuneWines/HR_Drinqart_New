import { useState, useEffect } from 'react'
import { Calendar, Check, X, Search, Plus, User, FileText, ClipboardList, Info, AlertTriangle, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all') // Changed to match employee management style
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detailsLeave, setDetailsLeave] = useState(null)

  // New leave request form state
  const [formData, setFormData] = useState({
    employee_select: '',
    employee_id: '',
    name: '',
    from_date: '',
    to_date: '',
    days: 0,
    leave_type: 'Casual Leave',
    reason: ''
  })

  useEffect(() => {
    fetchLeaves()
    fetchActiveEmployees()
  }, [])

  // Auto-calculate days when from_date or to_date changes
  useEffect(() => {
    if (formData.from_date && formData.to_date) {
      const start = new Date(formData.from_date)
      const end = new Date(formData.to_date)
      const diffTime = end - start
      if (diffTime >= 0) {
        const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        setFormData(prev => ({ ...prev, days: calculatedDays }))
      } else {
        setFormData(prev => ({ ...prev, days: 0 }))
      }
    }
  }, [formData.from_date, formData.to_date])

  const fetchLeaves = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeaves(data || [])
    } catch (error) {
      console.error('Error fetching leaves:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('employee_id, name_as_per_aadhar, status')
        .order('name_as_per_aadhar', { ascending: true })

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  // Update employee status function
  const updateEmployeeStatus = async (employeeId, newStatus) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          status: newStatus,
          updated_at: new Date()
        })
        .eq('employee_id', employeeId)

      if (error) throw error
      console.log(`Employee ${employeeId} status updated to ${newStatus}`)

      // Refresh employees list
      await fetchActiveEmployees()
    } catch (error) {
      console.error('Error updating employee status:', error)
    }
  }

  // Check if employee has any approved leaves overlapping with current date
  const checkEmployeeLeaveStatus = async (employeeId) => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('status', 'Approved')
        .lte('from_date', today)
        .gte('to_date', today)

      if (error) throw error

      // If employee has an approved leave covering today, status should be Inactive
      return data && data.length > 0
    } catch (error) {
      console.error('Error checking employee leave status:', error)
      return false
    }
  }

  const handleStatusChange = async (leaveId, newStatus) => {
    try {
      // Get the leave details first
      const leaveToUpdate = leaves.find(l => l.id === leaveId)
      if (!leaveToUpdate) return

      // If approving a leave, check if employee already has other approved leaves
      if (newStatus === 'Approved') {
        // Check for overlapping approved leaves
        const { data: overlappingLeaves } = await supabase
          .from('leaves')
          .select('*')
          .eq('employee_id', leaveToUpdate.employee_id)
          .eq('status', 'Approved')
          .neq('id', leaveId)
          .or(`from_date.lte.${leaveToUpdate.to_date},to_date.gte.${leaveToUpdate.from_date}`)

        if (overlappingLeaves && overlappingLeaves.length > 0) {
          alert('Employee already has approved leaves during this period!')
          return
        }
      }

      // Update leave status
      const { error } = await supabase
        .from('leaves')
        .update({ status: newStatus })
        .eq('id', leaveId)

      if (error) throw error

      // Update employee status based on leave approval
      if (newStatus === 'Approved') {
        // Set employee to Inactive when leave is approved
        await updateEmployeeStatus(leaveToUpdate.employee_id, 'Inactive')
      } else if (newStatus === 'Rejected' || newStatus === 'Pending') {
        // Check if employee has any other approved leaves
        const { data: activeLeaves } = await supabase
          .from('leaves')
          .select('*')
          .eq('employee_id', leaveToUpdate.employee_id)
          .eq('status', 'Approved')
          .neq('id', leaveId)

        // If no other approved leaves, set status back to Active
        if (!activeLeaves || activeLeaves.length === 0) {
          await updateEmployeeStatus(leaveToUpdate.employee_id, 'Active')
        }
      }

      // Update local state
      setLeaves(prev =>
        prev.map(item => (item.id === leaveId ? { ...item, status: newStatus } : item))
      )

      alert(`Leave ${newStatus.toLowerCase()} successfully!`)
    } catch (error) {
      console.error(`Error updating leave status to ${newStatus}:`, error)
      alert(`Error updating status: ${error.message}`)
    }
  }

  // Function to check and update employee statuses based on current dates (run periodically)
  const updateAllEmployeeStatuses = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Get all employees
      const { data: allEmployees } = await supabase
        .from('employees')
        .select('employee_id, status')

      if (!allEmployees) return

      for (const emp of allEmployees) {
        const isOnLeave = await checkEmployeeLeaveStatus(emp.employee_id)
        const expectedStatus = isOnLeave ? 'Inactive' : 'Active'

        if (emp.status !== expectedStatus && emp.status !== 'Left') {
          await updateEmployeeStatus(emp.employee_id, expectedStatus)
        }
      }
    } catch (error) {
      console.error('Error updating employee statuses:', error)
    }
  }

  // Run status check every hour
  useEffect(() => {
    updateAllEmployeeStatuses()
    const interval = setInterval(updateAllEmployeeStatuses, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleEmployeeChange = (e) => {
    const selectedId = e.target.value
    if (!selectedId) {
      setFormData(prev => ({
        ...prev,
        employee_select: '',
        employee_id: '',
        name: ''
      }))
      return
    }

    const emp = employees.find(item => item.employee_id === selectedId)
    if (emp) {
      setFormData(prev => ({
        ...prev,
        employee_select: selectedId,
        employee_id: emp.employee_id,
        name: emp.name_as_per_aadhar
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.employee_id || !formData.name || !formData.from_date || !formData.to_date || !formData.leave_type) {
      alert('Please fill out all required fields')
      return
    }

    if (formData.days <= 0) {
      alert('End Date must be greater than or equal to Start Date')
      return
    }

    setSaving(true)
    try {
      const leavePayload = {
        employee_id: formData.employee_id,
        name: formData.name,
        from_date: formData.from_date,
        to_date: formData.to_date,
        days: parseInt(formData.days, 10),
        leave_type: formData.leave_type,
        reason: formData.reason || '',
        status: 'Pending'
      }

      const { data, error } = await supabase
        .from('leaves')
        .insert([leavePayload])
        .select()

      if (error) throw error

      setLeaves([data[0], ...leaves])
      setShowForm(false)
      setFormData({
        employee_select: '',
        employee_id: '',
        name: '',
        from_date: '',
        to_date: '',
        days: 0,
        leave_type: 'Casual Leave',
        reason: ''
      })
      alert('Leave request submitted successfully!')
    } catch (error) {
      console.error('Error submitting leave:', error)
      alert('Error submitting leave: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // Statistics
  const getStatusCount = (status) => {
    return leaves.filter(item => item.status === status).length
  }

  const pendingCount = getStatusCount('Pending')
  const approvedCount = getStatusCount('Approved')
  const rejectedCount = getStatusCount('Rejected')

  // Filtering
  const filteredLeaves = leaves.filter(item => {
    const matchesTab = statusFilter === 'all' || item.status === statusFilter
    const matchesSearch = searchTerm === '' ||
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.leave_type?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesTab && matchesSearch
  })

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-700'
      case 'Rejected':
        return 'bg-red-100 text-red-700'
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="p-10 pt-5">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar size={28} />
            Leave Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Apply, track, and manage employee leave requests. Employee status auto-updates to Inactive on approved leave.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white  hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          New Leave Request
        </button>
      </div>

      {/* Filter and Search Section */}
      <div className="flex gap-4 mb-4 items-center flex-wrap">
        {/* Status Filter Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 border border-gray-200  text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none bg-white"
          >
            <option value="all">All Leaves ({leaves.length})</option>
            <option value="Pending">Pending ({pendingCount})</option>
            <option value="Approved">Approved ({approvedCount})</option>
            <option value="Rejected">Rejected ({rejectedCount})</option>
          </select>
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID or leave type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200  text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white  border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Employee ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Employee Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Leave Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">From Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">To Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Days</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-500">
                  No leave requests found
                </td>
              </tr>
            ) : (
              filteredLeaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{leave.employee_id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                        {leave.name?.charAt(0) || '?'}
                      </div>
                      {leave.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700  text-xs">
                      {leave.leave_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{leave.from_date}</td>
                  <td className="px-4 py-3 text-gray-600">{leave.to_date}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{leave.days} {leave.days === 1 ? 'day' : 'days'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(leave.status)}`}>
                      {leave.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setDetailsLeave(leave)}
                        className="p-1 text-gray-600 hover:text-indigo-600  transition-colors"
                        title="View Details"
                      >
                        <Info size={16} />
                      </button>
                      {leave.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(leave.id, 'Approved')}
                            className="p-1 text-green-600 hover:text-green-700  transition-colors"
                            title="Approve"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleStatusChange(leave.id, 'Rejected')}
                            className="p-1 text-red-600 hover:text-red-700  transition-colors"
                            title="Reject"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                      {leave.status !== 'Pending' && (
                        <button
                          onClick={() => handleStatusChange(leave.id, 'Pending')}
                          className="px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50  transition-colors border border-indigo-200"
                          title="Reset to Pending"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Request Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white  max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar size={20} className="text-indigo-600" />
                New Leave Request
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="employee_select"
                    value={formData.employee_select}
                    onChange={handleEmployeeChange}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.filter(emp => emp.status !== 'Left').map((emp) => (
                      <option key={emp.employee_id} value={emp.employee_id}>
                        {emp.name_as_per_aadhar} ({emp.employee_id})
                      </option>
                    ))}
                  </select>
                  {employees.filter(emp => emp.status !== 'Left').length === 0 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> No active employees found.
                    </p>
                  )}
                </div>

                {formData.employee_id && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50  border border-gray-100 text-xs">
                    <div>
                      <span className="text-gray-400 block font-medium">Employee Name</span>
                      <strong className="text-gray-700 font-semibold">{formData.name}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">Employee ID</span>
                      <strong className="text-gray-700 font-semibold">{formData.employee_id}</strong>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="leave_type"
                    value={formData.leave_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    required
                  >
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Earned Leave">Earned Leave</option>
                    <option value="Maternity Leave">Maternity Leave</option>
                    <option value="Paternity Leave">Paternity Leave</option>
                    <option value="Loss of Pay">Loss of Pay</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="from_date"
                      value={formData.from_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      To Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="to_date"
                      value={formData.to_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Leave Days
                  </label>
                  <input
                    type="number"
                    name="days"
                    value={formData.days}
                    className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-600  text-sm cursor-not-allowed"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Leave
                  </label>
                  <textarea
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                    placeholder="Provide reason for leave request..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300  hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white  hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {detailsLeave && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailsLeave(null)}>
          <div className="bg-white  max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                Leave Request Details
              </h2>
              <button onClick={() => setDetailsLeave(null)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Employee Name</label>
                  <p className="font-semibold text-gray-900">{detailsLeave.name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Employee ID</label>
                  <p className="font-mono font-medium text-gray-900">{detailsLeave.employee_id}</p>
                </div>
              </div>

              <div className="border-t border-gray-100"></div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Leave Type</label>
                  <p><span className="inline-block px-2 py-1 bg-gray-100 text-gray-700  text-xs mt-1">{detailsLeave.leave_type}</span></p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Total Duration</label>
                  <p className="font-semibold text-gray-800">{detailsLeave.days} {detailsLeave.days === 1 ? 'day' : 'days'}</p>
                </div>
              </div>

              <div className="border-t border-gray-100"></div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Start Date</label>
                  <p className="text-gray-700">{detailsLeave.from_date}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">End Date</label>
                  <p className="text-gray-700">{detailsLeave.to_date}</p>
                </div>
              </div>

              <div className="border-t border-gray-100"></div>

              <div>
                <label className="text-xs text-gray-500">Reason</label>
                <div className="mt-1 p-3 bg-gray-50 border border-gray-100  text-gray-700 text-sm">
                  {detailsLeave.reason || <em className="text-gray-400">No reason provided</em>}
                </div>
              </div>

              <div className="border-t border-gray-100"></div>

              <div className="flex justify-between items-center pt-2">
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <p className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(detailsLeave.status)} mt-1`}>
                    {detailsLeave.status}
                  </p>
                </div>
                {detailsLeave.status === 'Pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleStatusChange(detailsLeave.id, 'Approved')
                        setDetailsLeave(null)
                      }}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold  hover:bg-green-700 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        handleStatusChange(detailsLeave.id, 'Rejected')
                        setDetailsLeave(null)
                      }}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold  hover:bg-red-700 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}