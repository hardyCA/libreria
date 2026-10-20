import React from 'react'
import {
  BookOpen,
  ShoppingCart,
  Package,
  BarChart3,
  UserCheck,
  RefreshCw,
  LogOut,
  KeyRound,
} from 'lucide-react'

const VENDEDORES = ['Persona 1', 'Persona 2', 'Persona 3 (Admin)']

export default function Navbar({
  activeTab,
  setActiveTab,
  vendedor,
  setVendedor,
  currentUser,
  onLogout,
  onOpenUserModal,
  cartCount,
  onSync,
  isSyncing,
}) {
  const tabs = [
    {
      id: 'vender',
      label: '🛒 Vender (Caja)',
      shortLabel: 'Vender',
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
    },
    {
      id: 'inventario',
      label: '📦 Inventario y Costos',
      shortLabel: 'Inventario',
      icon: Package,
    },
    {
      id: 'caja',
      label: '📊 Caja y Ganancias',
      shortLabel: 'Caja',
      icon: BarChart3,
    },
  ]

  return (
    <>
      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md text-white shadow-lg border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Marca / Nombre del Sistema */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="truncate">
              <h1 className="text-base sm:text-xl font-black tracking-tight leading-none text-white truncate">
                Librería POS
              </h1>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5 hidden sm:block">
                Punto de Venta &amp; Control de Stock
              </p>
            </div>
          </div>

          {/* Pestañas Principales (Escritorio lg+) */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/70">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md scale-[1.01]'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="ml-1 px-2 py-0.5 text-xs font-black rounded-full bg-amber-400 text-slate-950">
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Controles Derecha: Selector Vendedor + Sincronizar + Claves + Salir */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Selector de quién atiende */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1.5">
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
              <div className="flex flex-col">
                <label
                  htmlFor="selector-vendedor"
                  className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-400 font-bold leading-none"
                >
                  Atiende:
                </label>
                <select
                  id="selector-vendedor"
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  className="bg-transparent text-white font-extrabold text-xs sm:text-sm focus:outline-none cursor-pointer pr-1"
                >
                  {VENDEDORES.map((v) => (
                    <option key={v} value={v} className="bg-slate-900 text-white">
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Botón Sincronizar */}
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              title="Sincronizar / Actualizar datos"
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700 text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isSyncing ? 'animate-spin text-indigo-400' : ''
                }`}
              />
              <span className="hidden xl:inline">
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </span>
            </button>

            {/* Botón Gestionar Claves / Usuarios */}
            <button
              type="button"
              onClick={onOpenUserModal}
              title={`Usuario actual: ${currentUser?.nombre || vendedor} (Cambiar contraseñas)`}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            {/* Botón Cerrar Sesión */}
            <button
              type="button"
              onClick={onLogout}
              title="Cerrar sesión"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800/70 text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* BARRA DE NAVEGACIÓN INFERIOR FIJA PARA CELULARES Y TABLETS (lg:hidden) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-1.5 shadow-2xl">
        <div className="grid grid-cols-3 gap-1 max-w-md mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {tab.badge && (
                    <span className="absolute -top-1.5 -right-3 px-1.5 py-0.2 text-[10px] font-black rounded-full bg-amber-400 text-slate-950">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="mt-1 leading-none">{tab.shortLabel}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
