import { useState, useEffect } from 'react'
import { Users, UserPlus, Search, Eye, Edit, Trash2, X, Save, XCircle, Sparkles, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false) // New state for edit modal
  const [editingEmployee, setEditingEmployee] = useState(null) // Store employee being edited
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editFormData, setEditFormData] = useState({})
  const [formData, setFormData] = useState({
    employee_id: '',
    indent_no: '',
    name_as_per_aadhar: '',
    father_name: '',
    dob: '',
    gender: '',
    mobile_no: '',
    candidate_email: '',
    family_mobile_no: '',
    date_of_joining: '',
    joining_place: '',
    designation: '',
    salary: '',
    joining_company_name: '',
    mode_of_attendance: 'Biometric',
    aadhar_no: '',
    current_account_no: '',
    ifsc_code: '',
    branch_name: '',
    payment_mode: 'Bank Transfer',
    status: 'Active'
  })

  // Sample data for auto-fill
  const sampleEmployees = [
    {
      name_as_per_aadhar: 'Rajesh Kumar',
      father_name: 'Suresh Kumar',
      dob: '1990-05-15',
      gender: 'Male',
      mobile_no: '9876543210',
      candidate_email: 'rajesh.kumar@example.com',
      family_mobile_no: '9876543211',
      date_of_joining: '2023-01-15',
      joining_place: 'Mumbai',
      designation: 'Senior Software Engineer',
      salary: '85000',
      joining_company_name: 'Tech Solutions Pvt Ltd',
      mode_of_attendance: 'Biometric',
      aadhar_no: '123456789012',
      current_account_no: 'ACC123456789',
      ifsc_code: 'SBIN0012345',
      branch_name: 'Andheri East',
      payment_mode: 'Bank Transfer',
      status: 'Active'
    },
    {
      name_as_per_aadhar: 'Priya Sharma',
      father_name: 'Rajesh Sharma',
      dob: '1988-08-20',
      gender: 'Female',
      mobile_no: '9876543212',
      candidate_email: 'priya.sharma@example.com',
      family_mobile_no: '9876543213',
      date_of_joining: '2022-06-10',
      joining_place: 'Delhi',
      designation: 'HR Manager',
      salary: '75000',
      joining_company_name: 'HR Solutions Inc',
      mode_of_attendance: 'Biometric',
      aadhar_no: '234567890123',
      current_account_no: 'ACC234567890',
      ifsc_code: 'HDFC0012345',
      branch_name: 'Connaught Place',
      payment_mode: 'Bank Transfer',
      status: 'Active'
    },
    {
      name_as_per_aadhar: 'Amit Patel',
      father_name: 'Bipin Patel',
      dob: '1995-12-10',
      gender: 'Male',
      mobile_no: '9876543214',
      candidate_email: 'amit.patel@example.com',
      family_mobile_no: '9876543215',
      date_of_joining: '2023-03-20',
      joining_place: 'Ahmedabad',
      designation: 'Sales Executive',
      salary: '45000',
      joining_company_name: 'Sales Corp',
      mode_of_attendance: 'Mobile App',
      aadhar_no: '345678901234',
      current_account_no: 'ACC345678901',
      ifsc_code: 'ICICI0012345',
      branch_name: 'Satellite',
      payment_mode: 'Bank Transfer',
      status: 'Active'
    },
    {
      name_as_per_aadhar: 'Neha Gupta',
      father_name: 'Sanjay Gupta',
      dob: '1992-03-25',
      gender: 'Female',
      mobile_no: '9876543216',
      candidate_email: 'neha.gupta@example.com',
      family_mobile_no: '9876543217',
      date_of_joining: '2021-11-05',
      joining_place: 'Bangalore',
      designation: 'Marketing Specialist',
      salary: '55000',
      joining_company_name: 'Marketing Pros',
      mode_of_attendance: 'Biometric',
      aadhar_no: '456789012345',
      current_account_no: 'ACC456789012',
      ifsc_code: 'AXIS0012345',
      branch_name: 'Indiranagar',
      payment_mode: 'Bank Transfer',
      status: 'Active'
    },
    {
      name_as_per_aadhar: 'Suresh Reddy',
      father_name: 'Narayana Reddy',
      dob: '1985-07-18',
      gender: 'Male',
      mobile_no: '9876543218',
      candidate_email: 'suresh.reddy@example.com',
      family_mobile_no: '9876543219',
      date_of_joining: '2020-09-15',
      joining_place: 'Hyderabad',
      designation: 'Technical Lead',
      salary: '120000',
      joining_company_name: 'Tech Innovators',
      mode_of_attendance: 'Biometric',
      aadhar_no: '567890123456',
      current_account_no: 'ACC567890123',
      ifsc_code: 'SBIN0056789',
      branch_name: 'Hitech City',
      payment_mode: 'Bank Transfer',
      status: 'Active'
    }
  ]

  let autoFillIndex = 0

  const autoFillForm = () => {
    const sample = sampleEmployees[autoFillIndex % sampleEmployees.length]
    autoFillIndex++

    setFormData({
      employee_id: `EMP${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      indent_no: `IND${Math.floor(Math.random() * 10000)}`,
      name_as_per_aadhar: sample.name_as_per_aadhar,
      father_name: sample.father_name,
      dob: sample.dob,
      gender: sample.gender,
      mobile_no: sample.mobile_no,
      candidate_email: sample.candidate_email,
      family_mobile_no: sample.family_mobile_no,
      date_of_joining: sample.date_of_joining,
      joining_place: sample.joining_place,
      designation: sample.designation,
      salary: sample.salary,
      joining_company_name: sample.joining_company_name,
      mode_of_attendance: sample.mode_of_attendance,
      aadhar_no: sample.aadhar_no,
      current_account_no: sample.current_account_no,
      ifsc_code: sample.ifsc_code,
      branch_name: sample.branch_name,
      payment_mode: sample.payment_mode,
      status: sample.status
    })
  }

  // Fetch employees from Supabase
  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
      alert('Error fetching employees: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusCount = (status) => {
    if (status === 'all') return employees.length
    return employees.filter(emp => emp.status?.toLowerCase() === status.toLowerCase()).length
  }

  const filteredEmployees = employees.filter(emp => {
    const matchesStatus = statusFilter === 'all' || emp.status?.toLowerCase() === statusFilter.toLowerCase()
    const matchesSearch = searchTerm === '' ||
      emp.name_as_per_aadhar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.mobile_no?.includes(searchTerm)
    return matchesStatus && matchesSearch
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Check if employee_id already exists
      const { data: existing } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('employee_id', formData.employee_id)
        .single()

      if (existing) {
        alert(`Employee ID ${formData.employee_id} already exists! Please use a different ID.`)
        setSaving(false)
        return
      }

      const employeeData = {
        employee_id: formData.employee_id,
        indent_no: formData.indent_no || null,
        name_as_per_aadhar: formData.name_as_per_aadhar,
        father_name: formData.father_name || null,
        dob: formData.dob,
        gender: formData.gender,
        mobile_no: formData.mobile_no,
        candidate_email: formData.candidate_email,
        family_mobile_no: formData.family_mobile_no || null,
        date_of_joining: formData.date_of_joining,
        joining_place: formData.joining_place,
        designation: formData.designation,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        joining_company_name: formData.joining_company_name || null,
        mode_of_attendance: formData.mode_of_attendance,
        aadhar_no: formData.aadhar_no || null,
        current_account_no: formData.current_account_no,
        ifsc_code: formData.ifsc_code,
        branch_name: formData.branch_name,
        payment_mode: formData.payment_mode,
        status: formData.status
      }

      const { data, error } = await supabase
        .from('employees')
        .insert([employeeData])
        .select()

      if (error) throw error

      setEmployees([data[0], ...employees])
      alert(`Employee added successfully! ID: ${formData.employee_id}`)
      resetForm()
      setShowForm(false)
    } catch (error) {
      console.error('Error saving employee:', error)
      alert('Error saving employee: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          ...editFormData,
          salary: editFormData.salary ? parseFloat(editFormData.salary) : null,
          updated_at: new Date()
        })
        .eq('id', editingEmployee.id)

      if (error) throw error

      setEmployees(employees.map(emp =>
        emp.id === editingEmployee.id ? { ...emp, ...editFormData } : emp
      ))
      alert('Employee updated successfully!')
      setShowEditModal(false)
      setEditingEmployee(null)
      setEditFormData({})
    } catch (error) {
      console.error('Error updating employee:', error)
      alert('Error updating employee: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (employee) => {
    setEditingEmployee(employee)
    setEditFormData({
      name_as_per_aadhar: employee.name_as_per_aadhar,
      date_of_joining: employee.date_of_joining,
      mobile_no: employee.mobile_no,
      father_name: employee.father_name || '',
      joining_place: employee.joining_place,
      designation: employee.designation,
      salary: employee.salary || '',
      status: employee.status,
      candidate_email: employee.candidate_email,
      dob: employee.dob,
      gender: employee.gender,
      current_account_no: employee.current_account_no,
      ifsc_code: employee.ifsc_code,
      branch_name: employee.branch_name,
      payment_mode: employee.payment_mode,
      mode_of_attendance: employee.mode_of_attendance,
      aadhar_no: employee.aadhar_no || '',
      family_mobile_no: employee.family_mobile_no || '',
      joining_company_name: employee.joining_company_name || ''
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      employee_id: '',
      indent_no: '',
      name_as_per_aadhar: '',
      father_name: '',
      dob: '',
      gender: '',
      mobile_no: '',
      candidate_email: '',
      family_mobile_no: '',
      date_of_joining: '',
      joining_place: '',
      designation: '',
      salary: '',
      joining_company_name: '',
      mode_of_attendance: 'Biometric',
      aadhar_no: '',
      current_account_no: '',
      ifsc_code: '',
      branch_name: '',
      payment_mode: 'Bank Transfer',
      status: 'Active'
    })
  }

  const handleViewDetails = (employee) => {
    setSelectedEmployee(employee)
    setShowDetailsModal(true)
  }

  const handleDelete = async (employee) => {
    if (!window.confirm(`Delete ${employee.name_as_per_aadhar}?`)) return

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employee.id)

      if (error) throw error

      setEmployees(employees.filter(emp => emp.id !== employee.id))
      alert('Employee deleted successfully!')
    } catch (error) {
      console.error('Error deleting employee:', error)
      alert('Error deleting employee: ' + error.message)
    }
  }

  const handleUpdateStatus = async (employee, newStatus) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ status: newStatus, updated_at: new Date() })
        .eq('id', employee.id)

      if (error) throw error

      setEmployees(employees.map(emp =>
        emp.id === employee.id ? { ...emp, status: newStatus } : emp
      ))
      alert(`Status updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status: ' + error.message)
    }
  }

  return (
    <div className="p-10 pt-5">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users size={28} />
            Employees
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage employee records</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <UserPlus size={18} />
          New Employee
        </button>
      </div>

      {/* Filter and Search Section */}
      <div className="flex gap-4 mb-4 items-center flex-wrap">
        {/* Status Filter Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none bg-white"
          >
            <option value="all">All Employees ({getStatusCount('all')})</option>
            <option value="active">Active ({getStatusCount('active')})</option>
            <option value="inactive">Inactive ({getStatusCount('inactive')})</option>
            <option value="left">Left ({getStatusCount('left')})</option>
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
            placeholder="Search by name, ID, designation or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Employee ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date Of Joining</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mobile Number</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Father Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Work Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Designation</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Salary</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="10" className="text-center py-8 text-gray-500">Loading...</td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center py-8 text-gray-500">No employees found</td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {emp.employee_id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                        {emp.name_as_per_aadhar?.charAt(0) || '?'}
                      </div>
                      {emp.name_as_per_aadhar}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.date_of_joining}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.mobile_no}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.father_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.joining_place}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.designation}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.salary ? `₹${emp.salary.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={emp.status}
                      onChange={(e) => handleUpdateStatus(emp, e.target.value)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 focus:ring-1 cursor-pointer ${emp.status === 'Active' ? 'bg-green-100 text-green-700' :
                          emp.status === 'Inactive' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Left">Left</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(emp)} className="p-1 text-blue-600 hover:text-blue-700" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleViewDetails(emp)} className="p-1 text-gray-600 hover:text-indigo-600" title="View">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleDelete(emp)} className="p-1 text-red-600 hover:text-red-700" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Popup for Add Employee Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Add New Employee</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={autoFillForm}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-colors text-sm"
                >
                  <Sparkles size={16} />
                  Auto-fill Sample Data
                </button>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Personal Information Section */}
                  <div className="lg:col-span-3">
                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b border-gray-200">Personal Information</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="employee_id"
                      value={formData.employee_id}
                      onChange={handleInputChange}
                      placeholder="e.g., EMP001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input type="text" name="name_as_per_aadhar" value={formData.name_as_per_aadhar} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
                    <input type="text" name="father_name" value={formData.father_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                    <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender <span className="text-red-500">*</span></label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No <span className="text-red-500">*</span></label>
                    <input type="tel" name="mobile_no" value={formData.mobile_no} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                    <input type="email" name="candidate_email" value={formData.candidate_email} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Family Mobile No</label>
                    <input type="tel" name="family_mobile_no" value={formData.family_mobile_no} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>

                  {/* Employment Information Section */}
                  <div className="lg:col-span-3 mt-2">
                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b border-gray-200">Employment Information</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining <span className="text-red-500">*</span></label>
                    <input type="date" name="date_of_joining" value={formData.date_of_joining} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Joining Place <span className="text-red-500">*</span></label>
                    <input type="text" name="joining_place" value={formData.joining_place} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Designation <span className="text-red-500">*</span></label>
                    <input type="text" name="designation" value={formData.designation} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
                    <input type="number" name="salary" value={formData.salary} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Joining Company Name</label>
                    <select
                      name="joining_company_name"
                      value={formData.joining_company_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select Company</option>
                      <option value="balaji wines">Balaji Wines</option>
                      <option value="madhur wines">Madhur Wines</option>
                      <option value="friends wines">Friends Wines</option>
                      <option value="kunal wines">Kunal Wines</option>
                      <option value="vishal wines">Vishal Wines</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mode of Attendance</label>
                    <select name="mode_of_attendance" value={formData.mode_of_attendance} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                      <option value="Biometric">Biometric</option>
                      <option value="Manual">Manual</option>
                      <option value="Mobile App">Mobile App</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar No</label>
                    <input type="text" name="aadhar_no" value={formData.aadhar_no} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>

                  {/* Banking Information Section */}
                  <div className="lg:col-span-3 mt-2">
                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b border-gray-200">Banking Information</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account No <span className="text-red-500">*</span></label>
                    <input type="text" name="current_account_no" value={formData.current_account_no} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code <span className="text-red-500">*</span></label>
                    <input type="text" name="ifsc_code" value={formData.ifsc_code} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name <span className="text-red-500">*</span></label>
                    <input type="text" name="branch_name" value={formData.branch_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode <span className="text-red-500">*</span></label>
                    <select name="payment_mode" value={formData.payment_mode} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Left">Left</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && editingEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Edit Employee</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Personal Information Section */}
                <div className="lg:col-span-3">
                  <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b border-gray-200">Personal Information</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={editingEmployee.employee_id}
                    disabled
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name_as_per_aadhar"
                    value={editFormData.name_as_per_aadhar || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
                  <input
                    type="text"
                    name="father_name"
                    value={editFormData.father_name || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    name="dob"
                    value={editFormData.dob || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender <span className="text-red-500">*</span></label>
                  <select
                    name="gender"
                    value={editFormData.gender || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    name="mobile_no"
                    value={editFormData.mobile_no || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    name="candidate_email"
                    value={editFormData.candidate_email || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Family Mobile No</label>
                  <input
                    type="tel"
                    name="family_mobile_no"
                    value={editFormData.family_mobile_no || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Employment Information Section */}
                <div className="lg:col-span-3 mt-2">
                  <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b border-gray-200">Employment Information</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    name="date_of_joining"
                    value={editFormData.date_of_joining || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Joining Place <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="joining_place"
                    value={editFormData.joining_place || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="designation"
                    value={editFormData.designation || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
                  <input
                    type="number"
                    name="salary"
                    value={editFormData.salary || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Joining Company Name</label>
                  <select
                    name="joining_company_name"
                    value={editFormData.joining_company_name || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select Company</option>
                    <option value="balaji wines">Balaji Wines</option>
                    <option value="madhur wines">Madhur Wines</option>
                    <option value="friends wines">Friends Wines</option>
                    <option value="kunal wines">Kunal Wines</option>
                    <option value="vishal wines">Vishal Wines</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode of Attendance</label>
                  <select
                    name="mode_of_attendance"
                    value={editFormData.mode_of_attendance || 'Biometric'}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="Biometric">Biometric</option>
                    <option value="Manual">Manual</option>
                    <option value="Mobile App">Mobile App</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar No</label>
                  <input
                    type="text"
                    name="aadhar_no"
                    value={editFormData.aadhar_no || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Banking Information Section */}
                <div className="lg:col-span-3 mt-2">
                  <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b border-gray-200">Banking Information</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account No <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="current_account_no"
                    value={editFormData.current_account_no || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="ifsc_code"
                    value={editFormData.ifsc_code || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="branch_name"
                    value={editFormData.branch_name || ''}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode <span className="text-red-500">*</span></label>
                  <select
                    name="payment_mode"
                    value={editFormData.payment_mode || 'Bank Transfer'}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={editFormData.status || 'Active'}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Left">Left</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Updating...' : 'Update Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Employee Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-gray-500">Employee ID</label><p className="font-medium">{selectedEmployee.employee_id}</p></div>
                <div><label className="text-xs text-gray-500">Full Name</label><p className="font-medium">{selectedEmployee.name_as_per_aadhar}</p></div>
                <div><label className="text-xs text-gray-500">Father's Name</label><p>{selectedEmployee.father_name || '-'}</p></div>
                <div><label className="text-xs text-gray-500">Date of Birth</label><p>{selectedEmployee.dob || '-'}</p></div>
                <div><label className="text-xs text-gray-500">Gender</label><p>{selectedEmployee.gender || '-'}</p></div>
                <div><label className="text-xs text-gray-500">Mobile No</label><p>{selectedEmployee.mobile_no}</p></div>
                <div><label className="text-xs text-gray-500">Email</label><p>{selectedEmployee.candidate_email}</p></div>
                <div><label className="text-xs text-gray-500">Date of Joining</label><p>{selectedEmployee.date_of_joining}</p></div>
                <div><label className="text-xs text-gray-500">Joining Place</label><p>{selectedEmployee.joining_place}</p></div>
                <div><label className="text-xs text-gray-500">Designation</label><p>{selectedEmployee.designation}</p></div>
                <div><label className="text-xs text-gray-500">Salary</label><p>₹{selectedEmployee.salary?.toLocaleString() || '-'}</p></div>
                <div><label className="text-xs text-gray-500">Status</label>
                  <p className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${selectedEmployee.status === 'Active' ? 'bg-green-100 text-green-700' :
                      selectedEmployee.status === 'Inactive' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                    }`}>{selectedEmployee.status}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}