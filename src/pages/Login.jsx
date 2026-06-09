import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Eye, EyeOff, User, Shield, ChevronDown, Sparkles } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function Login({ onLogin }) {
    const [activeTab, setActiveTab] = useState('login')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    // Form states
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [role, setRole] = useState('user')

    const handleLoginSubmit = async (e) => {
        e.preventDefault()
        if (!email || !password) {
            toast.error('Please fill in all fields')
            return
        }

        setLoading(true)
        try {
            // Query users table
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email.trim().toLowerCase())
                .maybeSingle()

            if (error) throw error

            if (!data) {
                toast.error('Account not found. Please register.')
                setLoading(false)
                return
            }

            // Plaintext password comparison as per users schema
            if (data.password !== password) {
                toast.error('Incorrect password')
                setLoading(false)
                return
            }

            toast.success(`Welcome back, ${data.name}!`)
            onLogin(data)
        } catch (err) {
            console.error('Login error:', err)
            toast.error(err.message || 'Failed to sign in. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleRegisterSubmit = async (e) => {
        e.preventDefault()
        if (!name || !email || !password) {
            toast.error('Please fill in all fields')
            return
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('users')
                .insert([
                    {
                        name: name.trim(),
                        email: email.trim().toLowerCase(),
                        password: password, // Store password
                        role: role
                    }
                ])
                .select()
                .single()

            if (error) {
                // Handle postgres unique constraint error (usually code 23505)
                if (error.code === '23505') {
                    toast.error('Email is already registered')
                } else {
                    throw error
                }
                setLoading(false)
                return
            }

            toast.success('Registration successful! You can now log in.')
            // Reset form and switch tab to login
            setName('')
            // Keep email filled in for convenience
            setPassword('')
            setActiveTab('login')
        } catch (err) {
            console.error('Registration error:', err)
            toast.error(err.message || 'Failed to register. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-radial from-slate-900 via-indigo-950 to-slate-950 p-4 relative overflow-hidden font-sans">
            {/* Dynamic background lights */}
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10 animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-1000" />

            {/* Auth Card */}
            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl transition-all duration-300 hover:border-white/15">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-black text-xl shadow-lg shadow-indigo-500/30 mb-4">
                        HR
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
                        HR Drinqkart <Sparkles size={18} className="text-indigo-400" />
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Manage attendance, payroll & operations</p>
                </div>

                {/* Sliding Pill Tab Switcher */}
                <div className="flex bg-slate-950/45 p-1.5 rounded-2xl mb-8 relative border border-white/5">
                    <button
                        onClick={() => {
                            setActiveTab('login')
                            setPassword('')
                        }}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 relative z-10 ${activeTab === 'login' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('register')
                            setPassword('')
                        }}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 relative z-10 ${activeTab === 'register' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Register
                    </button>
                    {/* Sliding Pill Indicator */}
                    <div
                        className={`absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl transition-transform duration-300 ease-out shadow-md ${activeTab === 'register' ? 'translate-x-full' : 'translate-x-0'
                            }`}
                    />
                </div>

                {/* Tab Contents */}
                {activeTab === 'login' ? (
                    <form onSubmit={handleLoginSubmit} className="space-y-5">
                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-indigo-300 tracking-wider uppercase">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-indigo-300 tracking-wider uppercase">Password</label>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-3 pl-11 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white py-3 px-4 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleRegisterSubmit} className="space-y-4">
                        {/* Full Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-indigo-300 tracking-wider uppercase">Full Name</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-indigo-300 tracking-wider uppercase">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-indigo-300 tracking-wider uppercase">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-3 pl-11 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                                    placeholder="Min. 6 characters"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Role Select */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-indigo-300 tracking-wider uppercase">System Role</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                                    <Shield size={18} />
                                </div>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl py-3 pl-11 pr-10 text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm appearance-none cursor-pointer"
                                >
                                    <option value="user">Employee (User)</option>
                                    <option value="admin">HR Manager (Admin)</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                    <ChevronDown size={18} />
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white py-3 px-4 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
