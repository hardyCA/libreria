export function formatBs(value) {
  const num = Number(value) || 0
  return `Bs. ${num.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDateTime(isoString) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Analiza el campo metodo_pago de una venta.
 * Soporta:
 * - 'Efectivo'
 * - 'QR'
 * - 'Mixto (Efectivo: 20.00 | QR: 15.50)'
 * @param {string} metodoPagoRaw
 * @param {number} totalVenta
 * @returns {{ tipo: 'Efectivo' | 'QR' | 'Mixto', efectivo: number, qr: number, labelCorto: string, detalleMixto: string | null }}
 */
export function parseMetodoPago(metodoPagoRaw, totalVenta = 0) {
  const raw = (metodoPagoRaw || 'Efectivo').trim()
  const total = Number(totalVenta) || 0

  if (raw.toLowerCase().startsWith('mixto')) {
    const matchEfec = raw.match(/Efectivo:\s*([0-9]+(?:\.[0-9]+)?)/i)
    const matchQr = raw.match(/QR:\s*([0-9]+(?:\.[0-9]+)?)/i)

    let efectivo = matchEfec ? parseFloat(matchEfec[1]) : total / 2
    let qr = matchQr ? parseFloat(matchQr[1]) : Math.max(0, total - efectivo)

    return {
      tipo: 'Mixto',
      efectivo,
      qr,
      labelCorto: 'Mixto (Efec + QR)',
      detalleMixto: `Efec: Bs. ${efectivo.toFixed(2)} • QR: Bs. ${qr.toFixed(2)}`,
    }
  }

  if (raw.toLowerCase().includes('qr')) {
    return {
      tipo: 'QR',
      efectivo: 0,
      qr: total,
      labelCorto: 'Pago QR',
      detalleMixto: null,
    }
  }

  return {
    tipo: 'Efectivo',
    efectivo: total,
    qr: 0,
    labelCorto: 'Efectivo',
    detalleMixto: null,
  }
}
