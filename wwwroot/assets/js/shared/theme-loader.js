/**
 * theme-loader.js — MONITECH
 * Aplica o tema salvo ANTES do CSS renderizar para evitar flash.
 * Deve ser incluído no <head> SEM defer/async.
 *
 * Prioridade:
 *   1. mt_t_{userId} — preferência da conta (userId lido do localStorage)
 *   2. mt_t           — tema global/anônimo
 *   3. localStorage['tema-site'] — fallback
 *
 * Quando deslogado o localStorage não tem userId → usa mt_t (tema anônimo livre).
 * pageshow só re-sincroniza em navegação bfcache (e.persisted) para não sobrescrever
 * o tema após verificarSessaoAtiva limpar o localStorage.
 */
(function () {
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? m[1] : null;
  }

  function getTheme() {
    // 1. Cookie por usuário (userId via localStorage — presente apenas quando logado)
    try {
      const userStr = localStorage.getItem('monitech_usuario_system')
                   || localStorage.getItem('monitech_usuario_landing');
      const userId = userStr ? JSON.parse(userStr)?.id : null;
      if (userId) {
        const t = getCookie('mt_t_' + userId);
        if (t === 'light' || t === 'dark') return t;
      }
    } catch {}
    // 2. Cookie global (tema anônimo — livre para o usuário deslogado mudar)
    const gc = getCookie('mt_t');
    if (gc === 'light' || gc === 'dark') return gc;
    // 3. localStorage
    return localStorage.getItem('tema-site') === 'light' ? 'light' : 'dark';
  }

  function syncThemeAttributes() {
    const tema = getTheme();
    const isDark = tema === 'dark';
    document.documentElement.setAttribute('data-theme', tema);
    document.documentElement.setAttribute('data-theme-mode', tema);
    document.documentElement.classList.toggle('dark-theme', isDark);
    if (!document.body) return;
    document.body.setAttribute('data-theme', tema);
    document.body.classList.toggle('dark-theme', isDark);
  }

  syncThemeAttributes();
  document.addEventListener('DOMContentLoaded', syncThemeAttributes);
  window.addEventListener('pageshow', function(e) { if (e.persisted) syncThemeAttributes(); });
})();
