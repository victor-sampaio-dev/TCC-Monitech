/**
 * MONITECH — Global Profile Photo Manager
 * Gerencia a foto de perfil do usuário em todo o site
 */

(function() {
  'use strict';

  let _carregando = false;

  function detectarContextoPagina() {
    const path = window.location.pathname;
    return (path.includes('/system/') || path.includes('/website/settings')) ? 'system' : 'landing';
  }

  function getAuthToken() {
    const ctx = detectarContextoPagina();
    if (ctx === 'system') return localStorage.getItem('monitech_token_system');
    const token  = localStorage.getItem('monitech_token_landing');
    const expira = localStorage.getItem('monitech_expira_landing');
    if (!token || !expira || new Date(expira) <= new Date()) return null;
    return token;
  }

  function obterUsuarioDoCache() {
    const ctx        = detectarContextoPagina();
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

  function mostrarFotoDoCache() {
    const ctx        = detectarContextoPagina();
    const usuarioKey = ctx === 'system' ? 'monitech_usuario_system' : 'monitech_usuario_landing';
    try {
      const u = JSON.parse(localStorage.getItem(usuarioKey));
      if (u && u.fotoUrl) atualizarFotoEmTodoSite(u.fotoUrl, u.nome);
    } catch (_) {}
  }

  async function carregarFotoPerfil() {
    if (_carregando) return;
    const token = getAuthToken();
    if (!token) return;
    try {
      _carregando = true;
      const response = await fetch('/api/usuario/me', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.sucesso && data.fotoUrl) {
        atualizarFotoEmTodoSite(data.fotoUrl, data.nome);
        const ctx        = detectarContextoPagina();
        const usuarioKey = ctx === 'system' ? 'monitech_usuario_system' : 'monitech_usuario_landing';
        try {
          const cached = JSON.parse(localStorage.getItem(usuarioKey) || '{}');
          if (cached.fotoUrl !== data.fotoUrl) {
            cached.fotoUrl = data.fotoUrl;
            localStorage.setItem(usuarioKey, JSON.stringify(cached));
          }
        } catch (_) {}
      }
    } catch (_) {
    } finally {
      _carregando = false;
    }
  }

  function atualizarFotoEmTodoSite(fotoUrl, nome) {
    const usuario      = obterUsuarioDoCache();
    const letraInicial = (nome || usuario?.nome || 'U')[0].toUpperCase();

    const seletores = [
      '#profile-avatar',
      '#account-avatar',
      '#user-menu-btn .user-avatar',
      '#user-dropdown-header .user-dropdown-avatar-lg',
      '.user-avatar-lg',
      '.user-info-avatar',
    ];

    seletores.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) atualizarAvatar(el, fotoUrl, letraInicial);
    });

    document.querySelectorAll('.user-profile-avatar').forEach(el => {
      atualizarAvatar(el, fotoUrl, letraInicial);
    });
  }

  function atualizarAvatar(elemento, fotoUrl, letraInicial) {
    if (!elemento) return;

    if (fotoUrl) {
      // Pula se img já está carregada com sucesso para a mesma URL
      const imgExistente = elemento.querySelector('img');
      if (imgExistente && imgExistente.complete && imgExistente.naturalWidth > 0 &&
          imgExistente.getAttribute('data-foto') === fotoUrl) return;

      elemento.innerHTML = '';
      elemento.style.backgroundColor = 'transparent';
      elemento.title = 'Foto de perfil';

      const cssImg = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
      let tentativa = 0;

      function tentarCarregar() {
        const img = document.createElement('img');
        img.src = fotoUrl;
        img.alt = '';
        img.dataset.foto = fotoUrl;
        img.style.cssText = cssImg;
        img.onerror = () => {
          tentativa++;
          if (tentativa < 3) {
            setTimeout(tentarCarregar, tentativa === 1 ? 3000 : 10000);
          } else {
            elemento.innerHTML = '';
            elemento.textContent = letraInicial;
            elemento.style.backgroundColor = '';
            elemento.title = 'Usuário';
          }
        };
        elemento.innerHTML = '';
        elemento.appendChild(img);
      }

      tentarCarregar();
    } else {
      elemento.textContent = letraInicial;
      elemento.style.backgroundColor = '';
      elemento.title = 'Usuário';
    }
  }

  window.atualizarFotoGlobal = function(fotoUrl, nome) {
    atualizarFotoEmTodoSite(fotoUrl, nome);
  };

  window.removerFotoGlobal = function(nome) {
    atualizarFotoEmTodoSite(null, nome);
  };

  function init() {
    setTimeout(() => {
      mostrarFotoDoCache();
      carregarFotoPerfil();
    }, 50);

    setInterval(carregarFotoPerfil, 5 * 60 * 1000);

    window.addEventListener('storage', (e) => {
      const chaveToken = ['monitech_token_landing', 'monitech_token_system', 'monitech_token'];
      if (chaveToken.includes(e.key)) carregarFotoPerfil();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.carregarFotoPerfilGlobal  = carregarFotoPerfil;
  window.atualizarFotoEmTodoSiteGlobal = atualizarFotoEmTodoSite;

})();
