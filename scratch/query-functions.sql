SELECT json_agg(f ORDER BY proname)
FROM (
  SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_functiondef(p.oid) AS definition,
    p.prosecdef AS is_security_definer,
    p.proleakproof AS is_leakproof,
    CASE 
      WHEN p.proconfig IS NOT NULL THEN array_to_string(p.proconfig, ', ')
      ELSE 'DEFAULT'
    END AS config_search_path,
    r.rolname AS owner
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE n.nspname = 'public'
) f;
