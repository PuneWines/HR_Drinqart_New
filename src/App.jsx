import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import LeaveManagement from './pages/LeaveManagement'
import Payroll from './pages/Payroll'
import MisReport from './pages/MisReport'
import AdminAdvance from './pages/AdminAdvance'
import { Recruitment, Reports, Settings } from './pages/StubPages'

function App() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

        {/* Main content */}
        <div
          className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${collapsed ? 'lg:ml-16' : 'lg:ml-64'
            }`}
        >


          {/* Page content */}
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/attendance" element={<Navigate to="/attendance/daily" replace />} />
              <Route path="/attendance/daily" element={<Attendance />} />
              <Route path="/attendance/monthly" element={<Attendance />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/leave" element={<LeaveManagement />} />
              <Route path="/recruitment" element={<Recruitment />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/misreport" element={<MisReport />} />
              <Route path="/admin-advance" element={<AdminAdvance />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App