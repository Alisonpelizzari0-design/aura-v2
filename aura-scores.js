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

      case 'sante': {
        const d = this._read('aura_sante_v1', null);
        if (!d) return null;
        const today = new Date().toISOString().slice(0,10);
        const last7 = Array.from({length:7}, (_,i) => { const dt=new Date(); dt.setDate(dt.getDate()-i); return dt.toISOString().slice(0,10); });

        // Hydratation : moyenne sur 7 jours / objectif 8 verres
        const waterVals = last7.map(ds => d.water?.[ds] || 0);
        const waterAvg = waterVals.reduce((s,v)=>s+v,0) / 7;
        const waterScore = Math.min(100, (waterAvg/8)*100);

        // Sommeil : moyenne sur 7 jours / objectif 7-9h
        const sleepEntries = last7.map(ds => d.sleep?.[ds]?.hours).filter(h => h !== undefined);
        const sleepAvg = sleepEntries.length ? sleepEntries.reduce((s,v)=>s+v,0)/sleepEntries.length : null;
        const sleepScore = sleepAvg !== null ? Math.max(0, Math.min(100, 100 - Math.abs(8-sleepAvg)*20)) : 50;

        // Activité physique : nb d'activités sur 7 jours / objectif 3-4
        const actCount = (d.activities||[]).filter(a => last7.includes(a.date)).length;
        const actScore = Math.min(100, (actCount/4)*100);

        const score = Math.round((waterScore + sleepScore + actScore) / 3);
        return { score, detail: `Hydratation ${Math.round(waterScore)}%, sommeil ${Math.round(sleepScore)}%, activité ${Math.round(actScore)}%` };
      }

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
        if (!d?.tasks?.length) return null;
        const doneCount = d.tasks.filter(t => t.done).length;
        const score = Math.round((doneCount/d.tasks.length)*100);
        return { score, detail: `${doneCount}/${d.tasks.length} tâches d'entretien faites` };
      }

      case 'famille': {
        const d = this._read('aura_social_v1', null);
        if (!d?.contacts?.length) return null;
        const onTrack = d.contacts.filter(c => Math.abs(c.lastContact) < 21).length;
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

  /* ── Met à jour les affichages globaux (sidebar + topbar) sur TOUTE page ──
     Appelée depuis main.js après chaque navigation, comme l'était
     AuraUI.updateXPDisplays() avant — mais avec un vrai score calculé. */
  updateGlobalDisplays() {
    const score = this.globalScore();
    const sidebarEl = document.getElementById('sb-user-level');
    const topbarEl  = document.getElementById('top-xp');
    if (sidebarEl) sidebarEl.textContent = score !== null ? `Score de vie : ${score}/100` : 'Score de vie : —';
    if (topbarEl)  topbarEl.textContent  = score !== null ? `Score : ${score}/100` : 'Score : —';
  },
};

window.AuraScores = AuraScores;
