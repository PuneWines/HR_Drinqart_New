import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LogOut, LayoutDashboard, Users, Calendar, Clock,
  DollarSign, BarChart3, Wallet, ChevronDown, ChevronRight,
  Menu, Building2
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, id: 'nav-dashboard' },
  { to: '/employees', label: 'Employees', icon: Users, id: 'nav-employees' },
  { to: '/joining-shop', label: 'Joining Shop', icon: Building2, id: 'joining-shop' },
  { to: '/leave', label: 'Leave Management', icon: Calendar, id: 'nav-leave' },
  {
    to: '/attendance',
    label: 'Attendance',
    icon: Clock,
    id: 'nav-attendance',
    subItems: [
      { to: '/attendance/daily', label: 'Daily Attendance', id: 'nav-attendance-daily' },
      { to: '/attendance/monthly', label: 'Monthly Attendance', id: 'nav-attendance-monthly' },
    ]
  },
  { to: '/roaster', label: 'Roster', icon: Wallet, id: 'roaster' },
  { to: '/payroll', label: 'Payroll', icon: DollarSign, id: 'payroll' },
  { to: '/misreport', label: 'MIS Report', icon: BarChart3, id: 'misReport' },
  { to: '/admin-advance', label: 'Admin Advance', icon: Wallet, id: 'admin advance' }
]

export default function Sidebar({ collapsed, setCollapsed, user, onLogout }) {
  const location = useLocation()
  const isAttendanceActive = location.pathname.startsWith('/attendance')
  const [attendanceOpen, setAttendanceOpen] = useState(isAttendanceActive)

  useEffect(() => {
    if (isAttendanceActive) {
      setAttendanceOpen(true)
    }
  }, [isAttendanceActive])

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Toggle Button for Mobile */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-4 left-4 z-40 lg:hidden bg-slate-800 text-white p-2 rounded-lg shadow-lg"
      >
        <Menu size={20} />
      </button>

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col
          bg-gradient-to-b from-slate-900 to-slate-800
          shadow-2xl transition-all duration-300 ease-in-out
          ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'translate-x-0 w-60'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20 shrink-0">
            DK
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-semibold text-sm leading-tight">DrinqKart</p>
              <p className="text-slate-400 text-xs">HR Management</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0
            const Icon = item.icon

            return (
              <div key={item.to} className="space-y-1">
                {hasSubItems ? (
                  <div>
                    <button
                      onClick={() => setAttendanceOpen(!attendanceOpen)}
                      className={`
                        w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg 
                        text-sm font-medium transition-all duration-200
                        ${attendanceOpen || location.pathname.startsWith('/attendance')
                          ? 'bg-indigo-600/20 text-indigo-300'
                          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={attendanceOpen || location.pathname.startsWith('/attendance') ? 'text-indigo-400' : 'text-slate-400'} />
                        {!collapsed && <span>{item.label}</span>}
                      </div>
                      {!collapsed && (
                        attendanceOpen ? (
                          <ChevronDown size={16} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-400" />
                        )
                      )}
                    </button>

                    {attendanceOpen && !collapsed && (
                      <div className="pl-10 pr-2 py-1 space-y-1">
                        {item.subItems.map((subItem) => (
                          <NavLink
                            key={subItem.to}
                            to={subItem.to}
                            className={({ isActive }) =>
                              `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
                              ${isActive
                                ? 'bg-indigo-600/20 text-indigo-300'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-500" />
                                <span className="truncate">{subItem.label}</span>
                                {isActive && (
                                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                )}
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm  transition-all duration-200
                      ${isActive
                        ? 'bg-indigo-600/20 text-indigo-300'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={18} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        )}
                      </>
                    )}
                  </NavLink>
                )}
              </div>
            )
          })}
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-800/50">
          {collapsed ? (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors group"
              title="Log Out"
            >
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-medium group-hover:bg-red-500/20 group-hover:text-red-400 transition-colors">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 shrink-0">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate" title={user?.name || 'User'}>
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-slate-400 truncate" title={user?.email || ''}>
                    {user?.email || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Collapse Toggle Button (Desktop) */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-colors shadow-md"
          >
            <ChevronRight size={14} />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-colors shadow-md"
          >
            <ChevronRight size={14} className="rotate-180" />
          </button>
        )}
      </aside>
    </>
  )
}