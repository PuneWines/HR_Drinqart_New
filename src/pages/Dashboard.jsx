import { useState, useEffect } from 'react'
import { Users, UserCheck, Clock, UserX, Briefcase, Calendar, TrendingUp, Award, PieChart } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
    const [totalEmployee, setTotalEmployee] = useState(0)
    const [activeEmployee, setActiveEmployee] = useState(0)
    const [leftEmployee, setLeftEmployee] = useState(0)
    const [inactiveEmployee, setInactiveEmployee] = useState(0)
    const [leaveThisMonth, setLeaveThisMonth] = useState(0)
    const [loading, setLoading] = useState(true)
    const [recentEmployees, setRecentEmployees] = useState([])
    const [statusDistribution, setStatusDistribution] = useState([])

    // Fetch employees and calculate stats
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
                    bgColor: 'bg-emerald-500',
                    lightBg: 'bg-emerald-50',
                    textColor: 'text-emerald-600'
                },
                {
                    name: 'Inactive',
                    count: inactive,
                    percentage: total ? Math.round((inactive / total) * 100) : 0,
                    color: '#f59e0b',
                    bgColor: 'bg-amber-500',
                    lightBg: 'bg-amber-50',
                    textColor: 'text-amber-600'
                },
                {
                    name: 'Left',
                    count: left,
                    percentage: total ? Math.round((left / total) * 100) : 0,
                    color: '#ef4444',
                    bgColor: 'bg-red-500',
                    lightBg: 'bg-red-50',
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

    // Calculate pie chart segments (using simple CSS conic-gradient)
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

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-800">HR Dashboard</h1>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">
                        {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white rounded-xl shadow-lg  p-6 flex items-start hover:shadow-xl transition-shadow">
                            <div className="p-3 rounded-full bg-blue-100 mr-4">
                                <Users size={24} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Total Employees</p>
                                <h3 className="text-2xl font-bold text-gray-800">{totalEmployee}</h3>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-lg  p-6 flex items-start hover:shadow-xl transition-shadow">
                            <div className="p-3 rounded-full bg-green-100 mr-4">
                                <UserCheck size={24} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Active Employees</p>
                                <h3 className="text-2xl font-bold text-gray-800">{activeEmployee}</h3>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-lg  p-6 flex items-start hover:shadow-xl transition-shadow">
                            <div className="p-3 rounded-full bg-amber-100 mr-4">
                                <Clock size={24} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 font-medium">On Resigned</p>
                                <h3 className="text-2xl font-bold text-gray-800">{leftEmployee}</h3>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-lg  p-6 flex items-start hover:shadow-xl transition-shadow">
                            <div className="p-3 rounded-full bg-red-100 mr-4">
                                <UserX size={24} className="text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 font-medium">Left This Month</p>
                                <h3 className="text-2xl font-bold text-gray-800">{leaveThisMonth}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Charts and Activity Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Employee Status Distribution - Pie Chart */}
                        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg  p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-800">Employee Status Distribution</h2>
                                <PieChart size={20} className="text-gray-400" />
                            </div>

                            {totalEmployee > 0 ? (
                                <div className="flex flex-col lg:flex-row items-center gap-8">
                                    {/* Pie Chart */}
                                    <div className="relative w-48 h-48">
                                        <div
                                            className="w-full h-full rounded-full shadow-lg transition-all duration-500"
                                            style={{ background: getPieChartGradient() }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="text-center">
                                                <p className="text-2xl font-bold text-gray-800">{totalEmployee}</p>
                                                <p className="text-xs text-gray-500">Total</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex-1 space-y-3">
                                        {statusDistribution.map((status) => (
                                            <div key={status.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${status.bgColor}`} />
                                                    <span className="text-sm font-medium text-gray-700">{status.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-semibold text-gray-800">{status.count}</span>
                                                    <span className="text-xs text-gray-500 ml-1">({status.percentage}%)</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-gray-400 py-8">No employee data available</p>
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
                        <div className="bg-white rounded-xl shadow-lg  p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-800">Recent Activities</h2>
                                <Calendar size={20} className="text-gray-400" />
                            </div>
                            <div className="space-y-4">
                                {recentEmployees.length > 0 ? (
                                    recentEmployees.map((emp) => (
                                        <div key={emp.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                                {emp.name_as_per_aadhar?.charAt(0) || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800">{emp.name_as_per_aadhar}</p>
                                                <p className="text-xs text-gray-500">{emp.designation} joined</p>
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
                                    <p className="text-center text-gray-400 py-8">No recent activities</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <TrendingUp size={28} />
                                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">This Year</span>
                            </div>
                            <p className="text-2xl font-bold">{totalEmployee}</p>
                            <p className="text-sm opacity-90 mt-1">Total Employees</p>
                            <div className="mt-4 pt-4 border-t border-white/20">
                                <p className="text-xs opacity-75">+{activeEmployee} active employees</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <Award size={28} />
                                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Current</span>
                            </div>
                            <p className="text-2xl font-bold">{activeEmployee}</p>
                            <p className="text-sm opacity-90 mt-1">Active Employees</p>
                            <div className="mt-4 pt-4 border-t border-white/20">
                                <p className="text-xs opacity-75">{totalEmployee ? Math.round((activeEmployee / totalEmployee) * 100) : 0}% of total workforce</p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <Users size={28} />
                                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Status</span>
                            </div>
                            <p className="text-2xl font-bold">{statusDistribution.filter(s => s.count > 0).length}</p>
                            <p className="text-sm opacity-90 mt-1">Active Status Types</p>
                            <div className="mt-4 pt-4 border-t border-white/20">
                                <p className="text-xs opacity-75">Active, Inactive, Left</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}