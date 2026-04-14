-- 1. Adicionar relacionamentos e campos em vendedores
ALTER TABLE public.vendedores 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS codigo_ref VARCHAR(30) UNIQUE;

-- 2. Adicionar meta genérica em rifas
ALTER TABLE public.rifas 
ADD COLUMN IF NOT EXISTS meta_guardiao INT DEFAULT 50;

-- 3. Tabela de Relacionamento (Guardião X Rifa)
CREATE TABLE IF NOT EXISTS public.rifa_vendedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rifa_id UUID REFERENCES public.rifas(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rifa_id, vendedor_id)
);

-- 4. Gravação de pedidos afiliados
ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL;

-- 5. Atualizar ou Criar Políticas Temporárias de Segurança (RLS) para o Guardião ler dados básicos
-- Isso permite o guardião ler suas rifas e seus pedidos associados.
-- Caso o Banco esteja RLS ativo:
-- Pedidos:
DROP POLICY IF EXISTS "permitir_guardiao_ver_proprios_pedidos" ON public.pedidos;
CREATE POLICY "permitir_guardiao_ver_proprios_pedidos" 
ON public.pedidos FOR SELECT 
USING (
  vendedor_id IN (
    SELECT id FROM public.vendedores WHERE user_id = auth.uid()
  )
);

-- Vendedores: pode ver e editar seu próprio perfil (se for usuário autenticado)
DROP POLICY IF EXISTS "permitir_vendedor_ver_editar_proprio_perfil" ON public.vendedores;
CREATE POLICY "permitir_vendedor_ver_editar_proprio_perfil" 
ON public.vendedores FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Notificação para habilitar RLS caso esteja desabilitado
-- ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
