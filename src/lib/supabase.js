import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jxhduzhvgdpndqgkhmlz.supabase.co'
// Asegura que si se pega la URL con /rest/v1/ al final, se limpie automáticamente al dominio base de Supabase
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4aGR1emh2Z2RwbmRxZ2tobWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NTMxMjcsImV4cCI6MjEwODAyOTEyN30.WrT_Rqz1VHCQcmhdCndv5OTdGUDTxs5BywtkR7kcaMM'

// PROHIBIDO usar Supabase Realtime para proteger el Free Tier.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
})
