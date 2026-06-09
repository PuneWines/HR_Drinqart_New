function StubPage({ name, icon, desc, color }) {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-4xl shadow-xl`}>
          {icon}
        </div>
        <h1 className="text-2xl font-bold text-slate-800">{name}</h1>
        <p className="text-slate-500 max-w-xs mx-auto">{desc}</p>
        <span className="inline-block px-4 py-2 rounded-full bg-slate-100 text-slate-500 text-sm font-medium">
          🚧 Coming Soon
        </span>
      </div>
    </div>
  )
}

export function Payroll() {
  return <StubPage name="Payroll" icon="💰" desc="Manage salary disbursements, payslips and deductions." color="from-amber-500 to-orange-600" />
}


export function Recruitment() {
  return <StubPage name="Recruitment" icon="📋" desc="Post jobs, manage applicants and track hiring pipelines." color="from-pink-500 to-rose-600" />
}

export function Reports() {
  return <StubPage name="Reports" icon="📊" desc="Generate insights and export HR analytics reports." color="from-indigo-500 to-violet-600" />
}

export function Settings() {
  return <StubPage name="Settings" icon="⚙️" desc="Configure system preferences, roles and permissions." color="from-slate-500 to-slate-700" />
}
