-- audit_log is append-only (docs/ARCHITECTURE.md §15).
-- A trigger, rather than role permissions, so it holds whichever database user connects.
--
-- UPDATE and TRUNCATE are never allowed. DELETE is allowed only for data-retention purges: inside a
-- transaction that sets `SET LOCAL app.audit_purge = 'on'`, and only for rows older than
-- two years.

CREATE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF coalesce(current_setting('app.audit_purge', true), '') <> 'on' THEN
    RAISE EXCEPTION 'audit_log is append-only: rows can only be deleted by a retention purge'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.occurred_at > now() - interval '2 years' THEN
    RAISE EXCEPTION 'audit_log retention purge may only delete rows older than two years'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

-- TRUNCATE bypasses row triggers, so block it separately.
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
