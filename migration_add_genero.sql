-- Adiciona a coluna genero à tabela vendedores
ALTER TABLE public.vendedores
ADD COLUMN IF NOT EXISTS genero VARCHAR(10) CHECK (genero IN ('masculino', 'feminino'));

-- Comentário: Execute este script no console de SQL Editor do Supabase.
