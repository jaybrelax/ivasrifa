import { createSupabase } from '@rifa/shared';

// Função robusta para pegar as variáveis de ambiente no Admin (Vite) na Vercel
const getEnv = (name: string) => {
  return (
    import.meta.env[name] || 
    (typeof process !== 'undefined' ? process.env[name] : undefined)
  );
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn('Supabase Client: Variáveis de ambiente faltando ou inválidas.');
}

export const supabase = createSupabase(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
