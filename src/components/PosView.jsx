import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Banknote,
  QrCode,
  Split,
  CheckCircle2,
  PackageOpen,
  X,
  AlertTriangle,
  Sparkles,
  ChevronUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatBs } from '../utils/formatters'

export default function PosView({
  productos,
  cart,
  setCart,
  vendedor,
  onSaleSuccess,
  showNotification,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [metodoPago, setMetodoPago] = useState('Efectivo') // 'Efectivo' | 'QR' | 'Mixto'
  const [montoRecibido, setMontoRecibido] = useState('')
  const [mixtoEfectivo, setMixtoEfectivo] = useState('')
  const [mixtoQR, setMixtoQR] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
  const searchInputRef = useRef(null)

  useEffect(() => {
    // En escritorio enfocar buscador automáticamente
    if (window.innerWidth >= 1024) {
      searchInputRef.current?.focus()
    }
  }, [])

  // Filtrado en memoria en tiempo real
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return productos
    return productos.filter((p) => {
      const nombre = (p.nombre || '').toLowerCase()
      const desc = (p.descripcion || '').toLowerCase()
      return nombre.includes(query) || desc.includes(query)
    })
  }, [productos, searchTerm])

  // Cantidad en carrito por producto
  const cartQtyMap = useMemo(() => {
    const map = {}
    for (const item of cart) {
      map[item.producto.id] = item.cantidad
    }
    return map
  }, [cart])

  const totalPagar = useMemo(() => {
    return cart.reduce(
      (acc, item) => acc + (Number(item.producto.precio) || 0) * item.cantidad,
      0
    )
  }, [cart])

  const totalUnidades = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.cantidad, 0)
  }, [cart])

  // Sincronizar montos de Pago Mixto cuando cambia el totalPagar o se selecciona Mixto
  useEffect(() => {
    if (metodoPago === 'Mixto') {
      if (totalPagar <= 0) {
        setMixtoEfectivo('')
        setMixtoQR('')
        return
      }
      const currentEfec = parseFloat(mixtoEfectivo)
      if (!isNaN(currentEfec) && currentEfec >= 0 && currentEfec <= totalPagar) {
        setMixtoQR((totalPagar - currentEfec).toFixed(2))
      } else {
        const mitad = (totalPagar / 2).toFixed(2)
        const resto = (totalPagar - parseFloat(mitad)).toFixed(2)
        setMixtoEfectivo(mitad)
        setMixtoQR(resto)
      }
    }
  }, [totalPagar, metodoPago])

  const handleMixtoEfectivoChange = (val) => {
    setMixtoEfectivo(val)
    const num = parseFloat(val)
    if (!isNaN(num) && num >= 0) {
      const resto = Math.max(0, totalPagar - num)
      setMixtoQR(resto.toFixed(2))
    } else {
      setMixtoQR(totalPagar.toFixed(2))
    }
  }

  const handleMixtoQRChange = (val) => {
    setMixtoQR(val)
    const num = parseFloat(val)
    if (!isNaN(num) && num >= 0) {
      const resto = Math.max(0, totalPagar - num)
      setMixtoEfectivo(resto.toFixed(2))
    } else {
      setMixtoEfectivo(totalPagar.toFixed(2))
    }
  }

  const addToCart = (producto) => {
    const stockDisponible = Number(producto.stock) || 0
    if (stockDisponible <= 0) {
      showNotification('Este producto está agotado.', 'error')
      return
    }

    const currentQty = cartQtyMap[producto.id] || 0
    if (currentQty + 1 > stockDisponible) {
      showNotification(
        `Stock máximo alcanzado para "${producto.nombre}" (${stockDisponible} disp.).`,
        'warning'
      )
      return
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.producto.id === producto.id)
      if (existing) {
        return prev.map((item) =>
          item.producto.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1, producto }
            : item
        )
      }
      return [...prev, { producto, cantidad: 1 }]
    })
  }

  const updateCartQuantity = (productoId, delta) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.producto.id !== productoId) return item
          const prodActual =
            productos.find((p) => p.id === productoId) || item.producto
          const maxStock = Number(prodActual.stock) || 0
          const nextQty = item.cantidad + delta
          if (nextQty > maxStock) {
            showNotification(
              `Solo hay ${maxStock} unidades disponibles de "${prodActual.nombre}".`,
              'warning'
            )
            return item
          }
          return { ...item, cantidad: nextQty, producto: prodActual }
        })
        .filter((item) => item.cantidad > 0)
    })
  }

  const removeFromCart = (productoId) => {
    setCart((prev) => prev.filter((item) => item.producto.id !== productoId))
  }

  const clearCart = () => {
    setCart([])
    setMontoRecibido('')
    setMixtoEfectivo('')
    setMixtoQR('')
  }

  const recibidoNum = parseFloat(montoRecibido)
  const tieneMontoRecibido = !isNaN(recibidoNum) && recibidoNum > 0
  const cambioDevolver =
    metodoPago === 'Efectivo' && tieneMontoRecibido
      ? recibidoNum - totalPagar
      : 0

  const handleCobrar = async () => {
    if (cart.length === 0) {
      showNotification('Agrega al menos un producto al carrito para cobrar.', 'warning')
      return
    }

    if (
      metodoPago === 'Efectivo' &&
      tieneMontoRecibido &&
      recibidoNum < totalPagar
    ) {
      showNotification(
        'El monto con el que paga el cliente es menor al Total a Pagar.',
        'error'
      )
      return
    }

    let metodoPagoParaDB = metodoPago
    if (metodoPago === 'Mixto') {
      const efecNum = parseFloat(mixtoEfectivo) || 0
      const qrNum = parseFloat(mixtoQR) || 0
      const sumaMixto = Number((efecNum + qrNum).toFixed(2))
      const totalRedondeado = Number(totalPagar.toFixed(2))

      if (efecNum <= 0 || qrNum <= 0) {
        showNotification(
          'En Pago Mixto, tanto el monto en Efectivo como el monto por QR deben ser mayores a Bs. 0.',
          'warning'
        )
        return
      }

      if (Math.abs(sumaMixto - totalRedondeado) > 0.05) {
        showNotification(
          `La suma de Efectivo (${formatBs(efecNum)}) + QR (${formatBs(qrNum)}) debe ser exactamente igual al Total (${formatBs(totalPagar)}).`,
          'error'
        )
        return
      }

      metodoPagoParaDB = `Mixto (Efectivo: ${efecNum.toFixed(2)} | QR: ${qrNum.toFixed(2)})`
    }

    // Validar stock antes de enviar
    for (const item of cart) {
      const currentProd = productos.find((p) => p.id === item.producto.id)
      const stockActual = currentProd ? Number(currentProd.stock) : 0
      if (item.cantidad > stockActual) {
        showNotification(
          `Stock insuficiente para "${item.producto.nombre}". Disponible: ${stockActual}`,
          'error'
        )
        return
      }
    }

    setIsSubmitting(true)
    try {
      const p_items = cart.map((item) => ({
        producto_id: Number(item.producto.id),
        cantidad: Number(item.cantidad),
      }))

      const { data: ventaId, error } = await supabase.rpc('registrar_venta', {
        p_metodo_pago: metodoPagoParaDB,
        p_vendedor: vendedor,
        p_items,
      })

      if (error) throw error

      const itemsVendidos = cart.map((item) => ({
        producto_id: item.producto.id,
        nombre: item.producto.nombre,
        cantidad: item.cantidad,
        precio_unitario: Number(item.producto.precio),
        costo_unitario: Number(item.producto.costo),
        subtotal: Number(item.producto.precio) * item.cantidad,
      }))

      setLastSaleReceipt({
        id: ventaId,
        total: totalPagar,
        metodoPago: metodoPagoParaDB,
        vendedor,
        cambio:
          metodoPago === 'Efectivo' && tieneMontoRecibido && cambioDevolver >= 0
            ? cambioDevolver
            : null,
        itemsCount: totalUnidades,
      })

      setCart([])
      setMontoRecibido('')
      setMixtoEfectivo('')
      setMixtoQR('')
      setIsMobileCartOpen(false)
      await onSaleSuccess(itemsVendidos, ventaId, metodoPagoParaDB, vendedor)
      showNotification(
        `¡Venta #${ventaId ?? ''} registrada con éxito por ${formatBs(totalPagar)}!`,
        'success'
      )
    } catch (err) {
      console.error('Error al registrar venta:', err)
      showNotification(
        err?.message || 'Error al registrar la venta. Verifica tu conexión o el stock.',
        'error'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStockBadge = (stock) => {
    const qty = Number(stock) || 0
    if (qty > 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          Stock: {qty}
        </span>
      )
    }
    if (qty >= 1 && qty <= 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          ¡Poco! ({qty})
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
        Agotado
      </span>
    )
  }

  // Contenido reutilizable del Carrito (para columna derecha en PC y Drawer en Celular)
  const renderCartContent = () => (
    <div className="flex flex-col h-full">
      {/* Lista de Productos en el Carrito */}
      <div className="p-3.5 sm:p-4 flex-1 max-h-[38vh] lg:max-h-[340px] overflow-y-auto divide-y divide-slate-200/80">
        {cart.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-2.5">
              <ShoppingCart className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-base font-extrabold text-slate-700">
              Tu carrito está vacío
            </p>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-[240px] mx-auto">
              Toca cualquier producto del catálogo para agregarlo al instante.
            </p>
          </div>
        ) : (
          cart.map(({ producto, cantidad }) => {
            const subtotal = (Number(producto.precio) || 0) * cantidad
            return (
              <div
                key={producto.id}
                className="py-3 first:pt-1 last:pb-1 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug truncate">
                      {producto.nombre}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500">
                      {formatBs(producto.precio)} c/u • Disp: {producto.stock}
                    </p>
                  </div>
                  <span className="text-sm sm:text-base font-black text-indigo-700 shrink-0">
                    {formatBs(subtotal)}
                  </span>
                </div>

                {/* Controles grandes - y + y papelera */}
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(producto.id, -1)}
                      className="w-9 h-9 rounded-lg bg-white hover:bg-slate-200 active:scale-95 text-slate-900 font-bold flex items-center justify-center shadow-2xs transition cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-11 text-center font-black text-base sm:text-lg text-slate-900">
                      {cantidad}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(producto.id, 1)}
                      className="w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold flex items-center justify-center shadow-2xs transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(producto.id)}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                    title="Quitar del carrito"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Sección de Método de Pago (Efectivo, QR o Mixto), Vuelto y Total */}
      <div className="p-4 sm:p-5 bg-slate-50/90 border-t-2 border-slate-200 space-y-3.5">
        {/* Selector de 3 Métodos de Pago */}
        <div>
          <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
            Método de Pago
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMetodoPago('Efectivo')}
              className={`py-2.5 px-2 rounded-xl font-extrabold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 border-2 transition cursor-pointer ${
                metodoPago === 'Efectivo'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Banknote className="w-4 h-4 shrink-0" />
              <span>💵 Efectivo</span>
            </button>

            <button
              type="button"
              onClick={() => setMetodoPago('QR')}
              className={`py-2.5 px-2 rounded-xl font-extrabold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 border-2 transition cursor-pointer ${
                metodoPago === 'QR'
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>📱 Pago QR</span>
            </button>

            <button
              type="button"
              onClick={() => setMetodoPago('Mixto')}
              className={`py-2.5 px-2 rounded-xl font-extrabold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 border-2 transition cursor-pointer ${
                metodoPago === 'Mixto'
                  ? 'bg-violet-600 text-white border-violet-700 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Split className="w-4 h-4 shrink-0" />
              <span>🔀 Mixto</span>
            </button>
          </div>
        </div>

        {/* OPCIÓN 1: PAGO EN EFECTIVO (Cálculo de Cambio/Vuelto) */}
        {metodoPago === 'Efectivo' && (
          <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-slate-700">
                ¿Con cuánto paga el cliente? (Opcional)
              </label>
              {montoRecibido && (
                <button
                  type="button"
                  onClick={() => setMontoRecibido('')}
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-extrabold text-slate-400 text-sm">
                Bs.
              </span>
              <input
                type="number"
                min="0"
                step="0.50"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                placeholder="Ej. 50.00"
                className="w-full pl-10 pr-3 py-2 text-base sm:text-lg font-extrabold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:bg-white text-slate-900"
              />
            </div>

            {totalPagar > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[10, 20, 50, 100, 200].map((billete) => (
                  <button
                    key={billete}
                    type="button"
                    onClick={() => setMontoRecibido(String(billete))}
                    className="px-2.5 py-1 text-xs font-extrabold rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200 transition cursor-pointer"
                  >
                    Bs. {billete}
                  </button>
                ))}
              </div>
            )}

            {tieneMontoRecibido && totalPagar > 0 && (
              <div
                className={`p-2.5 rounded-xl border-2 text-center ${
                  cambioDevolver >= 0
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                {cambioDevolver >= 0 ? (
                  <p className="text-sm sm:text-base font-black text-emerald-700">
                    Cambio / Vuelto a devolver: {formatBs(cambioDevolver)}
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm font-extrabold text-rose-700 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Faltan {formatBs(Math.abs(cambioDevolver))}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* OPCIÓN 3: PAGO MIXTO (Una parte en Efectivo y el resto por QR) */}
        {metodoPago === 'Mixto' && (
          <div className="bg-violet-50/70 p-3.5 rounded-xl border-2 border-violet-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-violet-950 uppercase tracking-wide">
                Dividir pago (Efectivo + QR)
              </span>
              {totalPagar > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const mitad = (totalPagar / 2).toFixed(2)
                    const resto = (totalPagar - parseFloat(mitad)).toFixed(2)
                    setMixtoEfectivo(mitad)
                    setMixtoQR(resto)
                  }}
                  className="text-[11px] font-extrabold text-violet-700 hover:underline cursor-pointer"
                >
                  50% y 50%
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Parte Efectivo */}
              <div className="bg-white p-2.5 rounded-xl border border-emerald-300">
                <label className="block text-[11px] font-extrabold text-emerald-800 mb-1">
                  💵 Parte en Efectivo (Bs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={mixtoEfectivo}
                  onChange={(e) => handleMixtoEfectivoChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 text-base font-black bg-emerald-50/50 border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-600 text-emerald-950"
                />
              </div>

              {/* Parte QR (Calculada automáticamente o editable) */}
              <div className="bg-white p-2.5 rounded-xl border border-indigo-300">
                <label className="block text-[11px] font-extrabold text-indigo-800 mb-1">
                  📱 Resto por QR (Bs.)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={mixtoQR}
                  onChange={(e) => handleMixtoQRChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 text-base font-black bg-indigo-50/50 border border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 text-indigo-950"
                />
              </div>
            </div>

            <p className="text-[11px] font-bold text-violet-800 text-center">
              Escribe cuánto da en efectivo y el resto se asigna a QR automáticamente.
            </p>
          </div>
        )}

        {/* Resumen del Total a Pagar */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 sm:p-4 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <span className="block text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-bold">
              Total a Pagar
            </span>
            <span className="text-xs text-slate-300">
              Atiende: <strong>{vendedor}</strong>
            </span>
          </div>
          <span className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
            {formatBs(totalPagar)}
          </span>
        </div>

        {/* Botón Gigante COBRAR Y REGISTRAR VENTA */}
        <button
          type="button"
          disabled={cart.length === 0 || isSubmitting}
          onClick={handleCobrar}
          className="w-full py-3.5 sm:py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 text-white font-black text-base sm:text-lg tracking-wide shadow-lg shadow-emerald-600/25 transition flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed"
        >
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          <span>
            {isSubmitting
              ? 'REGISTRANDO VENTA...'
              : 'COBRAR Y REGISTRAR VENTA'}
          </span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-36 lg:pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: CATÁLOGO DE PRODUCTOS */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          {/* Buscador moderno */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-xs border border-slate-200/90">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 absolute left-3.5 sm:left-4 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar libro, cuaderno o útil escolar..."
                className="w-full pl-11 sm:pl-13 pr-10 py-3 sm:py-3.5 text-base sm:text-lg font-semibold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white transition text-slate-900 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('')
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-3 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-2 px-1 text-xs text-slate-500 font-medium">
              <span>
                Mostrando <strong className="text-slate-800">{filteredProducts.length}</strong> de{' '}
                <strong className="text-slate-800">{productos.length}</strong> productos
              </span>
              <span className="hidden sm:inline">
                Toca cualquier producto para sumar +1 al carrito
              </span>
            </div>
          </div>

          {/* Banner de última venta exitosa */}
          {lastSaleReceipt && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="font-extrabold text-emerald-950 text-sm sm:text-base">
                    ¡Venta #{lastSaleReceipt.id} registrada! ({lastSaleReceipt.metodoPago})
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-800 font-medium">
                    Total cobrado: <strong>{formatBs(lastSaleReceipt.total)}</strong>
                    {lastSaleReceipt.cambio !== null && (
                      <>
                        {' '}
                        • Cambio entregado:{' '}
                        <strong className="underline">
                          {formatBs(lastSaleReceipt.cambio)}
                        </strong>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLastSaleReceipt(null)}
                className="px-3 py-1 rounded-lg bg-emerald-200/70 hover:bg-emerald-200 text-emerald-950 text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Cuadrícula de Productos Responsive (2 columnas en celular, 3 en escritorio) */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center">
              <PackageOpen className="w-14 h-14 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                {productos.length === 0
                  ? 'Aún no hay productos en el inventario'
                  : 'No se encontraron productos con esa búsqueda'}
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {productos.length === 0
                  ? 'Ve a la pestaña "📦 Inventario" para registrar tus productos.'
                  : 'Intenta con otra palabra clave.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-4">
              {filteredProducts.map((producto) => {
                const agotado = Number(producto.stock) <= 0
                const enCarrito = cartQtyMap[producto.id] || 0

                return (
                  <button
                    key={producto.id}
                    type="button"
                    disabled={agotado}
                    onClick={() => addToCart(producto)}
                    className={`group relative text-left rounded-2xl bg-white border-2 p-2.5 sm:p-4 flex flex-col justify-between transition-all ${
                      agotado
                        ? 'border-slate-200 opacity-60 cursor-not-allowed bg-slate-100'
                        : enCarrito > 0
                        ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md cursor-pointer active:scale-[0.98]'
                        : 'border-slate-200/90 hover:border-indigo-500 hover:shadow-md cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    {enCarrito > 0 && (
                      <div className="absolute -top-2 -right-2 z-10 bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-md">
                        {enCarrito} en carrito
                      </div>
                    )}

                    <div>
                      {/* Imagen compacta en móvil y amplia en PC */}
                      <div className="w-full h-24 sm:h-36 rounded-xl bg-slate-100 border border-slate-200/70 mb-2.5 overflow-hidden flex items-center justify-center relative">
                        {producto.imagen_url ? (
                          <img
                            src={producto.imagen_url}
                            alt={producto.nombre}
                            loading="lazy"
                            className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <PackageOpen className="w-8 h-8 sm:w-11 sm:h-11 stroke-[1.5]" />
                            <span className="text-[10px] font-semibold mt-0.5 uppercase tracking-wider">
                              Librería
                            </span>
                          </div>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug line-clamp-2">
                        {producto.nombre}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2">
                        {producto.descripcion || 'Sin descripción'}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-end justify-between gap-1">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 leading-none">
                          Precio
                        </span>
                        <span className="text-base sm:text-xl font-black text-indigo-700">
                          {formatBs(producto.precio)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        {renderStockBadge(producto.stock)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA (SOLO ESCRITORIO lg+): PANEL DEL CARRITO FIJO */}
        <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 lg:sticky lg:top-20 bg-white rounded-3xl shadow-xl border-2 border-slate-200 overflow-hidden flex-col">
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingCart className="w-6 h-6 text-indigo-400" />
              <div>
                <h2 className="text-lg font-extrabold leading-none">
                  Carrito de Venta
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'}
                </p>
              </div>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-bold text-rose-300 hover:text-rose-200 bg-rose-950/60 hover:bg-rose-900/70 px-3 py-1.5 rounded-lg border border-rose-800/60 transition cursor-pointer"
              >
                Vaciar
              </button>
            )}
          </div>
          {renderCartContent()}
        </div>
      </div>

      {/* BARRA FLOTANTE DE CARRITO EN CELULAR (lg:hidden) */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-20 px-3 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-2xl border border-indigo-400/30 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative bg-white/20 p-2 rounded-xl">
                <ShoppingCart className="w-5 h-5 text-white" />
                {totalUnidades > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 rounded-full">
                    {totalUnidades}
                  </span>
                )}
              </div>
              <div className="text-left">
                <p className="text-xs font-extrabold uppercase tracking-wider text-indigo-200 leading-none">
                  {totalUnidades > 0
                    ? `${totalUnidades} prod. en carrito`
                    : 'Carrito de Venta'}
                </p>
                <p className="text-sm font-black text-white mt-0.5 flex items-center gap-1">
                  Ver Carrito y Cobrar <ChevronUp className="w-4 h-4" />
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-amber-300">
                {formatBs(totalPagar)}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* DRAWER / MODAL DE CARRITO PARA CELULAR (lg:hidden) */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[92vh] w-full flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-base font-extrabold leading-none">
                    Carrito y Cobro ({totalUnidades})
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs font-bold text-rose-300 bg-rose-950/70 px-2.5 py-1 rounded-lg border border-rose-800/60"
                  >
                    Vaciar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileCartOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">{renderCartContent()}</div>
          </div>
        </div>
      )}
    </div>
  )
}
