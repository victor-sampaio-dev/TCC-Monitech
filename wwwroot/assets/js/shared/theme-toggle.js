/**
 * MONITECH — Theme Toggle Button
 * Persistência: mt_t (global/anônimo) + mt_t_{userId} (por conta, só quando logado).
 * userId vem do localStorage — naturalmente nulo quando deslogado, evitando sobrescrever
 * a preferência do usuário com escolhas anônimas.
 */

(function() {
  'use strict';

  const CHAVE_TEMA = 'tema-site';

  const SVG_MOON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const SVG_SUN  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;

  // ── Helpers de cookie ────────────────────────────────────────
  function setCookie(name, value, days) {
    const exp = new Date(Date.now() + (days || 365) * 864e5).toUTCString();
    document.cookie = name + '=' + value + '; expires=' + exp + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? m[1] : null;
  }

  // Lê o userId do localStorage — retorna null quando deslogado (chave removida no logout).
  // Isso garante que toggles anônimos nunca sobrescrevam mt_t_{uid}.
  function _userIdAtual() {
    try {
      const s = localStorage.getItem('monitech_usuario_system')
             || localStorage.getItem('monitech_usuario_landing');
      return s ? (JSON.parse(s)?.id || null) : null;
    } catch { return null; }
  }

  function _persistirCookie(tema) {
    setCookie('mt_t', tema);
    const uid = _userIdAtual();           // null quando deslogado → não toca mt_t_{uid}
    if (uid) setCookie('mt_t_' + uid, tema);
    localStorage.setItem(CHAVE_TEMA, tema);
  }

  // ── API pública ──────────────────────────────────────────────
  /** Lê o tema salvo em cookie para um userId específico */
  function getTemaUsuario(userId) {
    if (!userId) return null;
    const t = getCookie('mt_t_' + userId);
    return (t === 'light' || t === 'dark') ? t : null;
  }

  /** Salva tema no cookie do usuário (chamado pelo login) */
  function salvarTemaUsuario(userId, tema) {
    const t = tema === 'light' ? 'light' : 'dark';
    setCookie('mt_t_' + userId, t);
    setCookie('mt_t', t);
    localStorage.setItem(CHAVE_TEMA, t);
  }

  /** Reseta o tema anônimo para dark (chamado pelo logout) */
  function resetarTemaAnonimo() {
    setCookie('mt_t', 'dark');
    localStorage.setItem(CHAVE_TEMA, 'dark');
    // mt_t_{uid} preservado — restaurado no próximo login
  }

  window._getTemaUsuario     = getTemaUsuario;
  window._salvarTemaUsuario  = salvarTemaUsuario;
  window._resetarTemaAnonimo = resetarTemaAnonimo;

  // ── Core ─────────────────────────────────────────────────────
  function getTemaCurrent() {
    // Prioridade igual ao theme-loader.js: userId → mt_t_{uid} > mt_t global > localStorage
    const uid = _userIdAtual();
    if (uid) {
      const t = getCookie('mt_t_' + uid);
      if (t === 'light' || t === 'dark') return t;
    }
    const gc = getCookie('mt_t');
    if (gc === 'light' || gc === 'dark') return gc;
    return localStorage.getItem(CHAVE_TEMA) === 'light' ? 'light' : 'dark';
  }

  function setTema(tema, skipSalvar) {
    const t = tema === 'light' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-theme-mode', t);
    document.body.setAttribute('data-theme', t);
    document.body.classList.toggle('dark-theme', t === 'dark');

    localStorage.setItem(CHAVE_TEMA, t);

    window.dispatchEvent(new CustomEvent('monitech:tema-mudou', { detail: { tema: t } }));

    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      const icon = btn.querySelector('.theme-toggle-icon');
      if (icon) icon.innerHTML = t === 'light' ? SVG_SUN : SVG_MOON;
    });

    if (!skipSalvar) _persistirCookie(t);
  }

  function toggleTema() {
    setTema(getTemaCurrent() === 'light' ? 'dark' : 'light');
  }

  window.alternarTema = toggleTema;
  window.definirTema  = setTema;

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    setTema(getTemaCurrent(), true);

    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      if (!btn.dataset.themeListenerAttached) {
        btn.dataset.themeListenerAttached = '1';
        btn.addEventListener('click', toggleTema);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
