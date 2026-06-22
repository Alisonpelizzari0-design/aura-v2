/* ============================================================
   AURA — aura-editor.js
   Système d'édition inline universel pour tous les modules.

   Principe :
   - Chaque module marque ses textes éditables avec data-aura-edit="cle.unique"
   - Un bouton flottant "Éditer cette page" active le mode édition
   - En mode édition, tous les éléments marqués deviennent contenteditable
   - Les modifications sont stockées dans localStorage (aura_content_overrides)
   - À chaque chargement de module, les overrides sont ré-appliqués automatiquement
   - Fonctionne par-dessus le HTML d'origine sans jamais le modifier

   Usage dans un module HTML :
   <div data-aura-edit="dashboard.hero.title">Texte par défaut</div>

   Le system s'auto-applique après chaque navigate() via un hook sur AuraApp.loadModule.
   ============================================================ */
'use strict';

const AuraEditor = {
  _key: 'aura_content_overrides_v1',
  _data: null,
  editMode: false,
  _toolbar: null,

  /* ── Store des overrides ─────────────────────────────────── */
  get() {
    if (this._data) return this._data;
    try {
      const r = localStorage.getItem(this._key);
      this._data = r ? JSON.parse(r) : {};
    } catch(_) { this._data = {}; }
    return this._data;
  },

  save() {
    try { localStorage.setItem(this._key, JSON.stringify(this._data)); } catch(_) {}
    this.syncToDB();
  },

  setOverride(key, value) {
    const d = this.get();
    if (value === '' || value == null) delete d[key];
    else d[key] = value;
    this.save();
  },

  getOverride(key) {
    return this.get()[key];
  },

  /* ── Applique tous les overrides connus au DOM actuel ────── */
  applyOverrides(scopeModule) {
    const d = this.get();
    document.querySelectorAll('[data-aura-edit]').forEach(el => {
      const key = el.getAttribute('data-aura-edit');
      if (d[key] !== undefined) {
        // Respecte le type d'élément (texte simple vs HTML interne)
        if (el.hasAttribute('data-aura-edit-html')) el.innerHTML = d[key];
        else el.textContent = d[key];
      }
    });
  },

  /* ── Récupère tous les éléments éditables visibles du module courant ── */
  scanCurrentModule() {
    const els = [...document.querySelectorAll('#app-content [data-aura-edit]')];
    return els.map(el => ({
      key: el.getAttribute('data-aura-edit'),
      el,
      current: el.hasAttribute('data-aura-edit-html') ? el.innerHTML : el.textContent.trim(),
      label: el.getAttribute('data-aura-edit-label') || this._humanizeKey(el.getAttribute('data-aura-edit')),
    }));
  },

  _humanizeKey(key) {
    const parts = key.split('.');
    return parts[parts.length - 1].replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase());
  },

  /* ── Mode édition inline ──────────────────────────────────── */
  toggleEditMode() {
    this.editMode = !this.editMode;
    this._applyEditableState();
    this._updateToolbarState();

    if (this.editMode) {
      AuraUI.showToast('✏️ Mode édition activé — clique sur un texte pour le modifier');
    } else {
      AuraUI.showToast('✓ Mode édition désactivé');
    }
  },

  /* ── Applique ou retire l'état éditable sur les éléments visibles ──
     Centralisé ici pour éviter d'accumuler des écouteurs en double :
     on retire toujours l'ancien listener avant d'en ajouter un nouveau,
     que ce soit au toggle manuel ou après une navigation entre modules. */
  _applyEditableState() {
    const els = document.querySelectorAll('#app-content [data-aura-edit]');
    els.forEach(el => {
      el.contentEditable = this.editMode ? 'true' : 'false';
      el.classList.toggle('aura-editable-active', this.editMode);
      // Toujours retirer avant d'ajouter — empêche tout doublon d'écouteur
      el.removeEventListener('blur', this._onBlurHandler);
      el.removeEventListener('keydown', this._onKeydownHandler);
      if (this.editMode) {
        el.addEventListener('blur', this._onBlurHandler);
        el.addEventListener('keydown', this._onKeydownHandler);
      }
    });
  },

  _onBlurHandler(e) {
    const el = e.target;
    const key = el.getAttribute('data-aura-edit');
    const value = el.hasAttribute('data-aura-edit-html') ? el.innerHTML : el.textContent;
    AuraEditor.setOverride(key, value);
  },

  _onKeydownHandler(e) {
    // Empêche le retour à la ligne dans les titres courts (pas les zones data-aura-edit-multiline)
    if (e.key === 'Enter' && !e.target.hasAttribute('data-aura-edit-multiline')) {
      e.preventDefault();
      e.target.blur();
    }
    if (e.key === 'Escape') {
      e.target.blur();
    }
  },

  /* ── Toolbar flottante ────────────────────────────────────── */
  injectToolbar() {
    if (document.getElementById('aura-editor-toolbar')) return;
    const bar = document.createElement('div');
    bar.id = 'aura-editor-toolbar';
    bar.innerHTML = `
      <button id="aura-edit-toggle-btn" onclick="AuraEditor.toggleEditMode()" title="Activer/désactiver l'édition">
        <i class="ti ti-edit"></i>
      </button>
      <div id="aura-edit-panel" style="display:none">
        <div class="aura-edit-panel-header">
          <i class="ti ti-pencil" style="font-size:14px"></i>
          <span>Édition active</span>
        </div>
        <div class="aura-edit-panel-body">
          Clique sur n'importe quel texte souligné pour le modifier directement. <kbd>Entrée</kbd> ou <kbd>Échap</kbd> pour valider.
        </div>
        <div class="aura-edit-panel-actions">
          <button onclick="AuraEditor.openFullPanel()"><i class="ti ti-list"></i> Voir tous les textes</button>
          <button onclick="AuraEditor.resetModule()" class="danger"><i class="ti ti-refresh"></i> Réinitialiser cette page</button>
        </div>
      </div>`;
    document.body.appendChild(bar);
    this._toolbar = bar;
    this._injectStyles();
  },

  _updateToolbarState() {
    const btn = document.getElementById('aura-edit-toggle-btn');
    const panel = document.getElementById('aura-edit-panel');
    if (btn) btn.classList.toggle('active', this.editMode);
    if (panel) panel.style.display = this.editMode ? 'block' : 'none';
  },

  _injectStyles() {
    if (document.getElementById('aura-editor-styles')) return;
    const style = document.createElement('style');
    style.id = 'aura-editor-styles';
    style.textContent = `
      #aura-editor-toolbar {
        position: fixed; bottom: 1.5rem; left: 1.5rem; z-index: 95;
        display: flex; flex-direction: column-reverse; align-items: flex-start; gap: .75rem;
      }
      #aura-edit-toggle-btn {
        width: 50px; height: 50px; border-radius: 50%;
        background: var(--white); border: 1px solid var(--bd2);
        box-shadow: 0 4px 16px rgba(0,0,0,.1);
        color: var(--t2); font-size: 19px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all .15s;
      }
      #aura-edit-toggle-btn:hover { transform: scale(1.06); }
      #aura-edit-toggle-btn.active {
        background: #7C3AED; color: #fff; border-color: #7C3AED;
        box-shadow: 0 4px 20px rgba(124,58,237,.4);
      }
      #aura-edit-panel {
        background: var(--white); border: 1px solid var(--pu-b); border-radius: var(--r-lg);
        padding: 1rem; width: 280px; box-shadow: 0 8px 30px rgba(0,0,0,.12);
      }
      .aura-edit-panel-header {
        display: flex; align-items: center; gap: 6px;
        font-size: 12.5px; font-weight: 700; color: var(--pu-d); margin-bottom: .5rem;
      }
      .aura-edit-panel-body { font-size: 11.5px; color: var(--t2); line-height: 1.5; margin-bottom: .75rem; }
      .aura-edit-panel-body kbd {
        background: var(--bg); border: 1px solid var(--bd2); border-radius: 4px;
        padding: 1px 5px; font-size: 10px; font-family: monospace;
      }
      .aura-edit-panel-actions { display: flex; flex-direction: column; gap: 6px; }
      .aura-edit-panel-actions button {
        font-size: 11px; font-weight: 700; padding: 7px 10px; border-radius: var(--r-md);
        border: 1px solid var(--pu-b); background: var(--pu-l); color: var(--pu-d);
        cursor: pointer; text-align: left; display: flex; align-items: center; gap: 6px;
        transition: all .12s;
      }
      .aura-edit-panel-actions button:hover { background: var(--pu-m); }
      .aura-edit-panel-actions button.danger {
        border-color: var(--re-b); background: var(--re-l); color: var(--re);
      }
      .aura-edit-panel-actions button.danger:hover { background: #FEE2E2; }

      [data-aura-edit].aura-editable-active {
        outline: 1.5px dashed var(--pu-b); outline-offset: 3px; border-radius: 4px;
        cursor: text; transition: outline-color .12s;
      }
      [data-aura-edit].aura-editable-active:hover {
        outline-color: #7C3AED; background: var(--pu-l);
      }
      [data-aura-edit].aura-editable-active:focus {
        outline: 2px solid #7C3AED; background: var(--white);
      }

      /* Panneau complet liste des textes */
      .aura-full-edit-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 400;
        display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px);
      }
      .aura-full-edit-box {
        background: var(--white); border-radius: var(--r-xl); padding: 1.5rem;
        width: 100%; max-width: 560px; max-height: 80vh; overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,.2);
      }
      .aura-full-edit-item { margin-bottom: 1rem; }
      .aura-full-edit-item:last-child { margin-bottom: 0; }
      .aura-full-edit-label {
        font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
        color: var(--t2); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;
      }
      .aura-full-edit-key { font-size: 9px; color: var(--t3); font-family: monospace; font-weight: 400; text-transform: none; }
      .aura-full-edit-input {
        width: 100%; font-size: 12.5px; padding: 8px 12px; border-radius: var(--r-md);
        border: 1px solid var(--bd2); background: var(--bg); color: var(--text); outline: none;
        font-family: var(--font); resize: vertical;
      }
      .aura-full-edit-input:focus { border-color: #7C3AED; background: var(--white); }

      @media(max-width: 768px) {
        #aura-editor-toolbar { bottom: calc(74px + env(safe-area-inset-bottom,0)); left: .875rem; }
        #aura-edit-panel { width: calc(100vw - 1.75rem); max-width: 280px; }
      }
    `;
    document.head.appendChild(style);
  },

  /* ── Panneau complet : tous les textes du module en liste ── */
  openFullPanel() {
    const items = this.scanCurrentModule();
    const existing = document.getElementById('aura-full-edit-overlay');
    if (existing) existing.remove();

    if (!items.length) {
      AuraUI.showToast('Ce module ne contient pas encore de textes éditables');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'aura-full-edit-overlay';
    overlay.id = 'aura-full-edit-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
      <div class="aura-full-edit-box" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
          <div style="font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px">
            <i class="ti ti-list" style="color:#7C3AED"></i> Tous les textes de cette page
          </div>
          <button onclick="document.getElementById('aura-full-edit-overlay').remove()" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:18px"><i class="ti ti-x"></i></button>
        </div>
        ${items.map((item, i) => `
          <div class="aura-full-edit-item">
            <div class="aura-full-edit-label">${item.label} <span class="aura-full-edit-key">${item.key}</span></div>
            <textarea class="aura-full-edit-input" rows="2" data-edit-key="${item.key}" data-edit-html="${item.el.hasAttribute('data-aura-edit-html')}">${item.current}</textarea>
          </div>`).join('')}
        <div style="display:flex;gap:8px;margin-top:1.25rem">
          <button onclick="AuraEditor.saveFullPanel()" style="flex:1;padding:10px;border-radius:var(--r-md);background:#7C3AED;color:#fff;border:none;cursor:pointer;font-weight:700;font-size:13px">
            <i class="ti ti-check"></i> Tout enregistrer
          </button>
          <button onclick="document.getElementById('aura-full-edit-overlay').remove()" style="flex:1;padding:10px;border-radius:var(--r-md);background:var(--bg);color:var(--t2);border:1px solid var(--bd2);cursor:pointer;font-weight:700;font-size:13px">
            Annuler
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  saveFullPanel() {
    const inputs = document.querySelectorAll('#aura-full-edit-overlay textarea[data-edit-key]');
    let count = 0;
    inputs.forEach(inp => {
      const key = inp.getAttribute('data-edit-key');
      const isHtml = inp.getAttribute('data-edit-html') === 'true';
      const value = inp.value;
      const target = document.querySelector(`[data-aura-edit="${key}"]`);

      this.setOverride(key, value);

      // Si le champ a été vidé, setOverride a supprimé la clé d'override —
      // il ne faut donc PAS vider le texte affiché, mais le laisser tel qu'il
      // était avant (le texte par défaut du module, déjà dans le DOM). Sans
      // ce garde-fou, vider un champ effaçait visuellement le texte au lieu
      // de simplement annuler la personnalisation.
      if (target && value !== '') {
        if (isHtml) target.innerHTML = value;
        else target.textContent = value;
      }
      count++;
    });
    document.getElementById('aura-full-edit-overlay')?.remove();
    AuraUI.showToast(`✓ ${count} texte${count>1?'s':''} mis à jour`);
  },

  /* ── Réinitialiser les overrides du module courant ────────── */
  resetModule() {
    const items = this.scanCurrentModule();
    if (!items.length) { AuraUI.showToast('Rien à réinitialiser sur cette page'); return; }
    if (!confirm(`Réinitialiser les ${items.length} texte(s) personnalisé(s) de cette page ?`)) return;
    const d = this.get();
    items.forEach(item => delete d[item.key]);
    this.save();
    AuraUI.showToast('✓ Textes réinitialisés — rechargement de la page...');
    setTimeout(() => { if (window.AuraApp) AuraApp.loadModule(AuraApp.current); }, 600);
  },

  /* ── Sync Supabase (clé/valeur simple) ───────────────────── */
  async syncToDB() {
    if (!window.SupaClient?.isLoggedIn()) return;
    try {
      await SupaClient.upsert('content_overrides', {
        user_id: SupaClient.userId(),
        overrides: JSON.stringify(this.get()),
      }, 'user_id');
    } catch(e) { console.warn('[AuraEditor sync]', e.message); }
  },

  async syncFromDB() {
    if (!window.SupaClient?.isLoggedIn()) return;
    try {
      const rows = await SupaClient.select('content_overrides', `user_id=eq.${SupaClient.userId()}`);
      if (rows?.[0]?.overrides) {
        this._data = JSON.parse(rows[0].overrides);
        try { localStorage.setItem(this._key, JSON.stringify(this._data)); } catch(_) {}
      }
    } catch(e) { console.warn('[AuraEditor pull]', e.message); }
  },
};

/* ══════════════════════════════════════════════════
   HOOK AUTOMATIQUE — s'accroche à AuraApp.loadModule
   sans modifier main.js directement
══════════════════════════════════════════════════ */
function _hookEditorIntoApp() {
  if (!window.AuraApp || AuraApp._editorHooked) {
    if (!window.AuraApp) { setTimeout(_hookEditorIntoApp, 50); return; }
  }
  if (AuraApp._editorHooked) return;
  AuraApp._editorHooked = true;

  const originalLoad = AuraApp.loadModule.bind(AuraApp);
  AuraApp.loadModule = async function(name) {
    await originalLoad(name);
    // Après le rendu du module, ré-appliquer les overrides de contenu
    AuraEditor.applyOverrides(name);
    // Si le mode édition était actif, le réactiver sur le nouveau contenu
    // (sans risque de doublon : _applyEditableState retire toujours l'ancien
    // écouteur avant d'en poser un nouveau)
    if (AuraEditor.editMode) AuraEditor._applyEditableState();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  AuraEditor.injectToolbar();
  AuraEditor.syncFromDB().then(() => AuraEditor.applyOverrides());
  _hookEditorIntoApp();
});

window.AuraEditor = AuraEditor;
