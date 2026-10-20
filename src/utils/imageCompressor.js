import { supabase } from '../lib/supabase'

/**
 * Redimensiona y comprime una imagen en el navegador usando <canvas> HTML5
 * a baja resolución (máx 260x260 píxeles) y baja calidad WebP (0.45 / adaptativa)
 * para que pese entre 3KB y 12KB y nunca exceda la capa gratuita (Free Tier) de Supabase.
 * @param {File} file Archivo de imagen original
 * @returns {Promise<{ blob: Blob, previewUrl: string, width: number, height: number, sizeKB: string, originalSizeKB: string }>}
 */
export function compressImageToWebP(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Por favor selecciona un archivo de imagen válido.'))
      return
    }

    const originalSizeKB = (file.size / 1024).toFixed(1)
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'))
    reader.onload = (event) => {
      const img = new Image()
      img.onerror = () => reject(new Error('No se pudo procesar la imagen seleccionada.'))
      img.onload = () => {
        // Resolución compacta ideal para miniaturas y tarjetas POS (ahorro extremo de Storage)
        const MAX_SIZE = 260
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width)
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height)
            height = MAX_SIZE
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        // Primera pasada a calidad baja 0.45
        canvas.toBlob(
          (firstBlob) => {
            if (!firstBlob) {
              reject(new Error('Error al comprimir la imagen a WebP.'))
              return
            }

            // Si aún supera 12KB, reducimos calidad a 0.32 para garantizar peso mínimo
            if (firstBlob.size > 12 * 1024) {
              canvas.toBlob(
                (secondBlob) => {
                  const finalBlob = secondBlob || firstBlob
                  const previewUrl = URL.createObjectURL(finalBlob)
                  const sizeKB = (finalBlob.size / 1024).toFixed(1)
                  resolve({
                    blob: finalBlob,
                    previewUrl,
                    width,
                    height,
                    sizeKB,
                    originalSizeKB,
                  })
                },
                'image/webp',
                0.32
              )
            } else {
              const previewUrl = URL.createObjectURL(firstBlob)
              const sizeKB = (firstBlob.size / 1024).toFixed(1)
              resolve({
                blob: firstBlob,
                previewUrl,
                width,
                height,
                sizeKB,
                originalSizeKB,
              })
            }
          },
          'image/webp',
          0.45
        )
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Sube el Blob WebP ultra-comprimido al bucket público 'productos' de Supabase
 * y devuelve la URL pública.
 * @param {Blob} webpBlob
 * @returns {Promise<string>} URL pública de la imagen
 */
export async function uploadProductImage(webpBlob) {
  const fileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webp`

  const { error: uploadError } = await supabase.storage
    .from('productos')
    .upload(fileName, webpBlob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Error al subir imagen al bucket 'productos': ${uploadError.message}`)
  }

  const { data } = supabase.storage.from('productos').getPublicUrl(fileName)
  if (!data || !data.publicUrl) {
    throw new Error('No se pudo obtener la URL pública de la imagen.')
  }

  return data.publicUrl
}
