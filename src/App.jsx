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
import Login from './pages/Login'
import { Recruitment, Reports, Settings } from './pages/StubPages'
import { Toaster } from 'react-hot-toast'
import PublicRegister from './pages/PublicRegister'
import JoiningCompany from './pages/JoiningCompany'
import Roaster from './pages/Roaster'
// import './App.css'  

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('hr_user')
      return savedUser ? JSON.parse(savedUser) : null
    } catch (e) {
      console.error('Error parsing cached user:', e)
      return null
    }
  })

  const handleLogin = (userData) => {
    localStorage.setItem('hr_user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('hr_user')
    setUser(null)
  }

  const isPublicRoute = window.location.pathname === '/register'

  if (isPublicRoute) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<PublicRegister />} />
        </Routes>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </BrowserRouter>
    )
  }

  if (!user) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </>
    )
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          user={user}
          onLogout={handleLogout}
        />

        {/* Main content */}
        <div
          className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out min-w-0 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'
            }`}
        >
          {/* Page content */}
          <main className="flex-1 overflow-auto min-w-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/joining-shop" element={<JoiningCompany />} />
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
              <Route path="/roaster" element={<Roaster />} />
            </Routes>
          </main>
        </div>
      </div>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </BrowserRouter>
  )
}

export default App