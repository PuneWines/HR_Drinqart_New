import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Attendancedaily from './AttendanceDaily';
import AttendanceMonthly from './AttendanceMonthly';
import { Calendar, BarChart3, Clock, Download, Filter, Search } from 'lucide-react';

const Attendance = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const activeSubTab = location.pathname.endsWith('/monthly') ? 'monthly' : 'daily';

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Subtabs Navigation - Adjusted for sidebar */}
            <div className="border-b border-gray-200 bg-white sticky top-0 z-20 shadow-sm">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between">
                        <div className="flex space-x-1 py-3">
                            <button
                                onClick={() => navigate('/attendance/daily')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${activeSubTab === 'daily'
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                <Clock size={18} />
                                Daily Attendance
                            </button>
                            <button
                                onClick={() => navigate('/attendance/monthly')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${activeSubTab === 'monthly'
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                <BarChart3 size={18} />
                                Monthly Attendance
                            </button>
                        </div>

                        {/* Header Info */}
                        <div className="hidden md:block">
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                                <Calendar size={14} />
                                <span>{new Date().toLocaleDateString('en-IN', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - Adjusted padding for sidebar */}
            <div className="p-4 sm:p-6 lg:p-8">
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