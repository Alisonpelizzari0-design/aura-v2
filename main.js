/* ============================================================
   AURA — main.js v2.0
   Moteur SPA : navigation, init, AuraBridge IA, meta modules
   ============================================================ */
'use strict';

/* ── Registre & méta ────────────────────────────────────────── */
const MODULE_META = {
  dashboard:   { title:'Ancre du jour',       sub:'Pose ton intention · Horoscope · Vue globale',           icon:'ti-sun-high'         },
  spheres:     { title:'8 Sphères de vie',    sub:'Explore chaque dimension · Gagne des XP',               icon:'ti-circles'          },
  visionboard: { title:'Vision Board',         sub:'Tes objectifs en image · Plan d\'action · Affirmations ✦', icon:'ti-stars'          },
  rituel:      { title:'Rituel du matin',     sub:'5 minutes pour ancrer ta journée · +25 XP',             icon:'ti-sunrise'          },
  habitudes:   { title:'Mes habitudes',       sub:'Streaks · Validation · Progression',                    icon:'ti-repeat'           },
  coach:       { title:'Coach IA ✦',          sub:'Intelligence alignée sur ta croissance',                icon:'ti-sparkles'         },
  budget:      { title:'Budget & Épargne',    sub:'Prévision · Enveloppes · Alertes',                      icon:'ti-chart-pie'        },
  patrimoine:  { title:'Bilan patrimonial',   sub:'Actifs · Passifs · Stratégie · Éducation',              icon:'ti-building-bank'    },
  cagnottes:   { title:'Cagnottes de vie',    sub:'Visualise et abonde tes projets ✦',                     icon:'ti-pig-money'        },
  charges:     { title:'Charges fixes',       sub:'Structure tes coûts mensuels',                          icon:'ti-receipt'          },
  alertes:     { title:'Alertes',             sub:'Budget · Rappels · Succès',                             icon:'ti-bell'             },
  agenda:      { title:'Agenda & Calendrier',   sub:'Événements · RDV · Planning semaine & mois',          icon:'ti-calendar'         },
  cuisine:     { title:'Cuisine & Repas',        sub:'Recettes Air Fryer · Planning · Courses',               icon:'ti-chef-hat'         },
  maison:      { title:'Maison & Entretien',  sub:'Ménage · Rappels · Tâches récurrentes',                 icon:'ti-home-2'           },
  sante:       { title:'Santé & Corps',       sub:'Eau · Sommeil · Activité · Bien-être',                  icon:'ti-heart-rate-monitor'},
  social:      { title:'Social & Relations',  sub:'Anniversaires · Cadeaux · Contacts proches',            icon:'ti-users'            },
  voyages:     { title:'Voyages & Trips',     sub:'Planification · Budget · Checklist',                    icon:'ti-plane'            },
  abonnements: { title:'Abonnements',         sub:'Tous tes abonnements · Alertes renouvellement',         icon:'ti-credit-card'      },
  studio:      { title:'Studio de personnalisation', sub:'Thème · Effets cosmiques · Navigation · Contenu ✦', icon:'ti-wand'             },
  params:      { title:'Paramètres',          sub:'Profil · Budget · Alertes · Thème · Intégrations',      icon:'ti-settings'         },
};

/* ── AuraApp SPA ────────────────────────────────────────────── */
const AuraApp = {
  registry: Object.keys(MODULE_META),
  current: null,

  async loadModule(name) {
    if (!this.registry.includes(name)) {
      console.warn(`[AURA] Module inconnu : ${name}`);
      return;
    }
    const content = document.getElementById('app-content');
    if (!content) return;

    // Fade out
    content.style.opacity = '0.3';

    try {
      const res = await fetch(`modules/${name}.html`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      content.innerHTML = html;
      content.style.opacity = '1';

      // ── Correctif crucial ──────────────────────────────────
      // innerHTML n'exécute JAMAIS les balises <script> qu'il contient
      // (comportement de sécurité standard des navigateurs). Sans ce
      // correctif, toutes les fonctions déclarées dans le <script> de
      // chaque module (ex: saveGeminiKey, showTab, openModal...) restent
      // indéfinies tant qu'on ne les recrée pas et ré-injecte manuellement.
      content.querySelectorAll('script').forEach(oldScript => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        oldScript.replaceWith(newScript);
      });

      // Mettre à jour la topbar
      const meta = MODULE_META[name];
      _t('topbar-title', meta.title);
      _t('topbar-sub',   _todayMeta(meta.sub));

      // Nav active
      AuraUI.setActiveNav(name);

      // Met à jour le score de vie réel dans la sidebar/topbar
      if (window.AuraScores) AuraScores.updateGlobalDisplays();

      // Hook init module si défini
      if (typeof window.initModule === 'function') {
        window.initModule(name);
        window.initModule = null;
      }

      // Historique navigateur
      history.pushState({ module: name }, '', `#${name}`);
      this.current = name;
      console.log(`[AURA] ✓ ${name}`);

    } catch (err) {
      content.style.opacity = '1';
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:50vh;gap:16px">
          <i class="ti ti-alert-triangle" style="font-size:36px;color:var(--re)"></i>
          <div style="font-size:14px;color:var(--t2)">Module <strong>${name}</strong> introuvable.</div>
          <button onclick="AuraApp.loadModule('dashboard')" class="btn-pill pu"><i class="ti ti-home"></i> Dashboard</button>
        </div>`;
      console.error(`[AURA] ✗ ${name}`, err);
    }
  },

  async init() {
    console.log('[AURA OS] Démarrage ✦');

    // Thème initial — applique la config complète du Studio si elle existe
    const d = AuraStore.get();
    this._applyStudioOnBoot();

    // Élément toast générique — utilisé partout dans l'app pour les messages
    // de confirmation ("✓ Sauvegardé", erreurs...), pas seulement l'ancien XP.
    if (!document.getElementById('aura-xp-toast')) {
      document.body.insertAdjacentHTML('afterbegin',`
        <div class="xp-toast" id="aura-xp-toast">
          <i class="ti ti-check"></i><span id="aura-xp-msg"></span>
        </div>`);
    }

    // Score de vie réel — affichage initial
    if (window.AuraScores) AuraScores.updateGlobalDisplays();

    // Nom utilisateur sidebar
    if (d.prefs?.name) _t('sb-user-name', d.prefs.name);

    // Assistant flottant — injection directe (pas de module externe pour ce composant)
    const layer = document.getElementById('assistant-layer');
    if (layer && !layer.innerHTML.trim()) {
      layer.innerHTML = `
        <div class="assistant-panel" id="assistant-panel">
          <div class="assistant-header">
            <i class="ti ti-sparkles" style="color:#fff;font-size:16px"></i>
            <span>Assistant AURA</span>
            <button onclick="AuraAssistant.toggle()" style="margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;font-size:16px"><i class="ti ti-x"></i></button>
          </div>
          <div class="assistant-messages" id="assistant-messages"></div>
          <div class="assistant-input">
            <input type="text" id="assistant-input" placeholder="Pose une question ou navigue..." onkeydown="if(event.key==='Enter') AuraAssistant.send()">
            <button onclick="AuraAssistant.send()"><i class="ti ti-send"></i></button>
          </div>
        </div>
        <button class="assistant-bubble" onclick="AuraAssistant.toggle()" title="Assistant AURA">
          <i class="ti ti-sparkles"></i>
        </button>`;
    }

    // Retour navigateur
    window.addEventListener('popstate', e => { if (e.state?.module) this.loadModule(e.state.module); });

    // Module de démarrage : hash ou préférence ou dashboard
    const hash  = location.hash.replace('#','');
    const pref  = d.prefs?.homeModule || 'dashboard';
    const start = (hash && this.registry.includes(hash)) ? hash : pref;
    await this.loadModule(start);

    console.log('[AURA OS] Prêt ✦');
  },

  /* ── Applique la config Studio au démarrage, indépendamment du module Studio ── */
  _applyStudioOnBoot() {
    let studio;
    try { studio = JSON.parse(localStorage.getItem('aura_studio_v1') || 'null'); } catch(_) { studio = null; }
    if (!studio) return;

    const root = document.documentElement;
    const PALETTES_BOOT = {
      violet:{pu:'#7C3AED',puL:'#F5F3FF',puB:'#DDD6FE'}, teal:{pu:'#0D9488',puL:'#F0FDFA',puB:'#99F6E4'},
      rose:{pu:'#DB2777',puL:'#FDF2F8',puB:'#F9A8D4'},   ambre:{pu:'#EA580C',puL:'#FFF7ED',puB:'#FED7AA'},
      ocean:{pu:'#2563EB',puL:'#EFF6FF',puB:'#BFDBFE'},  foret:{pu:'#16A34A',puL:'#F0FDF4',puB:'#BBF7D0'},
      cosmos:{pu:'#9333EA',puL:'#F5F3FF',puB:'#C4B5FD'}, or:{pu:'#C9A84C',puL:'#FEFCE8',puB:'#FDE68A'},
    };
    const FONTS_BOOT = {
      system:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      serif:'"Georgia","Times New Roman",serif',
      rounded:'"Quicksand","Comfortaa",sans-serif',
    };

    const p = PALETTES_BOOT[studio.palette];
    if (p) { root.style.setProperty('--pu', p.pu); root.style.setProperty('--pu-l', p.puL); root.style.setProperty('--pu-b', p.puB); }
    if (FONTS_BOOT[studio.font]) root.style.setProperty('--font', FONTS_BOOT[studio.font]);

    if (studio.mode === 'dark' || studio.mode === 'cosmic') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');

    // Couche cosmique : on l'injecte directement ici (indépendant du module Studio)
    if (studio.mode === 'cosmic' && studio.effects) {
      document.getElementById('aura-cosmic-layer')?.remove();
      const opacity = ((studio.intensity||60)/100).toFixed(2);
      const layer = document.createElement('div');
      layer.id = 'aura-cosmic-layer';
      layer.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden;opacity:${opacity}`;
      if (studio.effects.aurora) {
        layer.innerHTML += `<div style="position:absolute;inset:-20%;background:
          radial-gradient(ellipse 60% 40% at 20% 0%, rgba(124,58,237,.25), transparent),
          radial-gradient(ellipse 50% 35% at 80% 10%, rgba(236,72,153,.18), transparent),
          radial-gradient(ellipse 45% 30% at 50% 100%, rgba(45,212,191,.15), transparent);
          animation:auraDrift 18s ease-in-out infinite alternate;filter:blur(40px)"></div>`;
      }
      if (studio.effects.particles) {
        let stars = '';
        for (let i=0;i<60;i++) {
          const top=Math.random()*100, left=Math.random()*100, size=(Math.random()*2+1).toFixed(1), delay=(Math.random()*4).toFixed(1);
          stars += `<div style="position:absolute;top:${top}%;left:${left}%;width:${size}px;height:${size}px;background:#fff;border-radius:50%;animation:auraTwinkleStar 3s ease-in-out ${delay}s infinite alternate"></div>`;
        }
        layer.innerHTML += stars;
      }
      document.body.appendChild(layer);
      if (!document.getElementById('aura-cosmic-keyframes')) {
        const style = document.createElement('style');
        style.id = 'aura-cosmic-keyframes';
        style.textContent = `
          @keyframes auraDrift { 0%{transform:translate(0,0) rotate(0deg)} 100%{transform:translate(3%,-3%) rotate(3deg)} }
          @keyframes auraTwinkleStar { 0%{opacity:.2;transform:scale(.8)} 100%{opacity:1;transform:scale(1.3)} }
        `;
        document.head.appendChild(style);
      }
    }

    // Navigation personnalisée : ordre, visibilité, labels
    if (studio.navOrder?.length || studio.navHidden?.length || Object.keys(studio.navLabels||{}).length) {
      setTimeout(() => {
        const itemsByKey = {};
        document.querySelectorAll('.nav-item').forEach(el => { itemsByKey[el.dataset.module] = el; });
        const order = studio.navOrder?.length ? studio.navOrder : Object.keys(itemsByKey);
        order.forEach(key => {
          const el = itemsByKey[key];
          if (!el) return;
          el.style.display = (studio.navHidden||[]).includes(key) ? 'none' : '';
          if (studio.navLabels?.[key]) {
            const icon = el.querySelector('i');
            const pip  = el.querySelector('.nav-pip');
            el.innerHTML = '';
            if (icon) el.appendChild(icon);
            el.appendChild(document.createTextNode(' ' + studio.navLabels[key]));
            if (pip) el.appendChild(pip);
          }
          el.parentElement?.appendChild(el);
        });
      }, 50);
    }

    // Carte "Explorer plus" : compte les modules masqués et affiche/cache la carte
    this._updateExploreMoreCard(studio.navHidden || []);
  },

  _updateExploreMoreCard(hiddenList) {
    setTimeout(() => {
      const card = document.getElementById('explore-more-card');
      const countEl = document.getElementById('explore-more-count');
      if (!card) return;
      const n = hiddenList.length;
      if (n > 0) {
        card.style.display = 'block';
        if (countEl) countEl.textContent = n;
      } else {
        card.style.display = 'none';
      }
    }, 60);
  },
};

/* ── Navigation globale ─────────────────────────────────────── */
function navigate(name) { AuraApp.loadModule(name); }

/* ── AuraBridge — l'IA pilote l'app ────────────────────────── */
const AuraBridge = {
  async command(cmd) {
    const [action, ...args] = cmd.trim().split(' ');
    switch(action) {
      case 'navigate':
        const mod = args[0];
        if (AuraApp.registry.includes(mod)) { await AuraApp.loadModule(mod); return `✦ Navigation vers "${mod}" effectuée.`; }
        return `Module "${mod}" inconnu. Disponibles : ${AuraApp.registry.join(', ')}`;
      case 'xp':
        const pts = parseInt(args[0])||10;
        const lbl = args.slice(1).join(' ')||'Action IA';
        return `✦ +${pts} XP : "${lbl}"`;
      case 'status':
        return `Module actuel: ${AuraApp.current}`;
      case 'theme':
        const t = args[0];
        document.documentElement.setAttribute('data-theme', t==='dark'?'dark':'');
        AuraStore.set('prefs.theme', t);
        return `✦ Thème "${t}" appliqué.`;
      default:
        // Rétrocompatibilité directe
        if (AuraApp.registry.includes(cmd)) { await AuraApp.loadModule(cmd); return `✦ Navigation vers "${cmd}".`; }
        return `Commande non reconnue. Essayez : navigate <module> | xp <pts> <label> | status | theme dark|light`;
    }
  }
};

/* ── Helpers ────────────────────────────────────────────────── */
function _t(id, val) { const e=document.getElementById(id); if(e) e.textContent=val; }
function _todayMeta(sub) { return sub; } // Peut enrichir avec la date courante

/* ── Globals ────────────────────────────────────────────────── */
window.navigate    = navigate;
window.AuraApp     = AuraApp;
window.AuraBridge  = AuraBridge;

/* ── Lancement ──────────────────────────────────────────────── */
window.onload = () => AuraApp.init();
