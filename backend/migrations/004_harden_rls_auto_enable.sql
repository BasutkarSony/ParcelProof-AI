-- Restrict direct API execution of the RLS auto-enable event trigger function.
-- The DDL event trigger remains active; database migrations continue to invoke it
-- through PostgreSQL's event-trigger mechanism. API roles do not need RPC access.
DO $$
BEGIN
    IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
        END IF;
    END IF;
END;
$$;
