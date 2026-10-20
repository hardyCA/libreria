import React, { useState, useMemo } from 'react'
import {
  Boxes,
  Wallet,
  TrendingUp,
  BadgeDollarSign,
  Search,
  Plus,
  PackagePlus,
  Pencil,
  Trash2,
  Upload,
  Link2,
  X,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatBs } from '../utils/formatters'
import { compressImageToWebP, uploadProductImage } from '../utils/imageCompressor'

export default function InventoryView({
  productos,
  setProductos,
  resumenServidor,
  onInventoryChanged,
  showNotification,
}) {
  const [searchTerm, setSearchTerm] = useState('')

  // Estado del Modal Crear/Editar Producto
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [formNombre, setFormNombre] = useState('')
  const [formDescripcion, setFormDescripcion] = useState('')
  const [formCosto, setFormCosto] = useState('')
  const [formPrecio, setFormPrecio] = useState('')
  const [formStock, setFormStock] = useState('')
  const [imageMode, setImageMode] = useState('upload')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [compressedImageData, setCompressedImageData] = useState(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isSavingProduct, setIsSavingProduct] = useState(false)

  // Estado del Modal Rápido "+ Sumar Stock"
  const [stockModalProduct, setStockModalProduct] = useState(null)
  const [unidadesASumar, setUnidadesASumar] = useState('')
  const [isAddingStock, setIsAddingStock] = useState(false)

  // Estado del Modal de Confirmación de Eliminación
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 4 Tarjetas Financieras Grandes calculadas en vivo sobre los productos activos
  const metricas = useMemo(() => {
    let unidadesTotales = 0
    let capitalInvertido = 0
    let valorVenta = 0
    let gananciaEstimada = 0

    for (const p of productos) {
      const stock = Math.max(0, Number(p.stock) || 0)
      const costo = Number(p.costo) || 0
      const precio = Number(p.precio) || 0

      unidadesTotales += stock
      capitalInvertido += stock * costo
      valorVenta += stock * precio
      gananciaEstimada += stock * (precio - costo)
    }

    return {
      unidadesTotales,
      capitalInvertido,
      valorVenta,
      gananciaEstimada,
    }
  }, [productos])

  // Búsqueda en memoria
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return productos
    return productos.filter((p) => {
      const nombre = (p.nombre || '').toLowerCase()
      const desc = (p.descripcion || '').toLowerCase()
      return nombre.includes(query) || desc.includes(query)
    })
  }, [productos, searchTerm])

  const openNewProductModal = () => {
    setEditingProduct(null)
    setFormNombre('')
    setFormDescripcion('')
    setFormCosto('')
    setFormPrecio('')
    setFormStock('1')
    setImageMode('upload')
    setFormImageUrl('')
    setCompressedImageData(null)
    setIsProductModalOpen(true)
  }

  const openEditProductModal = (prod) => {
    setEditingProduct(prod)
    setFormNombre(prod.nombre || '')
    setFormDescripcion(prod.descripcion || '')
    setFormCosto(String(prod.costo ?? ''))
    setFormPrecio(String(prod.precio ?? ''))
    setFormStock(String(prod.stock ?? '0'))
    setImageMode(prod.imagen_url ? 'url' : 'upload')
    setFormImageUrl(prod.imagen_url || '')
    setCompressedImageData(null)
    setIsProductModalOpen(true)
  }

  // Selección y compresión ultra ligera a WebP (260x260, baja calidad para ahorrar Free Tier)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsCompressing(true)
    try {
      const result = await compressImageToWebP(file)
      setCompressedImageData(result)
      showNotification(
        `Imagen ultra-comprimida: de ${result.originalSizeKB} KB a solo ${result.sizeKB} KB`,
        'success'
      )
    } catch (err) {
      showNotification(err.message || 'No se pudo comprimir la imagen.', 'error')
    } finally {
      setIsCompressing(false)
    }
  }

  // Cálculo en vivo de ganancia y margen en el modal
  const liveProfitCalc = useMemo(() => {
    const costo = parseFloat(formCosto) || 0
    const precio = parseFloat(formPrecio) || 0
    const ganancia = precio - costo
    const margen = costo > 0 ? (ganancia / costo) * 100 : precio > 0 ? 100 : 0
    return { ganancia, margen }
  }, [formCosto, formPrecio])

  const handleSaveProduct = async (e) => {
    e.preventDefault()
    const nombreLimpio = formNombre.trim()
    if (!nombreLimpio) {
      showNotification('El nombre del producto es obligatorio.', 'warning')
      return
    }

    const costoNum = parseFloat(formCosto)
    const precioNum = parseFloat(formPrecio)
    const stockNum = parseInt(formStock, 10)

    if (isNaN(costoNum) || costoNum < 0) {
      showNotification('Ingresa un Costo de Compra válido.', 'warning')
      return
    }
    if (isNaN(precioNum) || precioNum <= 0) {
      showNotification('Ingresa un Precio de Venta mayor a 0.', 'warning')
      return
    }
    if (isNaN(stockNum) || stockNum < 0) {
      showNotification('Ingresa un Stock válido (0 o más).', 'warning')
      return
    }

    setIsSavingProduct(true)
    try {
      let finalImageUrl = formImageUrl.trim() || null

      if (imageMode === 'upload' && compressedImageData?.blob) {
        finalImageUrl = await uploadProductImage(compressedImageData.blob)
      } else if (
        imageMode === 'upload' &&
        editingProduct?.imagen_url &&
        !compressedImageData
      ) {
        finalImageUrl = editingProduct.imagen_url
      }

      const payload = {
        nombre: nombreLimpio,
        descripcion: formDescripcion.trim() || null,
        imagen_url: finalImageUrl,
        costo: Number(costoNum.toFixed(2)),
        precio: Number(precioNum.toFixed(2)),
        stock: stockNum,
        activo: true,
      }

      if (editingProduct) {
        const { data, error } = await supabase
          .from('productos')
          .update(payload)
          .eq('id', editingProduct.id)
          .select()
          .single()

        if (error) throw error

        setProductos((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? data : p))
        )
        showNotification(`Producto "${data.nombre}" actualizado.`, 'success')
      } else {
        const { data, error } = await supabase
          .from('productos')
          .insert([payload])
          .select()
          .single()

        if (error) throw error

        setProductos((prev) => [data, ...prev])
        showNotification(`Producto "${data.nombre}" creado exitosamente.`, 'success')
      }

      setIsProductModalOpen(false)
      onInventoryChanged?.()
    } catch (err) {
      console.error('Error guardando producto:', err)
      showNotification(
        err?.message || 'Error al guardar el producto en Supabase.',
        'error'
      )
    } finally {
      setIsSavingProduct(false)
    }
  }

  const handleAddQuickStock = async (e) => {
    e.preventDefault()
    if (!stockModalProduct) return
    const delta = parseInt(unidadesASumar, 10)
    if (isNaN(delta) || delta <= 0) {
      showNotification('Ingresa una cantidad positiva para sumar al stock.', 'warning')
      return
    }

    setIsAddingStock(true)
    try {
      const nuevoStock = (Number(stockModalProduct.stock) || 0) + delta
      const { data, error } = await supabase
        .from('productos')
        .update({ stock: nuevoStock })
        .eq('id', stockModalProduct.id)
        .select()
        .single()

      if (error) throw error

      setProductos((prev) =>
        prev.map((p) => (p.id === stockModalProduct.id ? data : p))
      )
      showNotification(
        `Se sumaron +${delta} unidades a "${data.nombre}". Nuevo stock: ${nuevoStock}.`,
        'success'
      )
      setStockModalProduct(null)
      setUnidadesASumar('')
      onInventoryChanged?.()
    } catch (err) {
      console.error('Error al sumar stock:', err)
      showNotification(err?.message || 'No se pudo actualizar el stock.', 'error')
    } finally {
      setIsAddingStock(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirmProduct) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('productos')
        .update({ activo: false })
        .eq('id', deleteConfirmProduct.id)

      if (error) throw error

      setProductos((prev) =>
        prev.filter((p) => p.id !== deleteConfirmProduct.id)
      )
      showNotification(
        `Producto "${deleteConfirmProduct.nombre}" eliminado del catálogo activo.`,
        'success'
      )
      setDeleteConfirmProduct(null)
      onInventoryChanged?.()
    } catch (err) {
      console.error('Error eliminando producto:', err)
      showNotification(err?.message || 'No se pudo eliminar el producto.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const renderStockSemaphore = (stock) => {
    const qty = Number(stock) || 0
    if (qty > 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
          {qty} unid.
        </span>
      )
    }
    if (qty >= 1 && qty <= 5) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-extrabold bg-amber-100 text-amber-900 border border-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          {qty} (¡Poco!)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
        <span className="w-2 h-2 rounded-full bg-rose-600" />
        0 (Agotado)
      </span>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8 space-y-5">
      {/* 4 TARJETAS FINANCIERAS GRANDES (2x2 en celular, 4 en escritorio) */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Tarjeta 1: Unidades Totales en Stock */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border-2 border-slate-200/90 shadow-xs flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">
              1. Unidades en Stock
            </p>
            <p className="text-xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2 truncate">
              {metricas.unidadesTotales.toLocaleString('es-BO')}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
              {productos.length} productos activos
              {resumenServidor?.total_productos_distintos !== undefined ? '' : ''}
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Tarjeta 2: Capital Invertido en Stock */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border-2 border-slate-200/90 shadow-xs flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">
              2. Capital Invertido
            </p>
            <p className="text-xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2 truncate">
              {formatBs(metricas.capitalInvertido)}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
              Costo mercadería actual
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Tarjeta 3: Valor de Venta del Stock */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border-2 border-slate-200/90 shadow-xs flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500">
              3. Valor de Venta
            </p>
            <p className="text-xl sm:text-3xl font-black text-indigo-700 mt-1 sm:mt-2 truncate">
              {formatBs(metricas.valorVenta)}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
              Recaudación total esperada
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <BadgeDollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Tarjeta 4: Ganancia Estimada en Estantería */}
        <div className="bg-gradient-to-br from-emerald-950 to-teal-950 text-white rounded-2xl p-3.5 sm:p-5 border-2 border-emerald-500 shadow-md flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              4. Ganancia Estimada
            </p>
            <p className="text-xl sm:text-3xl font-black text-emerald-400 mt-1 sm:mt-2 truncate">
              {formatBs(metricas.gananciaEstimada)}
            </p>
            <p className="text-[11px] font-semibold text-emerald-200 mt-1 truncate">
              Utilidad futura en estantería
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/40">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </div>

      {/* BARRA DE HERRAMIENTAS: Buscador y "+ Nuevo Producto" */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar en inventario por nombre o descripción..."
            className="w-full pl-11 pr-10 py-3 text-sm sm:text-base font-semibold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-900"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={openNewProductModal}
          className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>+ Nuevo Producto</span>
        </button>
      </div>

      {/* VISTA EN CELULARES (md:hidden): TARJETAS RESPONSIVAS DE INVENTARIO */}
      <div className="md:hidden space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-200">
            No hay productos que coincidan con la búsqueda.
          </div>
        ) : (
          filteredProducts.map((prod) => {
            const costo = Number(prod.costo) || 0
            const precio = Number(prod.precio) || 0
            const gananciaUnidad = precio - costo
            const margenPct =
              costo > 0
                ? ((gananciaUnidad / costo) * 100).toFixed(0)
                : precio > 0
                ? '100'
                : '0'

            return (
              <div
                key={prod.id}
                className="bg-white rounded-2xl p-4 border-2 border-slate-200/90 shadow-xs space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {prod.imagen_url ? (
                      <img
                        src={prod.imagen_url}
                        alt={prod.nombre}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-slate-900 text-base leading-snug">
                        {prod.nombre}
                      </h4>
                      {renderStockSemaphore(prod.stock)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {prod.descripcion || 'Sin descripción'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-center">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400">
                      Costo
                    </span>
                    <span className="text-sm font-bold text-slate-700">
                      {formatBs(costo)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400">
                      Precio Venta
                    </span>
                    <span className="text-sm font-black text-indigo-700">
                      {formatBs(precio)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-emerald-700">
                      Ganancia ({margenPct}%)
                    </span>
                    <span className="text-sm font-black text-emerald-700">
                      +{formatBs(gananciaUnidad)}
                    </span>
                  </div>
                </div>

                {/* Botones grandes para móvil */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStockModalProduct(prod)
                      setUnidadesASumar('')
                    }}
                    className="py-2.5 px-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <PackagePlus className="w-4 h-4" />
                    <span>+ Stock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditProductModal(prod)}
                    className="py-2.5 px-2 rounded-xl bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmProduct(prod)}
                    className="py-2.5 px-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* VISTA EN ESCRITORIO Y TABLET (hidden md:block): TABLA COMPLETA */}
      <div className="hidden md:block bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-extrabold">Producto</th>
                <th className="py-3.5 px-4 font-extrabold text-right">
                  Costo de Compra
                </th>
                <th className="py-3.5 px-4 font-extrabold text-right">
                  Precio de Venta
                </th>
                <th className="py-3.5 px-4 font-extrabold text-right">
                  Ganancia por Unidad
                </th>
                <th className="py-3.5 px-4 font-extrabold text-center">
                  Stock Actual
                </th>
                <th className="py-3.5 px-4 font-extrabold text-right">
                  Acciones Rápidas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm sm:text-base">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No hay productos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const costo = Number(prod.costo) || 0
                  const precio = Number(prod.precio) || 0
                  const gananciaUnidad = precio - costo
                  const margenPct =
                    costo > 0
                      ? ((gananciaUnidad / costo) * 100).toFixed(0)
                      : precio > 0
                      ? '100'
                      : '0'

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {prod.imagen_url ? (
                              <img
                                src={prod.imagen_url}
                                alt={prod.nombre}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 text-base leading-snug">
                              {prod.nombre}
                            </p>
                            <p className="text-xs sm:text-sm text-slate-500 line-clamp-1">
                              {prod.descripcion || 'Sin descripción'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-700 whitespace-nowrap">
                        {formatBs(costo)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-indigo-700 whitespace-nowrap">
                        {formatBs(precio)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex flex-col items-end">
                          <span className="font-black text-emerald-700">
                            +{formatBs(gananciaUnidad)}
                          </span>
                          <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            Margen: {margenPct}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {renderStockSemaphore(prod.stock)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setStockModalProduct(prod)
                              setUnidadesASumar('')
                            }}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                          >
                            <PackagePlus className="w-4 h-4" />
                            <span>+ Sumar Stock</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditProductModal(prod)}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-800 hover:text-indigo-700 border border-slate-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmProduct(prod)}
                            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Eliminar</span>
                          </button>
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

      {/* MODAL CREAR / EDITAR PRODUCTO */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border-2 border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg sm:text-xl font-extrabold">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveProduct}
              className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1"
            >
              <div>
                <label className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1">
                  Nombre del Producto <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej. Cuaderno Empastado Tamaño Oficio 100 Hojas"
                  className="w-full px-3.5 py-2.5 text-sm sm:text-base font-semibold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Ej. Marca Líder, cuadriculado, tapa dura"
                  className="w-full px-3.5 py-2.5 text-sm sm:text-base font-medium bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                <div>
                  <label className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1">
                    Costo (Bs.) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formCosto}
                    onChange={(e) => setFormCosto(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 text-sm sm:text-base font-bold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1">
                    Precio (Bs.) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={formPrecio}
                    onChange={(e) => setFormPrecio(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 text-sm sm:text-base font-bold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-extrabold text-slate-800 mb-1">
                    {editingProduct ? 'Stock' : 'Stock Inicial'}{' '}
                    <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2.5 text-sm sm:text-base font-bold bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Aviso en vivo de Ganancia por Unidad y Margen */}
              <div
                className={`p-3 rounded-xl border-2 flex items-center justify-between ${
                  liveProfitCalc.ganancia >= 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}
              >
                <span className="text-xs sm:text-sm font-bold">
                  Ganancia por unidad:{' '}
                  <strong className="text-sm sm:text-base font-black">
                    {formatBs(liveProfitCalc.ganancia)}
                  </strong>{' '}
                  (Margen:{' '}
                  <strong className="font-black">
                    {liveProfitCalc.margen.toFixed(1)}%
                  </strong>
                  )
                </span>
                <TrendingUp className="w-5 h-5 text-emerald-700 shrink-0" />
              </div>

              {/* Imagen del Producto con compresión extrema WebP */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs sm:text-sm font-extrabold text-slate-800">
                    Foto del Producto (Ultra Ligera)
                  </label>
                  <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setImageMode('upload')}
                      className={`px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer ${
                        imageMode === 'upload'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Subir Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode('url')}
                      className={`px-2.5 py-1 rounded-md flex items-center gap-1 cursor-pointer ${
                        imageMode === 'url'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Pegar Link
                    </button>
                  </div>
                </div>

                {imageMode === 'upload' ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-3.5 bg-slate-50 text-center">
                    <input
                      id="product-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="product-image-upload"
                      className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                    >
                      {compressedImageData ? (
                        <div className="flex items-center gap-3.5 text-left">
                          <img
                            src={compressedImageData.previewUrl}
                            alt="Vista previa WebP"
                            className="w-16 h-16 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
                          />
                          <div>
                            <p className="text-xs sm:text-sm font-extrabold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              ¡Foto reducida a {compressedImageData.sizeKB} KB!
                            </p>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              {compressedImageData.width}x
                              {compressedImageData.height}px WebP (Original:{' '}
                              {compressedImageData.originalSizeKB} KB) — Protege tu
                              Free Tier
                            </p>
                            <span className="inline-block mt-1 text-xs font-bold text-indigo-600 underline">
                              Elegir otra foto
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-7 h-7 text-indigo-600" />
                          <span className="text-xs sm:text-sm font-bold text-slate-700">
                            {isCompressing
                              ? 'Comprimiendo foto al mínimo peso...'
                              : 'Toca aquí para tomar o elegir foto desde tu celular/PC'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Se reduce automáticamente a baja calidad (260x260px, ~5KB)
                            para no gastar almacenamiento en Supabase
                          </span>
                        </>
                      )}
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://ejemplo.com/imagen-producto.jpg"
                      className="w-full px-3.5 py-2.5 text-sm font-medium bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct || isCompressing}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-sm shadow-md cursor-pointer"
                >
                  {isSavingProduct
                    ? 'Guardando...'
                    : editingProduct
                    ? 'Guardar Cambios'
                    : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VENTANITA RÁPIDA "+ SUMAR STOCK" */}
      {stockModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-emerald-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-6 h-6" />
                <h3 className="text-lg font-extrabold">+ Sumar Stock Rápido</h3>
              </div>
              <button
                type="button"
                onClick={() => setStockModalProduct(null)}
                className="p-1 rounded-lg text-emerald-100 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddQuickStock} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">
                  Producto:
                </p>
                <p className="text-lg font-extrabold text-slate-900">
                  {stockModalProduct.nombre}
                </p>
                <p className="text-sm font-bold text-slate-600 mt-1">
                  Stock actual:{' '}
                  <span className="text-indigo-700 font-black">
                    {stockModalProduct.stock} unidades
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-extrabold text-slate-800 mb-1.5">
                  ¿Cuántas unidades nuevas llegaron?
                </label>
                <input
                  type="number"
                  autoFocus
                  required
                  min="1"
                  step="1"
                  value={unidadesASumar}
                  onChange={(e) => setUnidadesASumar(e.target.value)}
                  placeholder="Ej. 12"
                  className="w-full px-4 py-3 text-2xl font-black text-center bg-slate-50 border-2 border-emerald-500 rounded-xl focus:outline-none focus:bg-white text-slate-900"
                />
                {parseInt(unidadesASumar, 10) > 0 && (
                  <p className="text-center text-sm font-extrabold text-emerald-700 mt-2">
                    Nuevo stock total será:{' '}
                    {(Number(stockModalProduct.stock) || 0) +
                      parseInt(unidadesASumar, 10)}{' '}
                    unidades
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStockModalProduct(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAddingStock}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md cursor-pointer"
                >
                  {isAddingStock ? 'Sumando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  ¿Eliminar producto?
                </h3>
                <p className="text-xs text-slate-500">
                  El historial de ventas pasadas se conservará intacto.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              Estás por desactivar{' '}
              <strong className="text-slate-900">
                "{deleteConfirmProduct.nombre}"
              </strong>{' '}
              (Stock actual: {deleteConfirmProduct.stock}).
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-md cursor-pointer"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
