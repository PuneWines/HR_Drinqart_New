import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

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


export default function Sidebar({ collapsed, setCollapsed }) {
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
              <p className="text-white font-bold text-sm leading-tight">Jagwani</p>
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
          <div className={`flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-indigo-800 transition-colors cursor-pointer`}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
              A
            </div>
            {!collapsed && (
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-medium text-white truncate">Admin User</p>
                <p className="text-xs text-indigo-300 truncate">admin@jagwani.com</p>
              </div>
            )}
            {!collapsed && <span className="text-indigo-400 text-xs shrink-0">↗</span>}
          </div>
        </div>
      </aside>
    </>
  )
}