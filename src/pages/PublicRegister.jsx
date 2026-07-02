import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, Image, User, CreditCard, BookOpen, FileText, X, CheckCircle, ArrowRight, Crop } from 'lucide-react'

const STORAGE_BUCKET = 'employee_documents'

const CropperModal = ({ isOpen, imageSrc, aspectRatio, onClose, onCrop, onSkip }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const maskRef = useRef(null);
  const imgRef = useRef(null);

  // Reset scale and offset when modal is opened or image changes
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  if (!isOpen) return null;

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };

  const handleSave = () => {
    if (!maskRef.current || !imgRef.current) return;

    const maskRect = maskRef.current.getBoundingClientRect();
    const imgRect = imgRef.current.getBoundingClientRect();

    const scaleFactor = imgRef.current.naturalWidth / imgRect.width;

    const x_crop = (maskRect.left - imgRect.left) * scaleFactor;
    const y_crop = (maskRect.top - imgRect.top) * scaleFactor;
    const w_crop = maskRect.width * scaleFactor;
    const h_crop = maskRect.height * scaleFactor;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = maskRect.width * 2;
      canvas.height = maskRect.height * 2;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(
        imgRef.current,
        x_crop, y_crop, w_crop, h_crop,
        0, 0, canvas.width, canvas.height
      );
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      onCrop(dataUrl);
    } catch (e) {
      console.error('Error cropping image:', e);
      alert('Failed to crop image, using original file instead.');
      onSkip();
    }
  };

  const maskWidth = aspectRatio === 1.0 ? 220 : 320;
  const maskHeight = 200;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
      <div className="bg-white max-w-lg w-full rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <Crop size={16} className="text-indigo-600" />
            Adjust and Crop Image
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex-1 flex flex-col items-center justify-center space-y-6 overflow-y-auto">
          <p className="text-xs text-gray-500 text-center">
            Drag to pan. Use the slider below to zoom.
          </p>

          <div className="relative w-full h-[300px] bg-slate-900 overflow-hidden flex items-center justify-center select-none rounded-lg border border-slate-800 cursor-move"
               onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleMouseUp}
               onMouseDown={handleMouseDown}>
            
            <img
              ref={imgRef}
              src={imageSrc}
              alt="To Crop"
              className="absolute pointer-events-none select-none max-w-none origin-center"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                width: aspectRatio === 1.0 ? '250px' : '350px',
                height: 'auto',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out'
              }}
            />

            <div
              ref={maskRef}
              className="absolute pointer-events-none border-2 border-dashed border-indigo-500 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
              style={{
                width: `${maskWidth}px`,
                height: `${maskHeight}px`,
                borderRadius: aspectRatio === 1.0 ? '50%' : '8px'
              }}
            />
          </div>

          <div className="w-full flex items-center gap-3">
            <span className="text-xs text-gray-400 font-semibold">-</span>
            <input
              type="range"
              min="1"
              max="4"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs text-gray-400 font-semibold">+</span>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 gap-2">
          <button
            onClick={onSkip}
            className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Skip Crop
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Crop & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PublicRegister() {
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [joiningCompanies, setJoiningCompanies] = useState([])

  useEffect(() => {
    fetchJoiningCompanies()
  }, [])

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

  const [filePreviews, setFilePreviews] = useState({
    aadharFront: null,
    aadharBack: null,
    candidatePhoto: null,
    panCard: null,
    bankPassbook: null,
    resume: null
  })

  const [cropModal, setCropModal] = useState({
    isOpen: false,
    imageSrc: '',
    fieldName: '',
    fileName: '',
    fileType: '',
    aspectRatio: 1.0,
    originalFile: null
  })

  // Helper to convert cropped DataURL to File object
  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  }

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
    date_of_joining: new Date().toISOString().split('T')[0],
    joining_place: '',
    designation: 'Candidate',
    salary: '',
    joining_company_name: '',
    mode_of_attendance: 'Biometric',
    aadhar_no: '',
    current_account_no: '',
    ifsc_code: '',
    branch_name: '',
    payment_mode: 'Bank Transfer',
    beneficiary_name: '',
    status: 'Active',
    aadharFront: null,
    aadharBack: null,
    candidatePhoto: null,
    panCard: null,
    bankPassbook: null,
    resume: null
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

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

    const croppableFields = ['candidatePhoto', 'aadharFront', 'aadharBack', 'panCard', 'bankPassbook']
    if (croppableFields.includes(fieldName) && file.type.startsWith('image/')) {
      setCropModal({
        isOpen: true,
        imageSrc: previewUrl,
        fieldName,
        fileName: file.name,
        fileType: file.type,
        aspectRatio: fieldName === 'candidatePhoto' ? 1.0 : 1.6,
        originalFile: file
      })
      e.target.value = '' // Clear input
    } else {
      setFormData(prev => ({ ...prev, [fieldName]: file }))
      setFilePreviews(prev => ({ ...prev, [fieldName]: previewUrl }))
    }
  }

  const handleCropComplete = (croppedDataUrl) => {
    try {
      const croppedFile = dataURLtoFile(croppedDataUrl, cropModal.fileName)
      const previewUrl = URL.createObjectURL(croppedFile)
      
      setFormData(prev => ({ ...prev, [cropModal.fieldName]: croppedFile }))
      setFilePreviews(prev => ({ ...prev, [cropModal.fieldName]: previewUrl }))
    } catch (e) {
      console.error('Error processing cropped file:', e)
      // Fallback to original file
      setFormData(prev => ({ ...prev, [cropModal.fieldName]: cropModal.originalFile }))
      setFilePreviews(prev => ({ ...prev, [cropModal.fieldName]: cropModal.imageSrc }))
    } finally {
      setCropModal(prev => ({ ...prev, isOpen: false }))
    }
  }

  const handleCropSkip = () => {
    setFormData(prev => ({ ...prev, [cropModal.fieldName]: cropModal.originalFile }))
    setFilePreviews(prev => ({ ...prev, [cropModal.fieldName]: cropModal.imageSrc }))
    setCropModal(prev => ({ ...prev, isOpen: false }))
  }

  const handleRemoveFile = (fieldName) => {
    setFormData(prev => ({ ...prev, [fieldName]: null }))
    setFilePreviews(prev => ({ ...prev, [fieldName]: null }))
  }

  const uploadDocument = async (employeeId, documentType, file) => {
    if (!file) return null
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${documentType}/${employeeId}_${Date.now()}.${fileExt}`

      const { error } = await supabase.storage
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setUploading(true)

    try {
      // Check if employee_id already exists
      const { data: existing } = await supabase
        .from('employees')
        .select('employee_id')
        .eq('employee_id', formData.employee_id)
        .single()

      if (existing) {
        alert(`Registration reference ID ${formData.employee_id} already exists. Please refresh or modify the ID.`)
        setSaving(false)
        setUploading(false)
        return
      }

      // Upload files first
      const files = {
        aadharFront: formData.aadharFront,
        aadharBack: formData.aadharBack,
        candidatePhoto: formData.candidatePhoto,
        panCard: formData.panCard,
        bankPassbook: formData.bankPassbook,
        resume: formData.resume
      }

      const uploadedUrls = await uploadEmployeeDocuments(formData.employee_id, files)

      // Insert record
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

      const { error: insertError } = await supabase
        .from('employees')
        .insert([employeeData])

      if (insertError) throw insertError

      setSubmitted(true)
    } catch (error) {
      console.error('Registration failed:', error)
      alert('Error registering employee: ' + error.message)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

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
              />
              {icon}
              <span className="text-sm text-gray-600">Upload File</span>
            </label>
          )}
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center space-y-6 border border-gray-100">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle size={36} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Registration Complete!</h2>
            <p className="text-gray-500 text-sm mt-2">
              Your details and documents have been successfully submitted to HR.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-left">
            <div className="flex justify-between py-1">
              <span className="text-gray-500 text-xs">Reference ID:</span>
              <span className="font-mono text-xs font-bold text-gray-800">{formData.employee_id}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500 text-xs">Name:</span>
              <span className="text-xs font-semibold text-gray-800">{formData.name_as_per_aadhar}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500 text-xs">Mobile No:</span>
              <span className="text-xs font-semibold text-gray-800">{formData.mobile_no}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            You can close this tab now. Contact your hiring manager if you need to make corrections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100/60 p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">

        {/* Banner header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-8 text-white relative">
          <div className="absolute right-6 top-6 opacity-10">
            <User size={120} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Employee Registration</h1>
          <p className="text-indigo-100 text-xs sm:text-sm mt-1.5 max-w-xl">
            Please fill out all the details carefully as per your official documents and submit.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">

          {/* Personal Information Section */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-1.5">
              <User size={18} className="text-indigo-600" />
              Personal Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employee ID<span className="text-red-500">*</span>{"  (as per biometric)"}</label>
                <input
                  type="text"
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleInputChange}
                  placeholder="e.g., 1001"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  name="name_as_per_aadhar"
                  value={formData.name_as_per_aadhar}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name_as_per_aadhar: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Father's Name <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  name="father_name"
                  value={formData.father_name}
                  onChange={(e) =>
                    handleInputChange({
                      target: {
                        name: e.target.name,
                        value: e.target.value.toUpperCase(),
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
                <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500" required />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Gender <span className="text-red-500">*</span></label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white" required>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Mobile No <span className="text-red-500">*</span>
                </label>

                <input
                  type="tel"
                  name="mobile_no"
                  value={formData.mobile_no}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);

                    handleInputChange({
                      target: {
                        name: 'mobile_no',
                        value,
                      },
                    });
                  }}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  inputMode="numeric"
                  placeholder="Enter 10 digit mobile number"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                <input type="email" name="candidate_email" value={formData.candidate_email} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Family Mobile No
                </label>

                <input
                  type="tel"
                  name="family_mobile_no"
                  value={formData.family_mobile_no}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);

                    setFormData((prev) => ({
                      ...prev,
                      family_mobile_no: value,
                    }));
                  }}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  inputMode="numeric"
                  placeholder="Enter 10 digit mobile no"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Employment Information Section */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-1.5">
              <ArrowRight size={18} className="text-indigo-600" />
              Employment Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date of Joining <span className="text-red-500">*</span></label>
                <input type="date" name="date_of_joining" value={formData.date_of_joining} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500" required />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Joining Place <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  name="joining_place"
                  value={formData.joining_place}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      joining_place: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Designation <span className="text-red-500">*</span></label>
                <select
                  name="designation"
                  value={formData.designation}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                  required
                >
                  <option value="">Select Designation</option>
                  <option value="Employee">Employee</option>
                  <option value="Manager">Manager</option>
                  <option value="HOD">HOD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Joining Shop Name</label>
                <select
                  name="joining_company_name"
                  value={formData.joining_company_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
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
                <select name="mode_of_attendance" value={formData.mode_of_attendance} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white">
                  <option value="Biometric">Biometric</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Aadhar No <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  name="aadhar_no"
                  value={formData.aadhar_no}
                  onChange={(e) => {
                    const numericValue = e.target.value
                      .replace(/\D/g, "") // numbers only
                      .slice(0, 16); // max 16 digits

                    handleInputChange({
                      target: {
                        name: "aadhar_no",
                        value: numericValue,
                      },
                    });
                  }}
                  maxLength={16}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter Aadhar Number"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Banking Information Section */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-1.5">
              <BookOpen size={18} className="text-indigo-600" />
              Banking Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Account No <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  name="current_account_no"
                  value={formData.current_account_no}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/\D/g, "");

                    handleInputChange({
                      target: {
                        name: "current_account_no",
                        value: numericValue,
                      },
                    });
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter Account Number"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  IFSC Code <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  name="ifsc_code"
                  value={formData.ifsc_code}
                  onChange={(e) =>
                    handleInputChange({
                      target: {
                        name: "ifsc_code",
                        value: e.target.value.toUpperCase(),
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Branch Name <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  name="branch_name"
                  value={formData.branch_name}
                  onChange={(e) =>
                    handleInputChange({
                      target: {
                        name: "branch_name",
                        value: e.target.value.toUpperCase(),
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Mode <span className="text-red-500">*</span></label>
                <select name="payment_mode" value={formData.payment_mode} onChange={handleInputChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white" required>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Beneficiary Name
                </label>

                <input
                  type="text"
                  name="beneficiary_name"
                  value={formData.beneficiary_name}
                  onChange={(e) =>
                    handleInputChange({
                      target: {
                        name: "beneficiary_name",
                        value: e.target.value.toUpperCase(),
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 uppercase"
                />
              </div>

            </div>
          </div>

          {/* Documents Section */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-800 pb-2 border-b border-gray-200 flex items-center gap-1.5">
              <Upload size={18} className="text-indigo-600" />
              Documents
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {renderFileUpload('candidatePhoto', 'Candidate Photo', <User size={16} />, true)}
              {renderFileUpload('aadharFront', 'Aadhar Front', <Image size={16} />, true)}
              {renderFileUpload('aadharBack', 'Aadhar Back', <Image size={16} />, true)}
              {renderFileUpload('panCard', 'PAN Card', <CreditCard size={16} />)}
              {renderFileUpload('bankPassbook', 'Bank Passbook', <BookOpen size={16} />)}
              {renderFileUpload('resume', 'Resume', <FileText size={16} />)}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow"
            >
              {(saving || uploading) && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {uploading ? 'Uploading Documents...' : saving ? 'Saving Profile...' : 'Submit Registration'}
            </button>
          </div>

        </form>
      </div>

      <CropperModal
        isOpen={cropModal.isOpen}
        imageSrc={cropModal.imageSrc}
        aspectRatio={cropModal.aspectRatio}
        onClose={() => setCropModal(prev => ({ ...prev, isOpen: false }))}
        onCrop={handleCropComplete}
        onSkip={handleCropSkip}
      />
    </div>
  )
}
