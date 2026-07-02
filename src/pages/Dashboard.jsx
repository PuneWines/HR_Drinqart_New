import { useState, useEffect } from 'react'
import { Users, UserCheck, Clock, UserX, Briefcase, Calendar, TrendingUp, Award, PieChart, Filter, Search, AlertCircle, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
    // Employee stats
    const [totalEmployee, setTotalEmployee] = useState(0)
    const [activeEmployee, setActiveEmployee] = useState(0)
    const [leftEmployee, setLeftEmployee] = useState(0)
    const [inactiveEmployee, setInactiveEmployee] = useState(0)
    const [leaveThisMonth, setLeaveThisMonth] = useState(0)

    // Attendance stats for today
    const [todayAttendance, setTodayAttendance] = useState({
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        totalPresent: 0,
        totalAbsent: 0
    })

    const [loading, setLoading] = useState(true)
    const [recentEmployees, setRecentEmployees] = useState([])
    const [statusDistribution, setStatusDistribution] = useState([])
    const [todayDate, setTodayDate] = useState('')

    // States for unified detailed employees modal and lists
    const [presentEmployeesList, setPresentEmployeesList] = useState([])
    const [absentEmployeesList, setAbsentEmployeesList] = useState([])
    const [lateEmployeesList, setLateEmployeesList] = useState([])
    const [halfDayEmployeesList, setHalfDayEmployeesList] = useState([])
    const [detailModal, setDetailModal] = useState({
        isOpen: false,
        title: '',
        subtitle: '',
        employees: [],
        type: 'Present'
    })

    // Fetch employees and calculate stats
    useEffect(() => {
        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        setTodayDate(`${yyyy}-${mm}-${dd}`)

        fetchEmployees()
        fetchTodayAttendance()
    }, [])

    const fetchEmployees = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error

            // Calculate statistics
            const total = data?.length || 0
            const active = data?.filter(emp => emp.status === 'Active').length || 0
            const inactive = data?.filter(emp => emp.status === 'Inactive').length || 0
            const left = data?.filter(emp => emp.status === 'Left').length || 0

            // Calculate left this month
            const currentDate = new Date()
            const currentMonth = currentDate.getMonth()
            const currentYear = currentDate.getFullYear()

            const leftThisMonth = data?.filter(emp => {
                if (emp.status !== 'Left') return false
                const leftDate = new Date(emp.updated_at || emp.created_at)
                return leftDate.getMonth() === currentMonth && leftDate.getFullYear() === currentYear
            }).length || 0

            setTotalEmployee(total)
            setActiveEmployee(active)
            setInactiveEmployee(inactive)
            setLeftEmployee(left)
            setLeaveThisMonth(leftThisMonth)

            // Get recent employees (last 5)
            const recent = data?.slice(0, 5) || []
            setRecentEmployees(recent)

            // Calculate status distribution for pie chart
            const statusData = [
                {
                    name: 'Active',
                    count: active,
                    percentage: total ? Math.round((active / total) * 100) : 0,
                    color: '#10b981',
                    bgColor: 'bg-green-100',
                    badgeColor: 'bg-green-100 text-green-700',
                    textColor: 'text-green-600'
                },
                {
                    name: 'Inactive',
                    count: inactive,
                    percentage: total ? Math.round((inactive / total) * 100) : 0,
                    color: '#f59e0b',
                    bgColor: 'bg-amber-100',
                    badgeColor: 'bg-amber-100 text-amber-700',
                    textColor: 'text-amber-600'
                },
                {
                    name: 'Left',
                    count: left,
                    percentage: total ? Math.round((left / total) * 100) : 0,
                    color: '#ef4444',
                    bgColor: 'bg-red-100',
                    badgeColor: 'bg-red-100 text-red-700',
                    textColor: 'text-red-600'
                }
            ]
            setStatusDistribution(statusData)

        } catch (error) {
            console.error('Error fetching employees:', error)
        } finally {
            setLoading(false)
        }
    }

    // Fetch today's attendance statistics and categorize employees
    const fetchTodayAttendance = async () => {
        try {
            const today = new Date()
            const yyyy = today.getFullYear()
            const mm = String(today.getMonth() + 1).padStart(2, '0')
            const dd = String(today.getDate()).padStart(2, '0')
            const todayStr = `${yyyy}-${mm}-${dd}`

            // Fetch all active employees
            const { data: activeEmployees, error: empError } = await supabase
                .from('employees')
                .select('employee_id, name_as_per_aadhar, designation, joining_place')
                .eq('status', 'Active')

            if (empError) throw empError

            // Fetch today's attendance logs
            const { data: attendanceLogs, error: attError } = await supabase
                .from('attendance_logs')
                .select('status, employee_id, store_name, in_time, late_minute')
                .eq('attendance_date', todayStr)
 
            if (attError) throw attError
 
            const logsMap = new Map()
            attendanceLogs?.forEach(log => {
                logsMap.set(log.employee_id, log)
            })

            const presentList = []
            const lateList = []
            const absentList = []
            const halfDayList = []

            activeEmployees?.forEach(emp => {
                const log = logsMap.get(emp.employee_id)
                if (log) {
                    const empWithStore = {
                        ...emp,
                        joining_place: log.store_name || emp.joining_place,
                        in_time: log.in_time,
                        late_minute: log.late_minute,
                        status: log.status
                    }
                    if (log.status === 'Present') {
                        presentList.push(empWithStore)
                    } else if (log.status === 'Late') {
                        lateList.push(empWithStore)
                    } else if (log.status === 'Half Day') {
                        halfDayList.push(empWithStore)
                    } else if (log.status === 'Absent') {
                        absentList.push(empWithStore)
                    } else {
                        presentList.push(empWithStore)
                    }
                } else {
                    const empAbsent = {
                        ...emp,
                        status: 'Absent',
                        in_time: null,
                        late_minute: null
                    }
                    absentList.push(empAbsent)
                }
            })

            setPresentEmployeesList(presentList)
            setLateEmployeesList(lateList)
            setAbsentEmployeesList(absentList)
            setHalfDayEmployeesList(halfDayList)

            setTodayAttendance({
                present: presentList.length + lateList.length,
                late: lateList.length,
                absent: absentList.length,
                halfDay: halfDayList.length,
                totalPresent: presentList.length + lateList.length,
                totalAbsent: absentList.length
            })

        } catch (error) {
            console.error('Error fetching today\'s attendance:', error)
        }
    }

    const handleCardClick = (type) => {
        let title = ''
        let subtitle = ''
        let employeesList = []

        switch (type) {
            case 'Present':
                title = 'Present Employees'
                subtitle = `Employees who marked attendance for ${todayDate}`
                employeesList = [...presentEmployeesList, ...lateEmployeesList]
                break
            case 'Late':
                title = 'Late Arrivals'
                subtitle = `Employees who clocked in after 10:10 AM IST for ${todayDate}`
                employeesList = lateEmployeesList
                break
            case 'Absent':
                title = 'Absent Employees'
                subtitle = `Active employees who have no attendance record or are marked absent for ${todayDate}`
                employeesList = absentEmployeesList
                break
            case 'Half Day':
                title = 'Half Day Employees'
                subtitle = `Employees marked on half day for ${todayDate}`
                employeesList = halfDayEmployeesList
                break
            default:
                return
        }

        setDetailModal({
            isOpen: true,
            title,
            subtitle,
            employees: employeesList,
            type
        })
    }

    // Refresh attendance data (can be called after sync)
    const refreshAttendance = async () => {
        await fetchTodayAttendance()
        await fetchEmployees()
    }

    const formatTimeIST = (timeStr) => {
        if (!timeStr) return '-'
        try {
            let formatted = timeStr.trim();
            if (formatted.includes('T')) {
                const date = new Date(formatted);
                if (!isNaN(date.getTime())) {
                    return new Intl.DateTimeFormat('en-US', {
                        timeZone: 'Asia/Kolkata',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    }).format(date);
                }
            } else if (formatted.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
                const [hStr, mStr] = formatted.split(':');
                const h = parseInt(hStr, 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const displayH = h % 12 === 0 ? 12 : h % 12;
                return `${displayH}:${mStr} ${ampm}`;
            }
            return timeStr;
        } catch (e) {
            return timeStr;
        }
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffTime = Math.abs(now - date)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} week ago`
        return `${Math.floor(diffDays / 30)} months ago`
    }

    // Calculate pie chart segments
    const getPieChartGradient = () => {
        const activePercent = statusDistribution[0]?.percentage || 0
        const inactivePercent = statusDistribution[1]?.percentage || 0
        const leftPercent = statusDistribution[2]?.percentage || 0

        if (activePercent === 0 && inactivePercent === 0 && leftPercent === 0) {
            return 'conic-gradient(#e5e7eb 0deg 360deg)'
        }

        let currentAngle = 0
        const segments = []

        if (activePercent > 0) {
            const activeDeg = (activePercent / 100) * 360
            segments.push(`#10b981 ${currentAngle}deg ${currentAngle + activeDeg}deg`)
            currentAngle += activeDeg
        }

        if (inactivePercent > 0) {
            const inactiveDeg = (inactivePercent / 100) * 360
            segments.push(`#f59e0b ${currentAngle}deg ${currentAngle + inactiveDeg}deg`)
            currentAngle += inactiveDeg
        }

        if (leftPercent > 0) {
            const leftDeg = (leftPercent / 100) * 360
            segments.push(`#ef4444 ${currentAngle}deg ${currentAngle + leftDeg}deg`)
            currentAngle += leftDeg
        }

        return `conic-gradient(${segments.join(', ')})`
    }

    const StatCard = ({ icon: Icon, title, value, color, bgColor, trend, subtext, onClick }) => (
        <div
            onClick={onClick}
            className={`bg-white border border-gray-200 p-4 hover:shadow-md transition-all hover:-translate-y-0.5 ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
        >
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-sm text-gray-500 font-medium">{title}</p>
                    <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
                    {trend && <p className="text-xs text-green-600">{trend}</p>}
                    {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
                </div>
                <div className={`p-3  ${bgColor}`}>
                    <Icon size={24} className={color} />
                </div>
            </div>
        </div>
    )

    return (
        <div className="p-10 pt-5">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <PieChart size={28} />
                        Dashboard
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Overview of employee statistics and today's attendance
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">
                        {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                    <button
                        onClick={refreshAttendance}
                        className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="flex items-center gap-2 text-gray-500">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        Loading dashboard data...
                    </div>
                </div>
            ) : (
                <>
                    {/* Today's Attendance Stats Cards */}
                    <div className="mb-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                icon={UserCheck}
                                title="Present"
                                value={todayAttendance.present}
                                color="text-green-600"
                                bgColor="bg-green-50"
                                subtext={`${presentEmployeesList.length} on-time, ${lateEmployeesList.length} late`}
                                onClick={() => handleCardClick('Present')}
                            />
                            <StatCard
                                icon={Clock}
                                title="Late Arrivals"
                                value={todayAttendance.late}
                                color="text-orange-600"
                                bgColor="bg-orange-50"
                                subtext="Clocked in after 10:10 AM"
                                onClick={() => handleCardClick('Late')}
                            />
                            <StatCard
                                icon={UserX}
                                title="Absent"
                                value={todayAttendance.absent}
                                color="text-red-600"
                                bgColor="bg-red-50"
                                subtext="No attendance log today"
                                onClick={() => handleCardClick('Absent')}
                            />
                            <StatCard
                                icon={AlertCircle}
                                title="Half Day"
                                value={todayAttendance.halfDay}
                                color="text-yellow-600"
                                bgColor="bg-yellow-50"
                                subtext="Marked on half day status"
                                onClick={() => handleCardClick('Half Day')}
                            />
                        </div>
                    </div>

                    {/* Charts and Activity Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Employee Status Distribution - Pie Chart */}
                        <div className="lg:col-span-2 bg-white  border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-900">Employee Status Distribution</h2>
                                <PieChart size={20} className="text-gray-400" />
                            </div>

                            {totalEmployee > 0 ? (
                                <div className="flex flex-col lg:flex-row items-center gap-8">
                                    {/* Pie Chart */}
                                    <div className="relative w-48 h-48">
                                        <div
                                            className="w-full h-full rounded-full shadow-sm transition-all duration-500"
                                            style={{ background: getPieChartGradient() }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-gray-900">{totalEmployee}</p>
                                                <p className="text-xs text-gray-500">Total</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex-1 space-y-3">
                                        {statusDistribution.map((status) => (
                                            <div key={status.name} className="flex items-center justify-between p-3  hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${status.bgColor.replace('100', '500')}`} />
                                                    <span className="text-sm font-medium text-gray-700">{status.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-semibold text-gray-900">{status.count}</span>
                                                    <span className="text-xs text-gray-500 ml-1">({status.percentage}%)</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-400">No employee data available</p>
                                </div>
                            )}

                            {/* Quick Stats */}
                            <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <p className="text-xs text-gray-500 mb-1">Active Rate</p>
                                    <p className="text-xl font-bold text-green-600">
                                        {totalEmployee ? Math.round((activeEmployee / totalEmployee) * 100) : 0}%
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-gray-500 mb-1">Inactive Rate</p>
                                    <p className="text-xl font-bold text-amber-600">
                                        {totalEmployee ? Math.round((inactiveEmployee / totalEmployee) * 100) : 0}%
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-gray-500 mb-1">Retention Rate</p>
                                    <p className="text-xl font-bold text-blue-600">
                                        {totalEmployee ? Math.round(((totalEmployee - leftEmployee) / totalEmployee) * 100) : 0}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activities */}
                        <div className="bg-white  border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-900">Recent Activities</h2>
                                <Calendar size={20} className="text-gray-400" />
                            </div>
                            <div className="space-y-4">
                                {recentEmployees.length > 0 ? (
                                    recentEmployees.map((emp) => (
                                        <div key={emp.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
                                                {emp.name_as_per_aadhar?.charAt(0) || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900">{emp.name_as_per_aadhar}</p>
                                                <p className="text-xs text-gray-500">{emp.designation || 'Employee'} joined</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400">{formatDate(emp.date_of_joining)}</p>
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${emp.status === 'Active' ? 'bg-green-100 text-green-700' :
                                                    emp.status === 'Inactive' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {emp.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-gray-400">No recent activities</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600  shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <TrendingUp size={28} />
                                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">This Year</span>
                            </div>
                            <p className="text-3xl font-bold">{totalEmployee}</p>
                            <p className="text-sm opacity-90 mt-1">Total Employees</p>
                            <div className="mt-4 pt-4 border-t border-white/20">
                                <p className="text-xs opacity-75">+{activeEmployee} active employees</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-500 to-green-600  shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <Award size={28} />
                                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Current</span>
                            </div>
                            <p className="text-3xl font-bold">{activeEmployee}</p>
                            <p className="text-sm opacity-90 mt-1">Active Employees</p>
                            <div className="mt-4 pt-4 border-t border-white/20">
                                <p className="text-xs opacity-75">{totalEmployee ? Math.round((activeEmployee / totalEmployee) * 100) : 0}% of total workforce</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-red-500 to-red-600  shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <UserX size={28} />
                                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Today</span>
                            </div>
                            <p className="text-3xl font-bold">{todayAttendance.absent}</p>
                            <p className="text-sm opacity-90 mt-1">Absent Today</p>
                            <div className="mt-4 pt-4 border-t border-white/20">
                                <p className="text-xs opacity-75">
                                    {(() => {
                                        const totalActive = activeEmployee || 1;
                                        return `${Math.round((todayAttendance.absent / totalActive) * 100)}% of active employees`
                                    })()}
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Detailed Employees Modal */}
            {detailModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDetailModal({ ...detailModal, isOpen: false })}>
                    <div className="bg-white max-w-4xl w-full max-h-[80vh] shadow-2xl overflow-hidden border border-slate-100 flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    {(() => {
                                        switch (detailModal.type) {
                                            case 'Present': return <UserCheck size={20} className="text-green-600" />;
                                            case 'Late': return <Clock size={20} className="text-orange-600" />;
                                            case 'Absent': return <UserX size={20} className="text-red-600" />;
                                            case 'Half Day': return <AlertCircle size={20} className="text-yellow-600" />;
                                            default: return <UserCheck size={20} className="text-indigo-600" />;
                                        }
                                    })()}
                                    {detailModal.title}
                                    <span className="text-sm font-normal text-gray-500 ml-2">
                                        ({detailModal.employees.length} employees)
                                    </span>
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {detailModal.subtitle}
                                </p>
                            </div>
                            <button
                                onClick={() => setDetailModal({ ...detailModal, isOpen: false })}
                                className="p-2 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 overflow-y-auto max-h-[60vh] flex-1">
                            {detailModal.employees.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Users size={32} className="text-gray-400" />
                                    </div>
                                    <p className="text-lg font-semibold text-gray-700">No employees to show</p>
                                    <p className="text-sm text-gray-400">There are no records matching this category today.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">#</th>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Employee ID</th>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Employee Name</th>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Designation</th>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Store</th>
                                                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Attendance Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {detailModal.employees.map((emp, index) => (
                                                <tr
                                                    key={emp.employee_id}
                                                    className={(() => {
                                                        switch (detailModal.type) {
                                                            case 'Present': return 'hover:bg-green-50 transition-colors';
                                                            case 'Late': return 'hover:bg-orange-50 transition-colors';
                                                            case 'Absent': return 'hover:bg-red-50 transition-colors';
                                                            case 'Half Day': return 'hover:bg-yellow-50 transition-colors';
                                                            default: return 'hover:bg-slate-50 transition-colors';
                                                        }
                                                    })()}
                                                >
                                                    <td className="px-4 py-3 text-gray-500 text-xs">{index + 1}</td>
                                                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{emp.employee_id}</td>
                                                    <td className="px-4 py-3 font-medium text-gray-900">{emp.name_as_per_aadhar}</td>
                                                    <td className="px-4 py-3 text-gray-600">{emp.designation || '-'}</td>
                                                    <td className="px-4 py-3 text-gray-600">{emp.joining_place || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        {(() => {
                                                            const currentStatus = emp.status || detailModal.type;
                                                            if (currentStatus === 'Late') {
                                                                return (
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                                                                            <Clock size={12} />
                                                                            Late ({emp.late_minute || 0} mins)
                                                                        </span>
                                                                        {emp.in_time && (
                                                                            <span className="text-[10px] text-gray-500 font-mono">
                                                                                In: {formatTimeIST(emp.in_time)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            } else if (currentStatus === 'Present') {
                                                                return (
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                                                                            <UserCheck size={12} />
                                                                            Present
                                                                        </span>
                                                                        {emp.in_time && (
                                                                            <span className="text-[10px] text-gray-500 font-mono">
                                                                                In: {formatTimeIST(emp.in_time)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            } else if (currentStatus === 'Half Day') {
                                                                return (
                                                                    <span className="text-xs text-yellow-600 font-semibold flex items-center gap-1">
                                                                        <AlertCircle size={12} />
                                                                        Half Day
                                                                    </span>
                                                                );
                                                            } else {
                                                                return (
                                                                    <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                                                                        <UserX size={12} />
                                                                        Absent
                                                                    </span>
                                                                );
                                                            }
                                                        })()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                            <p className="text-xs text-gray-500">
                                Total active employees: {activeEmployee}
                            </p>
                            <button
                                onClick={() => setDetailModal({ ...detailModal, isOpen: false })}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}