/* ============================================================
   AURA — aura-onboarding.js
   Remplace le modal auth brut par un vrai parcours d'accueil :
   - Écran de bienvenue épuré (type Apple)
   - Choix compte / sans compte, sans friction
   - 4 questions courtes (prénom, signe, priorités, mode)
   - Configure automatiquement le Studio (mode "essentiel")
   - Ne s'affiche qu'une fois (sauf reset complet)
   ============================================================ */
'use strict';

const AuraOnboarding = {
  _key: 'aura_onboarding_done_v1',
  step: 0,
  data: { name: '', sign: '', priorities: [], mode: 'essentiel' },

  isDone() {
    try { return localStorage.getItem(this._key) === 'true'; } catch(_) { return false; }
  },

  markDone() {
    try { localStorage.setItem(this._key, 'true'); } catch(_) {}
  },

  /* ── Point d'entrée ── */
  maybeShow() {
    if (this.isDone()) return false;
    this.render();
    return true;
  },

  /* ── Coquille visuelle ── */
  render() {
    if (document.getElementById('aura-onboarding-overlay')) return;
    this._injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'aura-onboarding-overlay';
    overlay.innerHTML = `
      <div class="aob-bg"></div>
      <div class="aob-card" id="aob-card"></div>
    `;
    document.body.appendChild(overlay);
    this.step = 0;
    this.renderStep();
  },

  close() {
    document.getElementById('aura-onboarding-overlay')?.remove();
  },

  /* ── Étapes ── */
  renderStep() {
    const card = document.getElementById('aob-card');
    if (!card) return;
    card.style.opacity = '0';
    setTimeout(() => {
      card.innerHTML = this._stepHTML(this.step);
      card.style.opacity = '1';
      const input = card.querySelector('input[autofocus]');
      if (input) setTimeout(() => input.focus(), 150);
    }, 150);
  },

  next() { this.step++; this.renderStep(); },
  prev() { this.step--; this.renderStep(); },

  /* ── Contenu de chaque étape ── */
  _stepHTML(step) {
    const dots = (total, active) => Array.from({length:total},(_,i)=>`<span class="aob-dot ${i===active?'on':''}"></span>`).join('');

    switch(step) {

      /* ── 0 : Bienvenue ── */
      case 0: return `
        <div class="aob-hero-icon"><i class="ti ti-sun"></i></div>
        <div class="aob-title">Bienvenue dans AURA</div>
        <div class="aob-sub">Ton espace personnel pour vivre avec intention — finances, bien-être, organisation, tout au même endroit.</div>
        <button class="aob-btn-primary" onclick="AuraOnboarding.next()">Commencer ✦</button>
        <button class="aob-btn-text" onclick="AuraOnboarding.openLoginInstead()">J'ai déjà un compte</button>
        <button class="aob-btn-text" onclick="AuraOnboarding.skipToEnd()">Passer cette présentation</button>
        <div class="aob-dots">${dots(5,0)}</div>`;

      /* ── 1 : Prénom ── */
      case 1: return `
        <div class="aob-step-icon">👋</div>
        <div class="aob-title">Comment veux-tu qu'on t'appelle ?</div>
        <div class="aob-sub">Ce nom apparaîtra dans toute ton app</div>
        <input class="aob-input" id="aob-name" placeholder="Ton prénom" value="${this.data.name}" autofocus onkeydown="if(event.key==='Enter')AuraOnboarding.saveNameAndNext()">
        <button class="aob-btn-primary" onclick="AuraOnboarding.saveNameAndNext()">Continuer</button>
        <button class="aob-btn-text" onclick="AuraOnboarding.prev()">Retour</button>
        <div class="aob-dots">${dots(5,1)}</div>`;

      /* ── 2 : Signe astro (optionnel) ── */
      case 2: return `
        <div class="aob-step-icon">✨</div>
        <div class="aob-title">Ton signe astrologique</div>
        <div class="aob-sub">Pour personnaliser ton horoscope quotidien (facultatif)</div>
        <select class="aob-input" id="aob-sign">
          <option value="">— Préférer ne pas dire —</option>
          <option value="belier">♈ Bélier</option><option value="taureau">♉ Taureau</option>
          <option value="gemeaux">♊ Gémeaux</option><option value="cancer">♋ Cancer</option>
          <option value="lion">♌ Lion</option><option value="vierge">♍ Vierge</option>
          <option value="balance">♎ Balance</option><option value="scorpion">♏ Scorpion</option>
          <option value="sagittaire">♐ Sagittaire</option><option value="capricorne">♑ Capricorne</option>
          <option value="verseau">♒ Verseau</option><option value="poissons">♓ Poissons</option>
        </select>
        <button class="aob-btn-primary" onclick="AuraOnboarding.saveSignAndNext()">Continuer</button>
        <button class="aob-btn-text" onclick="AuraOnboarding.prev()">Retour</button>
        <div class="aob-dots">${dots(5,2)}</div>`;

      /* ── 3 : Priorités de vie ── */
      case 3: return `
        <div class="aob-step-icon">🎯</div>
        <div class="aob-title">Qu'est-ce qui compte le plus pour toi ?</div>
        <div class="aob-sub">Choisis 2 ou 3 priorités — AURA mettra ces modules en avant</div>
        <div class="aob-priority-grid" id="aob-priorities">
          ${this._priorityOptions().map(p => `
            <button class="aob-priority-btn" data-key="${p.key}" onclick="AuraOnboarding.togglePriority('${p.key}', this)">
              <span class="aob-priority-icon">${p.icon}</span><span>${p.label}</span>
            </button>`).join('')}
        </div>
        <button class="aob-btn-primary" onclick="AuraOnboarding.savePrioritiesAndNext()">Continuer</button>
        <button class="aob-btn-text" onclick="AuraOnboarding.prev()">Retour</button>
        <div class="aob-dots">${dots(5,3)}</div>`;

      /* ── 4 : Mode de navigation ── */
      case 4: return `
        <div class="aob-step-icon">🧭</div>
        <div class="aob-title">Comment veux-tu naviguer ?</div>
        <div class="aob-sub">Tu pourras changer à tout moment dans le Studio</div>
        <div class="aob-mode-grid">
          <button class="aob-mode-card sel" data-mode="essentiel" onclick="AuraOnboarding.selectMode('essentiel', this)">
            <div class="aob-mode-icon">✨</div>
            <div class="aob-mode-name">Essentiel</div>
            <div class="aob-mode-desc">Seulement tes priorités, le reste est masqué</div>
          </button>
          <button class="aob-mode-card" data-mode="complet" onclick="AuraOnboarding.selectMode('complet', this)">
            <div class="aob-mode-icon">📚</div>
            <div class="aob-mode-name">Complet</div>
            <div class="aob-mode-desc">Tous les modules visibles dès le départ</div>
          </button>
        </div>
        <button class="aob-btn-primary" onclick="AuraOnboarding.finish()">C'est parti ✦</button>
        <button class="aob-btn-text" onclick="AuraOnboarding.prev()">Retour</button>
        <div class="aob-dots">${dots(5,4)}</div>`;

      default: return '';
    }
  },

  _priorityOptions() {
    return [
      { key:'budget',     icon:'💰', label:'Finances' },
      { key:'rituel',     icon:'🌅', label:'Rituel & intention' },
      { key:'habitudes',  icon:'🔁', label:'Habitudes' },
      { key:'sante',      icon:'🌿', label:'Santé' },
      { key:'cuisine',    icon:'🍽️', label:'Cuisine' },
      { key:'maison',     icon:'🏡', label:'Maison' },
      { key:'agenda',     icon:'📅', label:'Organisation' },
      { key:'coach',      icon:'✨', label:'Coaching' },
      { key:'social',     icon:'👥', label:'Relations' },
      { key:'voyages',    icon:'✈️', label:'Voyages' },
      { key:'patrimoine', icon:'🏦', label:'Patrimoine' },
      { key:'spheres',    icon:'🎯', label:'Équilibre global' },
      { key:'visionboard',icon:'🌌', label:'Vision & objectifs' },
    ];
  },

  /* ── Handlers ── */
  saveNameAndNext() {
    const val = document.getElementById('aob-name')?.value?.trim();
    this.data.name = val || 'Mon AURA';
    this.next();
  },

  saveSignAndNext() {
    this.data.sign = document.getElementById('aob-sign')?.value || '';
    this.next();
  },

  togglePriority(key, btn) {
    const idx = this.data.priorities.indexOf(key);
    if (idx >= 0) { this.data.priorities.splice(idx,1); btn.classList.remove('sel'); }
    else {
      if (this.data.priorities.length >= 5) { AuraUI?.showToast?.('Maximum 5 priorités — décoche-en une d\'abord'); return; }
      this.data.priorities.push(key); btn.classList.add('sel');
    }
  },

  savePrioritiesAndNext() {
    if (this.data.priorities.length === 0) {
      // Pas grave, on continue avec une sélection par défaut raisonnable
      this.data.priorities = ['budget','rituel','habitudes'];
    }
    this.next();
  },

  selectMode(mode, btn) {
    this.data.mode = mode;
    document.querySelectorAll('.aob-mode-card').forEach(c => c.classList.toggle('sel', c.dataset.mode===mode));
  },

  skipToEnd() {
    this.data = { name:'Mon AURA', sign:'', priorities:['budget','rituel','habitudes'], mode:'complet' };
    this.finish();
  },

  openLoginInstead() {
    this.close();
    this.markDone(); // Évite que l'onboarding ressurgisse après la connexion
    if (window.AuraAuth) AuraAuth.showLoginModal();
  },

  /* ── Finalisation : applique tout et ferme ── */
  finish() {
    // 1. Profil
    AuraStore.set('prefs.name', this.data.name);
    if (this.data.sign) AuraStore.set('prefs.sign', this.data.sign);

    // Sauvegarder les priorités pour que le Studio puisse les réutiliser (mode essentiel rapide)
    try { localStorage.setItem('aura_onboarding_priorities', JSON.stringify(this.data.priorities)); } catch(_) {}

    // 2. Mode essentiel → configure le Studio pour masquer les modules non prioritaires
    if (this.data.mode === 'essentiel') {
      const ALL_MODULES = ['dashboard','spheres','visionboard','rituel','habitudes','budget','patrimoine','cagnottes','charges','agenda','cuisine','maison','sante','social','voyages','abonnements','coach','xp'];
      const ALWAYS_VISIBLE = ['dashboard','coach','xp']; // cœur de l'app, jamais masqué
      const toShow = new Set([...ALWAYS_VISIBLE, ...this.data.priorities]);
      const toHide = ALL_MODULES.filter(m => !toShow.has(m));

      let studio;
      try { studio = JSON.parse(localStorage.getItem('aura_studio_v1')||'null'); } catch(_) { studio = null; }
      studio = studio || { mode:'light', palette:'violet', font:'system', effects:{particles:true,aurora:true,confetti:true,transitions:true}, intensity:60, navOrder:[], navHidden:[], navLabels:{} };
      studio.navHidden = toHide;
      localStorage.setItem('aura_studio_v1', JSON.stringify(studio));
    }

    // 3. Marquer l'onboarding comme terminé
    this.markDone();

    // 4. Toast de bienvenue chaleureux + fermeture
    this.close();
    setTimeout(() => {
      AuraUI?.showToast?.(`✦ Bienvenue ${this.data.name}, ton AURA est prête`);
      // Ré-applique la nav du Studio sur la sidebar actuelle
      if (window.AuraApp?._applyStudioOnBoot) AuraApp._applyStudioOnBoot();
    }, 300);
  },

  /* ── Styles ── */
  _injectStyles() {
    if (document.getElementById('aura-onboarding-styles')) return;
    const style = document.createElement('style');
    style.id = 'aura-onboarding-styles';
    style.textContent = `
      #aura-onboarding-overlay {
        position: fixed; inset: 0; z-index: 600;
        display: flex; align-items: center; justify-content: center;
        padding: 1.25rem;
      }
      .aob-bg {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse at top, #F5F3FF 0%, #EDE9FE 40%, #F8F7FF 100%);
      }
      .aob-card {
        position: relative; z-index: 1;
        background: var(--white); border-radius: 28px;
        padding: 2.5rem 2rem; width: 100%; max-width: 420px;
        box-shadow: 0 30px 80px rgba(124,58,237,.18);
        text-align: center; transition: opacity .15s ease;
        display: flex; flex-direction: column; align-items: center;
      }
      .aob-hero-icon, .aob-step-icon {
        font-size: 44px; margin-bottom: 1rem;
      }
      .aob-hero-icon {
        width: 76px; height: 76px; border-radius: 50%;
        background: linear-gradient(135deg, #A78BFA, #7C3AED);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 12px 32px rgba(124,58,237,.35);
        color: #fff; font-size: 32px;
      }
      .aob-title { font-size: 21px; font-weight: 800; color: var(--text); line-height: 1.3; margin-bottom: .5rem; }
      .aob-sub { font-size: 13px; color: var(--t2); line-height: 1.5; margin-bottom: 1.5rem; max-width: 320px; }
      .aob-input {
        width: 100%; font-size: 15px; padding: 13px 16px; border-radius: 14px;
        border: 1.5px solid var(--bd2); background: var(--bg); color: var(--text);
        outline: none; text-align: center; margin-bottom: 1.25rem; font-family: var(--font);
        transition: border-color .15s;
      }
      .aob-input:focus { border-color: #7C3AED; background: var(--white); }
      .aob-btn-primary {
        width: 100%; padding: 14px; border-radius: 14px;
        background: linear-gradient(135deg, #8B5CF6, #7C3AED);
        color: #fff; border: none; font-size: 14.5px; font-weight: 700;
        cursor: pointer; transition: opacity .15s; box-shadow: 0 8px 20px rgba(124,58,237,.3);
      }
      .aob-btn-primary:hover { opacity: .92; }
      .aob-btn-text {
        background: none; border: none; font-size: 12.5px; color: var(--t3);
        cursor: pointer; margin-top: .875rem; text-decoration: none;
      }
      .aob-btn-text:hover { color: var(--t2); }
      .aob-dots { display: flex; gap: 6px; margin-top: 1.5rem; }
      .aob-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--bd2); transition: all .2s; }
      .aob-dot.on { background: #7C3AED; width: 18px; border-radius: 3px; }

      .aob-priority-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
        width: 100%; margin-bottom: 1.25rem;
      }
      .aob-priority-btn {
        display: flex; align-items: center; gap: 8px;
        padding: 11px 12px; border-radius: 13px; border: 1.5px solid var(--bd2);
        background: var(--white); cursor: pointer; transition: all .15s;
        font-size: 12.5px; font-weight: 600; color: var(--text); text-align: left;
      }
      .aob-priority-btn:hover { border-color: #C4B5FD; }
      .aob-priority-btn.sel { border-color: #7C3AED; background: var(--pu-l); color: #5B21B6; }
      .aob-priority-icon { font-size: 17px; flex-shrink: 0; }

      .aob-mode-grid { display: flex; gap: 10px; width: 100%; margin-bottom: 1.25rem; }
      .aob-mode-card {
        flex: 1; padding: 1.125rem .75rem; border-radius: 16px; border: 1.5px solid var(--bd2);
        background: var(--white); cursor: pointer; transition: all .15s; text-align: center;
      }
      .aob-mode-card:hover { border-color: #C4B5FD; }
      .aob-mode-card.sel { border-color: #7C3AED; background: var(--pu-l); box-shadow: 0 0 0 3px rgba(124,58,237,.1); }
      .aob-mode-icon { font-size: 26px; margin-bottom: .5rem; }
      .aob-mode-name { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 3px; }
      .aob-mode-desc { font-size: 10.5px; color: var(--t3); line-height: 1.4; }

      @media(max-width: 480px) {
        .aob-card { padding: 2rem 1.5rem; border-radius: 22px; }
        .aob-priority-grid { grid-template-columns: 1fr 1fr; }
      }
    `;
    document.head.appendChild(style);
  },
};

/* ══════════════════════════════════════════════════
   INIT — remplace l'appel direct à AuraAuth.showLoginModal
   présent dans aura-db.js
══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Laisse le temps à aura-db.js de tenter une restauration de session
  setTimeout(() => {
    const alreadyLoggedIn = window.SupaClient?.isLoggedIn?.();
    if (alreadyLoggedIn) return; // déjà connectée, rien à afficher

    // Un compte est-il déjà connu sur CET appareil (créé via le PIN précédemment) ?
    // Si oui, c'est l'écran "Bon retour" du PIN qui doit s'afficher — pas l'onboarding
    // générique de bienvenue, qui ne sait pas qu'un compte existe déjà ici.
    let known = null;
    try { known = JSON.parse(localStorage.getItem('aura_known_email_v1') || 'null'); } catch(_) {}

    if (known?.email && known?.name) {
      if (window.AuraAuth) AuraAuth.showLoginModal();
      return;
    }

    // Sinon, premier contact réel sur cet appareil → onboarding normal
    if (!AuraOnboarding.isDone()) {
      AuraOnboarding.maybeShow();
    }
  }, 200);
});

window.AuraOnboarding = AuraOnboarding;
