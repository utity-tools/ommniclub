-- OmniClub: Row Level Security (RLS) policies
-- Ejecutar después de `prisma migrate dev` para proteger todos los tenants

-- ─── ROLES ───────────────────────────────────────────────────────────────────
-- app_user: rol para la aplicación Next.js (usa JWT de Clerk)
-- app_admin: rol para scripts de migración y seeds (bypass RLS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin NOLOGIN;
  END IF;
END $$;

-- ─── HABILITAR RLS EN TODAS LAS TABLAS ───────────────────────────────────────
ALTER TABLE organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events     ENABLE ROW LEVEL SECURITY;

-- ─── FUNCIÓN HELPER: extraer org_id del JWT claim ────────────────────────────
-- Clerk pone el org_id en: request.jwt.claims ->> 'org_id'
CREATE OR REPLACE FUNCTION current_organization_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', TRUE), '')::TEXT;
$$ LANGUAGE sql STABLE;

-- ─── POLICIES: organizations ─────────────────────────────────────────────────
CREATE POLICY org_isolation ON organizations
  FOR ALL TO app_user
  USING (id = current_organization_id());

-- ─── POLICIES: users ─────────────────────────────────────────────────────────
CREATE POLICY users_org_isolation ON users
  FOR ALL TO app_user
  USING (organization_id = current_organization_id());

-- ─── POLICIES: members ───────────────────────────────────────────────────────
CREATE POLICY members_org_isolation ON members
  FOR ALL TO app_user
  USING (organization_id = current_organization_id());

-- ─── POLICIES: subscription_plans ────────────────────────────────────────────
CREATE POLICY plans_org_isolation ON subscription_plans
  FOR ALL TO app_user
  USING (organization_id = current_organization_id());

-- ─── POLICIES: products ──────────────────────────────────────────────────────
CREATE POLICY products_org_isolation ON products
  FOR ALL TO app_user
  USING (organization_id = current_organization_id());

-- ─── POLICIES: transactions ──────────────────────────────────────────────────
CREATE POLICY transactions_org_isolation ON transactions
  FOR ALL TO app_user
  USING (organization_id = current_organization_id());

-- ─── POLICIES: access_logs ───────────────────────────────────────────────────
CREATE POLICY access_logs_org_isolation ON access_logs
  FOR ALL TO app_user
  USING (organization_id = current_organization_id());

-- ─── POLICIES: audit_events ──────────────────────────────────────────────────
-- Solo lectura para STAFF; escritura desde app_admin (server-side)
CREATE POLICY audit_events_read ON audit_events
  FOR SELECT TO app_user
  USING (organization_id = current_organization_id());

CREATE POLICY audit_events_insert ON audit_events
  FOR INSERT TO app_user
  WITH CHECK (organization_id = current_organization_id());

-- ─── PERMISOS ─────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_admin;
