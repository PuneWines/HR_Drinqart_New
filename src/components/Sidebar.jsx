import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', id: 'nav-dashboard' },
  { to: '/employees', label: 'Employees', id: 'nav-employees' },
  { to: '/leave', label: 'Leave Management', id: 'nav-leave' },
  {
    to: '/attendance',
    label: 'Attendance',
    id: 'nav-attendance',
    subItems: [
      { to: '/attendance/daily', label: 'Daily Attendance', id: 'nav-attendance-daily' },
      { to: '/attendance/monthly', label: 'Monthly Attendance', id: 'nav-attendance-monthly' },
    ]
  },
  { to: '/payroll', label: 'Payroll', id: 'payroll' },
  { to: '/misreport', label: 'Mis Report', id: 'misReport' },
  { to: '/admin-advance', label: 'Admin Advance', id: 'admin advance' },
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
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        id="sidebar"
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col
          bg-indigo-900 text-white
          shadow-2xl transition-all duration-300 ease-in-out
          ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'translate-x-0 w-64'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-indigo-800">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
            HR
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight">Drinqart</p>
              <p className="text-indigo-300 text-xs">HR Management</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0
            const isSubActive = hasSubItems && location.pathname.startsWith(item.to)

            return (
              <div key={item.to} className="space-y-1">
                {hasSubItems ? (
                  <div>
                    <NavLink
                      id={item.id}
                      to={item.to === '/attendance' ? '/attendance/daily' : item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group
                        ${isActive
                          ? 'bg-indigo-800 text-white'
                          : 'text-indigo-100 hover:bg-indigo-800 hover:text-white'
                        }`
                      }
                      onClick={() => {
                        setAttendanceOpen(!attendanceOpen)
                      }}
                    >
                      {({ isActive }) => (
                        <>
                          {!collapsed && (
                            <span className="truncate">{item.label}</span>
                          )}
                          {!collapsed && (
                            <span className="ml-auto text-[10px] opacity-75 transition-transform duration-200 shrink-0">

                            </span>
                          )}
                          {!collapsed && isActive && !attendanceOpen && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                          )}
                        </>
                      )}
                    </NavLink>
                    {attendanceOpen && !collapsed && (
                      <div className="pl-6 pr-2 py-1 space-y-1">
                        {item.subItems.map((subItem) => (
                          <NavLink
                            key={subItem.to}
                            id={subItem.id}
                            to={subItem.to}
                            className={({ isActive }) =>
                              `flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200
                              ${isActive
                                ? 'bg-indigo-950 text-white font-semibold shadow-inner'
                                : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span className="truncate">{subItem.label}</span>
                                {isActive && (
                                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
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
                    id={item.id}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 group
                      ${isActive
                        ? 'bg-indigo-800 text-white'
                        : 'text-indigo-100 hover:bg-indigo-800 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                        {!collapsed && isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        )}
                      </>
                    )}
                  </NavLink>
                )}
              </div>
            )
          })}
        </nav>

        {/* User profile */}
        <div className="p-4 border-t border-indigo-800">
          {collapsed ? (
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-red-600/30 hover:text-red-200 flex items-center justify-center text-white text-xs font-bold transition-all relative group cursor-pointer mx-auto"
              title="Log Out"
            >
              <span className="group-hover:hidden uppercase">
                {user?.name ? user.name.charAt(0) : 'U'}
              </span>
              <LogOut size={16} className="hidden group-hover:block" />
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0 uppercase">
                  {user?.name ? user.name.charAt(0) : 'U'}
                </div>
                <div className="overflow-hidden flex-1 text-left">
                  <p className="text-sm font-medium text-white truncate" title={user?.name || 'User'}>
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-indigo-300 truncate" title={user?.email || ''}>
                    {user?.email || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg hover:bg-indigo-800 text-indigo-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Log Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}