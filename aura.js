/* ============================================================
   AURA — aura.js v3.0
   IA : Google Gemini (AI Studio) — gratuit
   Remplace tous les appels Anthropic
   ============================================================
   CONFIGURATION :
   1. Va sur https://aistudio.google.com/app/apikey
   2. Crée une clé API gratuite
   3. Remplace "VOTRE_CLE_GEMINI" ci-dessous
   ============================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════════
   🔑 CONFIGURATION — À RENSEIGNER
══════════════════════════════════════════════════════════════ */
const AURA_GEMINI = {
  // ⚠️  Remplace par ta clé Google AI Studio
  // https://aistudio.google.com/app/apikey
  API_KEY: 'VOTRE_CLE_GEMINI',

  // Modèle mis à jour pour éviter la 404 sur v1beta
MODEL: 'gemini-flash-latest',

  // Endpoint Gemini REST
  endpoint(model) {
    const key = localStorage.getItem('aura_gemini_key') || this.API_KEY;
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  },

  /* ── Appel central Gemini avec gestion de résilience (Retry automatique) ─────── */
  async call({ system = '', prompt, maxTokens = 800, json = false, retries = 2 }) {
    const parts = [{ text: system ? `${system}\n\n---\n${prompt}` : prompt }];
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.8,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    };

    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(this.endpoint(this.MODEL), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        // Gestion automatique des erreurs 503 (Surcharge) et 429 (Quota)
        if (res.status === 503 || res.status === 429) {
          if (i === retries) throw new Error(`Serveur indisponible (${res.status})`);
          // Attente progressive (1s, 2s) avant de réessayer
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(`Gemini ${res.status}: ${err.error?.message || 'Erreur inconnue'}`);
        }

        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
      } catch (err) {
        if (i === retries) throw err;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  },

  /* ── Parse JSON sécurisé (Corrigé pour éviter les erreurs de parsing) ─────────────── */
  parseJSON(text) {
    if (!text || typeof text !== 'string') return {};
    
    // 1. Nettoyage agressif des balises Markdown et espaces inutiles
    let clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // 2. Isoler la zone JSON si l'IA a ajouté du texte avant/après
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    
    if (start === -1 || end === -1) {
      console.error("Format JSON introuvable dans la réponse IA");
      return {};
    }
    
    clean = clean.substring(start, end + 1);

    try {
      return JSON.parse(clean);
    } catch (e) {
      console.error("Erreur de parsing JSON IA :", e, "\nContenu brut :", text);
      return {};
    }
  },

  /* ── Vérifier si la clé est configurée ─────────────────────── */
  isConfigured() {
    return this.API_KEY && this.API_KEY !== 'VOTRE_CLE_GEMINI';
  },
};

/* ══════════════════════════════════════════════════════════════
   CONFIG AURA
══════════════════════════════════════════════════════════════ */
const AURA_CONFIG = {
  storageKey: 'aura_data_v2',
  toastDuration: 2800,

  badges: [
    { id:'leve-tot',    icon:'🌅', name:'Lève-tôt',     desc:'7 rituels matins',       cond: d => (d.stats?.rituels||0)  >= 7   },
    { id:'epargnante',  icon:'💰', name:'Épargnante',    desc:'3 mois budget suivi',    cond: d => (d.stats?.budgets||0)  >= 3   },
    { id:'en-feu',      icon:'🔥', name:'En feu',        desc:'Streak 10+ jours',       cond: d => (d.stats?.streak||0)   >= 10  },
    { id:'architecte',  icon:'🏆', name:'Architecte',    desc:'Niveau 7 atteint',       cond: d => d.xp?.total            >= 4000 },
    { id:'flow',        icon:'🌊', name:'Flow',          desc:'21j hydratation',        cond: d => (d.stats?.hydra||0)    >= 21  },
    { id:'lectrice',    icon:'📖', name:'Lectrice',      desc:'10 sessions lecture',    cond: d => (d.stats?.lecture||0)  >= 10  },
    { id:'serenite',    icon:'🧘', name:'Sérénité',      desc:'20 méditations',         cond: d => (d.stats?.medita||0)   >= 20  },
    { id:'batisseuse',  icon:'🚀', name:'Bâtisseuse',    desc:'Cagnotte projet créée',  cond: d => (d.stats?.cagnottes||0)>= 1   },
    { id:'visionnaire', icon:'🌟', name:'Visionnaire',   desc:'Niveau 8 atteint',       cond: d => d.xp?.total            >= 5500 },
    { id:'investis',    icon:'📈', name:'Investisseuse', desc:'PEA 10 000 €',           cond: d => false                         },
    { id:'diamond',     icon:'💎', name:'Diamant',       desc:'Niveau 10 atteint',      cond: d => d.xp?.total            >= 10000},
    { id:'reine',       icon:'👑', name:'Reine',         desc:'Score vie 100/100',      cond: d => false                         },
  ],
};

/* ══════════════════════════════════════════════════════════════
   STORE LOCAL
══════════════════════════════════════════════════════════════ */
const AuraStore = {
  _data: null,

  get() {
    if (this._data) return this._data;
    try {
      const raw = localStorage.getItem(AURA_CONFIG.storageKey);
      if (raw) { this._data = JSON.parse(raw); return this._data; }
    } catch(_) {}
    this._data = {
      stats: { rituels:5, budgets:1, streak:12, hydra:21, lecture:8, medita:6, cagnottes:1 },
      prefs: {
        name:'Mon AURA',
        sign:'vierge',
        theme:'light',
        homeModule:'dashboard',
        affirmation:'Je suis alignée et en expansion',
        geminiKey: '',
      },
      earnedBadges: ['leve-tot','epargnante','en-feu','flow','lectrice','serenite','batisseuse'],
    };
    this.save();
    return this._data;
  },

  save() {
    try { localStorage.setItem(AURA_CONFIG.storageKey, JSON.stringify(this._data)); }
    catch(_) {}
  },

  set(path, val) {
    const d = this.get();
    _deepSet(d, path, val);
    this.save();
    return d;
  },

  getGeminiKey() {
    const fromPrefs = this.get().prefs?.geminiKey;
    return (fromPrefs && fromPrefs !== '') ? fromPrefs : AURA_GEMINI.API_KEY;
  },
};

/* ══════════════════════════════════════════════════════════════
   XP — désactivé intentionnellement (décision d'Alison)
   Toutes les méthodes existent toujours (pour ne pas faire planter
   les modules qui les appellent, comme coach.html), mais elles
   sont des no-op silencieux : aucune progression n'est enregistrée.
══════════════════════════════════════════════════════════════ */
const AuraXP = {
  getLevel() { return { cur: { n: 0, name: '' }, nxt: null, pct: 0 }; },
  earn(pts, label, icon) { return; }
};

/* ══════════════════════════════════════════════════════════════
   UI
══════════════════════════════════════════════════════════════ */
const AuraUI = {
  /* ── Pop satisfaisant sur un élément qu'on vient de cocher —
       appelable depuis n'importe quel module : AuraUI.pop(element) ── */
  pop(el) {
    if (!el) return;
    el.classList.remove('aura-pop');
    void el.offsetWidth; // force le navigateur à relancer l'animation même si elle vient de jouer
    el.classList.add('aura-pop');
  },

  /* ── Ripple tactile au clic — AuraUI.ripple(event) appelé en début
       de gestionnaire de clic sur un bouton avec la classe aura-ripple ── */
  ripple(evt) {
    const btn = evt?.currentTarget;
    if (!btn) return;
    btn.classList.add('aura-ripple');
    const rect = btn.getBoundingClientRect();
    const wave = document.createElement('span');
    const size = Math.max(rect.width, rect.height) * 1.4;
    // Teinte sombre sur fond clair (btn-pill, save-btn — souvent blancs),
    // teinte claire sur fond plein coloré (btn-primary, modal-btn.primary)
    // — sinon le ripple blanc serait quasi invisible sur fond blanc.
    const isFilled = btn.classList.contains('btn-primary') || (btn.classList.contains('modal-btn') && btn.classList.contains('primary'));
    wave.className = 'aura-ripple-wave' + (isFilled ? '' : ' dark');
    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${(evt.clientX ?? rect.left + rect.width/2) - rect.left - size/2}px`;
    wave.style.top  = `${(evt.clientY ?? rect.top + rect.height/2) - rect.top - size/2}px`;
    btn.appendChild(wave);
    setTimeout(() => wave.remove(), 520);
  },

  /* ── Incrémentation visuelle d'un chiffre — AuraUI.countUp(el, target)
       anime de 0 (ou de la valeur déjà affichée) jusqu'à la valeur
       finale, pour que les stats se sentent vivantes au chargement
       plutôt que d'apparaître figées d'un coup. ── */
  countUp(el, target, opts = {}) {
    if (!el) return;
    const duration = opts.duration || 700;
    const decimals = opts.decimals || 0;
    const suffix = opts.suffix || '';
    const prefix = opts.prefix || '';
    const start = parseFloat(el.dataset.countFrom) || 0;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = start + (target - start) * eased;
      el.textContent = prefix + current.toLocaleString('fr-FR', { minimumFractionDigits:decimals, maximumFractionDigits:decimals }) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
      else el.dataset.countFrom = target;
    }
    requestAnimationFrame(tick);
  },

  showToast(msg) {
    const t = document.getElementById('aura-xp-toast');
    const s = document.getElementById('aura-xp-msg');
    if (!t) return;
    if (s) s.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), AURA_CONFIG.toastDuration);
  },

  // No-op : le bandeau XP n'existe plus dans l'UI depuis la désactivation du système,
  // mais la fonction reste définie pour que main.js (qui l'appelle au démarrage et
  // après chaque navigation) ne plante jamais avec un "is not a function".
  updateXPDisplays() { return; },

  setActiveNav(mod) {
    document.querySelectorAll('.nav-item').forEach(el => {
      const dm = el.getAttribute('data-module') || el.getAttribute('href') || '';
      el.classList.toggle('active', dm === mod || dm === mod + '.html');
    });
  },

  dismissAlert(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.cssText += 'opacity:0;transition:opacity .2s';
    setTimeout(() => el.remove(), 220);
  },

  toggleCourse(cb) {
    cb.classList.toggle('on');
    const name = cb.parentElement?.querySelector('.ci-name');
    if (name) {
      const done = cb.classList.contains('on');
      name.classList.toggle('done', done);
    }
  },

  selectMood(el) {
    document.querySelectorAll('.mood').forEach(m => m.classList.remove('sel'));
    el.classList.add('sel');
  },

  toggleSwitch(btn) {
    btn.classList.toggle('on');
    btn.classList.toggle('off');
  },

  // Afficher une bannière "clé manquante" si pas configurée
  showKeyWarning(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <div style="text-align:center;padding:1.25rem;background:var(--am-l);border:1px solid var(--am-b);border-radius:var(--r-md)">
        <div style="font-size:20px;margin-bottom:6px">🔑</div>
        <div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:4px">Clé Google AI Studio manquante</div>
        <div style="font-size:12px;color:var(--t2);margin-bottom:.875rem;line-height:1.5">
          Va sur <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--pu)">aistudio.google.com</a> pour créer ta clé gratuite, puis renseigne-la dans les Paramètres AURA.
        </div>
        <button onclick="navigate('params')" class="btn-pill pu" style="margin:0 auto">
          <i class="ti ti-settings"></i> Aller dans les paramètres
        </button>
      </div>`;
  },
};

/* ══════════════════════════════════════════════════════════════
   SIMULATEURS
══════════════════════════════════════════════════════════════ */
const AuraSim = {
  epargne({ monthly, years, rate, resultId, subId }) {
    const m = +monthly || 0, y = +years || 0, r = (+rate / 100) || 0;
    const mo = y * 12, mr = r / 12;
    const total = mr === 0 ? m * mo : m * ((Math.pow(1 + mr, mo) - 1) / mr);
    _set(resultId, Math.round(total).toLocaleString('fr-FR') + ' €');
    if (subId) _set(subId, (m * mo).toLocaleString('fr-FR') + ' € versés');
    return total;
  },
  patrimoine({ base, monthly, years, rate, resultId }) {
    const r = +rate / 100 || 0, y = +years || 0;
    const bg = (+base || 0) * Math.pow(1 + r, y);
    const ns = this.epargne({ monthly, years, rate, resultId: null });
    _set(resultId, Math.round(bg + ns).toLocaleString('fr-FR') + ' €');
  },
};

/* ══════════════════════════════════════════════════════════════
   HOROSCOPE — Local + Gemini IA
══════════════════════════════════════════════════════════════ */
const AuraHoro = {
  signs: {
    belier:    { name:'Bélier',     emoji:'♈', dates:'21 mars – 19 avr',  element:'Feu',  planet:'Mars'    },
    taureau:   { name:'Taureau',    emoji:'♉', dates:'20 avr – 20 mai',   element:'Terre',planet:'Vénus'   },
    gemeaux:   { name:'Gémeaux',    emoji:'♊', dates:'21 mai – 20 juin',  element:'Air',  planet:'Mercure' },
    cancer:    { name:'Cancer',     emoji:'♋', dates:'21 juin – 22 juil', element:'Eau',  planet:'Lune'    },
    lion:      { name:'Lion',       emoji:'♌', dates:'23 juil – 22 août', element:'Feu',  planet:'Soleil'  },
    vierge:    { name:'Vierge',     emoji:'♍', dates:'23 août – 22 sept', element:'Terre',planet:'Mercure' },
    balance:   { name:'Balance',    emoji:'♎', dates:'23 sept – 22 oct',  element:'Air',  planet:'Vénus'   },
    scorpion:  { name:'Scorpion',   emoji:'♏', dates:'23 oct – 21 nov',   element:'Eau',  planet:'Pluton'  },
    sagittaire:{ name:'Sagittaire', emoji:'♐', dates:'22 nov – 21 déc',   element:'Feu',  planet:'Jupiter' },
    capricorne:{ name:'Capricorne', emoji:'♑', dates:'22 déc – 19 jan',   element:'Terre',planet:'Saturne' },
    verseau:   { name:'Verseau',    emoji:'♒', dates:'20 jan – 18 fév',   element:'Air',  planet:'Uranus'  },
    poissons:  { name:'Poissons',   emoji:'♓', dates:'19 fév – 20 mars',  element:'Eau',  planet:'Neptune' },
  },

  // Horoscope local (fallback sans API)
  getDaily(sign) {
    const pools = {
      amour:    ['Vénus illumine ton secteur des relations.','Une conversation sincère ouvre une porte inattendue.','Prends soin de tes liens aujourd\'hui.','L\'authenticité attire l\'amour qui te correspond.','Une nouvelle énergie relationnelle se lève.'],
      travail:  ['Ton intuition professionnelle est au sommet.','Un projet prend une nouvelle dimension créative.','La persévérance paie — continue.','Une opportunité se présente si tu restes ouverte.','Ta clarté d\'esprit impressionne aujourd\'hui.'],
      energie:  ['Vitalité maximale — profites-en pour avancer.','Écoute ton corps aujourd\'hui.','Recharge tes batteries avant d\'agir.','L\'élan est là — lance-toi.','Mouvement et respiration sont tes alliés.'],
      finances: ['Un mouvement financier favorable se profile.','Réfléchis avant une dépense impulsive.','L\'abondance se construit avec constance.','Bonne journée pour réviser tes objectifs d\'épargne.','La patience est ta meilleure stratégie financière.'],
      conseil:  ['Fais confiance au processus, même lentement.','La clarté vient après le silence.','Une ancre posée ce matin change toute ta journée.','Tu es exactement là où tu dois être.','Chaque petit pas compte plus que tu ne le crois.'],
    };
    const seed = (new Date().getDate() * 3 + sign.length * 7) % 5;
    return {
      amour:    pools.amour[seed],
      travail:  pools.travail[(seed + 1) % 5],
      energie:  pools.energie[(seed + 2) % 5],
      finances: pools.finances[(seed + 3) % 5],
      conseil:  pools.conseil[(seed + 4) % 5],
      stars:    3 + (seed % 3),
      energy:   ['Reposée', 'En montée', 'Maximale', 'Créative', 'Intuitive'][seed],
    };
  },

  // Rendu HTML local
  render(sign, containerId) {
    const info = this.signs[sign];
    const day  = this.getDaily(sign);
    const el   = document.getElementById(containerId);
    if (!el || !info) return;
    const stars = '⭐'.repeat(day.stars) + '☆'.repeat(5 - day.stars);
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:.875rem">
        <div style="font-size:32px">${info.emoji}</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text)">${info.name}</div>
          <div style="font-size:10px;color:var(--t3)">${info.dates} · ${info.element} · ${info.planet}</div>
          <div style="font-size:11px;color:var(--go);margin-top:2px">${stars} · Énergie : ${day.energy}</div>
        </div>
        <div style="margin-left:auto;font-size:10px;color:var(--t3);text-align:right">
          <div>Lecture locale</div>
          <button onclick="AuraHoro.getAI('${sign}','${containerId}')" style="margin-top:4px;font-size:10px;padding:2px 8px;border-radius:10px;border:1px solid var(--pu);background:var(--pu-l);color:var(--pu-d);cursor:pointer;font-weight:700">✨ IA</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        ${[['💞','Amour',day.amour],['💼','Travail',day.travail],['🌿','Énergie',day.energie],['💰','Finances',day.finances]].map(([ico,cat,msg]) => `
        <div style="display:flex;gap:8px;padding:.5rem;background:var(--bg);border-radius:var(--r-md);border:1px solid var(--bd)">
          <span style="font-size:14px;flex-shrink:0">${ico}</span>
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">${cat}</div>
            <div style="font-size:12px;color:var(--text);margin-top:2px;line-height:1.4">${msg}</div>
          </div>
        </div>`).join('')}
      </div>
      <div style="margin-top:.75rem;padding:.75rem;background:var(--pu-l);border:1px solid var(--pu-b);border-radius:var(--r-md);font-size:12px;color:var(--pu-d);line-height:1.5;font-style:italic">
        ✦ ${day.conseil}
      </div>`;
  },

  // Horoscope IA via Gemini — enrichi et personnalisé
  async getAI(sign, containerId) {
    const el   = document.getElementById(containerId);
    const info = this.signs[sign];
    if (!el || !info) return;

    const key = AuraStore.getGeminiKey();
    if (!key || key === 'VOTRE_CLE_GEMINI') {
      AuraUI.showKeyWarning(containerId);
      return;
    }

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:1.5rem;color:var(--t3)">
        <span style="font-size:20px;animation:auraPulse 1.2s infinite">✨</span>
        <span style="font-size:12px;font-style:italic">Consultation des astres par Gemini...</span>
      </div>`;

    try {
      AURA_GEMINI.API_KEY = key;

      const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
      const d     = AuraStore.get();
      const name  = d.prefs?.name || '';

      const text = await AURA_GEMINI.call({
        system: `Tu es Lyra, une astrologue bienveillante, poétique et précise. Tu rédiges des horoscopes personnalisés, positifs, profonds et inspirants. Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks ni commentaires.`,
        prompt: `Horoscope du ${today} pour ${info.name}${name ? ` (prénom: ${name})` : ''}. Élément: ${info.element}. Planète dominante: ${info.planet}.
Génère un JSON avec ces clés exactes :
{
  "amour": "message amour 2 phrases",
  "travail": "message travail 2 phrases",
  "energie": "message énergie 2 phrases",
  "finances": "message finances 2 phrases",
  "conseil_du_jour": "conseil profond et inspirant 2-3 phrases",
  "affirmation": "affirmation positive courte",
  "mot_du_jour": "un seul mot inspirant",
  "niveau_energie": "un mot: Basse/Moyenne/Haute/Maximale",
  "etoiles": 4
}`,
        maxTokens: 1000,
        json: true,
      });

      const h = AURA_GEMINI.parseJSON(text);
      if (!h || Object.keys(h).length === 0 || !h.amour || !h.travail) {
          throw new Error("Format JSON invalide ou incomplet");
      }
      
      const stars = '⭐'.repeat(Math.min(5, h.etoiles || 4)) + '☆'.repeat(Math.max(0, 5 - (h.etoiles || 4)));
       
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:.875rem">
          <div style="font-size:32px">${info.emoji}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:var(--text)">${info.name} · ${today}</div>
            <div style="font-size:10px;color:var(--t3)">${info.dates} · ${info.element} · ${info.planet}</div>
            <div style="font-size:11px;color:var(--go);margin-top:2px">${stars} · Énergie : ${h.niveau_energie || 'Haute'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:9px;color:var(--pu);font-weight:700;background:var(--pu-l);padding:2px 7px;border-radius:10px">✨ Gemini IA</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          ${[['💞','Amour',h.amour],['💼','Travail',h.travail],['🌿','Énergie',h.energie],['💰','Finances',h.finances]].filter(x=>x[2]).map(([ico,cat,msg]) => `
          <div style="display:flex;gap:8px;padding:.5rem;background:var(--bg);border-radius:var(--r-md);border:1px solid var(--bd)">
            <span style="font-size:14px;flex-shrink:0">${ico}</span>
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px">${cat}</div>
              <div style="font-size:12px;color:var(--text);margin-top:2px;line-height:1.4">${msg}</div>
            </div>
          </div>`).join('')}
        </div>
        ${h.conseil_du_jour ? `<div style="margin-top:.75rem;padding:.875rem;background:var(--pu-l);border:1px solid var(--pu-b);border-radius:var(--r-md);font-size:12px;color:var(--pu-d);line-height:1.5;font-style:italic">✦ ${h.conseil_du_jour}</div>` : ''}
        ${h.affirmation ? `<div style="margin-top:.5rem;padding:.625rem;background:var(--go-l);border:1px solid var(--go-b);border-radius:var(--r-md);font-size:12px;color:#78350F;font-weight:600;text-align:center">${h.affirmation}</div>` : ''}
        ${h.mot_du_jour  ? `<div style="margin-top:.375rem;text-align:center;font-size:11px;font-weight:700;color:var(--go)">✦ Mot du jour : ${h.mot_du_jour}</div>` : ''}`;

    } catch (err) {
      console.error('[AURA Horo]', err);
      this.render(sign, containerId);
      AuraUI.showToast('Horoscope IA : utilisation du mode local');
    }
  },
};

/* ══════════════════════════════════════════════════════════════
   COACH IA — Gemini
   Inclut le support de l'historique conversationnel multi-tours
   (paramètre "history"), utilisé par coach.html pour le thread
   de bulles de conversation.
══════════════════════════════════════════════════════════════ */
const AuraCoach = {

  /* ── Construit un contexte réel et concret pour le domaine choisi,
       à partir des vraies données — même moteur que aura-scores.js
       utilise déjà pour les Sphères. Retourne une phrase courte à
       injecter dans le prompt, ou '' si pas assez de données. ── */
  _buildDomainContext(domainKey) {
    const lines = [];

    // Score réel de la sphère, si calculable (mêmes 6 sphères que
    // AuraScores couvre — Travail et Création restent manuels).
    const auto = window.AuraScores?.computeAutoScore?.(domainKey);
    if (auto) lines.push(`Score réel actuel sur ce domaine : ${auto.score}/100 (${auto.detail}).`);

    // Faits concrets supplémentaires, propres à chaque domaine —
    // au-delà du score global, ce qui aide vraiment à donner un
    // conseil actionnable plutôt qu'une généralité.
    try {
      switch (domainKey) {
        case 'finance': {
          const fin = JSON.parse(localStorage.getItem('aura_finance_v1') || '{}');
          const enveloppes = fin.enveloppes || [];
          const map = { 'Alimentation':['alimentation','restaurant'], 'Loisirs':['loisirs','beaute'], 'Transport':['transport'], 'Santé':['sante'], 'Vêtements':['vetements'], 'Restaurant':['restaurant'] };
          const overspent = enveloppes
            .map(e => { const cats = map[e.label]||[]; const spent = (fin.depenses||[]).filter(d=>cats.includes(d.cat)).reduce((s,x)=>s+x.montant,0); return { label:e.label, pct: e.budget>0?Math.round((spent/e.budget)*100):0 }; })
            .filter(e => e.pct >= 90)
            .sort((a,b)=>b.pct-a.pct);
          if (overspent.length) lines.push(`Enveloppes en tension : ${overspent.map(e=>`${e.label} à ${e.pct}%`).join(', ')}.`);
          const epargneMois = (fin.epargne||[]).reduce((s,x)=>s+(x.mensuel||0),0);
          if (epargneMois) lines.push(`Épargne mensuelle programmée : ${epargneMois}€.`);
          break;
        }
        case 'dev': {
          const hab = JSON.parse(localStorage.getItem('aura_habitudes_v1') || '{}');
          const habits = hab.habits || [];
          if (habits.length) {
            const struggling = habits.filter(h => {
              const today = new Date(); const last7 = Array.from({length:7},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
              return last7.filter(ds=>h.log.includes(ds)).length <= 2;
            });
            if (struggling.length) lines.push(`Habitudes en difficulté cette semaine : ${struggling.map(h=>h.name).join(', ')}.`);
          }
          break;
        }
        case 'sante': {
          const san = JSON.parse(localStorage.getItem('aura_sante_v1') || '{}');
          const today = new Date(); today.setHours(0,0,0,0);
          const upcoming = (san.medical||[]).filter(m => new Date(m.date) >= today);
          if (upcoming.length) {
            const next = upcoming.sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
            lines.push(`Prochain rendez-vous médical : ${next.label} le ${next.date}.`);
          }
          if ((san.medications||[]).length) lines.push(`Traitements en cours : ${san.medications.map(m=>m.name).join(', ')}.`);
          break;
        }
        case 'maison': {
          const mai = JSON.parse(localStorage.getItem('aura_maison_v1') || '{}');
          const pieces = (mai.cards || []).filter(c => c.type === 'piece');
          const isDone = (t) => {
            if (!t.doneAt) return false;
            const done = new Date(t.doneAt), now = new Date();
            if (t.freq === 'Quotidien') return done.toDateString() === now.toDateString();
            if (t.freq === 'Hebdomadaire') { const ws=new Date(now); ws.setDate(now.getDate()-((now.getDay()+6)%7)); ws.setHours(0,0,0,0); return done>=ws; }
            if (t.freq === 'Mensuel') return done.getFullYear()===now.getFullYear() && done.getMonth()===now.getMonth();
            return true;
          };
          const pending = pieces.flatMap(p => (p.tasks||[]).filter(t => !isDone(t)));
          if (pending.length) lines.push(`${pending.length} tâche(s) d'entretien en attente.`);
          break;
        }
        case 'vision': {
          const vb = JSON.parse(localStorage.getItem('aura_visionboard_v1') || '{}');
          const cards = vb.cards || [];
          const today = new Date();
          const urgent = cards
            .filter(c => c.deadline)
            .map(c => ({ title:c.title, daysLeft: Math.ceil((new Date(c.deadline)-today)/86400000), pct: c.steps?.length?Math.round((c.steps.filter(s=>s.done).length/c.steps.length)*100):0 }))
            .filter(c => c.daysLeft >= 0 && c.daysLeft <= 30 && c.pct < 100)
            .sort((a,b)=>a.daysLeft-b.daysLeft);
          if (urgent.length) lines.push(`Objectif le plus proche : "${urgent[0].title}" à ${urgent[0].pct}%, échéance dans ${urgent[0].daysLeft} jour(s).`);
          break;
        }
        case 'famille': {
          const soc = JSON.parse(localStorage.getItem('aura_social_v1') || '{}');
          const contacts = soc.contacts || [];
          const today = new Date();
          const neglected = contacts.filter(c => {
            if (!c.lastContactDate) return false;
            const days = Math.floor((today - new Date(c.lastContactDate)) / 86400000);
            return days >= 21;
          });
          if (neglected.length) lines.push(`Relations sans contact depuis 3+ semaines : ${neglected.map(c=>c.name).join(', ')}.`);
          break;
        }
      }
    } catch(_) { /* contexte best-effort, jamais bloquant pour la conversation */ }

    return lines.join(' ');
  },

  async ask({ domain, type, message, history, containerId, onDone, domainKey }) {
    const el = containerId ? document.getElementById(containerId) : null;
    if (el) { el.style.display = 'block'; el.innerHTML = '<span style="color:#7C3AED">✦ Guide d\'alignement en activation...</span>'; }

    const key = AuraStore.getGeminiKey();
    if (!key || key === 'VOTRE_CLE_GEMINI') {
      if (el) AuraUI.showKeyWarning(containerId);
      else if (onDone) onDone('⚠ Configure ta clé Gemini dans les Paramètres pour activer le Coach IA.');
      return;
    }

    try {
      AURA_GEMINI.API_KEY = key;
      const d    = AuraStore.get();
      const name = d.prefs?.name || 'toi';
      const sign = d.prefs?.sign ? AuraHoro.signs[d.prefs.sign]?.name : '';

      // Contexte réel du domaine — score honnête + faits concrets,
      // construit à partir des vraies données plutôt que de laisser
      // Gemini parler dans le vide sur un thème abstrait.
      const domainContext = this._buildDomainContext(domainKey);

      // Historique conversationnel : injecté dans le prompt pour donner du
      // contexte à Gemini sur les tours précédents de la conversation.
      let fullPrompt = message || 'Accompagne-moi aujourd\'hui avec sagesse et bienveillance.';
      if (history && history.length) {
        const histText = history.map(h => `${h.role === 'user' ? name : 'Coach'} : ${h.text}`).join('\n');
        fullPrompt = `Voici notre échange jusqu'ici :\n${histText}\n\n${name} continue : ${message}`;
      }

      const systemBase = `Tu es le Coach Intentionnel AURA — un guide bienveillant, inspirant et ancré dans la réalité. Spécialisé en développement personnel, loi d'attraction, gestion financière et bien-être holistique. Tu parles à ${name}${sign ? `, signe ${sign}` : ''}. Tes réponses sont chaleureuses, directes, transformatrices. Tu utilises des métaphores vivantes et des pistes d'action concrètes. Réponds en français, avec émotion et profondeur. Type d'accompagnement demandé : ${type}. Domaine : ${domain}.`;
      const systemGrounding = domainContext
        ? ` Voici la situation réelle de ${name} sur ce domaine, à utiliser explicitement dans ta réponse plutôt que de rester générique : ${domainContext} Appuie-toi sur ces chiffres précis pour rendre ton conseil concret et personnel — nomme-les, réagis à eux.`
        : ` Aucune donnée chiffrée n'est encore disponible sur ce domaine — reste inspirant sans inventer de chiffres, et encourage à renseigner le module correspondant pour des conseils plus précis la prochaine fois.`;

      const text = await AURA_GEMINI.call({
        system: systemBase + systemGrounding,
        prompt: fullPrompt,
        maxTokens: 800,
      });

      if (el) el.innerHTML = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
      AuraXP.earn(50, 'Session Coach IA', '✨'); // no-op silencieux (XP désactivé)
      if (onDone) onDone(text, domainContext);

    } catch (err) {
      console.error('[AURA Coach]', err);
      const errMsg = '⚠ Le Coach est temporairement indisponible. Vérifie ta clé Gemini dans les Paramètres.';
      if (el) el.innerHTML = `<span style="color:var(--re)">⚠ Le Coach est temporairement indisponible.</span><br><span style="color:var(--t2);font-size:12px">Vérifie ta clé Gemini dans les Paramètres.</span>`;
      else if (onDone) onDone(errMsg);
    }
  },

  // Ancre quotidienne générée par Gemini
  async ancreQuotidienne(containerId) {
    const el  = document.getElementById(containerId);
    const key = AuraStore.getGeminiKey();

    const fallbacks = [
      { question:'Que dois-je faire aujourd\'hui pour être sereine demain ?',    affirmation:'Chaque action posée avec intention crée la vie que tu mérites.' },
      { question:'Qui est-ce que je choisis d\'être aujourd\'hui ?',             affirmation:'L\'identité précède le comportement. Sois avant d\'agir.'       },
      { question:'Quelle est la chose la plus courageuse que je puisse faire ?', affirmation:'Le courage n\'est pas l\'absence de peur — c\'est agir malgré elle.' },
      { question:'Comment puis-je servir ma vie à son plus haut niveau ?',       affirmation:'La grandeur se cache dans les petits gestes répétés avec amour.'  },
      { question:'Quelle version de moi veux-je rencontrer ce soir ?',           affirmation:'Je suis l\'architecte consciente de chaque instant.'               },
      { question:'Qu\'est-ce que mon futur moi me remercie d\'avoir fait ?',     affirmation:'Chaque graine plantée aujourd\'hui fleurit dans mon futur radieux.' },
    ];

    if (!key || key === 'VOTRE_CLE_GEMINI') {
      const f = fallbacks[new Date().getDate() % fallbacks.length];
      _set('ancre-q',   `" ${f.question} "`);
      _set('ancre-aff', f.affirmation);
      if (el) el.textContent = '✦ Ancre du jour';
      return;
    }

    if (el) el.textContent = '✦ Gemini génère ton ancre...';

    try {
      AURA_GEMINI.API_KEY = key;
      const d    = AuraStore.get();
      const jour = new Date().toLocaleDateString('fr-FR', { weekday:'long' });

      const text = await AURA_GEMINI.call({
        system: 'Tu es un coach de vie inspirant et poétique. Génère UNIQUEMENT du JSON valide, sans markdown, sans backticks.',
        prompt: `Ancre du jour pour ${jour}. Thème : alignement, croissance personnelle, intention. JSON exact : {"question":"question d'intention profonde et inspirante","affirmation":"affirmation positive et puissante"}`,
        maxTokens: 200,
      });

      const obj = AURA_GEMINI.parseJSON(text);
      if (obj.question)    _set('ancre-q',   `" ${obj.question} "`);
      if (obj.affirmation) _set('ancre-aff', obj.affirmation);
      if (el) el.textContent = '✦ Ancre du jour — Gemini IA';

    } catch (err) {
      console.warn('[AURA Ancre] Fallback local', err);
      const f = fallbacks[new Date().getDate() % fallbacks.length];
      _set('ancre-q',   `" ${f.question} "`);
      _set('ancre-aff', f.affirmation);
      if (el) el.textContent = '✦ Ancre du jour';
    }
  },
};

/* ══════════════════════════════════════════════════════════════
   ASSISTANT CHAT — Gemini
══════════════════════════════════════════════════════════════ */
const AuraAssistant = {
  history: [],
  open: false,

  toggle() {
    this.open = !this.open;
    const panel = document.querySelector('.assistant-panel');
    if (panel) panel.classList.toggle('open', this.open);
    if (this.open && this.history.length === 0) {
      this.addMsg('ai', 'Bonjour ✦ Je suis ton assistant AURA. Pose-moi une question, demande un conseil ou dis-moi "va sur cuisine" pour naviguer !');
    }
  },

  addMsg(role, text) {
    this.history.push({ role, text });
    const msgs = document.getElementById('assistant-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  async send(input) {
    const q = (typeof input === 'string' ? input : document.getElementById('assistant-input')?.value || '').trim();
    if (!q) return;
    const inp = document.getElementById('assistant-input');
    if (inp) inp.value = '';
    this.addMsg('user', q);

    const navMatch = q.match(/(?:va|ouvre|navigue|affiche|aller|voir|montre)\s+(?:sur\s+|vers?\s+)?(?:le\s+module\s+)?(\w+)/i);
    if (navMatch && window.AuraBridge) {
      const mod    = navMatch[1].toLowerCase();
      const result = await AuraBridge.command(`navigate ${mod}`);
      this.addMsg('ai', result);
      return;
    }

    const key = AuraStore.getGeminiKey();
    if (!key || key === 'VOTRE_CLE_GEMINI') {
      this.addMsg('ai', 'Configure ta clé Gemini dans les Paramètres pour activer l\'IA. En attendant, tu peux me demander de naviguer ! (ex: "va sur cuisine")');
      return;
    }

    try {
      AURA_GEMINI.API_KEY = key;
      const d = AuraStore.get();

      const contents = [];
      this.history.slice(-8).forEach(h => {
        contents.push({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] });
      });

      const systemNote = `Tu es l'assistant AURA de ${d.prefs?.name || 'l\'utilisatrice'}. Tu es bref, chaleureux et actionnable. Tu parles en français. Tu peux guider vers les modules : dashboard, rituel, habitudes, spheres, coach, budget, patrimoine, cagnottes, charges, cuisine, maison, sante, social, voyages, abonnements, params. Réponds en 2-3 phrases max, avec une touche chaleureuse.`;

      if (contents.length === 0 || contents[0].role !== 'user') {
        contents[contents.length - 1].parts[0].text = `${systemNote}\n\nUtilisatrice: ${q}`;
      }

      const body = {
        contents,
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
      };

      const res  = await fetch(AURA_GEMINI.endpoint(AURA_GEMINI.MODEL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Je t\'entends. ✦';
      this.addMsg('ai', text);

    } catch (_) {
      this.addMsg('ai', 'Connexion instable. Réessaie dans un instant. ✦');
    }
  },
};

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const data = AuraStore.get();
  AuraUI.updateXPDisplays(); // existe maintenant (no-op) — ne plante plus
  if (data.prefs?.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  if (data.prefs?.geminiKey) AURA_GEMINI.API_KEY = data.prefs.geminiKey;
});

/* ══════════════════════════════════════════════════════════════
   GLOBALS
══════════════════════════════════════════════════════════════ */
window.dismissAlert  = id              => AuraUI.dismissAlert(id);
window.toggleCourse  = cb              => AuraUI.toggleCourse(cb);
window.selectMood    = el              => AuraUI.selectMood(el);
window.toggleSwitch  = btn             => AuraUI.toggleSwitch(btn);
window.AuraGemini    = AURA_GEMINI;
window.AuraStore     = AuraStore;
window.AuraXP        = AuraXP;
window.AuraUI        = AuraUI;
window.AuraSim       = AuraSim;
window.AuraHoro      = AuraHoro;
window.AuraCoach     = AuraCoach;
window.AuraAssistant = AuraAssistant;

/* ══════════════════════════════════════════════════════════════
   HELPERS PARTAGÉS — source unique pour tous les modules
══════════════════════════════════════════════════════════════ */
window.fmtEuro = function(n, decimals) {
  const opts = decimals === false
    ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return Number(n || 0).toLocaleString('fr-FR', opts) + ' €';
};
window.fmtDateFR = function(s, opts) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('fr-FR', opts || { day:'numeric', month:'short', year:'numeric' }); }
  catch(_) { return s; }
};
window._setText  = function(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; };
window._setStyle = function(id, prop, val) { const e = document.getElementById(id); if (e) e.style[prop] = val; };
window._setValue = function(id, val) { const e = document.getElementById(id); if (e) e.value = val; };

/* ══════════════════════════════════════════════════════════════
   HELPERS INTERNES
══════════════════════════════════════════════════════════════ */
function _set(id, val)          { const e = document.getElementById(id); if (e) e.textContent = val; }
function _css(id, p, v)         { const e = document.getElementById(id); if (e) e.style[p] = v; }
/* ══════════════════════════════════════════════════════════════
   STUB GLOBAL earnXP — système XP retiré de l'app.
   De nombreux modules (budget, habitudes, coach, dashboard...)
   appellent encore earnXP(...) après une sauvegarde réussie. Sans
   cette fonction, l'appel lève un ReferenceError qui interrompt le
   script du module APRÈS la sauvegarde des données mais AVANT
   l'affichage du toast de confirmation. No-op volontaire.
══════════════════════════════════════════════════════════════ */
window.earnXP = function() {};

function _deepSet(obj, path, val) {
  const k = path.split('.');
  let o = obj;
  for (let i = 0; i < k.length - 1; i++) { if (!o[k[i]]) o[k[i]] = {}; o = o[k[i]]; }
  o[k[k.length - 1]] = val;
}
