-- Incremental RAG service scope migration for existing databases.
-- Run after taking a backup and before deploying backend code that calls match_knowledge_chunks_scoped.

ALTER TABLE public.knowledge_chunks
ADD COLUMN IF NOT EXISTS service_id TEXT;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_project_service
ON public.knowledge_chunks(project_id, service_id);

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
