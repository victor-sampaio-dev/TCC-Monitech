/**
 * MONITECH — User Info Display in Dropdown
 * Exibe informações do usuário logado no header do dropdown menu
 */

(function() {
  'use strict';

  function detectarContexto() {
    const path = window.location.pathname;
    return (path.includes('/system/') || path.includes('/website/settings')) ? 'system' : 'landing';
  }

  function obterUsuarioDoCache() {
    const ctx        = detectarContexto();
    const tokenKey   = ctx === 'system' ? 'monitech_token_system'   : 'monitech_token_landing';
    const expiraKey  = ctx === 'system' ? 'monitech_expira_system'  : 'monitech_expira_landing';
    const usuarioKey = ctx === 'system' ? 'monitech_usuario_system' : 'monitech_usuario_landing';

    const token      = localStorage.getItem(tokenKey);
    const expira     = localStorage.getItem(expiraKey);
    const usuarioStr = localStorage.getItem(usuarioKey);

    if (!token || !expira || !usuarioStr) return null;
    if (new Date(expira) <= new Date()) return null;

    try { return JSON.parse(usuarioStr); } catch (_) { return null; }
  }

  async function obterUsuarioDaAPI() {
    const ctx   = detectarContexto();
    const token = localStorage.getItem(ctx === 'system' ? 'monitech_token_system' : 'monitech_token_landing');
    if (!token) return null;

    try {
      const response = await fetch('/api/usuario/me', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data.sucesso && data.nome) {
        return { id: data.id, nome: data.nome, email: data.email, fotoUrl: data.fotoUrl };
      }
    } catch (_) {}
    return null;
  }

  function atualizarHeaderDropdown(usuario) {
    const headerEl   = document.getElementById('user-dropdown-header');
    const dividerEl  = document.getElementById('user-dropdown-divider');
    const avatarEl   = document.querySelector('#user-dropdown-header .user-dropdown-avatar-lg');
    const nomeEl     = document.getElementById('user-dropdown-nome');
    const emailEl    = document.getElementById('user-dropdown-email');

    if (!headerEl || !dividerEl) return;

    if (usuario && usuario.nome) {
      if (avatarEl) {
        const inicial = usuario.nome.charAt(0).toUpperCase();
        if (usuario.fotoUrl) {
          avatarEl.style.backgroundImage = `url('${usuario.fotoUrl}')`;
          avatarEl.style.backgroundSize = 'cover';
          avatarEl.style.backgroundPosition = 'center';
          avatarEl.textContent = '';
        } else {
          avatarEl.style.backgroundImage = '';
          avatarEl.textContent = inicial;
        }
      }
      if (nomeEl)  nomeEl.textContent  = usuario.nome;
      if (emailEl) emailEl.textContent = usuario.email || '';

      headerEl.style.cssText  = 'display: flex !important;';
      dividerEl.style.cssText = 'display: block !important;';
    } else {
      headerEl.style.cssText  = 'display: none !important;';
      dividerEl.style.cssText = 'display: none !important;';
    }
  }

  async function inicializar() {
    const usuarioCache = obterUsuarioDoCache();
    if (usuarioCache) atualizarHeaderDropdown(usuarioCache);

    const usuarioAPI = await obterUsuarioDaAPI();
    if (usuarioAPI && usuarioAPI.nome) {
      if (!usuarioCache ||
          usuarioCache.nome  !== usuarioAPI.nome ||
          usuarioCache.email !== usuarioAPI.email ||
          usuarioCache.fotoUrl !== usuarioAPI.fotoUrl) {
        atualizarHeaderDropdown(usuarioAPI);
        const ctx        = detectarContexto();
        const usuarioKey = ctx === 'system' ? 'monitech_usuario_system' : 'monitech_usuario_landing';
        try {
          const cached = JSON.parse(localStorage.getItem(usuarioKey) || '{}');
          Object.assign(cached, usuarioAPI);
          localStorage.setItem(usuarioKey, JSON.stringify(cached));
        } catch (_) {}
      }
    }
  }

  window.atualizarHeaderDropdownGlobal = inicializar;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }

})();
