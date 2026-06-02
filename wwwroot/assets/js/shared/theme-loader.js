/**
 * theme-loader.js — MONITECH
 * Aplica o tema salvo ANTES do CSS renderizar para evitar flash.
 * Deve ser incluído no <head> SEM defer/async.
 */
(function () {
  function getTheme() {
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
  window.addEventListener('pageshow', syncThemeAttributes);
})();
