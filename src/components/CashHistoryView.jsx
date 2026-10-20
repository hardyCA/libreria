import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Calendar,
  DollarSign,
  RefreshCcw,
  TrendingUp,
  CreditCard,
  Eye,
  Ban,
  X,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Split,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatBs, formatDateTime, parseMetodoPago } from '../utils/formatters'

function getLocalDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function CashHistoryView({
  onSaleAnnulled,
  showNotification,
}) {
  const [rangePreset, setRangePreset] = useState('hoy') // 'hoy' | 'ayer' | 'semana' | 'mes' | 'custom'
  const [customStart, setCustomStart] = useState(() =>
    getLocalDateString(new Date())
  )
  const [customEnd, setCustomEnd] = useState(() =>
    getLocalDateString(new Date())
  )

  const [ventas, setVentas] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Modal Ver Detalle de Venta
  const [selectedVenta, setSelectedVenta] = useState(null)
  const [detallesVenta, setDetallesVenta] = useState([])
  const [isLoadingDetalle, setIsLoadingDetalle] = useState(false)

  // Modal Confirmar Anulación
  const [ventaToAnnul, setVentaToAnnul] = useState(null)
  const [isAnnulling, setIsAnnulling] = useState(false)

  const dateRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now)
    const end = new Date(now)

    if (rangePreset === 'hoy') {
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (rangePreset === 'ayer') {
      start.setDate(now.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(now.getDate() - 1)
      end.setHours(23, 59, 59, 999)
    } else if (rangePreset === 'semana') {
      const day = now.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      start.setDate(now.getDate() + diffToMonday)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (rangePreset === 'mes') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
    } else if (rangePreset === 'custom') {
      const [sy, sm, sd] = (customStart || getLocalDateString(now))
        .split('-')
        .map(Number)
      const [ey, em, ed] = (customEnd || customStart || getLocalDateString(now))
        .split('-')
        .map(Number)
      start.setFullYear(sy, (sm || 1) - 1, sd || 1)
      start.setHours(0, 0, 0, 0)
      end.setFullYear(ey, (em || 1) - 1, ed || 1)
      end.setHours(23, 59, 59, 999)
    }

    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    }
  }, [rangePreset, customStart, customEnd])

  const fetchVentas = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .gte('fecha', dateRange.startISO)
        .lte('fecha', dateRange.endISO)
        .order('fecha', { ascending: false })

      if (error) throw error
      setVentas(data || [])
    } catch (err) {
      console.error('Error cargando historial de ventas:', err)
      showNotification(
        err?.message || 'No se pudo cargar el historial de ventas.',
        'error'
      )
    } finally {
      setIsLoading(false)
    }
  }, [dateRange.startISO, dateRange.endISO, showNotification])

  useEffect(() => {
    fetchVentas()
  }, [fetchVentas])

  // 4 Tarjetas de Resumen del Período Seleccionado (excluyendo ventas anuladas y desglosando pagos Mixtos exactamente)
  const resumenPeriodo = useMemo(() => {
    let totalVendido = 0
    let gananciaNeta = 0
    let totalEfectivo = 0
    let totalQR = 0
    let ventasCompletadas = 0
    let ventasMixtas = 0

    for (const v of ventas) {
      if (v.anulada) continue
      const total = Number(v.total) || 0
      const ganancia = Number(v.ganancia_total) || 0

      totalVendido += total
      gananciaNeta += ganancia
      ventasCompletadas += 1

      const parsed = parseMetodoPago(v.metodo_pago, total)
      totalEfectivo += parsed.efectivo
      totalQR += parsed.qr
      if (parsed.tipo === 'Mixto') {
        ventasMixtas += 1
      }
    }

    const costosRecuperados = totalVendido - gananciaNeta

    return {
      totalVendido,
      costosRecuperados,
      gananciaNeta,
      totalEfectivo,
      totalQR,
      ventasCompletadas,
      ventasMixtas,
    }
  }, [ventas])

  const handleVerDetalle = async (venta) => {
    setSelectedVenta(venta)
    setDetallesVenta([])
    setIsLoadingDetalle(true)
    try {
      const { data, error } = await supabase
        .from('detalle_ventas')
        .select('*')
        .eq('venta_id', venta.id)
        .order('id', { ascending: true })

      if (error) throw error
      setDetallesVenta(data || [])
    } catch (err) {
      console.error('Error al obtener detalle_ventas:', err)
      showNotification(
        err?.message || 'Error al cargar el detalle de la venta.',
        'error'
      )
    } finally {
      setIsLoadingDetalle(false)
    }
  }

  const handleConfirmAnnul = async () => {
    if (!ventaToAnnul) return
    setIsAnnulling(true)
    try {
      const { error } = await supabase.rpc('anular_venta', {
        p_venta_id: Number(ventaToAnnul.id),
      })

      if (error) throw error

      setVentas((prev) =>
        prev.map((v) =>
          v.id === ventaToAnnul.id ? { ...v, anulada: true } : v
        )
      )
      if (selectedVenta?.id === ventaToAnnul.id) {
        setSelectedVenta((prev) => (prev ? { ...prev, anulada: true } : null))
      }

      showNotification(
        `Venta #${ventaToAnnul.id} anulada. El stock fue devuelto al inventario.`,
        'success'
      )
      setVentaToAnnul(null)
      await onSaleAnnulled?.()
    } catch (err) {
      console.error('Error al anular venta:', err)
      showNotification(err?.message || 'No se pudo anular la venta.', 'error')
    } finally {
      setIsAnnulling(false)
    }
  }

  const renderPaymentBadge = (venta) => {
    const parsed = parseMetodoPago(venta.metodo_pago, venta.total)
    if (parsed.tipo === 'Mixto') {
      return (
        <div className="inline-flex flex-col items-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-violet-100 text-violet-800 border border-violet-300">
            <Split className="w-3 h-3" />
            🔀 Mixto
          </span>
          <span className="text-[10px] font-bold text-violet-700 mt-0.5">
            {parsed.detalleMixto}
          </span>
        </div>
      )
    }
    if (parsed.tipo === 'QR') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300">
          📱 QR
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
        💵 Efectivo
      </span>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8 space-y-5">
      {/* FILTRO SUPERIOR POR RANGO DE FECHAS */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
            <Calendar className="w-4 h-4 text-indigo-600" />
            Período:
          </span>
          {[
            { id: 'hoy', label: 'Hoy' },
            { id: 'ayer', label: 'Ayer' },
            { id: 'semana', label: 'Esta Semana' },
            { id: 'mes', label: 'Este Mes' },
            { id: 'custom', label: 'Elegir Fecha' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setRangePreset(btn.id)}
              className={`px-3 sm:px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm transition cursor-pointer ${
                rangePreset === btn.id
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {rangePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-600">Desde:</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-800"
            />
            <label className="text-xs font-bold text-slate-600">Hasta:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-800"
            />
          </div>
        )}

        <button
          type="button"
          onClick={fetchVentas}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
        >
          <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar Caja</span>
        </button>
      </div>

      {/* 4 TARJETAS DE RESUMEN DEL PERÍODO SELECCIONADO */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Vendido (Ingresos Brutos) */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border-2 border-slate-200 shadow-xs flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">
              1. Total Vendido
            </p>
            <p className="text-xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2 truncate">
              {formatBs(resumenPeriodo.totalVendido)}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
              {resumenPeriodo.ventasCompletadas} ventas válidas
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* 2. Costos Recuperados */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border-2 border-slate-200 shadow-xs flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">
              2. Costos Recuperados
            </p>
            <p className="text-xl sm:text-3xl font-black text-slate-800 mt-1 sm:mt-2 truncate">
              {formatBs(resumenPeriodo.costosRecuperados)}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
              Para reponer stock
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <RefreshCcw className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* 3. GANANCIA NETA REAL (Bolsillo) */}
        <div className="bg-gradient-to-br from-emerald-950 to-teal-950 text-white rounded-2xl p-3.5 sm:p-5 border-2 border-emerald-500 shadow-md flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              3. GANANCIA NETA REAL
            </p>
            <p className="text-xl sm:text-3xl font-black text-emerald-400 mt-1 sm:mt-2 truncate">
              {formatBs(resumenPeriodo.gananciaNeta)}
            </p>
            <p className="text-[11px] font-semibold text-emerald-200 mt-1 truncate">
              Utilidad limpia al bolsillo
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/40">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* 4. Desglose por Pago: Efectivo vs QR (incluye proporción exacta de ventas Mixtas) */}
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-3.5 sm:p-5 border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">
              4. Desglose Real (Efec. vs QR)
            </p>
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              <span className="text-xs font-extrabold text-emerald-900">
                💵 Efectivo:
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-800">
                {formatBs(resumenPeriodo.totalEfectivo)}
              </span>
            </div>
            <div className="flex items-center justify-between bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-200">
              <span className="text-xs font-extrabold text-indigo-900">
                📱 QR:
              </span>
              <span className="text-sm sm:text-base font-black text-indigo-800">
                {formatBs(resumenPeriodo.totalQR)}
              </span>
            </div>
            {resumenPeriodo.ventasMixtas > 0 && (
              <p className="text-[10px] font-bold text-violet-700 text-right">
                Incluye {resumenPeriodo.ventasMixtas} pago(s) mixto(s) repartidos
              </p>
            )}
          </div>
        </div>
      </div>

      {/* LISTA DE VENTAS EN CELULAR (md:hidden) */}
      <div className="md:hidden space-y-3">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2 px-1">
          <Receipt className="w-5 h-5 text-indigo-600" />
          Ventas del Período ({ventas.length})
        </h3>
        {isLoading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 font-bold border border-slate-200">
            Cargando ventas...
          </div>
        ) : ventas.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-200">
            No se registraron ventas en las fechas seleccionadas.
          </div>
        ) : (
          ventas.map((venta) => {
            const esAnulada = Boolean(venta.anulada)
            return (
              <div
                key={venta.id}
                className={`rounded-2xl p-4 border-2 shadow-xs space-y-3 ${
                  esAnulada
                    ? 'bg-rose-50/40 border-rose-200 opacity-75'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-slate-900">
                        Venta #{venta.id}
                      </span>
                      {esAnulada ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                          Anulada
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Completada
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {formatDateTime(venta.fecha)} • {venta.vendedor}
                    </p>
                  </div>
                  {renderPaymentBadge(venta)}
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400">
                      Total Vendido
                    </span>
                    <span
                      className={`text-base font-black ${
                        esAnulada ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {formatBs(venta.total)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] font-bold uppercase text-emerald-700">
                      Ganancia Neta
                    </span>
                    <span
                      className={`text-base font-black ${
                        esAnulada
                          ? 'line-through text-slate-400'
                          : 'text-emerald-700'
                      }`}
                    >
                      +{formatBs(venta.ganancia_total)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleVerDetalle(venta)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ver Detalle</span>
                  </button>
                  {!esAnulada && (
                    <button
                      type="button"
                      onClick={() => setVentaToAnnul(venta)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Ban className="w-4 h-4" />
                      <span>Anular Venta</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* TABLA DE VENTAS EN ESCRITORIO (hidden md:block) */}
      <div className="hidden md:block bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            Historial de Ventas del Período ({ventas.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-extrabold">N° Venta</th>
                <th className="py-3.5 px-4 font-extrabold">Fecha y Hora</th>
                <th className="py-3.5 px-4 font-extrabold">Vendedor</th>
                <th className="py-3.5 px-4 font-extrabold text-center">
                  Método de Pago
                </th>
                <th className="py-3.5 px-4 font-extrabold text-right">
                  Total Vendido
                </th>
                <th className="py-3.5 px-4 font-extrabold text-right">
                  Ganancia
                </th>
                <th className="py-3.5 px-4 font-extrabold text-center">Estado</th>
                <th className="py-3.5 px-4 font-extrabold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm sm:text-base">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-bold">
                    Cargando ventas del período...
                  </td>
                </tr>
              ) : ventas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No se registraron ventas en las fechas seleccionadas.
                  </td>
                </tr>
              ) : (
                ventas.map((venta) => {
                  const esAnulada = Boolean(venta.anulada)

                  return (
                    <tr
                      key={venta.id}
                      className={`transition-colors ${
                        esAnulada
                          ? 'bg-rose-50/40 text-slate-400'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-black text-slate-900">
                        #{venta.id}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {formatDateTime(venta.fecha)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {venta.vendedor || 'General'}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {renderPaymentBadge(venta)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-black whitespace-nowrap ${
                          esAnulada ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {formatBs(venta.total)}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-black whitespace-nowrap ${
                          esAnulada
                            ? 'line-through text-slate-400'
                            : 'text-emerald-700'
                        }`}
                      >
                        +{formatBs(venta.ganancia_total)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {esAnulada ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                            <Ban className="w-3.5 h-3.5" />
                            Anulada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completada
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerDetalle(venta)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 border border-slate-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Ver Detalle</span>
                          </button>

                          {!esAnulada && (
                            <button
                              type="button"
                              onClick={() => setVentaToAnnul(venta)}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                              <span>Anular Venta</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL VER DETALLE DEL TICKET */}
      {selectedVenta && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-xl font-extrabold flex items-center gap-2">
                  Detalle de Venta #{selectedVenta.id}
                  {selectedVenta.anulada && (
                    <span className="px-2.5 py-0.5 text-xs rounded-full bg-rose-600 text-white">
                      ANULADA
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDateTime(selectedVenta.fecha)} • {selectedVenta.vendedor} •{' '}
                  {selectedVenta.metodo_pago}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVenta(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {isLoadingDetalle ? (
                <p className="text-center py-8 text-slate-500 font-bold">
                  Cargando productos del ticket...
                </p>
              ) : detallesVenta.length === 0 ? (
                <p className="text-center py-8 text-slate-500">
                  No se encontraron líneas de detalle para esta venta.
                </p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[11px] uppercase">
                        <th className="py-2.5 px-3 font-extrabold">Producto</th>
                        <th className="py-2.5 px-2 font-extrabold text-center">
                          Cant.
                        </th>
                        <th className="py-2.5 px-3 font-extrabold text-right">
                          Costo
                        </th>
                        <th className="py-2.5 px-3 font-extrabold text-right">
                          Precio
                        </th>
                        <th className="py-2.5 px-3 font-extrabold text-right">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {detallesVenta.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.nombre_producto}
                          </td>
                          <td className="py-2.5 px-2 text-center font-black">
                            {item.cantidad}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 whitespace-nowrap">
                            {formatBs(item.costo_unitario)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-700 whitespace-nowrap">
                            {formatBs(item.precio_unitario)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                            {formatBs(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-500 block">
                    Ganancia Neta de este Ticket
                  </span>
                  <span className="text-lg font-black text-emerald-700">
                    +{formatBs(selectedVenta.ganancia_total)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase font-bold text-slate-500 block">
                    Total del Ticket
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatBs(selectedVenta.total)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                {!selectedVenta.anulada && (
                  <button
                    type="button"
                    onClick={() => setVentaToAnnul(selectedVenta)}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Anular Venta</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedVenta(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ANULACIÓN DE VENTA */}
      {ventaToAnnul && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  ¿Anular Venta #{ventaToAnnul.id}?
                </h3>
                <p className="text-xs text-slate-500">
                  El stock de los productos vendidos se devolverá automáticamente.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm text-slate-700 space-y-1">
              <p>
                Monto de la venta:{' '}
                <strong className="text-slate-900">
                  {formatBs(ventaToAnnul.total)}
                </strong>
              </p>
              <p>
                Vendedor: <strong>{ventaToAnnul.vendedor}</strong> • Pago:{' '}
                <strong>{ventaToAnnul.metodo_pago}</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVentaToAnnul(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isAnnulling}
                onClick={handleConfirmAnnul}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md cursor-pointer"
              >
                {isAnnulling ? 'Anulando...' : 'Sí, Anular y Devolver Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
