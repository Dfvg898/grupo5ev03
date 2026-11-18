import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Si falta el archivo .env la aplicación sigue funcionando en modo local (sin Supabase)
// en lugar de quedar en blanco. Ver .env.example.
export const supabaseConfigurado = Boolean(supabaseUrl && supabaseKey)

if (!supabaseConfigurado) {
  console.warn('Supabase no configurado: crea un archivo .env a partir de .env.example. Funcionando en modo local.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key'
)
