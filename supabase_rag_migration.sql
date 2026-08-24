-- 1. Habilitar la extension vector en Supabase
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Crear la tabla de fragmentos de conocimiento para RAG
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL,
    service_id TEXT,
    file_id TEXT,
    file_name TEXT,
    content TEXT NOT NULL,
    chunk_index INT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear indices para optimizar consultas por proyecto y servicio
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_project_id ON public.knowledge_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_project_service ON public.knowledge_chunks(project_id, service_id);

-- 4. Crear la funcion RPC legacy para busqueda semantica por similitud vectorial
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
    p_project_id TEXT,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.2,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    file_name TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.content,
        kc.file_name,
        (1 - (kc.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.knowledge_chunks kc
    WHERE kc.project_id = p_project_id
      AND (1 - (kc.embedding <=> query_embedding)) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 5. Crear RPC scopeada por project_id + service_id
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks_scoped(
    p_project_id TEXT,
    p_service_id TEXT,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.2,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    file_name TEXT,
    service_id TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.content,
        kc.file_name,
        kc.service_id,
        (1 - (kc.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.knowledge_chunks kc
    WHERE kc.project_id = p_project_id
      AND kc.service_id = p_service_id
      AND (1 - (kc.embedding <=> query_embedding)) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;