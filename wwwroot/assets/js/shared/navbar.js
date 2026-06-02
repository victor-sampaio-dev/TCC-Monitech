/**
 * Função para alternar o menu móvel (hambúrguer)
 * Compatível com todas as páginas do site
 */
function alternarMenuMobile() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('nav-menu-mobile');
  const backdrop = document.getElementById('nav-backdrop');
  
  if (!btn || !menu) return;
  
  const ativo = menu.classList.toggle('active');
  btn.classList.toggle('active', ativo);
  
  if (backdrop) {
    backdrop.classList.toggle('active', ativo);
  }
}

/**
 * Função para alternar o menu do usuário
 */
function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('active');
  }
}

/**
 * Fechar menu móvel quando um link é clicado
 */
function fecharMenuMobile() {
  const menu = document.getElementById('nav-menu-mobile');
  const btn = document.getElementById('mobile-menu-btn');
  const backdrop = document.getElementById('nav-backdrop');
  
  if (menu) menu.classList.remove('active');
  if (btn) btn.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

/**
 * Fechar menu do usuário
 */
function fecharUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) dropdown.classList.remove('active');
}

/**
 * Atualizar menu de autenticação: mostrar/esconder login e cadastro baseado no estado
 */
function atualizarMenuAutenticacao() {
  // ⚠️ Landing page verifica APENAS tokens com prefixo _landing
  const token = localStorage.getItem('monitech_token_landing');
  const expira = localStorage.getItem('monitech_expira_landing');

  // Verifica se o usuário está autenticado
  const usuarioLogado = token && expira && new Date(expira) > new Date();

  // Lê dados do usuário uma única vez para reutilizar em todo o menu
  let usuario = null;
  if (usuarioLogado) {
    try {
      const usuarioStr = localStorage.getItem('monitech_usuario_landing');
      usuario = usuarioStr ? JSON.parse(usuarioStr) : null;
    } catch (e) {
      console.warn('[atualizarMenuAutenticacao] Erro ao ler dados do usuário:', e);
    }
  }

  // --- Avatar pequeno (botão da navbar) ---
  const userAvatar = document.querySelector('#user-menu-btn .user-avatar');
  if (userAvatar) {
    if (usuarioLogado && usuario) {
      if (usuario.fotoUrl) {
        const letraNav = (usuario.nome || 'U').charAt(0).toUpperCase();
        userAvatar.innerHTML = '';
        userAvatar.style.backgroundColor = 'transparent';
        const imgNav = document.createElement('img');
        imgNav.src = usuario.fotoUrl;
        imgNav.alt = '';
        imgNav.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
        imgNav.onerror = () => {
          // Só reseta para inicial se profile-photo-manager não carregou nada ainda
          if (!userAvatar.querySelector('img[data-foto]')) {
            userAvatar.innerHTML = '';
            userAvatar.textContent = letraNav;
            userAvatar.style.backgroundColor = '';
          }
        };
        userAvatar.appendChild(imgNav);
      } else if (usuario.nome) {
        userAvatar.textContent = usuario.nome.charAt(0).toUpperCase();
        userAvatar.style.backgroundImage = '';
      }
    } else if (!usuarioLogado) {
      const SVG_USUARIO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>`;
      userAvatar.innerHTML = SVG_USUARIO;
      const svg = userAvatar.querySelector('svg');
      if (svg) {
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.color = 'currentColor';
      }
    }
  }

  // --- Dropdown header (avatar grande + nome + email) ---
  const dropdownHeader  = document.getElementById('user-dropdown-header');
  const dropdownDivider = document.getElementById('user-dropdown-divider');
  const dropdownNome    = document.getElementById('user-dropdown-nome');
  const dropdownEmail   = document.getElementById('user-dropdown-email');
  const dropdownAvatarLg = document.getElementById('user-dropdown-avatar-lg');

  if (usuarioLogado && usuario) {
    if (dropdownHeader)  dropdownHeader.style.cssText  = 'display: flex !important;';
    if (dropdownDivider) dropdownDivider.style.cssText = 'display: block !important;';
    if (dropdownNome)    dropdownNome.textContent  = usuario.nome  || 'Usuário';
    if (dropdownEmail)   dropdownEmail.textContent = usuario.email || '';
    if (dropdownAvatarLg) {
      if (usuario.fotoUrl) {
        const letraLg = (usuario.nome || 'U').charAt(0).toUpperCase();
        dropdownAvatarLg.innerHTML = '';
        dropdownAvatarLg.style.backgroundColor = 'transparent';
        const imgLg = document.createElement('img');
        imgLg.src = usuario.fotoUrl;
        imgLg.alt = '';
        imgLg.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
        imgLg.onerror = () => {
          if (!dropdownAvatarLg.querySelector('img[data-foto]')) {
            dropdownAvatarLg.innerHTML = '';
            dropdownAvatarLg.textContent = letraLg;
            dropdownAvatarLg.style.backgroundColor = '';
          }
        };
        dropdownAvatarLg.appendChild(imgLg);
      } else {
        dropdownAvatarLg.textContent = (usuario.nome || 'U').charAt(0).toUpperCase();
      }
    }
  } else {
    if (dropdownHeader)  dropdownHeader.style.cssText  = 'display: none !important;';
    if (dropdownDivider) dropdownDivider.style.cssText = 'display: none !important;';
  }

  // --- Itens do menu ---
  const loginBtn   = document.getElementById('dropdown-login');
  const cadastroBtn = document.getElementById('dropdown-cadastro');
  const configBtn  = document.getElementById('dropdown-config');
  const sobreBtn   = document.getElementById('dropdown-sobre');
  const logoutBtn  = document.getElementById('dropdown-logout');

  if (usuarioLogado) {
    if (loginBtn)    loginBtn.style.cssText    = 'display: none !important;';
    if (cadastroBtn) cadastroBtn.style.cssText = 'display: none !important;';
    if (configBtn)   configBtn.style.cssText   = 'display: flex !important;';
    if (sobreBtn)    sobreBtn.style.cssText    = 'display: flex !important;';
    if (logoutBtn)   logoutBtn.style.cssText   = 'display: flex !important;';
  } else {
    if (loginBtn)    loginBtn.style.cssText    = 'display: flex !important;';
    if (cadastroBtn) cadastroBtn.style.cssText = 'display: flex !important;';
    if (configBtn)   configBtn.style.cssText   = 'display: none !important;';
    if (sobreBtn)    sobreBtn.style.cssText    = 'display: none !important;';
    if (logoutBtn)   logoutBtn.style.cssText   = 'display: none !important;';
  }
}

function atualizarEstadoNavbar() {
  const nav = document.getElementById('nav') || document.querySelector('nav');

  if (nav) {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  }

  if (window.innerWidth > 768) {
    fecharMenuMobile();
  }
}

/**
 * Event listeners para fechar o menu quando um link é clicado
 */
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar ícones Lucide em toda a página
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  } else {
    window.addEventListener('load', function() {
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, { once: true });
  }

  const navLinks = document.querySelectorAll('.nav-menu-mobile .nav-link, .nav-menu-mobile .btn-nav-solid-mobile, .nav-menu-mobile .btn-nav-ghost-mobile');
  navLinks.forEach(link => {
    link.addEventListener('click', fecharMenuMobile);
  });

  // Fechar user dropdown ao clicar nos itens
  const userDropdownItems = document.querySelectorAll('.user-dropdown-item');
  userDropdownItems.forEach(item => {
    item.addEventListener('click', fecharUserMenu);
  });

  // Fechar user dropdown ao clicar fora
  document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu-wrapper');
    const dropdown = document.getElementById('user-dropdown');
    if (userMenu && dropdown && !userMenu.contains(event.target)) {
      dropdown.classList.remove('active');
    }
  });

  // Atualizar menu de autenticação na primeira vez que carrega
  atualizarMenuAutenticacao();

  atualizarEstadoNavbar();
});

window.addEventListener('scroll', atualizarEstadoNavbar);
window.addEventListener('resize', atualizarEstadoNavbar);
