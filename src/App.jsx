import React, { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  RefreshCw,
  KeyRound,
  Save,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'
import PosView from './components/PosView'
import InventoryView from './components/InventoryView'
import CashHistoryView from './components/CashHistoryView'
import LoginView, { DEFAULT_USERS } from './components/LoginView'

const VENDEDOR_STORAGE_KEY = 'libreria_pos_vendedor'
const SESSION_STORAGE_KEY = 'libreria_pos_session'
const USERS_STORAGE_KEY = 'libreria_pos_users'

export default function App() {
  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY)
      return saved ? JSON.parse(saved) : DEFAULT_USERS
    } catch {
      return DEFAULT_USERS
    }
  })

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [activeTab, setActiveTab] = useState('vender')
  const [vendedor, setVendedor] = useState(() => {
    return localStorage.getItem(VENDEDOR_STORAGE_KEY) || 'Persona 1'
  })

  const [productos, setProductos] = useState([])
  const [resumenServidor, setResumenServidor] = useState(null)
  const [cart, setCart] = useState([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [connectionError, setConnectionError] = useState(null)
  const [notification, setNotification] = useState(null)

  // Modal para gestionar usuarios / contraseñas
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [editableUsers, setEditableUsers] = useState([])

  useEffect(() => {
    localStorage.setItem(VENDEDOR_STORAGE_KEY, vendedor)
  }, [vendedor])

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ id: Date.now(), message, type })
  }, [])

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => {
      setNotification(null)
    }, 4500)
    return () => clearTimeout(timer)
  }, [notification])

  const handleLoginSuccess = (userObj) => {
    setCurrentUser(userObj)
    setVendedor(userObj.nombre)
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userObj))
    localStorage.setItem(VENDEDOR_STORAGE_KEY, userObj.nombre)
    showNotification(`¡Bienvenido(a), ${userObj.nombre}!`, 'success')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    showNotification('Sesión cerrada correctamente.', 'success')
  }

  const openUserManagement = () => {
    setEditableUsers(users.map((u) => ({ ...u })))
    setIsUserModalOpen(true)
  }

  const handleSaveUsers = (e) => {
    e.preventDefault()
    for (const u of editableUsers) {
      if (!u.username.trim() || !u.password.trim()) {
        showNotification('El usuario y la contraseña no pueden estar vacíos.', 'warning')
        return
      }
    }
    setUsers(editableUsers)
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(editableUsers))
    setIsUserModalOpen(false)
    showNotification('Usuarios y contraseñas actualizados.', 'success')
  }

  const fetchResumenInventario = useCallback(async () => {
    const { data, error } = await supabase
      .from('resumen_inventario')
      .select('*')
      .maybeSingle()
    if (!error && data) {
      setResumenServidor(data)
    }
  }, [])

  const syncData = useCallback(
    async (silent = false) => {
      setIsSyncing(true)
      setConnectionError(null)
      try {
        const [{ data: prods, error: prodError }] = await Promise.all([
          supabase
            .from('productos')
            .select('*')
            .eq('activo', true)
            .order('nombre', { ascending: true }),
          fetchResumenInventario(),
        ])

        if (prodError) throw prodError

        const activeProds = prods || []
        setProductos(activeProds)

        setCart((prevCart) =>
          prevCart
            .map((item) => {
              const updated = activeProds.find((p) => p.id === item.producto.id)
              if (!updated || Number(updated.stock) <= 0) return null
              return {
                producto: updated,
                cantidad: Math.min(item.cantidad, Number(updated.stock)),
              }
            })
            .filter(Boolean)
        )

        if (!silent) {
          showNotification('Datos sincronizados correctamente.', 'success')
        }
      } catch (err) {
        console.error('Error al sincronizar con Supabase:', err)
        setConnectionError(
          err?.message ||
            'No se pudo conectar con Supabase. Verifica tu conexión a internet.'
        )
        if (!silent) {
          showNotification(
            'Error al sincronizar datos. Verifica tu conexión a internet.',
            'error'
          )
        }
      } finally {
        setIsSyncing(false)
        setInitialLoading(false)
      }
    },
    [fetchResumenInventario, showNotification]
  )

  useEffect(() => {
    syncData(true)
  }, [syncData])

  const handleSaleSuccess = useCallback(
    async (itemsVendidos) => {
      const qtyMap = {}
      for (const item of itemsVendidos) {
        qtyMap[item.producto_id] =
          (qtyMap[item.producto_id] || 0) + Number(item.cantidad)
      }

      setProductos((prev) =>
        prev.map((prod) => {
          if (qtyMap[prod.id]) {
            const nuevoStock = Math.max(
              0,
              (Number(prod.stock) || 0) - qtyMap[prod.id]
            )
            return { ...prod, stock: nuevoStock }
          }
          return prod
        })
      )

      await fetchResumenInventario()
    },
    [fetchResumenInventario]
  )

  const handleSaleAnnulled = useCallback(async () => {
    await syncData(true)
  }, [syncData])

  const cartCount = cart.reduce((acc, item) => acc + item.cantidad, 0)

  // Si no ha iniciado sesión, mostrar pantalla de Login
  if (!currentUser) {
    return <LoginView users={users} onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        vendedor={vendedor}
        setVendedor={setVendedor}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenUserModal={openUserManagement}
        cartCount={cartCount}
        onSync={() => syncData(false)}
        isSyncing={isSyncing}
      />

      {/* Alerta flotante (Toast) */}
      {notification && (
        <div className="fixed top-16 sm:top-auto sm:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-50 sm:max-w-md sm:w-full">
          <div
            className={`rounded-2xl p-3.5 sm:p-4 shadow-2xl border-2 flex items-start gap-3 transition-all ${
              notification.type === 'error'
                ? 'bg-rose-950 text-white border-rose-500'
                : notification.type === 'warning'
                ? 'bg-amber-950 text-white border-amber-400'
                : 'bg-emerald-950 text-white border-emerald-400'
            }`}
          >
            {notification.type === 'error' ? (
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 shrink-0 mt-0.5" />
            ) : notification.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs sm:text-sm font-bold leading-snug">
              {notification.message}
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-300 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Aviso si hay error de red */}
      {connectionError && (
        <div className="max-w-[1600px] w-full mx-auto px-3 sm:px-6 pt-4">
          <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <p className="font-extrabold text-sm sm:text-base">
                  Problema de conexión detectado
                </p>
                <p className="text-xs sm:text-sm text-rose-700">
                  {connectionError}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => syncData(false)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="flex-1">
        {initialLoading ? (
          <div className="max-w-[1600px] mx-auto px-4 py-20 text-center">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-lg font-extrabold text-slate-700">
              Cargando catálogo e inventario de la librería...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'vender' && (
              <PosView
                productos={productos}
                cart={cart}
                setCart={setCart}
                vendedor={vendedor}
                onSaleSuccess={handleSaleSuccess}
                showNotification={showNotification}
              />
            )}

            {activeTab === 'inventario' && (
              <InventoryView
                productos={productos}
                setProductos={setProductos}
                resumenServidor={resumenServidor}
                onInventoryChanged={fetchResumenInventario}
                showNotification={showNotification}
              />
            )}

            {activeTab === 'caja' && (
              <CashHistoryView
                onSaleAnnulled={handleSaleAnnulled}
                showNotification={showNotification}
              />
            )}
          </>
        )}
      </main>

      {/* MODAL PARA CAMBIAR CONTRASEÑAS / USUARIOS */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-extrabold">
                  Usuarios y Contraseñas de Acceso
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUsers} className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Personaliza el nombre de usuario y clave/PIN de acceso para cada
                encargado de la librería:
              </p>

              <div className="space-y-3">
                {editableUsers.map((u, idx) => (
                  <div
                    key={u.nombre}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                      {u.nombre} ({u.rol})
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Usuario
                        </label>
                        <input
                          type="text"
                          required
                          value={u.username}
                          onChange={(e) => {
                            const val = e.target.value
                            setEditableUsers((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, username: val } : item
                              )
                            )
                          }}
                          className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Contraseña / PIN
                        </label>
                        <input
                          type="text"
                          required
                          value={u.password}
                          onChange={(e) => {
                            const val = e.target.value
                            setEditableUsers((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, password: val } : item
                              )
                            )
                          }}
                          className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Accesos</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
