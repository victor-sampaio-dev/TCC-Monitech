/**
 * MONITECH — Modal de Autenticação (Website)
 * Chamadas reais ao backend C# (ASP.NET Core).
 */

const API_BASE_MODAL = 'http://localhost:5000';

let authModalState = { isOpen: false, currentTab: 'login' };

/**
 * Sistema de notificações estilizadas (substitui window.alert)
 * tipos: 'sucesso' | 'erro' | 'aviso' | 'info'
 */
function mostrarToast(mensagem, tipo = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icones = {
    sucesso: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    erro:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    aviso:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  };

  const titulos = {
    sucesso: 'Sucesso',
    erro:    'Erro',
    aviso:   'Atenção',
    info:    'Informação',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `
    <div class="toast-icon">${icones[tipo] || icones.info}</div>
    <div class="toast-body">
      <div class="toast-titulo">${titulos[tipo] || 'Aviso'}</div>
      <div class="toast-mensagem">${mensagem}</div>
    </div>
    <button class="toast-fechar" aria-label="Fechar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const fechar = () => {
    toast.classList.add('toast-saindo');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-fechar').addEventListener('click', fechar);
  container.appendChild(toast);
  setTimeout(fechar, 4500);
}

document.addEventListener('DOMContentLoaded', () => {
  const msg = sessionStorage.getItem('monitech_msg_suspensa');
  if (msg) {
    sessionStorage.removeItem('monitech_msg_suspensa');
    setTimeout(() => mostrarToast(msg, 'erro'), 500);
  }
});

async function _apiFetch(url, opcoes = {}) {
  try {
    const resp  = await fetch(API_BASE_MODAL + url, opcoes);
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) console.warn(`[AuthModal] ${url} → HTTP ${resp.status}`);
    return dados;
  } catch (err) {
    console.error('[AuthModal] Erro de rede:', err.message);
    return { sucesso: false, erro: 'Sem conexão com o servidor.' };
  }
}

function logout() {
  // Captura o tema do usuário antes de limpar a sessão, para manter a landing page consistente
  let temaAntes = 'dark';
  try {
    const userStr = localStorage.getItem('monitech_usuario_landing');
    const userId  = userStr ? JSON.parse(userStr)?.id : null;
    if (userId) temaAntes = window._getTemaUsuario?.(userId) || 'dark';
  } catch (_) {}

  // Remove APENAS tokens da LANDING PAGE
  // Não toca em tokens do system (cada página é independente)
  localStorage.removeItem('monitech_token_landing');
  localStorage.removeItem('monitech_usuario_landing');
  localStorage.removeItem('monitech_expira_landing');
  sessionStorage.clear();

  // Mantém o tema que o usuário usava antes de deslogar (mt_t_{uid} é preservado automaticamente
  // pois o userId já foi removido do localStorage — _persistirCookie não tocará nele)
  if (window.definirTema) window.definirTema(temaAntes);

  if (typeof fecharUserMenu === 'function') fecharUserMenu();
  if (typeof atualizarMenuAutenticacao === 'function') atualizarMenuAutenticacao();
  if (typeof atualizarHeaderDropdownGlobal === 'function') atualizarHeaderDropdownGlobal();
  window.location.href = '../index.html';
}

function openAuthModal() {
  const el = document.getElementById('auth-backdrop');
  if (!el) return;
  el.classList.add('active');
  authModalState.isOpen = true;
  document.body.style.overflow = 'hidden';
  // Pré-renderiza botões Google ocultos para clique instantâneo
  requestAnimationFrame(() => _renderGoogleButtons());
}

function closeAuthModal() {
  const el = document.getElementById('auth-backdrop');
  if (el) { el.classList.remove('active'); authModalState.isOpen = false; document.body.style.overflow = ''; }
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  document.querySelectorAll('.auth-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`auth-${tab}`)?.classList.add('active');
  authModalState.currentTab = tab;
}

function showForgotPassword() {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-content').forEach(c => c.classList.remove('active'));
  document.getElementById('auth-forgot')?.classList.add('active');
  authModalState.currentTab = 'forgot';
}

async function esqueceuSenhaComEmail(event) {
  if (event) event.preventDefault();
  const email = document.getElementById('forgot-email')?.value?.trim();
  if (!email) { mostrarToast('Informe seu e-mail.', 'aviso'); return; }

  const btn = document.querySelector('#forgot-form .auth-submit-btn');
  if (btn) { btn.textContent = 'Enviando...'; btn.disabled = true; }

  const resp = await _apiFetch('/api/auth/esqueceu-senha', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email })
  });

  if (btn) { btn.textContent = 'Enviar link de recuperação'; btn.disabled = false; }

  mostrarToast(
    resp.mensagem || 'Se o e-mail existir, você receberá as instruções em breve.',
    'info'
  );
  setTimeout(() => switchAuthTab('login'), 3500);
}

// ── Google Identity Services ──────────────────────────────────
const GOOGLE_CLIENT_ID = '1027718748883-khrvgfqkkr6obscdm8uou5l7h2jnjrtr.apps.googleusercontent.com';

let _googleReady = false;

function _initGoogle() {
  if (_googleReady || typeof google === 'undefined') return;
  google.accounts.id.initialize({
    client_id:             GOOGLE_CLIENT_ID,
    callback:              _handleGoogleCredential,
    auto_select:           false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt:  false
  });
  _googleReady = true;
}

// Containers ocultos com o botão oficial do Google pré-renderizado.
// Nossos botões estilizados ficam visíveis; ao clicar, acionamos o botão oculto.
let _googleLoginHidden  = null;
let _googleSignupHidden = null;

function _renderGoogleButtons() {
  _initGoogle();
  if (!_googleReady) return;

  const criar = (text) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:300px;pointer-events:none;';
    document.body.appendChild(div);
    google.accounts.id.renderButton(div, { type: 'standard', size: 'large', text, locale: 'pt-BR' });
    return div;
  };

  if (!_googleLoginHidden)  _googleLoginHidden  = criar('signin_with');
  if (!_googleSignupHidden) _googleSignupHidden = criar('signup_with');
}

function _clicarGoogleOculto(container) {
  if (!container) return false;
  const btn = container.querySelector('[data-idom-class]') ||
              container.querySelector('div[role="button"]') ||
              container.querySelector('[role="button"]');
  if (btn) { btn.click(); return true; }
  return false;
}

async function _handleGoogleCredential(response) {
  const idToken = response.credential;
  try {
    const resp = await _apiFetch('/api/auth/google', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken })
    });

    if (resp.sucesso && resp.token) {
      localStorage.setItem('monitech_token_landing',   resp.token);
      localStorage.setItem('monitech_usuario_landing', JSON.stringify(resp.usuario));
      localStorage.setItem('monitech_expira_landing',  resp.expiraEm);
      const _temaGgl = window._getTemaUsuario?.(resp.usuario?.id) || resp.usuario?.tema || 'dark';
      window._salvarTemaUsuario?.(resp.usuario?.id, _temaGgl);
      if (window.definirTema) window.definirTema(_temaGgl, true);
      closeAuthModal();
      if (typeof atualizarMenuAutenticacao === 'function') atualizarMenuAutenticacao();
      if (typeof carregarFotoPerfilGlobal  === 'function') carregarFotoPerfilGlobal();
      mostrarToast('Login com Google realizado com sucesso!', 'sucesso');
    } else {
      mostrarToast(resp.erro || 'Erro ao autenticar com Google.', 'erro');
    }
  } catch (err) {
    mostrarToast('Erro de conexão. Tente novamente.', 'erro');
  }
}

function loginWithGoogle() {
  if (typeof google === 'undefined') { mostrarToast('SDK do Google não carregou. Tente novamente.', 'aviso'); return; }
  _renderGoogleButtons();
  if (!_clicarGoogleOculto(_googleLoginHidden)) mostrarToast('Erro ao iniciar login com Google.', 'erro');
}

function signupWithGoogle() {
  if (typeof google === 'undefined') { mostrarToast('SDK do Google não carregou. Tente novamente.', 'aviso'); return; }
  _renderGoogleButtons();
  if (!_clicarGoogleOculto(_googleSignupHidden)) mostrarToast('Erro ao iniciar cadastro com Google.', 'erro');
}

async function loginWithEmail(event) {
  if (event) event.preventDefault();
  const email = document.getElementById('login-email')?.value?.trim();
  const senha = document.getElementById('login-password')?.value;
  if (!email || !senha) { mostrarToast('Preencha e-mail e senha.', 'aviso'); return; }

  const btn = document.querySelector('#login-form .auth-submit-btn');
  if (btn) { btn.textContent = 'Aguarde...'; btn.disabled = true; }

  const resp = await _apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha })
  });

  if (btn) { btn.textContent = 'Login'; btn.disabled = false; }

  if (resp.sucesso && resp.token) {
    // ⚠️ IMPORTANTE: Landing page APENAS salva tokens com prefixo "_landing"
    localStorage.setItem('monitech_token_landing',   resp.token);
    localStorage.setItem('monitech_usuario_landing', JSON.stringify(resp.usuario));
    localStorage.setItem('monitech_expira_landing',  resp.expiraEm);
    // Cookie do usuário tem prioridade; fallback para o valor do servidor
    const _temaLand = window._getTemaUsuario?.(resp.usuario?.id) || resp.usuario?.tema || 'dark';
    console.log('[TEMA v61] loginWithEmail → id:', resp.usuario?.id, '| cookie:', window._getTemaUsuario?.(resp.usuario?.id), '| server:', resp.usuario?.tema, '| final:', _temaLand, '| definirTema?', typeof window.definirTema);
    window._salvarTemaUsuario?.(resp.usuario?.id, _temaLand);
    if (window.definirTema) window.definirTema(_temaLand, true);
    closeAuthModal();
    _atualizarAvatarMenu(resp.usuario);
    if (typeof atualizarMenuAutenticacao === 'function') {
      atualizarMenuAutenticacao();
    }
    if (typeof carregarFotoPerfilGlobal === 'function') {
      carregarFotoPerfilGlobal();
    }
    mostrarToast('Login realizado! Clique em "Acessar Painel" para ir ao sistema.', 'sucesso');
  } else {
    mostrarToast(resp.erro || 'E-mail ou senha incorretos.', 'erro');
  }
}

let authState = { isSubmitting: false };

async function signupWithEmail(event) {
  if (event) event.preventDefault();

  // Previne submissão dupla
  if (authState.isSubmitting) return;
  authState.isSubmitting = true;

  const nome   = document.getElementById('signup-name')?.value?.trim();
  const email  = document.getElementById('signup-email')?.value?.trim();
  const senha  = document.getElementById('signup-password')?.value;
  const termos = document.getElementById('signup-terms')?.checked;

  if (!nome || !email || !senha) { mostrarToast('Preencha todos os campos.', 'aviso'); authState.isSubmitting = false; return; }
  if (!termos) { mostrarToast('Aceite os termos de uso.', 'aviso'); authState.isSubmitting = false; return; }
  if (senha.length < 8) { mostrarToast('Senha: mínimo 8 caracteres.', 'aviso'); authState.isSubmitting = false; return; }

  const btn = document.querySelector('#signup-form .auth-submit-btn');
  if (btn) { btn.textContent = 'Aguarde...'; btn.disabled = true; }

  try {
    const resp = await _apiFetch('/api/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });

    if (resp.sucesso) {
      mostrarToast('Conta criada com sucesso! Acesse o painel clicando em "Acessar Painel".', 'sucesso');

      // NÃO faz login automático aqui
      // O usuário deve fazer login no system.html
      switchAuthTab('login');
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = '';

    } else {
      mostrarToast(resp.erro || 'Erro ao criar conta. Tente novamente.', 'erro');
    }
  } finally {
    authState.isSubmitting = false;
    if (btn) { btn.textContent = 'Criar Conta'; btn.disabled = false; }
  }
}

function _atualizarAvatarMenu(usuario) {
  const avatar = document.querySelector('#user-menu-btn .user-avatar');
  if (avatar && usuario?.nome) avatar.textContent = usuario.nome.charAt(0).toUpperCase();
}

function verificarSessaoAtiva() {
  // Landing page verifica APENAS tokens com prefixo _landing
  const token = localStorage.getItem('monitech_token_landing');
  const expira = localStorage.getItem('monitech_expira_landing');

  if (token && expira && new Date(expira) > new Date()) {
    try { _atualizarAvatarMenu(JSON.parse(localStorage.getItem('monitech_usuario_landing'))); } catch(_){}
    if (typeof atualizarMenuAutenticacao === 'function') atualizarMenuAutenticacao();
    return true;
  }
  localStorage.removeItem('monitech_token_landing');
  localStorage.removeItem('monitech_usuario_landing');
  localStorage.removeItem('monitech_expira_landing');
  if (typeof atualizarMenuAutenticacao === 'function') atualizarMenuAutenticacao();
  return false;
}

document.addEventListener('DOMContentLoaded', function () {
  verificarSessaoAtiva();
  document.querySelector('.auth-close-btn')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-backdrop')?.addEventListener('click', e => {
    if (e.target.id === 'auth-backdrop') closeAuthModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && authModalState.isOpen) closeAuthModal();
  });
  document.querySelector('[data-tab="login"]')?.classList.add('active');
  document.getElementById('auth-login')?.classList.add('active');
  document.querySelectorAll('.auth-tab').forEach(t =>
    t.addEventListener('click', () => switchAuthTab(t.dataset.tab))
  );

  // Inicializa Google assim que o script dele estiver disponível
  // O script é carregado com async/defer, então pode já estar pronto aqui
  if (typeof google !== 'undefined') {
    _initGoogle();
  } else {
    // Aguarda o script do Google carregar
    window.addEventListener('load', _initGoogle, { once: true });
  }
});
