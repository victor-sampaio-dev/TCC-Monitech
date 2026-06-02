/**
 * MONITECH — Theme Toggle Button
 * Gerencia alternância de tema claro/escuro no navbar
 * Funciona sem autenticação, salvando no localStorage
 */

(function() {
  'use strict';

  const CHAVE_TEMA = 'tema-site';

  const SVG_MOON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const SVG_SUN  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;
  
  /**
   * Obter tema atual
   */
  function getTemaCurrent() {
    const t = localStorage.getItem(CHAVE_TEMA);
      return t === 'light' ? 'light' : 'dark';
  }
  
  /**
   * Aplicar tema e atualizar todos os botões de toggle
   */
  function setTema(tema) {
    const t = tema === 'light' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-theme-mode', t);
    document.body.setAttribute('data-theme', t);
    document.body.classList.toggle('dark-theme', t === 'dark');

    localStorage.setItem(CHAVE_TEMA, t);

    // Atualiza ícone em TODOS os botões de toggle da página
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      const icon = btn.querySelector('.theme-toggle-icon');
      if (icon) icon.innerHTML = t === 'light' ? SVG_SUN : SVG_MOON;
    });
  }

  /**
   * Alternar tema — exposto globalmente para uso inline (onclick)
   */
  function toggleTema() {
    const atual = getTemaCurrent();
    setTema(atual === 'light' ? 'dark' : 'light');
  }

  window.alternarTema = toggleTema;

  /**
   * Inicializar
   */
  function init() {
    // Aplica tema salvo
    setTema(getTemaCurrent());

    // Registra listener em todos os botões com classe theme-toggle-btn (guard contra duplicatas)
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      if (!btn.dataset.themeListenerAttached) {
        btn.dataset.themeListenerAttached = '1';
        btn.addEventListener('click', toggleTema);
      }
    });
  }
  
  // Executar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
