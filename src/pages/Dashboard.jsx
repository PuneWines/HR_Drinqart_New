import { useState, useEffect } from 'react'
import { Users, UserCheck, Clock, UserX, Briefcase, Calendar, TrendingUp, Award, PieChart, Filter, Search } from 'lucide-react'
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

    const StatCard = ({ icon: Icon, title, value, color, bgColor, trend }) => (
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-sm text-gray-500 font-medium">{title}</p>
                    <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
                    {trend && <p className="text-xs text-green-600">{trend}</p>}
                </div>
                <div className={`p-3 rounded-lg ${bgColor}`}>
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
                        Overview of employee statistics and activities
                    </p>
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
                    <div className="flex items-center gap-2 text-gray-500">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        Loading dashboard data...
                    </div>
                </div>
            ) : (
                <>
                    {/* Summary Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                        <StatCard
                            icon={Users}
                            title="Total Employees"
                            value={totalEmployee}
                            color="text-blue-600"
                            bgColor="bg-blue-50"
                        />
                        <StatCard
                            icon={UserCheck}
                            title="Active Employees"
                            value={activeEmployee}
                            color="text-green-600"
                            bgColor="bg-green-50"
                            trend={`${totalEmployee ? Math.round((activeEmployee / totalEmployee) * 100) : 0}% of total`}
                        />
                        <StatCard
                            icon={UserX}
                            title="Inactive Employees"
                            value={inactiveEmployee}
                            color="text-amber-600"
                            bgColor="bg-amber-50"
                        />
                        <StatCard
                            icon={Clock}
                            title="Left This Month"
                            value={leaveThisMonth}
                            color="text-red-600"
                            bgColor="bg-red-50"
                        />
                    </div>

                    {/* Charts and Activity Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Employee Status Distribution - Pie Chart */}
                        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
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
                                            <div key={status.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
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
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
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

                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
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

                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <Briefcase size={28} />
                                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Status</span>
                            </div>
                            <p className="text-3xl font-bold">{statusDistribution.filter(s => s.count > 0).length}</p>
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