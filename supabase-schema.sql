-- Script de Criação do Banco de Dados (Supabase / PostgreSQL)
-- Execute este script no SQL Editor do seu painel Supabase

-- Habilitar a extensão pgcrypto para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela: rifas
CREATE TABLE IF NOT EXISTS public.rifas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    imagem_url TEXT,
    total_numeros INTEGER NOT NULL,
    valor_numero NUMERIC(10,2) NOT NULL,
    data_sorteio TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('rascunho', 'ativa', 'encerrada', 'sorteada')),
    qtd_sorteios INTEGER NOT NULL DEFAULT 1,
    timeout_reserva INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Tabela: clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo VARCHAR(300) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    total_compras INTEGER NOT NULL DEFAULT 0,
    total_gasto NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. Tabela: vendedores
CREATE TABLE IF NOT EXISTS public.vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    codigo_ref VARCHAR(20) NOT NULL UNIQUE,
    meta_numeros INTEGER NOT NULL,
    numeros_vendidos INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 4. Tabela: premios
CREATE TABLE IF NOT EXISTS public.premios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rifa_id UUID NOT NULL REFERENCES public.rifas(id) ON DELETE CASCADE,
    posicao INTEGER NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    valor_estimado NUMERIC(10,2),
    imagem_url TEXT,
    numero_sorteado INTEGER,
    cliente_vencedor_id UUID REFERENCES public.clientes(id),
    sorteado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela: pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rifa_id UUID NOT NULL REFERENCES public.rifas(id),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id),
    vendedor_id UUID REFERENCES public.vendedores(id),
    numeros INTEGER[] NOT NULL,
    quantidade INTEGER NOT NULL,
    valor_total NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pendente', 'pago', 'expirado', 'cancelado')),
    mp_payment_id VARCHAR(100),
    mp_qr_code TEXT,
    mp_pix_copy_paste TEXT,
    pago_em TIMESTAMPTZ,
    expira_em TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabela: numeros_rifa
CREATE TABLE IF NOT EXISTS public.numeros_rifa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rifa_id UUID NOT NULL REFERENCES public.rifas(id) ON DELETE CASCADE,
    pedido_id UUID REFERENCES public.pedidos(id),
    numero INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('disponivel', 'reservado', 'vendido')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(rifa_id, numero)
);

-- ==============================================================================
-- Configuração de Row Level Security (RLS)
-- ==============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.rifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numeros_rifa ENABLE ROW LEVEL SECURITY;

-- Políticas para Rifas
-- Público pode ler rifas ativas ou sorteadas
CREATE POLICY "Público pode ver rifas ativas" ON public.rifas
    FOR SELECT USING (status IN ('ativa', 'sorteada', 'encerrada'));
-- Apenas usuários autenticados (admin) podem gerenciar
CREATE POLICY "Admins gerenciam rifas" ON public.rifas
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para Prêmios
CREATE POLICY "Público pode ver prêmios" ON public.premios
    FOR SELECT USING (true);
CREATE POLICY "Admins gerenciam prêmios" ON public.premios
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para Números da Rifa
CREATE POLICY "Público pode ver status dos números" ON public.numeros_rifa
    FOR SELECT USING (true);
CREATE POLICY "Admins gerenciam números" ON public.numeros_rifa
    FOR ALL USING (auth.role() = 'authenticated');
-- Service role (backend) ou funções específicas gerenciam atualizações de reserva

-- Políticas para Clientes
CREATE POLICY "Admins gerenciam clientes" ON public.clientes
    FOR ALL USING (auth.role() = 'authenticated');
-- Permitir inserção anônima (quando o cliente preenche o form de checkout)
CREATE POLICY "Público pode criar cliente no checkout" ON public.clientes
    FOR INSERT WITH CHECK (true);
-- Permitir busca de cliente por CPF na tela de Minhas Compras
CREATE POLICY "Público pode ler clientes" ON public.clientes
    FOR SELECT USING (true);

-- Políticas para Pedidos
CREATE POLICY "Público pode criar pedidos" ON public.pedidos
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Público pode ler o próprio pedido" ON public.pedidos
    FOR SELECT USING (true); -- Em produção, idealmente filtrar por ID ou token
CREATE POLICY "Admins gerenciam pedidos" ON public.pedidos
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para Vendedores
CREATE POLICY "Público pode ler vendedores (para ref)" ON public.vendedores
    FOR SELECT USING (ativo = true);
CREATE POLICY "Admins gerenciam vendedores" ON public.vendedores
    FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- Funções e Triggers (Opcional - Atualização de updated_at)
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rifas_updated_at BEFORE UPDATE ON public.rifas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_premios_updated_at BEFORE UPDATE ON public.premios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_numeros_rifa_updated_at BEFORE UPDATE ON public.numeros_rifa FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 7. Tabela: configuracoes (Extrema Segurança para Chaves API)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Garante apenas uma linha de configuração
    nome_sistema VARCHAR(200) NOT NULL DEFAULT 'Sorteios Online',
    logo_url TEXT,
    mp_access_token TEXT,
    evolution_api_url TEXT,
    evolution_api_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas de Extrema Segurança para Configurações
-- Apenas usuários autenticados (Admins) podem ler e modificar as configurações e chaves API
CREATE POLICY "Admins gerenciam configuracoes" ON public.configuracoes
    FOR ALL USING (auth.role() = 'authenticated');

CREATE TRIGGER update_configuracoes_updated_at BEFORE UPDATE ON public.configuracoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir linha padrão caso não exista
INSERT INTO public.configuracoes (id, nome_sistema) VALUES (1, 'Sorteios Online') ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 8. View: vw_configuracoes_publicas (Para acesso sem autenticação)
-- ==============================================================================
CREATE OR REPLACE VIEW public.vw_configuracoes_publicas AS
SELECT id, nome_sistema, logo_url
FROM public.configuracoes;

-- Garantir acesso público à view
GRANT SELECT ON public.vw_configuracoes_publicas TO anon;
GRANT SELECT ON public.vw_configuracoes_publicas TO authenticated;

-- ==============================================================================
-- 9. Storage: Configuração do Bucket de Imagens
-- ==============================================================================

-- Criar o bucket 'images' se não existir (requer privilégios de superuser ou via painel, mas tentamos inserir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para o bucket 'images'
-- Permitir leitura pública
CREATE POLICY "Imagens públicas" ON storage.objects
    FOR SELECT USING (bucket_id = 'images');

-- Permitir upload para usuários autenticados
CREATE POLICY "Admins podem fazer upload de imagens" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.role() = 'authenticated');

-- Permitir update/delete para usuários autenticados
CREATE POLICY "Admins podem atualizar imagens" ON storage.objects
    FOR UPDATE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

CREATE POLICY "Admins podem deletar imagens" ON storage.objects
    FOR DELETE USING (bucket_id = 'images' AND auth.role() = 'authenticated');

