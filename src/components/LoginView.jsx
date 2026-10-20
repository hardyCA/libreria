import React, { useState } from 'react'
import {
  BookOpen,
  Lock,
  User,
  LogIn,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  KeyRound,
} from 'lucide-react'

export const DEFAULT_USERS = [
  {
    username: 'admin',
    password: '123',
    nombre: 'Persona 3 (Admin)',
    rol: 'Administrador',
    badgeColor: 'from-indigo-600 to-violet-600',
  },
  {
    username: 'persona1',
    password: '123',
    nombre: 'Persona 1',
    rol: 'Cajero / Ventas',
    badgeColor: 'from-emerald-600 to-teal-600',
  },
  {
    username: 'persona2',
    password: '123',
    nombre: 'Persona 2',
    rol: 'Cajero / Ventas',
    badgeColor: 'from-sky-600 to-blue-600',
  },
]

export default function LoginView({ users, onLoginSuccess }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMsg('')

    const cleanUser = username.trim().toLowerCase()
    const cleanPass = password.trim()

    const found = users.find(
      (u) =>
        u.username.toLowerCase() === cleanUser && u.password === cleanPass
    )

    if (!found) {
      setErrorMsg('Usuario o contraseña incorrectos. Intenta nuevamente.')
      return
    }

    onLoginSuccess(found)
  }

  const handleQuickSelect = (u) => {
    setUsername(u.username)
    setErrorMsg('')
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4 sm:p-6">
      {/* Decoración de fondo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
        {/* Cabecera moderna con gradiente */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 px-6 py-7 text-center text-white relative">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <BookOpen className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Librería POS
          </h1>
          <p className="text-indigo-100 text-xs sm:text-sm font-medium mt-1">
            Sistema Profesional de Punto de Venta e Inventario
          </p>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {/* Selector rápido de perfil (ideal para celular) */}
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
              Selecciona tu perfil rápido
            </p>
            <div className="grid grid-cols-3 gap-2">
              {users.map((u) => {
                const isSelected =
                  username.trim().toLowerCase() === u.username.toLowerCase()
                return (
                  <button
                    key={u.username}
                    type="button"
                    onClick={() => handleQuickSelect(u)}
                    className={`p-2.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-sm scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${
                        u.badgeColor || 'from-indigo-600 to-violet-600'
                      } text-white flex items-center justify-center font-black text-sm shadow-xs`}
                    >
                      {u.nombre.charAt(0)}
                    </div>
                    <span className="text-xs font-extrabold text-slate-800 truncate w-full">
                      {u.nombre.replace(' (Admin)', '')}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 truncate w-full">
                      @{u.username}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Usuario */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej. admin, persona1, persona2"
                  className="w-full pl-11 pr-4 py-3 text-base font-bold bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-900 transition"
                />
              </div>
            </div>

            {/* Contraseña / PIN */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                Contraseña / PIN de Acceso
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña..."
                  className="w-full pl-11 pr-11 py-3 text-base font-bold bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-900 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPass ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold text-center">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] text-white font-black text-base sm:text-lg shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogIn className="w-5 h-5" />
              <span>INGRESAR AL SISTEMA</span>
            </button>
          </form>

          {/* Tarjeta de ayuda rápida con las credenciales por defecto */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center justify-between font-extrabold text-slate-700">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                Accesos rápidos configurados:
              </span>
              <button
                type="button"
                onClick={() => setPassword('123')}
                className="text-indigo-600 hover:underline font-extrabold cursor-pointer"
              >
                Autocompletar clave (123)
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              • <strong>admin</strong> / clave: <code>123</code> (Persona 3 Admin)
              <br />• <strong>persona1</strong> / clave: <code>123</code> (Persona 1)
              <br />• <strong>persona2</strong> / clave: <code>123</code> (Persona 2)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
