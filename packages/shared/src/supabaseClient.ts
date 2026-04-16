import { createClient } from '@supabase/supabase-js';

// No Monorepo, as variáveis de ambiente variam por app (VITE_ ou NEXT_PUBLIC_)
// Então passamos via função ou deixamos que cada app injete a sua versão
export const createSupabase = (url: string, key: string) => {
  return createClient(url, key);
};
