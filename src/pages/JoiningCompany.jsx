import { useState, useEffect } from 'react'
import { Building2, Plus, Trash2, ShieldAlert, CheckCircle, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function JoiningCompany() {
  const [companies, setCompanies] = useState([])
  const [newCompanyName, setNewCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('joining_company_names')
        .select('*')
        .order('company_name', { ascending: true })

      if (error) throw error
      setCompanies(data || [])
    } catch (err) {
      showAlert('error', 'Failed to fetch companies: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 4000)
  }

  const handleAddCompany = async (e) => {
    e.preventDefault()
    const trimmedName = newCompanyName.trim()
    if (!trimmedName) return

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('joining_company_names')
        .insert([{ company_name: trimmedName }])
        .select()

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('This company name already exists.')
        }
        throw error
      }

      setCompanies(prev => [...prev, ...data].sort((a, b) => a.company_name.localeCompare(b.company_name)))
      setNewCompanyName('')
      showAlert('success', 'Company added successfully!')
    } catch (err) {
      showAlert('error', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCompany = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      const { error } = await supabase
        .from('joining_company_names')
        .delete()
        .eq('id', id)

      if (error) throw error

      setCompanies(prev => prev.filter(c => c.id !== id))
      showAlert('success', 'Company deleted successfully!')
    } catch (err) {
      showAlert('error', 'Failed to delete company: ' + err.message)
    }
  }

  const filteredCompanies = companies.filter(c =>
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Alert banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3  shadow-lg border text-sm animate-fade-in ${alert.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
          {alert.type === 'success' ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-indigo-600 animate-pulse" />
            Joining Companies
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure entity/company names for employee profiles and registrations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Card */}
        <div className="lg:col-span-1">
          <div className="bg-white  shadow-md border border-slate-100 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Add New Company</h3>
            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Company Name
                </label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Balaji Wines"
                  className="w-full px-3 py-2 text-sm border border-slate-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={saving || !newCompanyName.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white  text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent  animate-spin"></div>
                ) : (
                  <Plus size={16} />
                )}
                Add Company
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: List Card */}
        <div className="lg:col-span-2">
          <div className="bg-white  shadow-md border border-slate-100 overflow-hidden flex flex-col h-[500px]">
            {/* Search Header */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50">
              <span className="text-sm font-bold text-slate-700">Company List ({filteredCompanies.length})</span>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300  focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent  animate-spin"></div>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Building2 size={48} className="opacity-40" />
                  <p className="text-sm">No companies found</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase bg-slate-50/50">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Company Name</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredCompanies.map((company, index) => (
                      <tr key={company.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{index + 1}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">{company.company_name}</td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteCompany(company.id, company.company_name)}
                            className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete Company"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
