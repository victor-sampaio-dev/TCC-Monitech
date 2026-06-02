/**
 * MAGNIFIC ICONS LOADER
 * Carrega ícones para usuários não autenticados
 */

(function () {
  'use strict';

  // SVG de usuário simples (sem conta)
  const SVG_USUARIO_SIMPLES = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>`;


  console.log('[icon-loader] Loader iniciado');

  /**
   * Este loader é exclusivo para páginas de landing (tokens _landing).
   * Qualquer página que tenha um token de sistema válido não deve ter o avatar substituído.
   */
  function ehPaginaSistema() {
    // Verifica pelo caminho
    const path = window.location.pathname;
    if (path.includes('/system/') || path.includes('/website/settings')) return true;

    // Verifica se há token de sistema válido (usuário logado no painel)
    const tokenSystem = localStorage.getItem('monitech_token_system');
    const expiraSystem = localStorage.getItem('monitech_expira_system');
    if (tokenSystem && expiraSystem && new Date(expiraSystem) > new Date()) return true;

    return false;
  }

  /**
   * Obter dados do usuário logado (verifica APENAS tokens de landing page)
   */
  function obterUsuarioLogado() {
    // ⚠️ Landing page verifica APENAS tokens com prefixo _landing
    const token = localStorage.getItem('monitech_token_landing');
    const expira = localStorage.getItem('monitech_expira_landing');
    const usuarioStr = localStorage.getItem('monitech_usuario_landing');

    if (!token || !expira || !usuarioStr) {
      return null;
    }

    if (new Date(expira) <= new Date()) {
      return null;
    }

    try {
      return JSON.parse(usuarioStr);
    } catch (e) {
      return null;
    }
  }

  /**
   * Monitorar mudanças no localStorage (APENAS tokens de landing)
   */
  function monitorarAutenticacao() {
    window.addEventListener('storage', (e) => {
      // ⚠️ Landing page monitora APENAS mudanças em tokens _landing
      if (
        e.key === 'monitech_token_landing' ||
        e.key === 'monitech_usuario_landing' ||
        e.key === 'monitech_expira_landing'
      ) {
        console.log('[icon-loader] Autenticação da LANDING mudou, verificando ícones');
        injetarIconeNaoAutenticado();
      }
    });
  }

  /**
   * Injetar ícone no avatar quando não autenticado
   */
  function injetarIconeNaoAutenticado() {
    // Não interfere em páginas do sistema (que usam tokens próprios, não _landing)
    if (ehPaginaSistema()) return;

    const usuario = obterUsuarioLogado();

    if (usuario) {
      console.log('[icon-loader] Usuário logado, mantendo foto de perfil');
      return;
    }

    const avatars = document.querySelectorAll('.user-avatar');

    if (!avatars.length) {
      console.log('[icon-loader] Nenhum avatar .user-avatar encontrado');
      return;
    }

    avatars.forEach((avatar) => {
      // Não sobrescreve se profile-photo-manager já carregou uma foto (img com data-foto)
      if (avatar.querySelector('img[data-foto]')) return;
      avatar.innerHTML = SVG_USUARIO_SIMPLES;

      const svg = avatar.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.color = 'currentColor';
      }
    });
  }

  /**
   * Inicializar
   */
  function init() {
    console.log('[icon-loader] Inicializando loader de ícones...');

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[icon-loader] DOM carregado, injetando ícones');
        injetarIconeNaoAutenticado();
        monitorarAutenticacao();
      });
    } else {
      console.log('[icon-loader] DOM já carregado, injetando ícones');
      injetarIconeNaoAutenticado();
      monitorarAutenticacao();
    }
  }

  init();

  /**
   * Funções globais para teste no console
   */
  window.injetarIconeNaoAutenticadoGlobal = injetarIconeNaoAutenticado;

})();