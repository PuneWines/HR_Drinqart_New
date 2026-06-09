import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Attendancedaily from './AttendanceDaily';
import AttendanceMonthly from './AttendanceMonthly';
import { Calendar, BarChart3, Clock, Users, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

const Attendance = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const activeSubTab = location.pathname.endsWith('/monthly') ? 'monthly' : 'daily';

    // Mock summary stats (you can replace with actual data from your components)
    const summaryStats = {
        totalEmployees: 156,
        presentToday: 142,
        absentToday: 14,
        onLeave: 8,
        attendanceRate: 91
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Clock size={24} className="text-indigo-600" />
                                Attendance Management
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Track daily and monthly employee attendance records
                            </p>
                        </div>
                        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="text-xs text-gray-600">
                                {new Date().toLocaleDateString('en-IN', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Stats Cards - Only for Daily View */}


            {/* Tab Navigation */}
            <div className="px-8 pt-6">
                <div className="flex gap-2 border-b border-gray-200">
                    <button
                        onClick={() => navigate('/attendance/daily')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 ${activeSubTab === 'daily'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <Clock size={16} />
                        Daily Attendance
                    </button>
                    <button
                        onClick={() => navigate('/attendance/monthly')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 ${activeSubTab === 'monthly'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <BarChart3 size={16} />
                        Monthly Attendance
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-8">
                {activeSubTab === 'daily' ? (
                    <Attendancedaily />
                ) : (
                    <AttendanceMonthly />
                )}
            </div>
        </div>
    );
};

export default Attendance;