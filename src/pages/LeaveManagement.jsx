import { useState, useEffect } from 'react'
import { Calendar, Check, X, Search, Plus, User, FileText, ClipboardList, Info, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Pending')
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
    const matchesTab = item.status === activeTab
    const matchesSearch = searchTerm === '' ||
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.leave_type?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesTab && matchesSearch
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">

            Leave Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Apply, track, and manage employee leave requests. Employee status auto-updates to Inactive on approved leave.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 text-sm"
        >
          <Plus size={18} />
          New Leave Request
        </button>
      </div>



      {/* Navigation Tabs and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3 gap-4">
        <div className="flex gap-2">
          {['Pending', 'Approved', 'Rejected'].map((status) => {
            const counts = { Pending: pendingCount, Approved: approvedCount, Rejected: rejectedCount }
            const activeStyles = {
              Pending: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
              Approved: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
              Rejected: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold'
            }
            const hoverStyles = {
              Pending: 'hover:bg-amber-50 hover:text-amber-700',
              Approved: 'hover:bg-emerald-50 hover:text-emerald-700',
              Rejected: 'hover:bg-rose-50 hover:text-rose-700'
            }

            return (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`px-4 py-2 text-sm rounded-xl border transition-all duration-200 ${activeTab === status
                  ? activeStyles[status]
                  : `text-slate-500 bg-white border-slate-200 ${hoverStyles[status]}`
                  }`}
              >
                {status} Leaves ({counts[status]})
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, ID or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm"
          />
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Employee Name</th>
                <th className="px-6 py-4">Leave Type</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Total Days</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    <div className="flex flex-col items-center gap-2 justify-center">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading leave details...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400 font-medium">
                    No {activeTab.toLowerCase()} leave requests found
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">{leave.employee_id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{leave.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium text-xs">
                        {leave.leave_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      <div className="flex flex-col">
                        <span>From: <strong className="text-slate-700">{leave.from_date}</strong></span>
                        <span>To: <strong className="text-slate-700">{leave.to_date}</strong></span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800 text-center sm:text-left">{leave.days} {leave.days === 1 ? 'day' : 'days'}</td>
                    <td className="px-6 py-4 max-w-xs truncate text-slate-500" title={leave.reason}>
                      {leave.reason || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setDetailsLeave(leave)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Info size={16} />
                        </button>
                        {leave.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(leave.id, 'Approved')}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleStatusChange(leave.id, 'Rejected')}
                              className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        {leave.status !== 'Pending' && (
                          <button
                            onClick={() => handleStatusChange(leave.id, 'Pending')}
                            className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100"
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
      </div>

      {/* New Request Modal - Same as before */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
            <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="text-indigo-600" />
                New Leave Request
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Select Employee <span className="text-red-500">*</span>
                </label>
                <select
                  name="employee_select"
                  value={formData.employee_select}
                  onChange={handleEmployeeChange}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.filter(emp => emp.status === 'Active').map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.name_as_per_aadhar} ({emp.employee_id})
                    </option>
                  ))}
                </select>
                {employees.filter(emp => emp.status === 'Active').length === 0 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> No active employees found.
                  </p>
                )}
              </div>

              {formData.employee_id && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Employee Name</span>
                    <strong className="text-slate-700 font-semibold">{formData.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Employee ID</span>
                    <strong className="text-slate-700 font-semibold">{formData.employee_id}</strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="leave_type"
                  value={formData.leave_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm"
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    From Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="from_date"
                    value={formData.from_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    To Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="to_date"
                    value={formData.to_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total Leave Days
                </label>
                <input
                  type="number"
                  name="days"
                  value={formData.days}
                  className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 text-slate-600 rounded-xl text-sm shadow-sm cursor-not-allowed"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for Leave
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm shadow-sm resize-none"
                  placeholder="Provide reason for leave request..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-100 disabled:opacity-50 transition-all duration-300"
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
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setDetailsLeave(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-indigo-600" />
                Leave Request Details
              </h2>
              <button onClick={() => setDetailsLeave(null)} className="p-1 hover:bg-slate-200 rounded-xl text-slate-500 hover:text-slate-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider">Employee Name</span>
                  <p className="font-semibold text-slate-800 text-base">{detailsLeave.name}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider">Employee ID</span>
                  <p className="font-mono font-bold text-slate-800 text-base">{detailsLeave.employee_id}</p>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider">Leave Type</span>
                  <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md font-bold text-xs mt-1">
                    {detailsLeave.leave_type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider">Total Duration</span>
                  <p className="font-bold text-slate-800 mt-1">{detailsLeave.days} {detailsLeave.days === 1 ? 'day' : 'days'}</p>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider">Start Date</span>
                  <p className="font-medium text-slate-700">{detailsLeave.from_date}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider">End Date</span>
                  <p className="font-medium text-slate-700">{detailsLeave.to_date}</p>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div>
                <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider mb-1">Reason</span>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 break-words max-h-32 overflow-y-auto">
                  {detailsLeave.reason || <em className="text-slate-400">No reason provided</em>}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <div>
                  <span className="text-slate-400 block text-xs font-semibold uppercase tracking-wider">Status</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-1.5 ${detailsLeave.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                    detailsLeave.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                    {detailsLeave.status === 'Approved' && <Check size={12} />}
                    {detailsLeave.status === 'Rejected' && <X size={12} />}
                    {detailsLeave.status}
                  </span>
                </div>
                <div className="flex gap-2 self-end">
                  {detailsLeave.status === 'Pending' && (
                    <>
                      <button
                        onClick={() => {
                          handleStatusChange(detailsLeave.id, 'Approved')
                          setDetailsLeave(null)
                        }}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          handleStatusChange(detailsLeave.id, 'Rejected')
                          setDetailsLeave(null)
                        }}
                        className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700 transition-colors shadow-sm"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}