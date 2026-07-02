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
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
            {/* Header Section */}
            <div className="bg-gray-100 border-gray-200 sticky top-0 z-20">
                <div className="px-8 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Clock size={24} className="text-indigo-600" />
                                Attendance Management
                            </h1>

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



            {/* Main Content */}
            <div className="p-8 pt-2 flex-grow overflow-hidden">
                {activeSubTab === 'daily' ? (
                    <Attendancedaily />
                ) : (
                    <AttendanceMonthly />
                )}
            </div>
        </div >
    );
};

export default Attendance;