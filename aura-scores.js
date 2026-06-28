/* ============================================================
   AURA — aura-scores.js
   Moteur de calcul des scores de vie — remplace la logique XP.

   Philosophie : AURA n'est plus un jeu à points, c'est un carnet
   de bord honnête. Chaque score de sphère est calculé à partir de
   FAITS RÉELS (actions faites, chiffres réels dans les autres
   modules), pas de points accumulés en cliquant des boutons.

   Mélange calcul auto + ajustement manuel :
   - computeAutoScore(sphereKey) lit les données réelles des autres
     modules et propose un score de base.
   - L'utilisatrice peut toujours ajuster manuellement via le slider
     dans spheres.html — son ajustement est respecté et mémorisé
     séparément (scoreOverrides), recalculé seulement si elle clique
     "Recalculer automatiquement".
   ============================================================ */
'use strict';

const AuraScores = {

  /* ── Lecture sécurisée d'une clé localStorage JSON ── */
  _read(key, fallback) {
    try {
      const r = localStorage.getItem(key);
      return r ? JSON.parse(r) : fallback;
    } catch(_) { return fallback; }
  },

  /* ── Calcul du score AUTOMATIQUE d'une sphère, basé sur des faits réels ──
     Retourne { score: 0-100, detail: "explication courte" } ou null si pas
     assez de données pour calculer (dans ce cas, on garde le score manuel). */
  computeAutoScore(sphereKey) {
    switch (sphereKey) {

      // Santé n'a plus de mesure automatique possible depuis la refonte
      // du module (hydratation/sommeil/activité retirés sur demande —
      // trop chronophages à saisir au quotidien). La sphère redevient
      // 100% manuelle, comme Travail et Création — honnête plutôt que
      // de calculer un score à partir de champs qui n'existent plus.
      case 'sante':
        return null;

      case 'dev': {
        const habD = this._read('aura_habitudes_v1', null);
        const ritD = this._read('aura_rituels_v1', null);
        if (!habD && !ritD) return null;

        let habScore = null, ritScore = null;
        if (habD?.habits?.length) {
          const today = new Date();
          const last7 = Array.from({length:7}, (_,i) => { const dt=new Date(today); dt.setDate(dt.getDate()-i); return dt.toISOString().slice(0,10); });
          let totalPossible = 0, totalDone = 0;
          habD.habits.forEach(h => {
            totalPossible += last7.length;
            totalDone += last7.filter(ds => h.log.includes(ds)).length;
          });
          habScore = totalPossible ? Math.round((totalDone/totalPossible)*100) : null;
        }
        if (ritD?.entries?.length) {
          const today = new Date();
          const last7 = Array.from({length:7}, (_,i) => { const dt=new Date(today); dt.setDate(dt.getDate()-i); return dt.toISOString().slice(0,10); });
          const doneCount = ritD.entries.filter(e => last7.includes(e.date)).length;
          ritScore = Math.round((doneCount/7)*100);
        }
        const parts = [habScore, ritScore].filter(s => s !== null);
        if (!parts.length) return null;
        const score = Math.round(parts.reduce((s,v)=>s+v,0)/parts.length);
        return { score, detail: `Habitudes ${habScore??'—'}%, rituel matin ${ritScore??'—'}%` };
      }

      case 'finance': {
        const d = this._read('aura_finance_v1', null);
        if (!d) return null;
        const revenus = (d.revenus||[]).reduce((s,x)=>s+x.montant,0);
        const charges = (d.charges||[]).reduce((s,x)=>s+x.montant,0);
        const epargneMensuelle = (d.epargne||[]).reduce((s,x)=>s+(x.mensuel||0),0);

        if (!revenus) return null;
        // Taux de charges (sain si <50% des revenus)
        const chargeRatio = charges/revenus;
        const chargeScore = Math.max(0, Math.min(100, 100 - (chargeRatio*100 - 30)*2)); // pénalise au-delà de 30%
        // Taux d'effort épargne (sain si >=15% des revenus épargnés/mois)
        const epargneRatio = revenus > 0 ? epargneMensuelle/revenus : 0;
        const epargneScore = Math.min(100, (epargneRatio/0.15)*100);

        const score = Math.round((chargeScore*0.5) + (epargneScore*0.5));
        return { score, detail: `Charges ${Math.round(chargeRatio*100)}% des revenus, épargne ${Math.round(epargneRatio*100)}%/mois` };
      }

      case 'maison': {
        const d = this._read('aura_maison_v1', null);
        if (!d?.cards?.length) return null;
        // Structure mise à jour : tasks/declutter vivent maintenant
        // dans chaque carte de type "piece", plutôt qu'à la racine.
        const pieces = d.cards.filter(c => c.type === 'piece');
        if (!pieces.length) return null;
        const isTaskDone = (t) => {
          if (!t.doneAt) return false;
          const done = new Date(t.doneAt);
          const now = new Date();
          if (t.freq === 'Quotidien') return done.toDateString() === now.toDateString();
          if (t.freq === 'Hebdomadaire') { const ws=new Date(now); ws.setDate(now.getDate()-((now.getDay()+6)%7)); ws.setHours(0,0,0,0); return done>=ws; }
          if (t.freq === 'Mensuel') return done.getFullYear()===now.getFullYear() && done.getMonth()===now.getMonth();
          return true;
        };
        let totalTasks = 0, doneTasks = 0;
        pieces.forEach(p => { (p.tasks||[]).forEach(t => { totalTasks++; if (isTaskDone(t)) doneTasks++; }); });
        if (!totalTasks) return null;
        const score = Math.round((doneTasks/totalTasks)*100);
        return { score, detail: `${doneTasks}/${totalTasks} tâches d'entretien à jour` };
      }

      case 'famille': {
        const d = this._read('aura_social_v1', null);
        if (!d?.contacts?.length) return null;
        // Calcul en direct depuis la vraie date de dernier contact —
        // lastContact était un compteur figé à 0 pour toujours côté
        // social.html (jamais recalculé), corrigé pour utiliser
        // lastContactDate, la vraie date stockée, comme source unique.
        const today = new Date();
        const daysSince = (c) => {
          if (!c.lastContactDate) return 0;
          const last = new Date(c.lastContactDate);
          return Math.floor((today - last) / 86400000);
        };
        const onTrack = d.contacts.filter(c => daysSince(c) < 21).length;
        const score = Math.round((onTrack/d.contacts.length)*100);
        return { score, detail: `${onTrack}/${d.contacts.length} relations entretenues récemment` };
      }

      case 'vision': {
        const d = this._read('aura_visionboard_v1', null);
        if (!d?.cards?.length) return null;
        const avgProgress = d.cards.reduce((s,c) => {
          const pct = c.steps?.length ? (c.steps.filter(st=>st.done).length / c.steps.length) * 100 : 0;
          return s + pct;
        }, 0) / d.cards.length;
        const score = Math.round(avgProgress);
        return { score, detail: `${d.cards.length} objectif(s) en moyenne à ${score}% de progression` };
      }

      // Travail et Création n'ont pas de module dédié pour mesurer un fait objectif —
      // on laisse le score 100% manuel pour ces deux sphères.
      case 'travail':
      case 'creation':
      default:
        return null;
    }
  },

  /* ── Score global de vie = moyenne des 8 scores actuels (manuels ou auto) ── */
  globalScore() {
    try {
      const sph = this._read('aura_spheres_v1', null);
      if (!sph?.scores) return null;
      const vals = Object.values(sph.scores);
      if (!vals.length) return null;
      return Math.round(vals.reduce((s,v)=>s+v,0) / vals.length);
    } catch(_) { return null; }
  },

  /* ── Met à jour les affichages globaux (sidebar) sur TOUTE page ──
     Compose le texte avec le statut de connexion (géré par
     aura-db.js:updateSidebarAuth) plutôt que de l'écraser — les deux
     fonctions écrivaient auparavant dans le même élément sans se
     coordonner. #top-xp n'est plus ciblé : cet élément a été retiré
     de index.html avec l'étoile XP de la topbar, en début de refonte. */
  updateGlobalDisplays() {
    const score = this.globalScore();
    const sidebarEl = document.getElementById('sb-user-level');
    if (sidebarEl) {
      const statut = window.SupaClient?.isLoggedIn?.() ? '✓ Connectée' : 'Mode local';
      sidebarEl.textContent = score !== null ? `${statut} · Score ${score}/100` : statut;
    }
  },
};

window.AuraScores = AuraScores;
