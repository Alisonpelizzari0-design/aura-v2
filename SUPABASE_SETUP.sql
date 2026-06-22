-- ============================================================
--  AURA — Life Architecture OS
--  Supabase SQL Setup — Version nettoyée (sans doublons)
--  À exécuter dans : Supabase > SQL Editor > New query > Run
-- ============================================================

-- ── 1. EXTENSION UUID ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. PROFILS UTILISATEURS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'Mon AURA',
  sign          TEXT DEFAULT 'vierge',
  affirmation   TEXT DEFAULT 'Je suis alignée et en expansion',
  gemini_key    TEXT DEFAULT '',
  home_module   TEXT DEFAULT 'dashboard',
  theme         TEXT DEFAULT 'light',
  foyer         INT  DEFAULT 1,
  appareils     JSONB DEFAULT '{"airfryer":true,"four":true,"thermomix":false}',
  avatar_url    TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. XP & PROGRESSION ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_data (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp    INT NOT NULL DEFAULT 0,
  today_xp    INT NOT NULL DEFAULT 0,
  last_date   DATE DEFAULT CURRENT_DATE,
  log         JSONB DEFAULT '[]',
  badges      JSONB DEFAULT '[]',
  stats       JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── 4. FINANCE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_revenus (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  categorie   TEXT NOT NULL DEFAULT 'autre-revenu',
  montant     NUMERIC(10,2) NOT NULL,
  date_op     DATE DEFAULT CURRENT_DATE,
  recurrent   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_charges (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  categorie   TEXT NOT NULL DEFAULT 'autre',
  montant     NUMERIC(10,2) NOT NULL,
  ic          TEXT DEFAULT 'ti-receipt',
  icolor      TEXT DEFAULT '#64748B',
  color       TEXT DEFAULT '#F8F7FF',
  period      TEXT DEFAULT 'Mensuel',
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_depenses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  categorie   TEXT NOT NULL DEFAULT 'autre',
  montant     NUMERIC(10,2) NOT NULL,
  date_op     DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_cagnottes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       TEXT DEFAULT '💰',
  name        TEXT NOT NULL,
  montant     NUMERIC(10,2) DEFAULT 0,
  cible       NUMERIC(10,2) NOT NULL,
  mensuel     NUMERIC(10,2) DEFAULT 0,
  color_from  TEXT DEFAULT '#7C3AED',
  color_to    TEXT DEFAULT '#5B21B6',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_enveloppes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  budget      NUMERIC(10,2) NOT NULL,
  ic          TEXT DEFAULT 'ti-tag',
  bg          TEXT DEFAULT '#F8F7FF',
  ic2         TEXT DEFAULT '#64748B',
  ordre       INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_budget_prefs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revenus_nets    NUMERIC(10,2) DEFAULT 0,
  budget_logement NUMERIC(10,2) DEFAULT 0,
  budget_alim     NUMERIC(10,2) DEFAULT 0,
  budget_loisirs  NUMERIC(10,2) DEFAULT 0,
  budget_transport NUMERIC(10,2) DEFAULT 0,
  budget_abos     NUMERIC(10,2) DEFAULT 0,
  budget_sante    NUMERIC(10,2) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── 5. RITUEL & HABITUDES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS rituels (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_rituel DATE DEFAULT CURRENT_DATE,
  humeur      INT DEFAULT 3,
  gratitudes  TEXT DEFAULT '',
  intention   TEXT DEFAULT '',
  affirmation TEXT DEFAULT '',
  ancre_q     TEXT DEFAULT '',
  ancre_aff   TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date_rituel)
);

CREATE TABLE IF NOT EXISTS habitudes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  icone       TEXT DEFAULT '✅',
  description TEXT DEFAULT '',
  xp_gain     INT DEFAULT 10,
  cible_hebdo INT DEFAULT 7,
  ordre       INT DEFAULT 0,
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habitudes_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habitude_id  UUID NOT NULL REFERENCES habitudes(id) ON DELETE CASCADE,
  date_log     DATE DEFAULT CURRENT_DATE,
  done         BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, habitude_id, date_log)
);

-- ── 6. SPHÈRES DE VIE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spheres_scores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sphere      TEXT NOT NULL,
  score       INT DEFAULT 50,
  notes       TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sphere)
);

-- ── 6b. AGENDA / CALENDRIER (définition unique, fusionnée) ───
CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  categorie    TEXT NOT NULL DEFAULT 'perso',
  date         DATE NOT NULL,
  date_end     DATE,
  heure_debut  TEXT DEFAULT '09:00',
  heure_fin    TEXT DEFAULT '10:00',
  lieu         TEXT DEFAULT '',
  note         TEXT DEFAULT '',
  recurrence   TEXT DEFAULT 'none',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date);

-- ── 6c. COACH IA — Historique des sessions ───────────────────
CREATE TABLE IF NOT EXISTS coach_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain      TEXT NOT NULL DEFAULT 'global',
  type        TEXT NOT NULL DEFAULT 'deblocage',
  message     TEXT DEFAULT '',
  response    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_sessions_user ON coach_sessions(user_id, created_at DESC);

-- ── 6d. PATRIMOINE — Actifs & Passifs ────────────────────────
CREATE TABLE IF NOT EXISTS patrimoine_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'actif',
  name        TEXT NOT NULL,
  montant     NUMERIC(12,2) NOT NULL DEFAULT 0,
  type        TEXT DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patrimoine_user ON patrimoine_items(user_id);

-- ── 6e. ÉDITEUR DE CONTENU — overrides de textes ─────────────
CREATE TABLE IF NOT EXISTS content_overrides (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overrides   TEXT NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── 6f. VISION BOARD — objectifs visuels par sphère ──────────
CREATE TABLE IF NOT EXISTS vision_cards (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  sphere       TEXT NOT NULL DEFAULT 'vision',
  deadline     DATE,
  color        TEXT DEFAULT '#7C3AED',
  affirmation  TEXT DEFAULT '',
  visual_type  TEXT DEFAULT 'emoji',
  visual_value TEXT DEFAULT '🎯',
  steps        JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vision_cards_user ON vision_cards(user_id);

-- ── 7. CUISINE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recettes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  icone       TEXT DEFAULT '🍽️',
  cat         TEXT DEFAULT 'sale',
  time_cat    TEXT DEFAULT 'moyen',
  duree_min   INT DEFAULT 20,
  difficulte  INT DEFAULT 2,
  tags        JSONB DEFAULT '[]',
  favori      BOOLEAN DEFAULT FALSE,
  lien_ext    TEXT DEFAULT '',
  ingredients_json JSONB DEFAULT '[]',
  steps_json  JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planning_repas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_repas  DATE NOT NULL,
  moment      TEXT NOT NULL,
  recette_id  UUID REFERENCES recettes(id) ON DELETE SET NULL,
  label       TEXT DEFAULT '',
  color_slot  TEXT DEFAULT 'or',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date_repas, moment)
);

CREATE TABLE IF NOT EXISTS liste_courses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  categorie   TEXT DEFAULT 'Épicerie',
  quantite    TEXT DEFAULT '×1',
  done        BOOLEAN DEFAULT FALSE,
  semaine     DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. SYNTHÈSES & EXPORTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS syntheses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  periode      TEXT NOT NULL,
  contenu      JSONB NOT NULL DEFAULT '{}',
  ia_analyse   TEXT DEFAULT '',
  xp_total     INT DEFAULT 0,
  score_vie    INT DEFAULT 0,
  partage      BOOLEAN DEFAULT FALSE,
  share_token  TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. ALERTES FINANCE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertes_finance (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  niveau      TEXT DEFAULT 'info',
  titre       TEXT NOT NULL,
  message     TEXT DEFAULT '',
  lu          BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. ROW LEVEL SECURITY (RLS) ─────────────────────────────
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_data              ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_revenus      ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_charges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_depenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_cagnottes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_enveloppes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budget_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rituels              ENABLE ROW LEVEL SECURITY;
ALTER TABLE habitudes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE habitudes_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE spheres_scores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE patrimoine_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_overrides    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recettes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_repas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE liste_courses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE syntheses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertes_finance      ENABLE ROW LEVEL SECURITY;

-- Policies génériques : chaque user = ses données (une seule passe, sans doublon)
DO $$ DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'finance_revenus','finance_charges','finance_depenses',
    'finance_cagnottes','finance_enveloppes','finance_budget_prefs',
    'rituels','habitudes','habitudes_log','spheres_scores',
    'recettes','planning_repas','liste_courses','alertes_finance',
    'events','coach_sessions','patrimoine_items','vision_cards'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('
      CREATE POLICY "%s_user_policy" ON %s
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    ', tbl, tbl);
  END LOOP;
END $$;

-- Profile : lecture/écriture par soi (id = auth.uid(), pas user_id)
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- XP : lecture/écriture par soi
CREATE POLICY "xp_policy" ON xp_data
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Content overrides : lecture/écriture par soi
CREATE POLICY "content_overrides_policy" ON content_overrides
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Synthèses : lecture si partagée OU propriétaire
CREATE POLICY "syntheses_owner" ON syntheses
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "syntheses_shared" ON syntheses
  FOR SELECT USING (partage = TRUE);

-- ── 11. TRIGGER : profil + XP auto à l'inscription ───────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Mon AURA'))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO xp_data (user_id, total_xp, today_xp)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 12. TRIGGER : updated_at auto (toutes les tables concernées) ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated          BEFORE UPDATE ON profiles             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_xp_updated                BEFORE UPDATE ON xp_data              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cagnottes_updated         BEFORE UPDATE ON finance_cagnottes    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_budget_updated            BEFORE UPDATE ON finance_budget_prefs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_spheres_updated           BEFORE UPDATE ON spheres_scores       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_events_updated            BEFORE UPDATE ON events               FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patrimoine_updated        BEFORE UPDATE ON patrimoine_items     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vision_cards_updated      BEFORE UPDATE ON vision_cards         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_content_overrides_updated BEFORE UPDATE ON content_overrides    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── FIN DU SETUP ─────────────────────────────────────────────
-- 21 tables créées :
--   profiles, xp_data,
--   finance_revenus, finance_charges, finance_depenses,
--   finance_cagnottes, finance_enveloppes, finance_budget_prefs,
--   rituels, habitudes, habitudes_log,
--   spheres_scores, events, coach_sessions, patrimoine_items,
--   content_overrides, vision_cards,
--   recettes, planning_repas, liste_courses,
--   syntheses, alertes_finance
