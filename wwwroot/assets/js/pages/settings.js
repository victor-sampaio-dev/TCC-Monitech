/**
 * settings.js — MONITECH
 * Gerencia tema, tabs e interações da página de configurações.
 */

const CHAVE_TEMA = 'tema-site';

/* ── Utilitários de tema ── */
function getTheme() {
  return localStorage.getItem(CHAVE_TEMA) === 'light' ? 'light' : 'dark';
}

function applyTheme(tema, save = true) {
  const t = tema === 'light' ? 'light' : 'dark';

  // Aplicar no <html> (selector principal do CSS)
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.setAttribute('data-theme-mode', t);

  // Aplicar no <body> (compatibilidade)
  document.body.setAttribute('data-theme', t);
  if (t === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }

  if (save) localStorage.setItem(CHAVE_TEMA, t);

  updateThemeUI(t);
}

function updateThemeUI(tema) {
  // Atualiza radio buttons
  const radio = document.querySelector(`input[name="theme"][value="${tema}"]`);
  if (radio) radio.checked = true;

  // Atualiza label
  const label = document.getElementById('theme-current-label');
  if (label) label.textContent = tema === 'light' ? 'Claro' : 'Escuro';

  // Atualiza visual dos cards
  document.querySelectorAll('.theme-card').forEach(card => {
    const input = card.querySelector('input[type="radio"]');
    if (input && input.value === tema) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  // Atualiza o live preview
  updateLivePreview(tema);
}

function updateLivePreview(tema) {
  const lp = document.querySelector('.live-preview');
  if (!lp) return;

  if (tema === 'dark') {
    lp.style.background = '#020a14';
    lp.style.borderColor = '#1f2937';
    const topbar = lp.querySelector('.lp-topbar');
    if (topbar) { topbar.style.background = '#050f1e'; topbar.style.borderColor = '#1f2937'; }
    const card = lp.querySelector('.lp-card');
    if (card) { card.style.background = '#071628'; card.style.borderColor = 'rgba(0,212,255,0.1)'; }
    const vals = lp.querySelectorAll('.lp-metric-val');
    vals.forEach(v => v.style.color = '#e8f4ff');
    const keys = lp.querySelectorAll('.lp-metric-key');
    keys.forEach(k => k.style.color = '#3d6080');
    const header = lp.querySelector('.lp-card-header');
    if (header) header.style.color = '#e8f4ff';
    const logoText = lp.querySelector('.lp-logo-text');
    if (logoText) logoText.style.color = '#e8f4ff';
    const badges = lp.querySelectorAll('.lp-badge:not(.lp-badge-success):not(.lp-badge-accent)');
    badges.forEach(b => { b.style.background = '#111827'; b.style.borderColor = '#1f2937'; b.style.color = '#3d6080'; });
    const body = lp.querySelector('.lp-body');
    if (body) body.style.background = '#020a14';
  } else {
    lp.style.background = '#eef1f8';
    lp.style.borderColor = '#e2e8f2';
    const topbar = lp.querySelector('.lp-topbar');
    if (topbar) { topbar.style.background = '#ffffff'; topbar.style.borderColor = '#e2e8f2'; }
    const card = lp.querySelector('.lp-card');
    if (card) { card.style.background = '#ffffff'; card.style.borderColor = '#e2e8f2'; }
    const vals = lp.querySelectorAll('.lp-metric-val');
    vals.forEach(v => v.style.color = '#0b1724');
    const keys = lp.querySelectorAll('.lp-metric-key');
    keys.forEach(k => k.style.color = '#7a8fa8');
    const header = lp.querySelector('.lp-card-header');
    if (header) header.style.color = '#0b1724';
    const logoText = lp.querySelector('.lp-logo-text');
    if (logoText) logoText.style.color = '#0b1724';
    const badges = lp.querySelectorAll('.lp-badge:not(.lp-badge-success):not(.lp-badge-accent)');
    badges.forEach(b => { b.style.background = '#f7f8fc'; b.style.borderColor = '#e2e8f2'; b.style.color = '#52677b'; });
    const body = lp.querySelector('.lp-body');
    if (body) body.style.background = '#eef1f8';
  }
}

/* ── Tabs ── */
function showTab(nome) {
  // Esconde todos os painéis
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(t => t.classList.remove('active'));

  const painel = document.getElementById('panel-' + nome);
  const tab = document.getElementById('tab-' + nome);
  if (painel) painel.classList.add('active');
  if (tab) tab.classList.add('active');
}

/* ── Toast ── */
function showToast(msg, tipo = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const iconEl = document.getElementById('toast-icon');
  if (!toast) return;

  const tipos = {
    success: { icon: '✓', bg: '#0057ff', border: 'rgba(0,87,255,0.4)' },
    warn:    { icon: '⚠', bg: '#cc8a00', border: 'rgba(204,138,0,0.4)' },
    info:    { icon: 'ℹ', bg: '#374151', border: 'rgba(55,65,81,0.4)' },
    error:   { icon: '✕', bg: '#d93d63', border: 'rgba(217,61,99,0.4)' },
  };

  const cfg = tipos[tipo] || tipos.success;
  toast.style.background = cfg.bg;
  toast.style.borderColor = cfg.border;
  if (msgEl) msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = cfg.icon;

  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ── Range label ── */
function updateRangeLabel(input) {
  const label = document.getElementById('range-val');
  if (label) label.textContent = input.value;
}

function updateRangeLabelLanding(input) {
  const label = document.getElementById('landing-range-val');
  if (label) label.textContent = input.value;
}

/* ── Config Dispositivo (landing) ── */
function salvarConfigDispositivo() {
  const intervalo = document.getElementById('landing-interval')?.value || '5';
  localStorage.setItem('monitech_intervalo_landing', intervalo);
  showToast(`Intervalo salvo: ${intervalo}s`, 'success');
}

function salvarTarifaLanding() {
  const distribuidora = document.getElementById('landing-distribuidora')?.value.trim() || '';
  const tarifa = document.getElementById('landing-tarifa')?.value || '';
  if (!tarifa) { showToast('Informe a tarifa em R$/kWh.', 'error'); return; }
  const cfg = { distribuidora, tarifa: parseFloat(tarifa) };
  localStorage.setItem('monitech_tarifa_landing', JSON.stringify(cfg));
  showToast('Tarifa de energia salva!', 'success');
}

function carregarConfigDispositivo() {
  const intervalo = localStorage.getItem('monitech_intervalo_landing') || '5';
  const sliderEl = document.getElementById('landing-interval');
  const labelEl  = document.getElementById('landing-range-val');
  if (sliderEl) sliderEl.value = intervalo;
  if (labelEl)  labelEl.textContent = intervalo;

  const tarifaRaw = localStorage.getItem('monitech_tarifa_landing');
  if (tarifaRaw) {
    const cfg = JSON.parse(tarifaRaw);
    const distEl   = document.getElementById('landing-distribuidora');
    const tarifaEl = document.getElementById('landing-tarifa');
    if (distEl && cfg.distribuidora) distEl.value = cfg.distribuidora;
    if (tarifaEl && cfg.tarifa)      tarifaEl.value = cfg.tarifa;
  }
}

/* ── Notificações (landing) — persiste no backend ── */
async function salvarNotificacoesLanding() {
  const token = getAuthToken();
  if (!token) { showToast('Você precisa estar logado.', 'error'); return; }

  const kwh   = parseFloat(document.getElementById('notif-limite-kwh')?.value)   || null;
  const custo = parseFloat(document.getElementById('notif-limite-custo')?.value) || null;

  const payload = {
    emailAlertas:   document.getElementById('notif-email')?.checked    ?? true,
    alertaAnomalia: document.getElementById('notif-tensao')?.checked   ?? true,
    alertaConsumo:  document.getElementById('notif-kwh')?.checked      ?? true,
    alertaTensao:   document.getElementById('notif-custo')?.checked    ?? false,
    alertaSensor:   document.getElementById('notif-sensor')?.checked   ?? true,
    limiteKwh:   kwh,
    limiteCusto: custo,
  };

  try {
    const res = await fetch('/api/usuario/notificacoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.sucesso) {
      localStorage.setItem('monitech_notif_landing', JSON.stringify(payload));
      showToast('Preferências de notificação salvas!', 'success');
    } else {
      showToast(data.erro || 'Erro ao salvar preferências.', 'error');
    }
  } catch {
    showToast('Erro de conexão. Tente novamente.', 'error');
  }
}

function salvarLimitesNotificacao() {
  salvarNotificacoesLanding();
}

async function carregarNotificacoesLanding() {
  const token = getAuthToken();

  // fallback para localStorage enquanto não logado
  if (!token) {
    _carregarNotifLocalStorage();
    return;
  }

  try {
    const res = await fetch('/api/usuario/notificacoes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) { _carregarNotifLocalStorage(); return; }
    const data = await res.json();
    if (!data.sucesso) { _carregarNotifLocalStorage(); return; }

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    set('notif-email',  data.emailAlertas   ?? true);
    set('notif-tensao', data.alertaAnomalia ?? true);
    set('notif-kwh',    data.alertaConsumo  ?? true);
    set('notif-custo',  data.alertaTensao   ?? false);
    set('notif-sensor', data.alertaSensor   ?? true);

    const kwhEl   = document.getElementById('notif-limite-kwh');
    const custoEl = document.getElementById('notif-limite-custo');
    if (kwhEl   && data.limiteKwh)   kwhEl.value   = data.limiteKwh;
    if (custoEl && data.limiteCusto) custoEl.value = data.limiteCusto;
  } catch {
    _carregarNotifLocalStorage();
  }
}

function _carregarNotifLocalStorage() {
  const cfgRaw = localStorage.getItem('monitech_notif_landing');
  if (cfgRaw) {
    const cfg = JSON.parse(cfgRaw);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    set('notif-email',  cfg.emailAlertas   ?? true);
    set('notif-tensao', cfg.alertaAnomalia ?? true);
    set('notif-kwh',    cfg.alertaConsumo  ?? true);
    set('notif-custo',  cfg.alertaTensao   ?? false);
    set('notif-sensor', cfg.alertaSensor   ?? true);
    const kwhEl   = document.getElementById('notif-limite-kwh');
    const custoEl = document.getElementById('notif-limite-custo');
    if (kwhEl   && cfg.limiteKwh)   kwhEl.value   = cfg.limiteKwh;
    if (custoEl && cfg.limiteCusto) custoEl.value = cfg.limiteCusto;
  }
}

/* ── Protocol options fallback ── */
function initProtocolOptions() {
  document.querySelectorAll('.proto-opt').forEach(opt => {
    const radio = opt.querySelector('input[type="radio"]');
    if (!radio) return;
    if (radio.checked) opt.classList.add('proto-selected');
    radio.addEventListener('change', () => {
      document.querySelectorAll('.proto-opt').forEach(o => o.classList.remove('proto-selected'));
      if (radio.checked) opt.classList.add('proto-selected');
    });
  });
}

/* ── FOTO DE PERFIL ── */

// Recuperar a URL do token JWT (do localStorage)
function getAuthToken() {
  return localStorage.getItem('monitech_token_landing');
}

// Carrega os dados do perfil incluindo foto
async function carregarPerfilUsuario() {
  try {
    const token = getAuthToken();
    if (!token) return;

    const response = await fetch('/api/usuario/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Erro ao carregar perfil:', response.status);
      return;
    }

    const data = await response.json();
    if (data.sucesso) {
      atualizarAvatarInterface(data.fotoUrl, data.nome);
      const nomeEl = document.getElementById('settings-nome');
      const emailEl = document.getElementById('settings-email');
      if (nomeEl) nomeEl.value = data.nome || '';
      if (emailEl) emailEl.value = data.email || '';

      // Sidebar header
      const sideUsername = document.getElementById('sidebar-username');
      const sideEmail    = document.getElementById('sidebar-email');
      if (sideUsername) sideUsername.textContent = data.nome || 'Usuário';
      if (sideEmail)    sideEmail.textContent    = data.email || '—';
    }
  } catch (err) {
    console.error('[ERRO] Ao carregar perfil:', err);
  }
}

// Atualiza o avatar na interface (settings.html)
function atualizarAvatarInterface(fotoUrl, nome) {
  const avatar = document.getElementById('profile-avatar');
  if (!avatar) return;

  if (fotoUrl) {
    avatar.innerHTML = '';
    const img = document.createElement('img');
    img.src = fotoUrl;
    img.alt = 'Foto de perfil';
    avatar.appendChild(img);
    const btnRemove = document.getElementById('btn-remove-photo');
    if (btnRemove) btnRemove.style.display = 'block';

    // Sidebar header avatar com foto
    const sideAvatar = document.getElementById('sidebar-avatar');
    if (sideAvatar) {
      sideAvatar.innerHTML = '';
      const sideImg = document.createElement('img');
      sideImg.src = fotoUrl;
      sideImg.alt = nome || '';
      sideImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      sideAvatar.appendChild(sideImg);
    }
  } else {
    const initial = nome?.[0]?.toUpperCase() || 'U';
    avatar.innerHTML = `<span class="avatar-initial">${initial}</span>`;
    const btnRemove = document.getElementById('btn-remove-photo');
    if (btnRemove) btnRemove.style.display = 'none';

    const sideAvatar = document.getElementById('sidebar-avatar');
    if (sideAvatar) sideAvatar.textContent = initial;
  }

  if (window.atualizarFotoGlobal) {
    const usuario = JSON.parse(localStorage.getItem('monitech_usuario') || '{}');
    window.atualizarFotoGlobal(fotoUrl, nome || usuario.nome || 'U');
  }
}

// Trigger do input de arquivo ao clicar no avatar ou botão
function triggerFileInput() {
  document.getElementById('profile-file-input').click();
}

// Handle ao selecionar um arquivo
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('profile-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const arquivo = e.target.files?.[0];
      if (arquivo) {
        validarEMostrarPreview(arquivo);
      }
    });
  }
});

// Valida e mostra preview da foto
function validarEMostrarPreview(arquivo) {
  // Validar tamanho
  const tamanhoMB = arquivo.size / (1024 * 1024);
  if (tamanhoMB > 5) {
    showToast('Arquivo muito grande! Máximo 5MB.', 'error');
    return;
  }

  // Validar tipo
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!tiposPermitidos.includes(arquivo.type)) {
    showToast('Tipo de arquivo inválido. Use JPG, PNG ou WebP.', 'error');
    return;
  }

  // Ler e mostrar preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewImg = document.getElementById('preview-img');
    const previewInfo = document.getElementById('preview-info');
    const previewSection = document.getElementById('profile-photo-preview');

    if (previewImg) previewImg.src = e.target.result;
    
    if (previewInfo) {
      previewInfo.innerHTML = `
        <strong>Arquivo:</strong> ${arquivo.name} — 
        <strong>Tamanho:</strong> ${tamanhoMB.toFixed(2)}MB — 
        <strong>Tipo:</strong> ${arquivo.type}
      `;
    }

    if (previewSection) {
      previewSection.style.display = 'flex';
      previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  reader.readAsDataURL(arquivo);
}

// Confirmar upload da foto
async function confirmarUploadFoto() {
  try {
    const fileInput = document.getElementById('profile-file-input');
    const arquivo = fileInput.files?.[0];
    
    if (!arquivo) {
      showToast('Nenhum arquivo selecionado.', 'error');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      showToast('Você precisa estar logado.', 'error');
      return;
    }

    // Mostrar loading
    const avatar = document.getElementById('profile-avatar');
    if (avatar) avatar.classList.add('loading');

    const formData = new FormData();
    formData.append('arquivo', arquivo);

    const response = await fetch('/api/usuario/foto', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.erro || 'Erro ao fazer upload');
    }

    const data = await response.json();
    if (data.sucesso) {
      // Atualiza avatar
      atualizarAvatarInterface(data.fotoUrl, null);
      
      // Limpa preview
      cancelarPreview();
      
      showToast('Foto de perfil atualizada com sucesso! 📷', 'success');
    }
  } catch (err) {
    console.error('[ERRO] Upload:', err);
    showToast(`Erro: ${err.message}`, 'error');
  } finally {
    const avatar = document.getElementById('profile-avatar');
    if (avatar) avatar.classList.remove('loading');
  }
}

// Cancelar preview
function cancelarPreview() {
  const previewSection = document.getElementById('profile-photo-preview');
  const fileInput = document.getElementById('profile-file-input');
  
  if (previewSection) previewSection.style.display = 'none';
  if (fileInput) fileInput.value = '';
}

// Remover foto (com confirmação)
function removerFotoConfirm() {
  if (confirm('Tem certeza que deseja remover sua foto de perfil?')) {
    removerFoto();
  }
}

// Remover foto
async function removerFoto() {
  try {
    const token = getAuthToken();
    if (!token) {
      showToast('Você precisa estar logado.', 'error');
      return;
    }

    const response = await fetch('/api/usuario/foto', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.erro || 'Erro ao remover foto');
    }

    const data = await response.json();
    if (data.sucesso) {
      atualizarAvatarInterface(null, 'U');
      showToast('Foto de perfil removida.', 'success');
    }
  } catch (err) {
    console.error('[ERRO] Remover foto:', err);
    showToast(`Erro: ${err.message}`, 'error');
  }
}

/* ── Salvar perfil (landing) ── */
async function salvarPerfilLanding() {
  const nome = (document.getElementById('settings-nome')?.value || '').trim();
  if (!nome) { showToast('Informe seu nome.', 'error'); return; }

  const token = getAuthToken();
  if (!token) { showToast('Você precisa estar logado.', 'error'); return; }

  try {
    const response = await fetch('/api/usuario/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ nome })
    });
    const data = await response.json();
    if (data.sucesso) {
      const usuario = JSON.parse(localStorage.getItem('monitech_usuario_landing') || '{}');
      usuario.nome = data.usuario.nome;
      localStorage.setItem('monitech_usuario_landing', JSON.stringify(usuario));
      if (window.atualizarFotoGlobal) window.atualizarFotoGlobal(usuario.fotoUrl, data.usuario.nome);
      showToast('Perfil atualizado com sucesso!', 'success');
    } else {
      showToast(data.erro || 'Erro ao salvar perfil.', 'error');
    }
  } catch (err) {
    console.error('[salvarPerfilLanding]', err);
    showToast('Erro de conexão. Tente novamente.', 'error');
  }
}

/* ── Alterar senha (landing) ── */
async function alterarSenhaLanding() {
  const senhaAtual = document.getElementById('settings-pass-atual')?.value || '';
  const novaSenha  = document.getElementById('settings-pass-nova')?.value || '';
  const confirmar  = document.getElementById('settings-pass-confirmar')?.value || '';

  if (!senhaAtual || !novaSenha || !confirmar) {
    showToast('Preencha todos os campos de senha.', 'error'); return;
  }
  if (novaSenha !== confirmar) {
    showToast('A nova senha e a confirmação não coincidem.', 'error'); return;
  }
  if (novaSenha.length < 8) {
    showToast('A nova senha deve ter no mínimo 8 caracteres.', 'error'); return;
  }

  const token = getAuthToken();
  if (!token) { showToast('Você precisa estar logado.', 'error'); return; }

  try {
    const response = await fetch('/api/usuario/senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ senhaAtual, novaSenha })
    });
    const data = await response.json();
    if (data.sucesso) {
      document.getElementById('settings-pass-atual').value = '';
      document.getElementById('settings-pass-nova').value = '';
      document.getElementById('settings-pass-confirmar').value = '';
      showToast('Senha alterada com sucesso!', 'success');
    } else {
      showToast(data.erro || 'Erro ao alterar senha.', 'error');
    }
  } catch (err) {
    console.error('[alterarSenhaLanding]', err);
    showToast('Erro de conexão. Tente novamente.', 'error');
  }
}

/* ── Excluir conta (landing) — abre modal estilizado ── */
function deletarContaLanding() {
  const input = document.getElementById('landing-delete-input');
  const btn   = document.getElementById('btn-confirmar-excluir-landing');
  if (input) input.value = '';
  if (btn)   btn.disabled = true;
  abrirModalSettings('modal-excluir-conta');
}

function verificarInputExclusaoLanding(valor) {
  const btn = document.getElementById('btn-confirmar-excluir-landing');
  if (btn) btn.disabled = valor !== 'EXCLUIR';
}

async function confirmarExclusaoContaLanding() {
  fecharModalSettings('modal-excluir-conta');

  const token = getAuthToken();
  if (!token) { showToast('Você precisa estar logado.', 'error'); return; }

  try {
    const response = await fetch('/api/usuario', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({})
    });
    const data = await response.json();
    if (data.sucesso) {
      showToast('Conta excluída. Até logo!', 'success');
      setTimeout(() => {
        localStorage.removeItem('monitech_token_landing');
        localStorage.removeItem('monitech_usuario_landing');
        localStorage.removeItem('monitech_expira_landing');
        window.location.href = '../index.html';
      }, 2000);
    } else {
      showToast(data.erro || 'Erro ao excluir conta.', 'error');
    }
  } catch (err) {
    console.error('[confirmarExclusaoContaLanding]', err);
    showToast('Erro de conexão. Tente novamente.', 'error');
  }
}

function abrirModalSettings(id)  { document.getElementById(id)?.classList.add('open'); }
function fecharModalSettings(id) { document.getElementById(id)?.classList.remove('open'); }

/* ── Mobile nav ── */
function alternarMenuMobile() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('nav-menu-mobile');
  const backdrop = document.getElementById('nav-backdrop');
  if (!menu) return;
  const ativo = menu.classList.toggle('active');
  if (btn) btn.classList.toggle('active', ativo);
  if (backdrop) backdrop.classList.toggle('active', ativo);
}

/* ── showTab override — carrega dados ao trocar de aba ── */
const _origShowTab = typeof showTab === 'function' ? showTab : null;
function showTab(nome) {
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(t => t.classList.remove('active'));
  const painel = document.getElementById('panel-' + nome);
  const tab    = document.getElementById('tab-' + nome);
  if (painel) painel.classList.add('active');
  if (tab)    tab.classList.add('active');

  if (nome === 'dispositivo')   carregarConfigDispositivo();
  if (nome === 'notificacoes')  carregarNotificacoesLanding();
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const tema = getTheme();
  applyTheme(tema, false);

  // Listeners dos radio de tema
  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', function () {
      applyTheme(this.value, true);
      showToast(
        this.value === 'dark' ? 'Tema Escuro ativado!' : 'Tema Claro ativado!',
        'success'
      );
    });
  });

  // Protocolo options fallback
  initProtocolOptions();

  // Carregar perfil do usuário
  carregarPerfilUsuario();

  // Pré-carregar config das abas (caso já ativas)
  carregarConfigDispositivo();
  carregarNotificacoesLanding();

  // Nav scroll
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
  });
});
