/* ============================================================
   AURA — aura-db.js v1.0
   Couche Supabase : Auth + Sync BDD
   Usage : <script src="aura-db.js"></script> AVANT aura.js
   ============================================================
   CONFIGURATION :
   1. Crée un projet sur https://supabase.com (gratuit)
   2. Project Settings > API → copie URL + anon key
   3. Remplace les valeurs ci-dessous
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   🔑 CONFIGURATION SUPABASE
══════════════════════════════════════════════════════════════ */
const AURA_DB_CONFIG = {
  // Configuré avec le projet Supabase d'Alison
  // Project Settings > API
  url:    'https://sukgfnckxxllnhlcjlcs.supabase.co',
  anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1a2dmbmNreHhsbG5obGNqbGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjg2MzYsImV4cCI6MjA5NzcwNDYzNn0.iyOqEjmnu-WKyFBav7aUVnOKHTs-011jIs7u0mzN2To',
};

/* ══════════════════════════════════════════════════════════════
   CLIENT SUPABASE LÉGER (sans npm — vanilla JS)
   Utilise l'API REST Supabase directement
══════════════════════════════════════════════════════════════ */
const SupaClient = {
  _token: null,
  _userId: null,

  /* ── Headers ── */
  headers(extra = {}) {
    const h = {
      'Content-Type':  'application/json',
      'apikey':        AURA_DB_CONFIG.anonKey,
      'Authorization': `Bearer ${this._token || AURA_DB_CONFIG.anonKey}`,
      ...extra,
    };
    return h;
  },

  /* ── Auth : inscription ── */
  async signUp(email, password, name = 'Mon AURA') {
    const res  = await fetch(`${AURA_DB_CONFIG.url}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': AURA_DB_CONFIG.anonKey },
      body: JSON.stringify({ email, password, data: { name } }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.msg);
    if (data.access_token) {
      this._token  = data.access_token;
      this._userId = data.user?.id;
      this._saveSession(data);
    }
    return data;
  },

  /* ── Auth : connexion ── */
  async signIn(email, password) {
    const res  = await fetch(`${AURA_DB_CONFIG.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': AURA_DB_CONFIG.anonKey },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.msg || 'Erreur connexion');
    this._token  = data.access_token;
    this._userId = data.user?.id;
    this._saveSession(data);
    return data;
  },

  /* ── Auth : déconnexion ── */
  async signOut() {
    await fetch(`${AURA_DB_CONFIG.url}/auth/v1/logout`, {
      method: 'POST', headers: this.headers(),
    }).catch(() => {});
    this._token  = null;
    this._userId = null;
    localStorage.removeItem('aura_session');
    localStorage.removeItem('aura_data_v2');
    localStorage.removeItem('aura_finance_v1');
  },

  /* ── Auth : refresh token ── */
  async refreshSession() {
    const s = this._loadSession();
    if (!s?.refresh_token) return false;
    try {
      const res  = await fetch(`${AURA_DB_CONFIG.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': AURA_DB_CONFIG.anonKey },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      const data = await res.json();
      if (data.access_token) {
        this._token  = data.access_token;
        this._userId = data.user?.id;
        this._saveSession(data);
        return true;
      }
    } catch(_) {}
    return false;
  },

  /* ── Session ── */
  _saveSession(data) {
    localStorage.setItem('aura_session', JSON.stringify({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      user:          data.user,
      expires_at:    Date.now() + (data.expires_in || 3600) * 1000,
    }));
  },
  _loadSession() {
    try { return JSON.parse(localStorage.getItem('aura_session') || 'null'); }
    catch(_) { return null; }
  },
  isLoggedIn() { return !!this._token && !!this._userId; },
  userId()     { return this._userId; },

  /* ── REST Query helpers ── */
  async select(table, filters = '', options = '') {
    const url = `${AURA_DB_CONFIG.url}/rest/v1/${table}?${filters}${options}`;
    const res  = await fetch(url, { headers: this.headers({ 'Prefer': 'return=representation' }) });
    if (!res.ok) throw new Error(`SELECT ${table}: ${res.status}`);
    return res.json();
  },

  async insert(table, data) {
    const res = await fetch(`${AURA_DB_CONFIG.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `INSERT ${table} failed`); }
    const result = await res.json();
    return Array.isArray(data) ? result : result[0];
  },

  async update(table, data, filter) {
    const res = await fetch(`${AURA_DB_CONFIG.url}/rest/v1/${table}?${filter}`, {
      method: 'PATCH',
      headers: this.headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `UPDATE ${table} failed`); }
    return res.json();
  },

  async upsert(table, data, onConflict = '') {
    const prefer = onConflict
      ? `return=representation,resolution=merge-duplicates`
      : 'return=representation';
    const res = await fetch(`${AURA_DB_CONFIG.url}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ''}`, {
      method: 'POST',
      headers: this.headers({ 'Prefer': prefer }),
      body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || `UPSERT ${table} failed`); }
    return res.json();
  },

  async delete(table, filter) {
    const res = await fetch(`${AURA_DB_CONFIG.url}/rest/v1/${table}?${filter}`, {
      method: 'DELETE', headers: this.headers(),
    });
    if (!res.ok) throw new Error(`DELETE ${table}: ${res.status}`);
    return true;
  },

  async rpc(fn, params = {}) {
    const res = await fetch(`${AURA_DB_CONFIG.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`RPC ${fn}: ${res.status}`);
    return res.json();
  },
};

/* ══════════════════════════════════════════════════════════════
   AURA SYNC — Synchronise localStorage ↔ Supabase
══════════════════════════════════════════════════════════════ */
const AuraSync = {

  uid() { return SupaClient.userId(); },

  /* ── Profil ── */
  async saveProfile(prefs) {
    if (!SupaClient.isLoggedIn()) return;
    await SupaClient.upsert('profiles', {
      id:            this.uid(),
      name:          prefs.name          || 'Mon AURA',
      sign:          prefs.sign          || 'vierge',
      affirmation:   prefs.affirmation   || '',
      gemini_key:    prefs.geminiKey     || '',
      home_module:   prefs.homeModule    || 'dashboard',
      theme:         prefs.theme         || 'light',
      accent_color:  prefs.accentColor   || '#7C3AED',
      foyer:         parseInt(prefs.foyer) || 1,
      appareils:     JSON.stringify(prefs.appareils || {}),
    }, 'id');
  },

  async loadProfile() {
    if (!SupaClient.isLoggedIn()) return null;
    const rows = await SupaClient.select('profiles', `id=eq.${this.uid()}`);
    return rows?.[0] || null;
  },

  /* ── XP ── */
  async saveXP(xpData) {
    if (!SupaClient.isLoggedIn()) return;
    await SupaClient.upsert('xp_data', {
      user_id:   this.uid(),
      total_xp:  xpData.total  || 0,
      today_xp:  xpData.today  || 0,
      last_date: xpData.lastDate || new Date().toISOString().slice(0,10),
      log:       JSON.stringify(xpData.log   || []),
      badges:    JSON.stringify(xpData.badges|| []),
      stats:     JSON.stringify(xpData.stats || {}),
    }, 'user_id');
  },

  async loadXP() {
    if (!SupaClient.isLoggedIn()) return null;
    const rows = await SupaClient.select('xp_data', `user_id=eq.${this.uid()}`);
    const row  = rows?.[0];
    if (!row) return null;
    return {
      total:    row.total_xp,
      today:    row.today_xp,
      lastDate: row.last_date,
      log:      JSON.parse(row.log    || '[]'),
      badges:   JSON.parse(row.badges || '[]'),
      stats:    JSON.parse(row.stats  || '{}'),
    };
  },

  /* ── Finance — Revenus ── */
  async addRevenu(item) {
    if (!SupaClient.isLoggedIn()) return null;
    return SupaClient.insert('finance_revenus', {
      user_id:   this.uid(),
      label:     item.label,
      categorie: item.cat,
      montant:   item.montant,
      date_op:   item.date || new Date().toISOString().slice(0,10),
      recurrent: item.recurrent || false,
    });
  },

  async loadRevenus() {
    if (!SupaClient.isLoggedIn()) return [];
    return SupaClient.select('finance_revenus', `user_id=eq.${this.uid()}`, '&order=date_op.desc');
  },

  async deleteRevenu(id) {
    if (!SupaClient.isLoggedIn()) return;
    return SupaClient.delete('finance_revenus', `id=eq.${id}&user_id=eq.${this.uid()}`);
  },

  /* ── Finance — Charges ── */
  async addCharge(item) {
    if (!SupaClient.isLoggedIn()) return null;
    return SupaClient.insert('finance_charges', {
      user_id:   this.uid(),
      label:     item.label,
      categorie: item.cat,
      montant:   item.montant,
      ic:        item.ic    || 'ti-receipt',
      icolor:    item.icolor|| '#64748B',
      color:     item.color || '#F8F7FF',
      period:    item.period|| 'Mensuel',
    });
  },

  async loadCharges() {
    if (!SupaClient.isLoggedIn()) return [];
    return SupaClient.select('finance_charges', `user_id=eq.${this.uid()}&actif=eq.true`, '&order=created_at.asc');
  },

  async deleteCharge(id) {
    if (!SupaClient.isLoggedIn()) return;
    return SupaClient.delete('finance_charges', `id=eq.${id}&user_id=eq.${this.uid()}`);
  },

  /* ── Finance — Dépenses ── */
  async addDepense(item) {
    if (!SupaClient.isLoggedIn()) return null;
    return SupaClient.insert('finance_depenses', {
      user_id:   this.uid(),
      label:     item.label,
      categorie: item.cat,
      montant:   item.montant,
      date_op:   item.date || new Date().toISOString().slice(0,10),
    });
  },

  async loadDepenses(mois) {
    if (!SupaClient.isLoggedIn()) return [];
    const filter = mois
      ? `user_id=eq.${this.uid()}&date_op=gte.${mois}-01&date_op=lte.${mois}-31`
      : `user_id=eq.${this.uid()}`;
    return SupaClient.select('finance_depenses', filter, '&order=date_op.desc');
  },

  async deleteDepense(id) {
    if (!SupaClient.isLoggedIn()) return;
    return SupaClient.delete('finance_depenses', `id=eq.${id}&user_id=eq.${this.uid()}`);
  },

  /* ── Finance — Cagnottes ── */
  async saveCagnotte(item) {
    if (!SupaClient.isLoggedIn()) return null;
    if (item.db_id) {
      return SupaClient.update('finance_cagnottes', {
        montant: item.montant, mensuel: item.mensuel,
      }, `id=eq.${item.db_id}&user_id=eq.${this.uid()}`);
    }
    return SupaClient.insert('finance_cagnottes', {
      user_id:    this.uid(),
      emoji:      item.emoji     || '💰',
      name:       item.name,
      montant:    item.montant   || 0,
      cible:      item.cible,
      mensuel:    item.mensuel   || 0,
      color_from: item.color?.[0]|| '#7C3AED',
      color_to:   item.color?.[1]|| '#5B21B6',
    });
  },

  async loadCagnottes() {
    if (!SupaClient.isLoggedIn()) return [];
    return SupaClient.select('finance_cagnottes', `user_id=eq.${this.uid()}`, '&order=created_at.asc');
  },

  /* ── Rituels ── */
  async saveRituel(data) {
    if (!SupaClient.isLoggedIn()) return null;
    return SupaClient.upsert('rituels', {
      user_id:     this.uid(),
      date_rituel: data.date || new Date().toISOString().slice(0,10),
      humeur:      data.humeur      || 3,
      gratitudes:  data.gratitudes  || '',
      intention:   data.intention   || '',
      affirmation: data.affirmation || '',
      ancre_q:     data.ancreQ      || '',
      ancre_aff:   data.ancreAff    || '',
    }, 'user_id,date_rituel');
  },

  async loadRituels(limit = 30) {
    if (!SupaClient.isLoggedIn()) return [];
    return SupaClient.select('rituels', `user_id=eq.${this.uid()}`, `&order=date_rituel.desc&limit=${limit}`);
  },

  /* ── Habitudes ── */
  async saveHabitudeLog(habitudeId, done = true) {
    if (!SupaClient.isLoggedIn()) return null;
    return SupaClient.upsert('habitudes_log', {
      user_id:     this.uid(),
      habitude_id: habitudeId,
      date_log:    new Date().toISOString().slice(0,10),
      done,
    }, 'user_id,habitude_id,date_log');
  },

  async loadHabitudesLog(depuis) {
    if (!SupaClient.isLoggedIn()) return [];
    const filter = depuis
      ? `user_id=eq.${this.uid()}&date_log=gte.${depuis}`
      : `user_id=eq.${this.uid()}`;
    return SupaClient.select('habitudes_log', filter, '&order=date_log.desc');
  },

  /* ── Sphères ── */
  async saveSphere(sphere, score, notes = '') {
    if (!SupaClient.isLoggedIn()) return null;
    return SupaClient.upsert('spheres_scores', {
      user_id: this.uid(), sphere, score, notes,
    }, 'user_id,sphere');
  },

  async loadSpheres() {
    if (!SupaClient.isLoggedIn()) return [];
    return SupaClient.select('spheres_scores', `user_id=eq.${this.uid()}`);
  },

  /* ── Liste de courses ── */
  async addCourse(item) {
    if (!SupaClient.isLoggedIn()) return null;
    return SupaClient.insert('liste_courses', {
      user_id:  this.uid(),
      label:    item.label,
      categorie:item.categorie || 'Épicerie',
      quantite: item.quantite  || '×1',
      done:     false,
      semaine:  new Date().toISOString().slice(0,10),
    });
  },

  async toggleCourse(id, done) {
    if (!SupaClient.isLoggedIn()) return null;
    return SupaClient.update('liste_courses', { done }, `id=eq.${id}&user_id=eq.${this.uid()}`);
  },

  async loadCourses() {
    if (!SupaClient.isLoggedIn()) return [];
    const lundi = _getLundi();
    return SupaClient.select('liste_courses', `user_id=eq.${this.uid()}&semaine=gte.${lundi}`, '&order=done.asc,created_at.asc');
  },

  /* ── Synthèses ── */
  async saveSynthese(type, periode, contenu, iaAnalyse = '') {
    if (!SupaClient.isLoggedIn()) return null;
    const token = Math.random().toString(36).slice(2, 10);
    return SupaClient.insert('syntheses', {
      user_id:    this.uid(),
      type, periode,
      contenu:    JSON.stringify(contenu),
      ia_analyse: iaAnalyse,
      xp_total:   contenu.xp_total   || 0,
      score_vie:  contenu.score_vie  || 0,
      partage:    false,
      share_token:token,
    });
  },

  async loadSyntheses(limit = 10) {
    if (!SupaClient.isLoggedIn()) return [];
    return SupaClient.select('syntheses', `user_id=eq.${this.uid()}`, `&order=created_at.desc&limit=${limit}`);
  },

  async togglePartage(id, partage) {
    if (!SupaClient.isLoggedIn()) return null;
    return SupaClient.update('syntheses', { partage }, `id=eq.${id}&user_id=eq.${this.uid()}`);
  },

  async loadSynthesePartagee(token) {
    // Accessible SANS auth (lecture publique si partagée)
    const rows = await SupaClient.select('syntheses', `share_token=eq.${token}&partage=eq.true`);
    return rows?.[0] || null;
  },

  /* ── Sync complète : localStorage → Supabase ──
     IMPORTANT — ne couvre QUE le profil et le XP. Chaque module
     (Agenda, Maison, Cuisine, Vision Board, Habitudes, Patrimoine...)
     gère sa propre synchronisation individuelle via ses fonctions
     syncXToDB() dédiées. pushAll() n'est donc pas une sauvegarde
     complète de toute l'app — son nom peut laisser croire le
     contraire, gardé tel quel pour ne pas casser les appels
     existants (AuraAuth.register/logout), mais à interpréter
     comme "synchronise le profil et le XP", pas "synchronise tout". */
  async pushAll() {
    if (!SupaClient.isLoggedIn()) return;
    console.log('[AuraSync] Push localStorage → Supabase (profil + XP uniquement — les autres modules se synchronisent individuellement)...');
    try {
      // Profil
      const d = AuraStore?.get();
      if (d?.prefs) await this.saveProfile(d.prefs);
      // XP
      if (d?.xp)  await this.saveXP({ ...d.xp, log: d.log, badges: d.earnedBadges, stats: d.stats });
      console.log('[AuraSync] Push OK');
    } catch(e) {
      console.warn('[AuraSync] Push partiel:', e.message);
    }
  },

  /* ── Sync complète : Supabase → localStorage ──
     Même remarque que pushAll() : ne récupère que profil + XP au
     login. Les données de chaque module (finances, habitudes,
     rituels...) sont rapatriées séparément par le syncFromDB() propre
     à chaque module, lors de sa première visite après connexion. */
  async pullAll() {
    if (!SupaClient.isLoggedIn()) return;
    console.log('[AuraSync] Pull Supabase → localStorage (profil + XP uniquement — les autres modules se synchronisent individuellement)...');
    try {
      const [profile, xp] = await Promise.all([this.loadProfile(), this.loadXP()]);
      if (profile && window.AuraStore) {
        const d = AuraStore.get();
        if (profile.name)        d.prefs.name        = profile.name;
        if (profile.sign)        d.prefs.sign        = profile.sign;
        if (profile.affirmation) d.prefs.affirmation = profile.affirmation;
        if (profile.gemini_key)  d.prefs.geminiKey   = profile.gemini_key;
        if (profile.home_module) d.prefs.homeModule  = profile.home_module;
        if (profile.theme)       d.prefs.theme       = profile.theme;
        if (profile.accent_color) d.prefs.accentColor = profile.accent_color;
        AuraStore.save();
      }
      console.log('[AuraSync] Pull OK');
    } catch(e) {
      console.warn('[AuraSync] Pull partiel:', e.message);
    }
  },
};

/* ══════════════════════════════════════════════════════════════
   AURA AUTH UI — Gestion connexion / inscription
══════════════════════════════════════════════════════════════ */
const AuraAuth = {

  /* ── Vérifier et restaurer la session au démarrage ── */
  async init() {
    const s = SupaClient._loadSession();
    if (!s) return false;
    // Token expiré → refresh
    if (Date.now() > (s.expires_at || 0)) {
      const ok = await SupaClient.refreshSession();
      if (!ok) return false;
    } else {
      SupaClient._token  = s.access_token;
      SupaClient._userId = s.user?.id;
    }
    // Synchroniser depuis Supabase
    await AuraSync.pullAll();
    return true;
  },

  /* ── Connexion ── */
  async login(email, password) {
    await SupaClient.signIn(email, password);
    await AuraSync.pullAll();
    try { localStorage.setItem('aura_onboarding_done_v1', 'true'); } catch(_) {}
    AuraUI?.showToast?.('✓ Connectée — Bienvenue dans ton AURA');
  },

  /* ── Inscription : nouveau compte, l'onboarding pourra s'afficher juste après ── */
  async register(email, password, name) {
    await SupaClient.signUp(email, password, name);
    await AuraSync.pushAll();
    AuraUI?.showToast?.('✦ Compte AURA créé — Bienvenue !');
  },

  /* ── Déconnexion ── */
  async logout() {
    await AuraSync.pushAll(); // Sauvegarder avant de partir
    await SupaClient.signOut();
    location.reload();
  },

  /* ── Afficher l'écran de connexion par PIN ──
     Principe : l'email est le VRAI identifiant Supabase (garantit l'unicité
     et permet une récupération de compte classique). Le PIN sert uniquement
     de mot de passe technique pour les connexions rapides du quotidien.
     Sur un appareil donné, une fois connectée, l'app retient quel email
     correspond au PIN tapé (mapping local, jamais le mot de passe) pour
     permettre une reconnexion en 4 chiffres sans retaper l'email. */
  _pinBuffer: '',
  _pinName: '',
  _pinEmail: '',
  _authStep: 'check', // 'check' | 'pin-known' | 'register' | 'pin-only'
  _knownEmailKey: 'aura_known_email_v1',

  showLoginModal() {
    const existing = document.getElementById('aura-auth-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div id="aura-auth-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:1.25rem">
        <div style="background:var(--white);border-radius:24px;padding:2rem 1.75rem;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,.2);text-align:center">

          <div style="width:52px;height:52px;background:linear-gradient(135deg,#A78BFA,#7C3AED);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;box-shadow:0 8px 20px rgba(124,58,237,.3)">
            <i class="ti ti-sun" style="color:#fff;font-size:24px"></i>
          </div>
          <div style="font-size:19px;font-weight:800;color:var(--text)">AURA</div>
          <div id="pin-step-label" style="font-size:12px;color:var(--t2);margin-top:4px;margin-bottom:1.5rem">Chargement...</div>

          <!-- Étape A : reconnexion rapide (email déjà connu sur cet appareil) -->
          <div id="pin-step-quickpin" style="display:none">
            <div id="pin-dots" style="display:flex;gap:12px;justify-content:center;margin-bottom:1.5rem"></div>
            <div id="pin-keypad-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:1rem"></div>
            <div id="pin-error" style="color:var(--re);font-size:12px;margin-bottom:.5rem;display:none"></div>
            <button onclick="AuraAuth.forgetThisAccount()" style="background:none;border:none;font-size:12px;color:var(--t3);cursor:pointer;text-decoration:underline">
              Ce n'est pas moi — utiliser un autre compte
            </button>
          </div>

          <!-- Étape B : premier accès sur cet appareil — email + prénom -->
          <div id="pin-step-email" style="display:none">
            <input id="pin-email-input" type="email" placeholder="Ton adresse email" autocomplete="email"
              style="width:100%;font-size:14px;padding:12px 14px;border-radius:14px;border:1.5px solid var(--bd2);background:var(--bg);color:var(--text);outline:none;text-align:center;margin-bottom:.75rem;font-family:var(--font)">
            <input id="pin-name-input" type="text" placeholder="Ton prénom" autocomplete="name"
              style="width:100%;font-size:14px;padding:12px 14px;border-radius:14px;border:1.5px solid var(--bd2);background:var(--bg);color:var(--text);outline:none;text-align:center;margin-bottom:1rem;font-family:var(--font)"
              onkeydown="if(event.key==='Enter')AuraAuth.pinGoToKeypad()">
            <div id="email-error" style="color:var(--re);font-size:12px;margin-bottom:.75rem;display:none"></div>
            <button onclick="AuraAuth.pinGoToKeypad()" style="width:100%;padding:13px;border-radius:14px;background:linear-gradient(135deg,#8B5CF6,#7C3AED);color:#fff;border:none;cursor:pointer;font-size:14px;font-weight:700;box-shadow:0 8px 20px rgba(124,58,237,.3)">
              Continuer
            </button>
            <div style="font-size:10.5px;color:var(--t3);margin-top:.875rem;line-height:1.5">
              Ton email sert uniquement à sécuriser ton compte et le retrouver si besoin. Ensuite, tu te connecteras juste avec ton PIN.
            </div>
          </div>

          <!-- Étape C : création du PIN (4 chiffres, après l'email) -->
          <div id="pin-step-create" style="display:none">
            <div id="pin-dots-create" style="display:flex;gap:12px;justify-content:center;margin-bottom:1.5rem"></div>
            <div id="pin-keypad-grid-create" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:1rem"></div>
            <div id="pin-create-error" style="color:var(--re);font-size:12px;margin-bottom:.5rem;display:none"></div>
            <button onclick="AuraAuth.pinBackToEmail()" style="background:none;border:none;font-size:12px;color:var(--t3);cursor:pointer;text-decoration:underline">
              ← Retour
            </button>
          </div>

          <div id="pin-bottom-actions" style="margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid var(--bd)">
            <button onclick="AuraAuth.continueOffline()" style="background:none;border:none;font-size:11px;color:var(--t3);cursor:pointer;text-decoration:underline">
              Continuer sans compte (mode local)
            </button>
          </div>
        </div>
      </div>`);
    this.startAuthFlow();
  },

  /* ── Détermine le bon point de départ selon ce que l'appareil connaît déjà ── */
  startAuthFlow() {
    let known = null;
    try { known = JSON.parse(localStorage.getItem(this._knownEmailKey) || 'null'); } catch(_) {}

    if (known?.email && known?.name) {
      // Cet appareil a déjà un compte associé → connexion rapide par PIN seul
      this._pinEmail = known.email;
      this._pinName  = known.name;
      this._authStep = 'pin-known';
      this._pinBuffer = '';
      document.getElementById('pin-step-label').textContent = `Bon retour, ${known.name} ✦`;
      document.getElementById('pin-step-quickpin').style.display = 'block';
      this.renderPinKeypad('pin-keypad-grid', 'pinPress');
      this.renderPinDots('pin-dots', 4);
    } else {
      // Premier accès sur cet appareil → email + prénom
      this._authStep = 'register';
      document.getElementById('pin-step-label').textContent = 'Crée ton AURA ou connecte-toi';
      document.getElementById('pin-step-email').style.display = 'block';
    }
  },

  forgetThisAccount() {
    localStorage.removeItem(this._knownEmailKey);
    this._pinName = ''; this._pinEmail = ''; this._pinBuffer = '';
    document.getElementById('pin-step-quickpin').style.display = 'none';
    document.getElementById('pin-step-email').style.display = 'block';
    document.getElementById('pin-step-label').textContent = 'Crée ton AURA ou connecte-toi';
  },

  /* ── Étape email/prénom → passage à la création du PIN ── */
  pinGoToKeypad() {
    const email = document.getElementById('pin-email-input')?.value?.trim();
    const name  = document.getElementById('pin-name-input')?.value?.trim();
    const errEl = document.getElementById('email-error');
    if (!email || !email.includes('@')) { errEl.textContent='Entre une adresse email valide'; errEl.style.display='block'; return; }
    if (!name) { errEl.textContent='Entre ton prénom'; errEl.style.display='block'; return; }
    errEl.style.display = 'none';

    this._pinEmail = email.toLowerCase();
    this._pinName  = name;
    this._pinBuffer = '';

    document.getElementById('pin-step-email').style.display = 'none';
    document.getElementById('pin-step-create').style.display = 'block';
    document.getElementById('pin-step-label').textContent = `Choisis un code PIN à 4 chiffres`;
    this.renderPinKeypad('pin-keypad-grid-create', 'pinCreatePress');
    this.renderPinDots('pin-dots-create', 4);
  },

  pinBackToEmail() {
    this._pinBuffer = '';
    document.getElementById('pin-step-create').style.display = 'none';
    document.getElementById('pin-step-email').style.display = 'block';
    document.getElementById('pin-step-label').textContent = 'Crée ton AURA ou connecte-toi';
  },

  /* ── Clavier générique réutilisable ── */
  renderPinKeypad(gridId, handlerName) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
    grid.innerHTML = keys.map(k => {
      if (k === '') return '<div></div>';
      const isDelete = k === '⌫';
      return `<button onclick="AuraAuth.${handlerName}('${k}')" style="aspect-ratio:1;border-radius:16px;border:1.5px solid var(--bd2);background:var(--bg);font-size:${isDelete?'16':'18'}px;font-weight:700;color:var(--text);cursor:pointer;transition:all .12s" onmousedown="this.style.background='var(--pu-l)'" onmouseup="this.style.background='var(--bg)'">${k}</button>`;
    }).join('');
  },

  renderPinDots(dotsId, length) {
    const el = document.getElementById(dotsId);
    if (!el) return;
    el.innerHTML = Array.from({length}, (_,i) => {
      const filled = i < this._pinBuffer.length;
      return `<div style="width:14px;height:14px;border-radius:50%;border:2px solid var(--pu);background:${filled?'var(--pu)':'transparent'};transition:all .15s"></div>`;
    }).join('');
  },

  /* ── Saisie PIN : reconnexion rapide (compte déjà connu sur cet appareil) ── */
  pinPress(key) {
    document.getElementById('pin-error').style.display = 'none';
    if (key === '⌫') { this._pinBuffer = this._pinBuffer.slice(0,-1); this.renderPinDots('pin-dots',4); return; }
    if (this._pinBuffer.length >= 4) return;
    this._pinBuffer += key;
    this.renderPinDots('pin-dots',4);
    if (this._pinBuffer.length === 4) setTimeout(() => this.pinSubmitKnown(), 200);
  },

  /* ── Saisie PIN : création initiale (après email+prénom) ── */
  pinCreatePress(key) {
    document.getElementById('pin-create-error').style.display = 'none';
    if (key === '⌫') { this._pinBuffer = this._pinBuffer.slice(0,-1); this.renderPinDots('pin-dots-create',4); return; }
    if (this._pinBuffer.length >= 4) return;
    this._pinBuffer += key;
    this.renderPinDots('pin-dots-create',4);
    if (this._pinBuffer.length === 4) setTimeout(() => this.pinSubmitCreate(), 200);
  },

  /* ── Transforme email + PIN en mot de passe technique (≥6 caractères) ── */
  _pinToPassword(email, pin) {
    return `aurapin-${pin}-${email.replace(/[^a-z0-9]/g,'')}-secure`;
  },

  _rememberOnThisDevice(email, name) {
    try { localStorage.setItem(this._knownEmailKey, JSON.stringify({ email, name })); } catch(_) {}
  },

  /* ── Soumission : reconnexion rapide (compte déjà connu) ── */
  async pinSubmitKnown() {
    const password = this._pinToPassword(this._pinEmail, this._pinBuffer);
    const errEl = document.getElementById('pin-error');
    try {
      await this.login(this._pinEmail, password);
      document.getElementById('aura-auth-modal')?.remove();
      AuraStore?.set?.('prefs.name', this._pinName);
      AuraApp?.loadModule?.('dashboard');
    } catch(e) {
      this._pinBuffer = '';
      this.renderPinDots('pin-dots',4);
      errEl.textContent = 'PIN incorrect — réessaie';
      errEl.style.display = 'block';
    }
  },

  /* ── Soumission : création du compte (email + prénom + nouveau PIN) ── */
  async pinSubmitCreate() {
    const password = this._pinToPassword(this._pinEmail, this._pinBuffer);
    const errEl = document.getElementById('pin-create-error');
    try {
      await this.register(this._pinEmail, password, this._pinName);
      this._rememberOnThisDevice(this._pinEmail, this._pinName);
      document.getElementById('aura-auth-modal')?.remove();
      AuraStore?.set?.('prefs.name', this._pinName);
      AuraApp?.loadModule?.('dashboard');
    } catch(registerErr) {
      const msg = (registerErr.message||'').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        // Email déjà utilisé → on tente une connexion avec ce PIN (cas : nouvel appareil, compte existant)
        try {
          await this.login(this._pinEmail, password);
          this._rememberOnThisDevice(this._pinEmail, this._pinName);
          document.getElementById('aura-auth-modal')?.remove();
          AuraStore?.set?.('prefs.name', this._pinName);
          AuraApp?.loadModule?.('dashboard');
        } catch(loginErr) {
          this._pinBuffer = '';
          this.renderPinDots('pin-dots-create',4);
          errEl.textContent = 'Cet email a déjà un compte avec un autre PIN';
          errEl.style.display = 'block';
        }
      } else {
        this._pinBuffer = '';
        this.renderPinDots('pin-dots-create',4);
        errEl.textContent = 'Erreur — vérifie ta connexion internet';
        errEl.style.display = 'block';
      }
    }
  },

  continueOffline() {
    document.getElementById('aura-auth-modal')?.remove();
    AuraUI?.showToast?.('Mode local activé — données non sauvegardées en ligne');
  },

  /* ── Afficher le bouton profil dans la sidebar selon l'état ── */
  updateSidebarAuth() {
    const footer = document.getElementById('sb-footer-btn');
    if (!footer) return;
    const name = AuraStore?.get()?.prefs?.name || 'Mon AURA';
    document.getElementById('sb-user-name') && (document.getElementById('sb-user-name').textContent = name);
    if (SupaClient.isLoggedIn()) {
      document.getElementById('sb-user-level') && (document.getElementById('sb-user-level').textContent = '✓ Connectée');
    } else {
      document.getElementById('sb-user-level') && (document.getElementById('sb-user-level').textContent = 'Mode local · non connecté');
    }
  },
};

/* ══════════════════════════════════════════════════════════════
   GÉNÉRATEUR DE SYNTHÈSES
══════════════════════════════════════════════════════════════ */
const AuraSynthese = {

  /* ── Générer la synthèse hebdomadaire ── */
  async genererHebdo() {
    const d      = AuraStore?.get() || {};
    const fin    = JSON.parse(localStorage.getItem('aura_finance_v1') || '{}');
    const periode = _semaineStr();

    // Score de vie honnête, calculé par aura-scores.js (moyenne des 8
    // sphères, manuelles ou automatiques selon le module) — remplace
    // l'ancien système niveau/XP qui n'existe plus depuis le retrait
    // de la gamification. AuraXP n'a jamais été redéfini ailleurs après
    // ce retrait, donc AuraXP?.getLevel?.() retournait toujours
    // undefined silencieusement, laissant "niveau" et "niveau_nom"
    // vides dans chaque synthèse générée jusqu'ici.
    const scoreVie = window.AuraScores?.globalScore?.() ?? null;

    const contenu = {
      periode,
      score_vie:  scoreVie, // peut être null si aucune sphère n'a encore de donnée — affiché honnêtement comme tel, jamais une valeur inventée
      rituels:    d.stats?.rituels || 0,
      streak:     d.stats?.streak  || 0,
      revenus:    (fin.revenus  || []).reduce((s,x)=>s+x.montant,0),
      charges:    (fin.charges  || []).reduce((s,x)=>s+x.montant,0),
      depenses:   (fin.depenses || []).reduce((s,x)=>s+x.montant,0),
      epargne:    (fin.epargne  || []).reduce((s,x)=>s+(x.mensuel||0),0),
    };

    // Analyse IA si disponible
    let iaAnalyse = '';
    const geminiKey = AuraStore?.getGeminiKey?.();
    if (geminiKey && geminiKey !== 'VOTRE_CLE_GEMINI') {
      try {
        AURA_GEMINI.API_KEY = geminiKey;
        iaAnalyse = await AURA_GEMINI.call({
          system: 'Tu es le Coach AURA. Tu génères des synthèses hebdomadaires bienveillantes et motivantes.',
          prompt: `Synthèse de la semaine ${periode} :
- Score de vie global : ${contenu.score_vie !== null ? contenu.score_vie + '/100' : 'pas encore calculé'}
- Rituels complétés : ${contenu.rituels}
- Streak habitudes : ${contenu.streak} jours
- Revenus : ${contenu.revenus} €
- Dépenses : ${contenu.depenses} €
- Épargne : ${contenu.epargne} €

Génère une synthèse courte (3-4 phrases), encourageante, avec 1 conseil actionnable pour la semaine prochaine.`,
          maxTokens: 300,
        });
      } catch(_) {}
    }

    // Sauvegarder en BDD si connectée
    if (SupaClient.isLoggedIn()) {
      await AuraSync.saveSynthese('hebdo', periode, contenu, iaAnalyse);
    }

    return { contenu, iaAnalyse };
  },

  /* ── Afficher une synthèse dans un modal ── */
  async afficherModal(type = 'hebdo') {
    AuraUI?.showToast?.('✦ Génération de ta synthèse...');
    const s = await this.genererHebdo();
    const c = s.contenu;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="synthese-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)" onclick="document.getElementById('synthese-modal').remove()">
        <div style="background:var(--white);border-radius:var(--r-xl);padding:1.75rem;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)" onclick="event.stopPropagation()">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.25rem">
            <div style="width:40px;height:40px;border-radius:10px;background:var(--pu);display:flex;align-items:center;justify-content:center"><i class="ti ti-trophy" style="color:#fff;font-size:18px"></i></div>
            <div>
              <div style="font-size:15px;font-weight:800;color:var(--text)">Synthèse ${type === 'hebdo' ? 'hebdomadaire' : 'mensuelle'}</div>
              <div style="font-size:11px;color:var(--t2)">${c.periode}</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1.25rem">
            ${[['🌟','Score de vie',c.score_vie!==null?c.score_vie+'/100':'—','var(--pu-l)','var(--pu-d)'],['☀️','Rituels',c.rituels+' complétés','var(--gr-l)','var(--gr)'],['🔥','Streak',c.streak+' jours','#FFF7ED','#C2410C'],['💰','Revenus',_fmt(c.revenus),'var(--gr-l)','var(--gr)'],['💳','Dépenses',_fmt(c.depenses),'var(--re-l)','var(--re)'],['🏦','Épargne',_fmt(c.epargne),'var(--bl-l)','var(--bl)']].map(([ico,lbl,val,bg,col])=>`
            <div style="background:${bg};border-radius:var(--r-md);padding:.75rem;text-align:center">
              <div style="font-size:18px;margin-bottom:3px">${ico}</div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--t3)">${lbl}</div>
              <div style="font-size:14px;font-weight:800;color:${col};margin-top:2px">${val}</div>
            </div>`).join('')}
          </div>

          ${s.iaAnalyse ? `
          <div style="background:var(--pu-l);border:1px solid var(--pu-b);border-radius:var(--r-md);padding:1rem;margin-bottom:1.25rem">
            <div style="font-size:11px;font-weight:700;color:var(--pu-d);margin-bottom:.5rem">✦ Coach AURA — Analyse IA</div>
            <div style="font-size:12px;color:var(--text);line-height:1.6">${s.iaAnalyse.replace(/\n/g,'<br>')}</div>
          </div>` : ''}

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="AuraSynthese.partager()" style="flex:1;padding:9px;border-radius:var(--r-md);background:var(--gr);color:#fff;border:none;cursor:pointer;font-weight:700;font-size:12px"><i class="ti ti-share"></i> Partager</button>
            <button onclick="AuraSynthese.exporter()" style="flex:1;padding:9px;border-radius:var(--r-md);background:var(--pu-l);color:var(--pu-d);border:1px solid var(--pu-b);cursor:pointer;font-weight:700;font-size:12px"><i class="ti ti-download"></i> Exporter</button>
            <button onclick="document.getElementById('synthese-modal').remove()" style="flex:1;padding:9px;border-radius:var(--r-md);background:var(--bg);color:var(--t2);border:1px solid var(--bd2);cursor:pointer;font-weight:700;font-size:12px">Fermer</button>
          </div>
        </div>
      </div>`);
  },

  /* ── Partager via lien ── */
  async partager() {
    const syntheses = SupaClient.isLoggedIn() ? await AuraSync.loadSyntheses(1) : [];
    if (syntheses.length && syntheses[0].share_token) {
      await AuraSync.togglePartage(syntheses[0].id, true);
      const lien = `${location.origin}${location.pathname}#synthese/${syntheses[0].share_token}`;
      navigator.clipboard.writeText(lien).catch(()=>{});
      AuraUI?.showToast?.('✓ Lien de partage copié !');
    } else {
      AuraUI?.showToast?.('Connecte-toi pour partager ta synthèse');
    }
  },

  /* ── Export texte ── */
  exporter() {
    const d   = AuraStore?.get() || {};
    const fin = JSON.parse(localStorage.getItem('aura_finance_v1') || '{}');
    const scoreVie = window.AuraScores?.globalScore?.();
    const txt = `AURA — Synthèse ${_semaineStr()}
==============================
Score de vie : ${scoreVie !== null && scoreVie !== undefined ? scoreVie + '/100' : 'non calculé'}
Rituels  : ${d.stats?.rituels || 0}
Streak   : ${d.stats?.streak  || 0} jours

FINANCES
Revenus  : ${_fmt((fin.revenus||[]).reduce((s,x)=>s+x.montant,0))}
Dépenses : ${_fmt((fin.depenses||[]).reduce((s,x)=>s+x.montant,0))}
Épargne  : ${_fmt((fin.epargne||[]).reduce((s,x)=>s+(x.mensuel||0),0))}

Généré par AURA — ${new Date().toLocaleDateString('fr-FR')}`;
    const a = document.createElement('a');
    a.href  = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
    a.download = `aura-synthese-${_semaineStr()}.txt`;
    a.click();
  },
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function _getLundi() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay()+6) % 7));
  return d.toISOString().slice(0,10);
}
function _semaineStr() {
  const d = new Date();
  const w = Math.ceil(d.getDate() / 7);
  return `${d.getFullYear()}-W${String(Math.ceil((d-new Date(d.getFullYear(),0,1))/(7*86400000))).padStart(2,'0')}`;
}
function _fmt(n) { return Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }

/* ══════════════════════════════════════════════════════════════
   INIT — Restaurer session au chargement
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  const isLoggedIn = await AuraAuth.init();
  AuraAuth.updateSidebarAuth();
  // Signale aux autres scripts (aura-onboarding.js notamment) que la
  // tentative de restauration de session est terminée, avec son résultat
  // réel — plus besoin de deviner via un setTimeout arbitraire qui peut
  // se déclencher avant la fin de l'appel réseau et rouvrir à tort
  // l'écran de connexion alors que la session était en cours de restauration.
  window.__auraSessionReady = true;
  window.__auraSessionLoggedIn = isLoggedIn;
  document.dispatchEvent(new CustomEvent('aura:session-ready', { detail: { isLoggedIn } }));
  // Note : l'ancien auto-affichage du modal de login a été retiré.
  // C'est maintenant aura-onboarding.js qui gère le premier contact avec l'utilisateur
  // (parcours de bienvenue), avec un lien "J'ai déjà un compte" qui ouvre ce modal.
});

/* ══════════════════════════════════════════════════════════════
   GLOBALS
══════════════════════════════════════════════════════════════ */
window.SupaClient    = SupaClient;
window.AuraSync      = AuraSync;
window.AuraAuth      = AuraAuth;
window.AuraSynthese  = AuraSynthese;
