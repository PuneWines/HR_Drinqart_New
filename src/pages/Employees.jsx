import { useState, useEffect } from 'react'
import { Users, UserPlus, Search, Eye, Edit, Trash2, X, Save, XCircle, Sparkles, Filter, Upload, Image, File, User, CreditCard, BookOpen, FileText, ExternalLink, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Storage bucket name
const STORAGE_BUCKET = 'employee_documents'

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false) // Changed from showEditModal
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editFormData, setEditFormData] = useState({})
  const [joiningCompanies, setJoiningCompanies] = useState([])

  // File preview states for add form
  const [filePreviews, setFilePreviews] = useState({
    aadharFront: null,
    aadharBack: null,
    candidatePhoto: null,
    panCard: null,
    bankPassbook: null,
    resume: null
  })

  // File preview states for edit panel
  const [editFilePreviews, setEditFilePreviews] = useState({
    aadharFront: null,
    aadharBack: null,
    candidatePhoto: null,
    panCard: null,
    bankPassbook: null,
    resume: null
  })

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
    beneficiary_name: '',
    aadharFront: null,
    aadharBack: null,
    candidatePhoto: null,
    panCard: null,
    bankPassbook: null,
    resume: null
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
      payment_mode: 'Bank Transfer'
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
      payment_mode: 'Bank Transfer'
    }
  ]

  let autoFillIndex = 0

  // Upload document to Supabase Storage
  const uploadDocument = async (employeeId, documentType, file) => {
    if (!file) return null

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${documentType}/${employeeId}_${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName)

      return urlData.publicUrl
    } catch (error) {
      console.error(`Error uploading ${documentType}:`, error)
      throw error
    }
  }

  // Upload all documents for an employee
  const uploadEmployeeDocuments = async (employeeId, files) => {
    const uploadedUrls = {}

    const documentMap = {
      aadharFront: 'aadhar_front',
      aadharBack: 'aadhar_back',
      candidatePhoto: 'candidate_photo',
      panCard: 'pan_card',
      bankPassbook: 'bank_passbook',
      resume: 'resume'
    }

    for (const [key, type] of Object.entries(documentMap)) {
      if (files[key] && files[key] instanceof window.File) {
        const url = await uploadDocument(employeeId, type, files[key])
        uploadedUrls[key] = url
      }
    }

    return uploadedUrls
  }

  // Fetch employees and companies from Supabase
  useEffect(() => {
    fetchEmployees()
    fetchJoiningCompanies()
  }, [])

  useEffect(() => {
    if (showForm || showEditPanel) {
      fetchJoiningCompanies()
    }
  }, [showForm, showEditPanel])

  const fetchJoiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('joining_company_names')
        .select('*')
        .order('company_name', { ascending: true })

      if (error) throw error
      setJoiningCompanies(data || [])
    } catch (error) {
      console.error('Error fetching joining companies:', error)
    }
  }

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

  const filteredEmployees = employees.filter(emp => {
    return searchTerm === '' ||
      emp.name_as_per_aadhar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.mobile_no?.includes(searchTerm)
  })

  const handleInputChange = (e) => {
    let { name, value } = e.target
    if (['name_as_per_aadhar', 'father_name', 'joining_place', 'branch_name', 'beneficiary_name', 'ifsc_code'].includes(name)) {
      value = value.toUpperCase()
    }
    if (name === 'aadhar_no') {
      value = value.replace(/\D/g, '').slice(0, 16)
    }
    if (name === 'current_account_no') {
      value = value.replace(/\D/g, '')
    }
    if (['mobile_no', 'family_mobile_no'].includes(name)) {
      value = value.replace(/\D/g, '').slice(0, 10)
    }
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleEditInputChange = (e) => {
    let { name, value } = e.target
    if (['name_as_per_aadhar', 'father_name', 'joining_place', 'branch_name', 'beneficiary_name', 'ifsc_code'].includes(name)) {
      value = value.toUpperCase()
    }
    if (name === 'aadhar_no') {
      value = value.replace(/\D/g, '').slice(0, 16)
    }
    if (name === 'current_account_no') {
      value = value.replace(/\D/g, '')
    }
    if (['mobile_no', 'family_mobile_no'].includes(name)) {
      value = value.replace(/\D/g, '').slice(0, 10)
    }
    setEditFormData(prev => ({ ...prev, [name]: value }))
  }

  // Handle file change in add form
  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image (JPEG, PNG) or PDF file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size should be less than 5MB')
      return
    }

    const previewUrl = URL.createObjectURL(file)

    setFormData(prev => ({ ...prev, [fieldName]: file }))
    setFilePreviews(prev => ({ ...prev, [fieldName]: previewUrl }))
  }

  // Remove file in add form
  const handleRemoveFile = (fieldName) => {
    setFormData(prev => ({ ...prev, [fieldName]: null }))
    setFilePreviews(prev => ({ ...prev, [fieldName]: null }))
  }

  // Handle file change in edit panel
  const handleEditFileChange = (e, fieldName) => {
    const file = e.target.files[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image (JPEG, PNG) or PDF file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size should be less than 5MB')
      return
    }

    const previewUrl = URL.createObjectURL(file)

    setEditFormData(prev => ({ ...prev, [fieldName]: file }))
    setEditFilePreviews(prev => ({ ...prev, [fieldName]: previewUrl }))
  }

  // Remove file in edit panel
  const handleEditRemoveFile = (fieldName) => {
    setEditFormData(prev => ({ ...prev, [fieldName]: null }))
    setEditFilePreviews(prev => ({ ...prev, [fieldName]: null }))
  }

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
      aadharFront: null,
      aadharBack: null,
      candidatePhoto: null,
      panCard: null,
      bankPassbook: null,
      resume: null
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setUploading(true)

    try {
      const { data: existing } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('employee_id', formData.employee_id)
        .single()

      if (existing) {
        alert(`Employee ID ${formData.employee_id} already exists! Please use a different ID.`)
        setSaving(false)
        setUploading(false)
        return
      }

      const files = {
        aadharFront: formData.aadharFront,
        aadharBack: formData.aadharBack,
        candidatePhoto: formData.candidatePhoto,
        panCard: formData.panCard,
        bankPassbook: formData.bankPassbook,
        resume: formData.resume
      }

      const uploadedUrls = await uploadEmployeeDocuments(formData.employee_id, files)

      const employeeData = {
        employee_id: formData.employee_id,
        indent_no: formData.indent_no || null,
        name_as_per_aadhar: formData.name_as_per_aadhar,
        father_name: formData.father_name || null,
        dob: formData.dob,
        gender: formData.gender,
        mobile_no: formData.mobile_no,
        candidate_email: formData.candidate_email || null,
        family_mobile_no: formData.family_mobile_no || null,
        date_of_joining: formData.date_of_joining,
        joining_place: formData.joining_place,
        designation: formData.designation,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        joining_company_name: formData.joining_company_name || null,
        mode_of_attendance: formData.mode_of_attendance,
        aadhar_no: formData.aadhar_no,
        current_account_no: formData.current_account_no,
        ifsc_code: formData.ifsc_code,
        branch_name: formData.branch_name,
        payment_mode: formData.payment_mode,
        beneficiary_name: formData.beneficiary_name || null,
        status: 'Active',
        aadhar_front_image: uploadedUrls.aadharFront || null,
        aadhar_back_image: uploadedUrls.aadharBack || null,
        candidate_photo: uploadedUrls.candidatePhoto || null,
        pan_card_image: uploadedUrls.panCard || null,
        bank_passbook_image: uploadedUrls.bankPassbook || null,
        resume_url: uploadedUrls.resume || null
      }

      const { data: newEmployee, error: insertError } = await supabase
        .from('employees')
        .insert([employeeData])
        .select()
        .single()

      if (insertError) throw insertError

      setEmployees([newEmployee, ...employees])
      alert(`Employee added successfully! ID: ${formData.employee_id}`)
      resetForm()
      setShowForm(false)
    } catch (error) {
      console.error('Error saving employee:', error)
      alert('Error saving employee: ' + error.message)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const handleUpdate = async () => {
    setSaving(true)
    setUploading(true)

    try {
      const { data: currentEmployee } = await supabase
        .from('employees')
        .select('employee_id, aadhar_front_image, aadhar_back_image, candidate_photo, pan_card_image, bank_passbook_image, resume_url')
        .eq('id', editingEmployee.id)
        .single()

      const files = {
        aadharFront: editFormData.aadharFront,
        aadharBack: editFormData.aadharBack,
        candidatePhoto: editFormData.candidatePhoto,
        panCard: editFormData.panCard,
        bankPassbook: editFormData.bankPassbook,
        resume: editFormData.resume
      }

      const uploadedUrls = await uploadEmployeeDocuments(currentEmployee.employee_id, files)

      const updateData = {
        name_as_per_aadhar: editFormData.name_as_per_aadhar,
        date_of_joining: editFormData.date_of_joining,
        mobile_no: editFormData.mobile_no,
        father_name: editFormData.father_name || null,
        joining_place: editFormData.joining_place,
        designation: editFormData.designation,
        salary: editFormData.salary ? parseFloat(editFormData.salary) : null,
        candidate_email: editFormData.candidate_email || null,
        dob: editFormData.dob,
        gender: editFormData.gender,
        current_account_no: editFormData.current_account_no,
        ifsc_code: editFormData.ifsc_code,
        branch_name: editFormData.branch_name,
        payment_mode: editFormData.payment_mode,
        beneficiary_name: editFormData.beneficiary_name || null,
        mode_of_attendance: editFormData.mode_of_attendance,
        aadhar_no: editFormData.aadhar_no,
        family_mobile_no: editFormData.family_mobile_no || null,
        joining_company_name: editFormData.joining_company_name || null,
        updated_at: new Date(),
        aadhar_front_image: uploadedUrls.aadharFront || currentEmployee.aadhar_front_image,
        aadhar_back_image: uploadedUrls.aadharBack || currentEmployee.aadhar_back_image,
        candidate_photo: uploadedUrls.candidatePhoto || currentEmployee.candidate_photo,
        pan_card_image: uploadedUrls.panCard || currentEmployee.pan_card_image,
        bank_passbook_image: uploadedUrls.bankPassbook || currentEmployee.bank_passbook_image,
        resume_url: uploadedUrls.resume || currentEmployee.resume_url
      }

      const { error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', editingEmployee.id)

      if (error) throw error

      await fetchEmployees()

      alert('Employee updated successfully!')
      setShowEditPanel(false)
      setEditingEmployee(null)
      setEditFormData({})
      setEditFilePreviews({
        aadharFront: null,
        aadharBack: null,
        candidatePhoto: null,
        panCard: null,
        bankPassbook: null,
        resume: null
      })
    } catch (error) {
      console.error('Error updating employee:', error)
      alert('Error updating employee: ' + error.message)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const openEditPanel = (employee) => {
    setEditingEmployee(employee)
    setEditFormData({
      name_as_per_aadhar: employee.name_as_per_aadhar,
      date_of_joining: employee.date_of_joining,
      mobile_no: employee.mobile_no,
      father_name: employee.father_name || '',
      joining_place: employee.joining_place,
      designation: employee.designation,
      salary: employee.salary || '',
      candidate_email: employee.candidate_email || '',
      dob: employee.dob || '',
      gender: employee.gender || '',
      current_account_no: employee.current_account_no || '',
      ifsc_code: employee.ifsc_code || '',
      branch_name: employee.branch_name || '',
      payment_mode: employee.payment_mode || 'Bank Transfer',
      beneficiary_name: employee.beneficiary_name || '',
      mode_of_attendance: employee.mode_of_attendance || 'Biometric',
      aadhar_no: employee.aadhar_no || '',
      family_mobile_no: employee.family_mobile_no || '',
      joining_company_name: employee.joining_company_name || '',
      aadharFront: null,
      aadharBack: null,
      candidatePhoto: null,
      panCard: null,
      bankPassbook: null,
      resume: null
    })

    setEditFilePreviews({
      aadharFront: employee.aadhar_front_image || null,
      aadharBack: employee.aadhar_back_image || null,
      candidatePhoto: employee.candidate_photo || null,
      panCard: employee.pan_card_image || null,
      bankPassbook: employee.bank_passbook_image || null,
      resume: employee.resume_url || null
    })

    setShowEditPanel(true)
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
      beneficiary_name: '',
      aadharFront: null,
      aadharBack: null,
      candidatePhoto: null,
      panCard: null,
      bankPassbook: null,
      resume: null
    })
    setFilePreviews({
      aadharFront: null,
      aadharBack: null,
      candidatePhoto: null,
      panCard: null,
      bankPassbook: null,
      resume: null
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



  // Render file upload component for add form
  const renderFileUpload = (fieldName, label, icon, required = false) => {
    return (
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-gray-600">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex items-center gap-2 mt-1">
          {filePreviews[fieldName] ? (
            <div className="relative">
              {fieldName === 'resume' ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded bg-gray-50 text-sm text-blue-600">
                  <FileText size={16} />
                  <span>Resume Attached</span>
                </div>
              ) : (
                <img
                  src={filePreviews[fieldName]}
                  alt={fieldName}
                  className="w-16 h-16 object-cover rounded border"
                />
              )}
              <button
                type="button"
                onClick={() => handleRemoveFile(fieldName)}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded hover:border-indigo-500 cursor-pointer transition-colors w-full justify-center bg-gray-50/50">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleFileChange(e, fieldName)}
                className="hidden"
                required={required}
              />
              {icon}
              <span className="text-sm text-gray-600">Upload File</span>
            </label>
          )}
        </div>
      </div>
    )
  }

  // Render file upload component for edit panel
  const renderEditFileUpload = (fieldName, label, icon) => {
    return (
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-700">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {editFilePreviews[fieldName] ? (
            <div className="relative">
              {fieldName === 'resume' ? (
                <a
                  href={editFilePreviews[fieldName]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 border rounded bg-gray-50 text-xs text-blue-600 hover:bg-blue-50"
                >
                  <FileText size={14} />
                  View
                </a>
              ) : (
                <img
                  src={editFilePreviews[fieldName]}
                  alt={fieldName}
                  className="w-14 h-14 object-cover rounded border"
                />
              )}
              <button
                type="button"
                onClick={() => handleEditRemoveFile(fieldName)}
                className="absolute -top-2 -right-2 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-dashed rounded hover:border-indigo-500 cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleEditFileChange(e, fieldName)}
                className="hidden"
              />
              {icon}
              <span className="text-xs text-gray-600">Upload</span>
            </label>
          )}
        </div>
      </div>
    )
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
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <UserPlus size={18} />
          New Employee
        </button>
      </div>

      {/* Filter and Search Section */}
      <div className="flex gap-4 mb-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID, designation or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 overflow-x-auto">
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
              <th className="text-left px-4 py-3 font-medium text-gray-600">Shop name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-gray-500">Loading...</td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-gray-500">No employees found</td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {emp.employee_id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {emp.candidate_photo ? (
                        <img
                          src={emp.candidate_photo}
                          alt={emp.name_as_per_aadhar}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                          {emp.name_as_per_aadhar?.charAt(0) || '?'}
                        </div>
                      )}
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
                    {emp.joining_company_name}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEditPanel(emp)} className="p-1 text-blue-600 hover:text-blue-700" title="Edit">
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
          <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Add New Employee</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Self-Registration QR Code Card */}
                  <div className="lg:col-span-3 bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-indigo-50/30 border border-indigo-100 rounded-xl p-5 flex flex-col md:flex-row items-center gap-5 mb-2 shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="bg-white p-2.5 rounded-xl shadow-sm border border-indigo-100 shrink-0">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/register')}`}
                        alt="Registration QR Code"
                        className="w-[120px] h-[120px] md:w-[130px] md:h-[130px] block"
                      />
                    </div>
                    <div className="flex-1 text-center md:text-left space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                        <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>
                        New: Self-Registration
                      </div>
                      <h4 className="text-base font-bold text-slate-800">
                        Let Candidates Fill Out Their Form
                      </h4>
                      <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
                        Instead of typing candidate details manually, ask them to scan this QR code on their phone. They can fill out their details and upload their own Aadhar, PAN, photo, and resume directly.
                      </p>
                      <div className="pt-1 flex flex-wrap gap-2 justify-center md:justify-start">
                        <a
                          href="/register"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5  shadow-sm transition-all duration-200"
                        >
                          Open Page <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Personal Information Section */}
                  <div className="lg:col-span-3 mt-2">
                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b border-gray-200">Personal Information</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID <span className="text-red-500">*</span>{" (as per biometric)"}</label>
                    <input
                      type="text"
                      name="employee_id"
                      value={formData.employee_id}
                      onChange={handleInputChange}
                      placeholder="e.g., 1001"
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input type="text" name="name_as_per_aadhar" value={formData.name_as_per_aadhar} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 uppercase" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name <span className="text-red-500">*</span></label>
                    <input type="text" name="father_name" value={formData.father_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 uppercase" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                    <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender <span className="text-red-500">*</span></label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required>
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
                      value={formData.mobile_no}
                      onChange={handleInputChange}
                      maxLength={10}
                      pattern="[0-9]{10}"
                      inputMode="numeric"
                      placeholder="Enter 10 digit mobile number"
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" name="candidate_email" value={formData.candidate_email} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Family Mobile No</label>
                    <input
                      type="tel"
                      name="family_mobile_no"
                      value={formData.family_mobile_no}
                      onChange={handleInputChange}
                      maxLength={10}
                      pattern="[0-9]{10}"
                      inputMode="numeric"
                      placeholder="Enter 10 digit mobile number"
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Employment Information Section */}
                  <div className="lg:col-span-3 mt-2">
                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b border-gray-200">Employment Information</h3>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining <span className="text-red-500">*</span></label>
                    <input type="date" name="date_of_joining" value={formData.date_of_joining} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Joining Place <span className="text-red-500">*</span></label>
                    <input type="text" name="joining_place" value={formData.joining_place} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 uppercase" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Designation <span className="text-red-500">*</span></label>
                    <select
                      name="designation"
                      value={formData.designation}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      required
                    >
                      <option value="">Select Designation</option>
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="HOD">HOD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Joining Shop Name</label>
                    <select
                      name="joining_company_name"
                      value={formData.joining_company_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select Shop</option>
                      {joiningCompanies.map((company) => (
                        <option key={company.id} value={company.company_name}>
                          {company.company_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mode of Attendance</label>
                    <select name="mode_of_attendance" value={formData.mode_of_attendance} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                      <option value="Biometric">Biometric</option>
                      <option value="Manual">Manual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar No <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="aadhar_no"
                      value={formData.aadhar_no}
                      onChange={handleInputChange}
                      maxLength={16}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Enter Aadhar Number"
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      required
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
                      value={formData.current_account_no}
                      onChange={handleInputChange}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Enter Account Number"
                      className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code <span className="text-red-500">*</span></label>
                    <input type="text" name="ifsc_code" value={formData.ifsc_code} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 uppercase" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name <span className="text-red-500">*</span></label>
                    <input type="text" name="branch_name" value={formData.branch_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 uppercase" required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode <span className="text-red-500">*</span></label>
                    <select name="payment_mode" value={formData.payment_mode} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary Name</label>
                    <input type="text" name="beneficiary_name" value={formData.beneficiary_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 uppercase" />
                  </div>

                  {/* Documents Section */}
                  <div className="lg:col-span-3 mt-4">
                    <h3 className="text-md font-medium text-gray-700 mb-3 pb-2 border-b border-gray-200 flex items-center gap-1.5">
                      <Upload size={16} className="text-indigo-600" />
                      Documents
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {renderFileUpload('candidatePhoto', 'Photo', <User size={14} />, true)}
                      {renderFileUpload('aadharFront', 'Aadhar Front', <Image size={14} />, true)}
                      {renderFileUpload('aadharBack', 'Aadhar Back', <Image size={14} />, true)}
                      {renderFileUpload('panCard', 'PAN Card', <CreditCard size={14} />)}
                      {renderFileUpload('bankPassbook', 'Passbook', <BookOpen size={14} />)}
                      {renderFileUpload('resume', 'Resume', <FileText size={14} />)}
                    </div>
                  </div>

                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving || uploading} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2">
                  {(saving || uploading) && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Slide Panel - Right to Left */}
      <div className={`fixed inset-0 overflow-hidden z-50 ${showEditPanel ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${showEditPanel ? 'opacity-50' : 'opacity-0'}`}
          onClick={() => {
            setShowEditPanel(false)
            setEditingEmployee(null)
          }}
        />

        {/* Slide Panel */}
        <div className={`absolute inset-y-0 right-0 max-w-6xl w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${showEditPanel ? 'translate-x-0' : 'translate-x-full'}`}>
          {editingEmployee && (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50 text-gray-900">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowEditPanel(false)
                      setEditingEmployee(null)
                    }}
                    className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  {editFilePreviews.candidatePhoto ? (
                    <img
                      src={editFilePreviews.candidatePhoto}
                      alt={editingEmployee.name_as_per_aadhar}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      {editingEmployee.name_as_per_aadhar?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Edit Employee</h2>
                    <p className="text-xs text-gray-500">Update employee information</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-gray-200/50 px-3 py-1 rounded-full text-gray-700">
                    <span className="text-xs font-medium">ID:</span>
                    <span className="text-xs font-semibold">{editingEmployee.employee_id}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowEditPanel(false)
                      setEditingEmployee(null)
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                <div className="space-y-6">
                  {/* Documents Section */}
                  <div className="bg-white border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                      <Upload size={16} />
                      Documents
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {renderEditFileUpload('candidatePhoto', 'Photo', <User size={14} />)}
                      {renderEditFileUpload('aadharFront', 'Aadhar Front', <Image size={14} />)}
                      {renderEditFileUpload('aadharBack', 'Aadhar Back', <Image size={14} />)}
                      {renderEditFileUpload('panCard', 'PAN Card', <CreditCard size={14} />)}
                      {renderEditFileUpload('bankPassbook', 'Passbook', <BookOpen size={14} />)}
                      {renderEditFileUpload('resume', 'Resume', <FileText size={14} />)}
                    </div>
                  </div>

                  {/* Personal Information Section */}
                  <div className="bg-white border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-100">
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employee ID</label>
                        <input
                          type="text"
                          value={editingEmployee.employee_id}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="name_as_per_aadhar"
                          value={editFormData.name_as_per_aadhar || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800 uppercase"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Father's Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="father_name"
                          value={editFormData.father_name || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800 uppercase"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          name="dob"
                          value={editFormData.dob || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Gender <span className="text-red-500">*</span></label>
                        <select
                          name="gender"
                          value={editFormData.gender || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                          required
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mobile No <span className="text-red-500">*</span></label>
                        <input
                          type="tel"
                          name="mobile_no"
                          value={editFormData.mobile_no || ''}
                          onChange={handleEditInputChange}
                          maxLength={10}
                          pattern="[0-9]{10}"
                          inputMode="numeric"
                          placeholder="Enter 10 digit mobile number"
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                        <input
                          type="email"
                          name="candidate_email"
                          value={editFormData.candidate_email || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Family Mobile No</label>
                        <input
                          type="tel"
                          name="family_mobile_no"
                          value={editFormData.family_mobile_no || ''}
                          onChange={handleEditInputChange}
                          maxLength={10}
                          pattern="[0-9]{10}"
                          inputMode="numeric"
                          placeholder="Enter 10 digit mobile number"
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Employment Information Section */}
                  <div className="bg-white border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-100">
                      Employment Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date of Joining <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          name="date_of_joining"
                          value={editFormData.date_of_joining || ''} 
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Joining Place <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="joining_place"
                          value={editFormData.joining_place || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800 uppercase"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Designation <span className="text-red-500">*</span></label>
                        <select
                          name="designation"
                          value={editFormData.designation || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                          required
                        >
                          <option value="">Select Designation</option>
                          <option value="Employee">Employee</option>
                          <option value="Manager">Manager</option>
                          <option value="HOD">HOD</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Salary</label>
                        <input
                          type="number"
                          name="salary"
                          value={editFormData.salary || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Joining Shop Name</label>
                        <select
                          name="joining_company_name"
                          value={editFormData.joining_company_name || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                        >
                          <option value="">Select Shop</option>
                          {joiningCompanies.map((company) => (
                            <option key={company.id} value={company.company_name}>
                              {company.company_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mode of Attendance</label>
                        <select
                          name="mode_of_attendance"
                          value={editFormData.mode_of_attendance || 'Biometric'}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                        >
                          <option value="Biometric">Biometric</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Aadhar No <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="aadhar_no"
                          value={editFormData.aadhar_no || ''}
                          onChange={handleEditInputChange}
                          maxLength={16}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="Enter Aadhar Number"
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banking Information Section */}
                  <div className="bg-white border border-gray-200 shadow-sm p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-100">
                      Banking Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Account No <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="current_account_no"
                          value={editFormData.current_account_no || ''}
                          onChange={handleEditInputChange}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="Enter Account Number"
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">IFSC Code <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="ifsc_code"
                          value={editFormData.ifsc_code || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800 uppercase"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Branch Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          name="branch_name"
                          value={editFormData.branch_name || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800 uppercase"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Mode <span className="text-red-500">*</span></label>
                        <select
                          name="payment_mode"
                          value={editFormData.payment_mode || 'Bank Transfer'}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800"
                          required
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Beneficiary Name</label>
                        <input
                          type="text"
                          name="beneficiary_name"
                          value={editFormData.beneficiary_name || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-3 py-2 text-sm border border-gray-300  focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-800 uppercase"
                        />
                      </div>


                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPanel(false)
                    setEditingEmployee(null)
                  }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300  hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={saving || uploading}
                  className="px-6 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 font-medium shadow-sm"
                >
                  {(saving || uploading) && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {uploading ? 'Uploading...' : saving ? 'Updating...' : 'Update Employee'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Slide Panel - Right to Left */}
      <div className={`fixed inset-0 overflow-hidden z-50 ${showDetailsModal ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${showDetailsModal ? 'opacity-50' : 'opacity-0'}`}
          onClick={() => {
            setShowDetailsModal(false)
            setSelectedEmployee(null)
          }}
        />

        {/* Slide Panel */}
        <div className={`absolute inset-y-0 right-0 max-w-5xl w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${showDetailsModal ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedEmployee && (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50 text-gray-900">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowDetailsModal(false)
                      setSelectedEmployee(null)
                    }}
                    className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  {selectedEmployee.candidate_photo ? (
                    <img
                      src={selectedEmployee.candidate_photo}
                      alt={selectedEmployee.name_as_per_aadhar}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                      {selectedEmployee.name_as_per_aadhar?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-base text-gray-900">{selectedEmployee.name_as_per_aadhar}</h3>
                    <p className="text-xs text-gray-500">{selectedEmployee.designation} • {selectedEmployee.joining_place}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-gray-200/50 px-3 py-1 rounded-full text-gray-700">
                    <span className="text-xs font-medium">ID:</span>
                    <span className="text-xs font-semibold">{selectedEmployee.employee_id}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false)
                      setSelectedEmployee(null)
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="bg-white  border border-gray-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Name</label>
                        <input
                          type="text"
                          value={selectedEmployee.name_as_per_aadhar || ''}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Father's Name</label>
                        <input
                          type="text"
                          value={selectedEmployee.father_name || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date of Birth</label>
                        <input
                          type="text"
                          value={selectedEmployee.dob || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Gender</label>
                        <input
                          type="text"
                          value={selectedEmployee.gender || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mobile No</label>
                        <input
                          type="text"
                          value={selectedEmployee.mobile_no || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
                        <input
                          type="text"
                          value={selectedEmployee.candidate_email || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Family Mobile No</label>
                        <input
                          type="text"
                          value={selectedEmployee.family_mobile_no || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Employment Information */}
                  <div className="bg-white  border border-gray-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                      Employment Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date of Joining</label>
                        <input
                          type="text"
                          value={selectedEmployee.date_of_joining || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Joining Place</label>
                        <input
                          type="text"
                          value={selectedEmployee.joining_place || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Designation</label>
                        <input
                          type="text"
                          value={selectedEmployee.designation || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Salary</label>
                        <input
                          type="text"
                          value={selectedEmployee.salary ? `₹${selectedEmployee.salary.toLocaleString()}` : '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Joining Shop Name</label>
                        <input
                          type="text"
                          value={selectedEmployee.joining_company_name || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mode of Attendance</label>
                        <input
                          type="text"
                          value={selectedEmployee.mode_of_attendance || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Aadhar No</label>
                        <input
                          type="text"
                          value={selectedEmployee.aadhar_no || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>

                    </div>
                  </div>

                  {/* Banking Information */}
                  <div className="bg-white  border border-gray-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                      Banking Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Account No</label>
                        <input
                          type="text"
                          value={selectedEmployee.current_account_no || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">IFSC Code</label>
                        <input
                          type="text"
                          value={selectedEmployee.ifsc_code || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Branch Name</label>
                        <input
                          type="text"
                          value={selectedEmployee.branch_name || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Payment Mode</label>
                        <input
                          type="text"
                          value={selectedEmployee.payment_mode || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">Beneficiary Name</label>
                        <input
                          type="text"
                          value={selectedEmployee.beneficiary_name || '--'}
                          disabled
                          className="w-full px-3 py-2 text-sm border border-gray-200  bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Documents */}
                  <div className="bg-white  border border-gray-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                      Documents
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedEmployee.candidate_photo && (
                        <a
                          href={selectedEmployee.candidate_photo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 border border-gray-200  hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors"
                        >
                          <div className="p-2 bg-indigo-50  text-indigo-600">
                            <User size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">Employee Photo</p>
                            <span className="text-[10px] text-gray-400">Click to view</span>
                          </div>
                          <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
                        </a>
                      )}
                      {selectedEmployee.aadhar_front_image && (
                        <a
                          href={selectedEmployee.aadhar_front_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 border border-gray-200  hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors"
                        >
                          <div className="p-2 bg-indigo-50  text-indigo-600">
                            <Image size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">Aadhar Front</p>
                            <span className="text-[10px] text-gray-400">Click to view</span>
                          </div>
                          <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
                        </a>
                      )}
                      {selectedEmployee.aadhar_back_image && (
                        <a
                          href={selectedEmployee.aadhar_back_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 border border-gray-200  hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors"
                        >
                          <div className="p-2 bg-indigo-50  text-indigo-600">
                            <Image size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">Aadhar Back</p>
                            <span className="text-[10px] text-gray-400">Click to view</span>
                          </div>
                          <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
                        </a>
                      )}
                      {selectedEmployee.pan_card_image && (
                        <a
                          href={selectedEmployee.pan_card_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 border border-gray-200  hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors"
                        >
                          <div className="p-2 bg-indigo-50  text-indigo-600">
                            <CreditCard size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">PAN Card</p>
                            <span className="text-[10px] text-gray-400">Click to view</span>
                          </div>
                          <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
                        </a>
                      )}
                      {selectedEmployee.bank_passbook_image && (
                        <a
                          href={selectedEmployee.bank_passbook_image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 border border-gray-200  hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors"
                        >
                          <div className="p-2 bg-indigo-50  text-indigo-600">
                            <BookOpen size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">Bank Passbook</p>
                            <span className="text-[10px] text-gray-400">Click to view</span>
                          </div>
                          <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
                        </a>
                      )}
                      {selectedEmployee.resume_url && (
                        <a
                          href={selectedEmployee.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 border border-gray-200  hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors"
                        >
                          <div className="p-2 bg-indigo-50  text-indigo-600">
                            <FileText size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">Resume</p>
                            <span className="text-[10px] text-gray-400">Click to view</span>
                          </div>
                          <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
                        </a>
                      )}
                      {!(selectedEmployee.candidate_photo || selectedEmployee.aadhar_front_image || selectedEmployee.aadhar_back_image || selectedEmployee.pan_card_image || selectedEmployee.bank_passbook_image || selectedEmployee.resume_url) && (
                        <div className="col-span-full py-4 text-center text-sm text-gray-400 bg-gray-50 border border-dashed border-gray-200 ">
                          No documents uploaded
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setShowDetailsModal(false)
                    setSelectedEmployee(null)
                  }}
                  className="px-6 py-2 text-sm bg-gray-200 text-gray-700  hover:bg-gray-300 transition-colors font-medium shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}