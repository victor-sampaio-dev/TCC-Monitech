// ===================================================
// ESTADO GLOBAL DA APLICAÇÃO
// Pronto para integração com banco de dados.
// Substitua as chamadas localStorage por requisições fetch() à API.
// ===================================================
let appState = {
  usuario:      null,
  role:         'user',  // 'admin' | 'user'
  residencia:   null,
  residencias:  [],      // todas as residências do usuário
  sensor:       null,
  comodos:      [],
  dispositivos: [],
  leituras:     [],
  alertas:      [],
  dadosAoVivo:  { volts: 0, amps: 0, watts: 0, pf: 0, freq: 0, kwh: 0 }
};

const CHAVE_TEMA_SITE = 'tema-site';

/** Retorna true se o usuário logado é administrador */
function isAdmin() { return appState.role === 'admin'; }

/** Mostra ou oculta elementos por role: data-admin-only e data-user-only */
function _aplicarPermissoes() {
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.style.display = isAdmin() ? '' : 'none';
  });
  document.querySelectorAll('[data-user-only]').forEach(el => {
    el.style.display = isAdmin() ? 'none' : '';
  });
}

// ===================================================
// SISTEMA DE ALERTAS CUSTOMIZADOS
// ===================================================

let alertContainer = null;

/** Inicializa o container de alertas */
function inicializarContainerAlertas() {
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'alerts-container';
    alertContainer.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
      pointer-events: none;
    `;
    document.body.appendChild(alertContainer);
  }
}

/**
 * Exibe um alerta customizado
 * @param {string} tipo - 'success', 'error', 'warning', 'info'
 * @param {string} titulo - Título do alerta
 * @param {string} mensagem - Mensagem do alerta
 * @param {number} duracao - Duração em ms (0 = não fecha automaticamente)
 */
function mostrarAlerta(tipo = 'info', titulo = '', mensagem = '', duracao = 5000) {
  inicializarContainerAlertas();

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const colors = {
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: 'var(--warn)',
    info: 'var(--cyan)'
  };

  const alerta = document.createElement('div');
  alerta.className = `alert alert-${tipo}`;
  alerta.innerHTML = `
    <div class="alert-icon">${icons[tipo] || icons.info}</div>
    <div class="alert-content">
      ${titulo ? `<div class="alert-title">${titulo}</div>` : ''}
      ${mensagem ? `<div class="alert-message">${mensagem}</div>` : ''}
    </div>
    <button class="alert-close" onclick="this.parentElement.remove()">×</button>
  `;

  alerta.style.cssText = `
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: var(--bg-card);
    border: 1px solid ${colors[tipo]};
    border-left: 4px solid ${colors[tipo]};
    border-radius: 8px;
    padding: 16px;
    font-size: 13px;
    color: var(--text-primary);
    animation: slideInRight 0.3s ease-out;
    pointer-events: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;

  // Estilo do ícone
  const iconEl = alerta.querySelector('.alert-icon');
  iconEl.style.cssText = `
    font-size: 20px;
    color: ${colors[tipo]};
    font-weight: bold;
    flex-shrink: 0;
    min-width: 24px;
    text-align: center;
  `;

  // Estilo do conteúdo
  const contentEl = alerta.querySelector('.alert-content');
  contentEl.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;

  // Estilo do título
  const titleEl = alerta.querySelector('.alert-title');
  if (titleEl) {
    titleEl.style.cssText = `
      font-weight: 600;
      color: ${colors[tipo]};
    `;
  }

  // Estilo da mensagem
  const msgEl = alerta.querySelector('.alert-message');
  if (msgEl) {
    msgEl.style.cssText = `
      color: var(--text-secondary);
      font-size: 12px;
    `;
  }

  // Estilo do botão fechar
  const closeBtn = alerta.querySelector('.alert-close');
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: ${colors[tipo]};
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    margin: -4px -8px -4px 0;
    opacity: 0.7;
    transition: opacity 0.2s;
    flex-shrink: 0;
  `;
  closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
  closeBtn.onmouseout = () => closeBtn.style.opacity = '0.7';

  alertContainer.appendChild(alerta);

  // Auto-remover após duracao
  if (duracao > 0) {
    setTimeout(() => {
      alerta.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => alerta.remove(), 300);
    }, duracao);
  }

  return alerta;
}

/** Exibe alerta de sucesso */
function alertaSucesso(titulo, mensagem = '', duracao = 4000) {
  return mostrarAlerta('success', titulo, mensagem, duracao);
}

/** Exibe alerta de erro */
function alertaErro(titulo, mensagem = '', duracao = 5000) {
  return mostrarAlerta('error', titulo, mensagem, duracao);
}

/** Exibe alerta de aviso */
function alertaAviso(titulo, mensagem = '', duracao = 5000) {
  return mostrarAlerta('warning', titulo, mensagem, duracao);
}

/** Exibe alerta informativo */
function alertaInfo(titulo, mensagem = '', duracao = 4000) {
  return mostrarAlerta('info', titulo, mensagem, duracao);
}


// ===================================================
// ===================================================
// CAMADA DE API — Chamadas reais ao backend C# (ASP.NET Core)
// Apontando para o backend rodando localmente
// ===================================================

const API_BASE = 'http://localhost:5000';  // Backend C# rodando em localhost:5000

/** JWT salvo no localStorage após login */
function obterToken() {
  return localStorage.getItem('monitech_token_system') || '';
}

/** Headers padrão com Authorization JWT */
function headersAuth() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${obterToken()}`
  };
}

/**
 * Wrapper fetch — lida com erros de rede e respostas HTTP não-ok.
 * Retorna sempre o JSON parseado (ou { sucesso: false, erro: '...' } em falha).
 */
async function apiFetch(url, opcoes = {}) {
  try {
    const resp  = await fetch(API_BASE + url, opcoes);
    const dados = await resp.json().catch(() => ({}));
    if (resp.status === 401 && opcoes?.headers?.Authorization) {
      localStorage.removeItem('monitech_token_system');
      sessionStorage.setItem('monitech_msg_suspensa', dados?.erro || 'Sessão encerrada.');
      window.location.href = '/';
      return {};
    }
    if (!resp.ok) {
      console.warn(`[API] ${opcoes.method || 'GET'} ${url} → HTTP ${resp.status}`, dados);
    }
    return dados;
  } catch (err) {
    console.error('[API] Erro de rede:', err.message);
    return { sucesso: false, erro: 'Sem conexão com o servidor. Verifique se o backend está rodando.' };
  }
}

const API = {

  // ── AUTH ──────────────────────────────────────────────────

  /** POST /api/auth/cadastro */
  cadastrar: async (dados) => {
    return await apiFetch('/api/auth/cadastro', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nome:     dados.nome,
        email:    dados.email,
        senha:    dados.senha,
        telefone: dados.telefone || null
      })
    });
  },

  /**
   * POST /api/auth/login
   * Salva token + dados do usuário no localStorage após sucesso.
   */
  login: async (email, senha) => {
    const resp = await apiFetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, senha })
    });
    if (resp.sucesso && resp.token) {
      localStorage.setItem('monitech_token_system',   resp.token);
      localStorage.setItem('monitech_usuario_system', JSON.stringify(resp.usuario));
      localStorage.setItem('monitech_expira_system',  resp.expiraEm);
    }
    return resp;
  },

  /** POST /api/auth/2fa/verificar */
  verificar2FaLogin: async (tokenTemp, codigo) => {
    return await apiFetch('/api/auth/2fa/verificar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tokenTemp, codigo })
    });
  },

  /** Remove token e dados do localStorage (logout) */
  logout: () => {
    localStorage.removeItem('monitech_token_system');
    localStorage.removeItem('monitech_usuario_system');
    localStorage.removeItem('monitech_expira_system');
  },

  // ── RESIDÊNCIA ────────────────────────────────────────────

  /** GET /api/residencia — lista todas as residências do usuário */
  listarResidencias: async () => {
    return await apiFetch('/api/residencia', { headers: headersAuth() });
  },

  /** POST /api/residencia */
  salvarResidencia: async (dados) => {
    return await apiFetch('/api/residencia', {
      method:  'POST',
      headers: headersAuth(),
      body:    JSON.stringify(dados)
    });
  },

  /** PATCH /api/residencia/{id} */
  atualizarResidencia: async (id, dados) => {
    return await apiFetch(`/api/residencia/${id}`, {
      method:  'PATCH',
      headers: headersAuth(),
      body:    JSON.stringify(dados)
    });
  },

  // ── TARIFAS ───────────────────────────────────────────────

  /** GET /api/tarifas/distribuidoras?estado=SP */
  obterDistribuidoras: async (estado) => {
    return await apiFetch(`/api/tarifas/distribuidoras?estado=${estado}`);
  },

  /** GET /api/tarifas/bandeira */
  obterBandeira: async () => {
    return await apiFetch('/api/tarifas/bandeira');
  },

  /** GET /api/tarifas/info?distribuidora=CEMIG */
  obterTarifaInfo: async (distribuidora) => {
    return await apiFetch(`/api/tarifas/info?distribuidora=${encodeURIComponent(distribuidora)}`);
  },

  // ── CÔMODOS ───────────────────────────────────────────────

  /** GET /api/comodos/:idResidencia */
  obterComodos: async (idResidencia) => {
    const id = idResidencia || appState.residencia?.id;
    if (!id) return { sucesso: false, comodos: [] };
    return await apiFetch(`/api/comodos/${id}`, { headers: headersAuth() });
  },

  /** POST /api/comodos */
  adicionarComodo: async (dados) => {
    return await apiFetch('/api/comodos', {
      method:  'POST',
      headers: headersAuth(),
      body:    JSON.stringify(dados)
    });
  },

  /** DELETE /api/comodos/:id */
  removerComodo: async (id) => {
    return await apiFetch(`/api/comodos/${id}`, {
      method:  'DELETE',
      headers: headersAuth()
    });
  },

  /** PATCH /api/comodos/:id/posicao */
  atualizarPosicaoComodo: async (id, posicaoX, posicaoY) => {
    return await apiFetch(`/api/comodos/${id}/posicao`, {
      method:  'PATCH',
      headers: { ...headersAuth(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ posicaoX, posicaoY })
    });
  },

  // ── DISPOSITIVOS ──────────────────────────────────────────

  /** GET /api/dispositivos/:idResidencia */
  obterDispositivos: async (idResidencia) => {
    const id = idResidencia || appState.residencia?.id;
    if (!id) return { sucesso: false, dispositivos: [] };
    return await apiFetch(`/api/dispositivos/${id}`, { headers: headersAuth() });
  },

  /** POST /api/dispositivos */
  adicionarDispositivo: async (dados) => {
    return await apiFetch('/api/dispositivos', {
      method:  'POST',
      headers: headersAuth(),
      body:    JSON.stringify(dados)
    });
  },

  /** PATCH /api/dispositivos/:id/status */
  alterarStatusDispositivo: async (id, novoStatus) => {
    return await apiFetch(`/api/dispositivos/${id}/status`, {
      method:  'PATCH',
      headers: headersAuth(),
      body:    JSON.stringify(novoStatus)
    });
  },

  // ── SENSORES / ESP32 ──────────────────────────────────────

  /** POST /api/sensores/registrar — vincula ESP32 e recebe token secreto */
  registrarSensor: async (dados) => {
    return await apiFetch('/api/sensores/registrar', {
      method:  'POST',
      headers: headersAuth(),
      body:    JSON.stringify(dados)
    });
  },

  /** GET /api/sensores/:idResidencia */
  listarSensores: async (idResidencia) => {
    const id = idResidencia || appState.residencia?.id;
    return await apiFetch(`/api/sensores/${id}`, { headers: headersAuth() });
  },

  // ── DASHBOARD / LEITURAS ──────────────────────────────────

  /** GET /api/dashboard/resumo?idResidencia=... */
  obterResumoDashboard: async (idResidencia) => {
    const id = idResidencia || appState.residencia?.id;
    if (!id) return { sucesso: false };
    return await apiFetch(`/api/dashboard/resumo?idResidencia=${id}`, {
      headers: headersAuth()
    });
  },

  /** GET /api/leituras/aovivo/:idSensor */
  obterLeituraAoVivo: async (idSensor) => {
    const id = idSensor || appState.sensor?.id;
    if (!id) return { sucesso: false, dados: appState.dadosAoVivo };
    return await apiFetch(`/api/leituras/aovivo/${id}`, { headers: headersAuth() });
  },

  /** GET /api/leituras/historico?idResidencia=...&periodo=day */
  obterHistorico: async (periodo) => {
    const id = appState.residencia?.id;
    if (!id) return { sucesso: true, dados: gerarHistoricoSimulado(periodo) };
    return await apiFetch(
      `/api/leituras/historico?idResidencia=${id}&periodo=${periodo || 'day'}`,
      { headers: headersAuth() }
    );
  },

  // ── ALERTAS ───────────────────────────────────────────────

  /** GET /api/dashboard/alertas?idResidencia=...&apenasNaoLidos=false */
  obterAlertas: async (apenasNaoLidos = false) => {
    const id = appState.residencia?.id;
    if (!id) return { sucesso: true, alertas: [] };
    return await apiFetch(
      `/api/dashboard/alertas?idResidencia=${id}&apenasNaoLidos=${apenasNaoLidos}`,
      { headers: headersAuth() }
    );
  },

  /** PATCH /api/dashboard/alertas/:id/lido */
  marcarAlertaLido: async (id) => {
    return await apiFetch(`/api/dashboard/alertas/${id}/lido`, {
      method:  'PATCH',
      headers: headersAuth()
    });
  },

  /** DELETE /api/dashboard/alertas/:id */
  removerAlerta: async (id) => {
    return await apiFetch(`/api/dashboard/alertas/${id}`, {
      method:  'DELETE',
      headers: headersAuth()
    });
  },

  /** DELETE /api/dashboard/alertas?idResidencia=... */
  limparTodosAlertas: async () => {
    const id = appState.residencia?.id;
    if (!id) return { sucesso: false };
    return await apiFetch(`/api/dashboard/alertas?idResidencia=${id}`, {
      method:  'DELETE',
      headers: headersAuth()
    });
  },

  /** POST /api/alertas/config */
  salvarConfiguracaoAlertas: async (config) => {
    return await apiFetch('/api/alertas/config', {
      method:  'POST',
      headers: headersAuth(),
      body:    JSON.stringify(config)
    });
  },

  // ── NILM ─────────────────────────────────────────────────

  /** GET /api/nilm/analisar?idResidencia=...&horas=24 */
  analisarNilm: async (horas = 24) => {
    const id = appState.residencia?.id;
    if (!id) return { disponivel: false };
    return await apiFetch(
      `/api/nilm/analisar?idResidencia=${id}&horas=${horas}`,
      { headers: headersAuth() }
    );
  },

  /** GET /api/nilm/status */
  statusNilm: async () => {
    return await apiFetch('/api/nilm/status', { headers: headersAuth() });
  },

  // ── ADMIN ─────────────────────────────────────────────────

  /** GET /api/admin/stats */
  adminStats: async () => {
    return await apiFetch('/api/admin/stats', { headers: headersAuth() });
  },

  /** GET /api/admin/usuarios?search=&page=1&limit=20 */
  adminUsuarios: async (page = 1, search = '') => {
    const q = new URLSearchParams({ page, limit: 20, ...(search ? { search } : {}) });
    return await apiFetch(`/api/admin/usuarios?${q}`, { headers: headersAuth() });
  },

  /** PATCH /api/admin/usuarios/{id}/status */
  adminAtualizarStatus: async (id, status) => {
    return await apiFetch(`/api/admin/usuarios/${id}/status`, {
      method:  'PATCH',
      headers: headersAuth(),
      body:    JSON.stringify({ status })
    });
  },

  /** PATCH /api/admin/usuarios/{id}/role */
  adminAtualizarRole: async (id, role) => {
    return await apiFetch(`/api/admin/usuarios/${id}/role`, {
      method:  'PATCH',
      headers: headersAuth(),
      body:    JSON.stringify({ role })
    });
  },

  /** PATCH /api/admin/usuarios/{id}/plano */
  adminAtualizarPlano: async (id, plano, diasExpiracao) => {
    return await apiFetch(`/api/admin/usuarios/${id}/plano`, {
      method:  'PATCH',
      headers: headersAuth(),
      body:    JSON.stringify({ plano, diasExpiracao })
    });
  }
};


// ===================================================
// GERADORES DE DADOS SIMULADOS
// Estes dados serão substituídos pelas leituras reais do dispositivo
// ===================================================

/**
 * Gera histórico simulado de leituras para um dado período.
 * @param {string} periodo - 'day', 'week' ou 'month'
 * @returns {Array} Array de objetos com dados simulados zerados (aguardando dispositivo real)
 */
function gerarHistoricoSimulado(periodo = 'day') {
  // Retorna zeros — aguardando leituras reais do sensor
  const vazio = (label) => ({ label, kwh: 0, custo: 0, watts: 0, volts: 0, amps: 0 });

  if (periodo === 'day')
    return Array.from({ length: 24 }, (_, i) => vazio(`${i}h`));

  if (periodo === 'week')
    return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(vazio);

  if (periodo === 'month')
    return Array.from({ length: 30 }, (_, i) => vazio(`${i + 1}`));

  if (periodo === 'year')
    return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map(vazio);

  return [];
}

/** Retorna mapa de ícones SVG por tipo de cômodo */
function obterIconesComodos() {
  const s = (p) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  return {
    sala:       s('<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z"/><path d="M4 18v2"/><path d="M20 18v2"/><path d="M12 4v9"/>'),
    quarto:     s('<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>'),
    cozinha:    s('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/>'),
    banheiro:   s('<path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><line x1="2" y1="12" x2="22" y2="12"/>'),
    garagem:    s('<path d="M19 17H5"/><path d="M2 17 8.5 5h7L22 17"/><path d="M9 17V9"/><path d="M15 17V9"/>'),
    escritorio: s('<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'),
    lavanderia: s('<rect x="2" y="2" width="20" height="20" rx="2"/><path d="M2 7h20"/><circle cx="12" cy="14" r="4"/>'),
    varanda:    s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
    outro:      s('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  };
}

/** Retorna mapa de ícones SVG por tipo de dispositivo */
function obterIconesDispositivos() {
  const s = (p) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  return {
    ar:          s('<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>'),
    geladeira:   s('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M4 10h16"/><path d="M9 7v6"/>'),
    tv:          s('<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>'),
    maquina:     s('<rect x="2" y="2" width="20" height="20" rx="2"/><path d="M2 7h20"/><circle cx="12" cy="14" r="4"/>'),
    chuveiro:    s('<path d="m4 4 2.5 2.5"/><path d="M13.5 6.5a4.95 4.95 0 0 0-7 7"/><path d="M15 5 5 15"/><path d="m14 10 6 6"/><path d="M10 16c.5 1.5 2 3 5 2.5"/>'),
    computador:  s('<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'),
    microondas:  s('<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="7" cy="12" r="1.5"/><path d="M11 9v6"/><path d="M15 9v6"/>'),
    iluminacao:  s('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
    bomba:       s('<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
    forno:       s('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h12"/><path d="M6 16h12"/><path d="M9 8v8"/>'),
    aquecedor:   s('<path d="M11 6c0 4-8 4.5-8 9a5 5 0 0 0 10 0c0-1.1-.35-2.12-.95-2.95"/><path d="M18 12c0 3.31-2.69 6-6 6"/><path d="M18 2c0 4-8 4.5-8 9"/>'),
    outro:       s('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8H2"/><rect x="2" y="8" width="20" height="9" rx="1"/>'),
  };
}


// ===================================================
// ROTEAMENTO DE PÁGINAS E ABAS
// ===================================================

/**
 * Exibe a página solicitada e oculta todas as demais.
 * @param {string} idPagina - ID da div de página a exibir
 */
function mostrarPagina(idPagina) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pagina = document.getElementById(idPagina);
  if (pagina) {
    pagina.classList.add('active');
    corrigirTextosCorrompidosNaPagina(pagina);
  }
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.classList.toggle('bottom-nav--active', idPagina === 'page-system');
  if (idPagina !== 'page-system') fecharBnavMais();
}

/**
 * Exibe a aba de conteúdo da aplicação solicitada.
 * @param {string} nomeAba - Nome da aba (dashboard, planta, rooms, devices, reports, alerts, esp32, settings)
 */
const _viewAccents = {
  dashboard: '',        // usa --cyan via var()
  planta:    '#4ade80',
  rooms:     '#22d3ee',
  devices:   '#a78bfa',
  reports:   '#fb923c',
  alerts:    '#f87171',
  esp32:     '#60a5fa',
  settings:  '#94a3b8',
  account:   '#e879f9',
  admin:     '#f43f5e',
};

function exibirAba(nomeAba) {
  localStorage.setItem('monitech_last_tab', nomeAba);

  // Propaga cor de acento para elementos fora do escopo da view (nav, bnav)
  const accent = _viewAccents[nomeAba];
  document.documentElement.style.setProperty(
    '--current-accent',
    accent || 'var(--cyan)'
  );

  // Oculta todas as views e remove destaque dos tabs
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  // Ativa a view e o tab selecionados
  const viewEl = document.getElementById('view-' + nomeAba);
  const tabEl  = document.getElementById('tab-' + nomeAba);
  if (viewEl) viewEl.classList.add('active');
  if (tabEl)  tabEl.classList.add('active');

  // Sincroniza bottom nav mobile
  sincronizarBnavMobile(nomeAba);

  // Para o polling de status ao sair da aba esp32
  if (nomeAba !== 'esp32') _pararStatusPolling();

  // Inicializa os componentes específicos de cada aba
  switch (nomeAba) {
    case 'dashboard':
      _sincronizarDispositivos().then(() => inicializarGraficos());
      _carregarHistoricoGraficos();
      break;
    case 'planta':
      renderizarPlanta();
      break;
    case 'rooms':
      _sincronizarComodos().then(renderizarComodos);
      break;
    case 'devices':
      _sincronizarDispositivos().then(renderizarDispositivos);
      _carregarNilm();
      break;
    case 'reports':
      inicializarGraficosRelatorio();
      _carregarHistoricoRelatorio();
      break;
    case 'alerts':
      adicionarAlertasAmostra().then(renderizarAlertas);
      carregarConfiguracaoAlertas();
      break;
    case 'account':
      carregarDadosConta();
      break;
    case 'settings':
      carregarDadosConfiguracoes();
      break;
    case 'esp32':
      if (!window.esp32TabAberta) inicializarAbaEsp32();
      _carregarStatusDispositivoUsuario();
      _iniciarStatusPolling();
      break;
    case 'admin':
      if (isAdmin()) carregarAdminDashboard();
      break;
  }

  corrigirTextosCorrompidosNaPagina(viewEl || document.body);
}

/** Sincroniza cômodos do servidor para o appState */
async function _sincronizarComodos() {
  if (!appState.residencia?.id) return;
  const resp = await API.obterComodos(appState.residencia.id);
  if (resp?.sucesso && resp.comodos) appState.comodos = resp.comodos;
}

/** Sincroniza dispositivos do servidor para o appState */
async function _sincronizarDispositivos() {
  if (!appState.residencia?.id) return;
  const resp = await API.obterDispositivos(appState.residencia.id);
  if (resp?.sucesso && resp.dispositivos) {
    appState.dispositivos = resp.dispositivos.map(d => {
      const watts = Number(d.potenciaNominal ?? d.watts ?? 0);
      return {
        ...d,
        watts,
        nomeComodo: d.comodo?.nome ?? d.nomeComodo ?? '—',
        tipo:       d.categoria   ?? d.tipo        ?? 'eletronico',
        // kWh estimado: potência × 8h uso/dia ÷ 1000
        kwh: d.kwh != null ? Number(d.kwh) : +(watts * 8 / 1000).toFixed(2),
      };
    });
  }
}

/** Carrega histórico real para os gráficos do dashboard */
async function _carregarHistoricoGraficos() {
  if (!appState.residencia?.id) return;

  const [respDia, respAno] = await Promise.all([
    API.obterHistorico('day'),
    API.obterHistorico('year')
  ]);

  if (respDia?.sucesso && respDia.dados?.length && graficos.porHora) {
    graficos.porHora.data.labels = respDia.dados.map(d => d.label);
    graficos.porHora.data.datasets[0].data = respDia.dados.map(d => d.kwh);
    graficos.porHora.update();
  }

  if (respAno?.sucesso && respAno.dados?.length && graficos.mensal) {
    graficos.mensal.data.labels = respAno.dados.map(d => d.label);
    graficos.mensal.data.datasets[0].data = respAno.dados.map(d => d.kwh);
    graficos.mensal.update();
  }
}

/** Carrega histórico real (ou simulado) para os gráficos de relatório */
async function _carregarHistoricoRelatorio() {
  const selRep = document.getElementById('report-period');
  const periodo = selRep?.value || 'week';

  if (periodo === 'year' && _isPlanoGratuito()) {
    if (selRep) selRep.value = 'month';
    atualizarPlano();
    return;
  }

  const tarifa  = appState.residencia?.tarifaKwh || 0.74;

  let dados;
  if (appState.residencia?.id) {
    const resp = await API.obterHistorico(periodo);
    dados = resp?.sucesso && resp.dados?.length ? resp.dados : null;
  }
  if (!dados) {
    const sim = gerarHistoricoSimulado(periodo);
    dados = sim.map(d => ({ label: d.label, kwh: d.kwh, potencia: d.watts, tensao: d.volts, corrente: d.amps }));
  }

  const labels = dados.map(d => d.label);
  const kwhs   = dados.map(d => d.kwh);
  const custos = dados.map(d => parseFloat((d.kwh * tarifa).toFixed(2)));
  const volts  = dados.map(d => d.tensao);
  const amps   = dados.map(d => d.corrente);

  if (graficos.rel_diario) { graficos.rel_diario.data.labels = labels; graficos.rel_diario.data.datasets[0].data = kwhs;   graficos.rel_diario.update(); }
  if (graficos.rel_custo)  { graficos.rel_custo.data.labels  = labels; graficos.rel_custo.data.datasets[0].data  = custos; graficos.rel_custo.update();  }
  if (graficos.rel_volts)  { graficos.rel_volts.data.labels  = labels; graficos.rel_volts.data.datasets[0].data  = volts;  graficos.rel_volts.update();  }
  if (graficos.rel_amps)   { graficos.rel_amps.data.labels   = labels; graficos.rel_amps.data.datasets[0].data   = amps;   graficos.rel_amps.update();   }

  // Popula KPI cards de resumo
  const totalKwh   = kwhs.reduce((s, v) => s + v, 0);
  const totalCusto = custos.reduce((s, v) => s + v, 0);
  const picoW      = Math.max(...dados.map(d => +d.potencia), 0);
  const mediaDia   = dados.length > 0 ? totalKwh / dados.length : 0;
  const setKpi = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setKpi('rep-kpi-kwh',   totalKwh.toFixed(1));
  setKpi('rep-kpi-custo', totalCusto.toFixed(2));
  setKpi('rep-kpi-pico',  picoW.toFixed(0));
  setKpi('rep-kpi-media', mediaDia.toFixed(2));

  const corpoTabela = document.getElementById('report-tbody');
  if (corpoTabela) {
    corpoTabela.innerHTML = dados.map((d, i) => `
      <tr>
        <td>${d.label}</td>
        <td>${(+d.kwh).toFixed(3)}</td>
        <td>R$ ${custos[i].toFixed(2)}</td>
        <td>${(+d.potencia).toFixed(1)} W</td>
        <td>${(+d.tensao).toFixed(1)} V</td>
        <td>${(+d.corrente).toFixed(3)} A</td>
      </tr>
    `).join('');
  }
}

/** Carrega análise NILM e exibe comparação estimado vs. medido */
async function _carregarNilm() {
  const container = document.getElementById('nilm-resultado');
  if (!container) return;

  const horas = parseInt(document.getElementById('nilm-horas')?.value || '24');
  const estimados = appState.dispositivos || [];

  container.innerHTML = `
    <div class="nilm-loading">
      <div class="nilm-loading__spinner"></div>
      <div class="nilm-loading__text">Analisando consumo real…</div>
    </div>`;

  // Verificar microserviço
  let statusResp;
  try { statusResp = await API.statusNilm(); } catch { statusResp = null; }

  if (!statusResp?.online) {
    _nilmRenderTabela(container, estimados, [], horas, 'offline');
    return;
  }

  const resp = await API.analisarNilm(horas);

  if (!resp?.disponivel) {
    _nilmRenderTabela(container, estimados, [], horas, 'semDados');
    return;
  }

  _nilmRenderTabela(container, estimados, resp.dispositivos || [], horas, 'ok', resp);
}

function _nilmRenderTabela(container, estimados, reais, horas, modo, resp) {
  const CORES = ['#818cf8','#34d399','#fb923c','#f472b6','#60a5fa','#a78bfa','#facc15','#f87171','#2dd4bf','#e879f9'];
  const temReal = modo === 'ok';

  const avisoMap = {
    offline:       `<div class="nilm-aviso nilm-aviso--warn">Serviço de análise offline — exibindo somente estimativas cadastradas.</div>`,
    semDados:      `<div class="nilm-aviso nilm-aviso--info">Dados insuficientes no período — exibindo somente estimativas. Aumente o intervalo ou aguarde mais leituras.</div>`,
    planoGratuito: `<div class="nilm-aviso nilm-aviso--info">🔒 A comparação com medição real (NILM avançado) está disponível no <strong>Plano Mensal</strong>. <a href="#" onclick="atualizarPlano();return false;" style="color:var(--blue-core)">Fazer upgrade →</a></div>`,
    ok: '',
  };

  // Ícone por nome/tipo do aparelho
  const _icone = (est) => {
    const n = (est.nome || '').toLowerCase();
    const t = (est.tipo || est.categoria || '').toLowerCase();
    if (n.includes('ar') || n.includes('cond') || t.includes('clima')) return 'wind';
    if (n.includes('chuv') || t.includes('chuv'))                       return 'droplets';
    if (n.includes('gelad') || n.includes('frigor'))                    return 'thermometer';
    if (n.includes('tv') || n.includes('telev'))                        return 'tv-2';
    if (n.includes('lamp') || t.includes('ilumina'))                    return 'lightbulb';
    if (n.includes('micro') || n.includes('forno'))                     return 'zap';
    if (n.includes('lava') || n.includes('máqui'))                      return 'rotate-cw';
    if (n.includes('comp') || n.includes('note') || n.includes('pc'))  return 'monitor';
    if (n.includes('chuveiro'))                                         return 'droplets';
    return 'plug';
  };

  // Máximos para escalar as barras
  const maxEst  = Math.max(...estimados.map(e => Number(e.kwh  || 0)), 0.001);
  const maxReal = Math.max(...reais.map(r => Number(r.kwhEstimado || 0)), 0.001);

  // Linhas dos aparelhos cadastrados
  const linhas = estimados.map((est, i) => {
    const real    = reais.find(r => r.nome?.toLowerCase() === est.nome?.toLowerCase());
    const ativo   = est.status === 'on' || est.status === 'ativo';
    const estKwh  = Number(est.kwh || 0);
    const realKwh = real ? Number(real.kwhEstimado || 0) : null;
    const cor     = CORES[i % CORES.length];
    const icone   = _icone(est);
    const estPct  = ((estKwh / maxEst) * 100).toFixed(1);
    const realPct = realKwh !== null ? ((realKwh / maxReal) * 100).toFixed(1) : 0;

    // Pill de delta
    let deltaPill = `<span class="nc-delta-pill nc-delta-pill--nd">—</span>`;
    if (realKwh !== null && estKwh > 0) {
      const pct   = ((realKwh - estKwh) / estKwh) * 100;
      const sinal = pct > 0 ? '+' : '';
      const label = `${sinal}${pct.toFixed(0)}%`;
      if      (pct >  20) deltaPill = `<span class="nc-delta-pill nc-delta-pill--alto">↑ ${label}</span>`;
      else if (pct < -20) deltaPill = `<span class="nc-delta-pill nc-delta-pill--baixo">↓ ${label}</span>`;
      else                deltaPill = `<span class="nc-delta-pill nc-delta-pill--ok">${label}</span>`;
    }

    const realCell = realKwh !== null
      ? `<div class="nc-cell">
           <span class="nc-num nc-num--real">${realKwh.toFixed(3)}<small> kWh</small></span>
           <div class="nc-bar"><div class="nc-bar-fill nc-bar-fill--real" style="width:${realPct}%"></div></div>
         </div>`
      : `<div class="nc-cell nc-cell--nd">
           <span class="nc-num-nd">${temReal ? 'não detectado' : '—'}</span>
           <div class="nc-bar"></div>
         </div>`;

    const minsCell = temReal
      ? `<span class="nc-mins">${real?.minutosLigadoEstimado != null ? real.minutosLigadoEstimado + '<small> min</small>' : '—'}</span>`
      : '';

    return `
      <div class="nc-row ${!ativo ? 'nc-row--inativo' : ''}">
        <div class="nc-device">
          <span class="nc-dot" style="background:${cor}"></span>
          <span class="nc-icon" style="color:${cor}"><i data-lucide="${icone}" style="width:14px;height:14px"></i></span>
          <div class="nc-device-info">
            <span class="nc-name">${est.nome}</span>
            <span class="nc-status ${ativo ? 'nc-status--on' : 'nc-status--off'}">${ativo ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>
        <div class="nc-cell">
          <span class="nc-num nc-num--est">${estKwh.toFixed(3)}<small> kWh</small></span>
          <div class="nc-bar"><div class="nc-bar-fill nc-bar-fill--est" style="width:${estPct}%"></div></div>
        </div>
        ${realCell}
        ${deltaPill}
        ${minsCell}
      </div>`;
  }).join('');

  // Aparelhos detectados pelo sensor mas não cadastrados
  const extras = reais.filter(r => !estimados.some(e => e.nome?.toLowerCase() === r.nome?.toLowerCase()));
  const extrasHtml = extras.map(r => {
    const realKwh = Number(r.kwhEstimado || 0);
    const realPct = ((realKwh / maxReal) * 100).toFixed(1);
    return `
      <div class="nc-row nc-row--novo">
        <div class="nc-device">
          <span class="nc-dot" style="background:#facc15"></span>
          <span class="nc-icon" style="color:#facc15"><i data-lucide="search" style="width:14px;height:14px"></i></span>
          <div class="nc-device-info">
            <span class="nc-name">${r.nome} <span class="nc-badge-novo">novo</span></span>
            <span class="nc-status nc-status--on">Detectado</span>
          </div>
        </div>
        <div class="nc-cell nc-cell--nd"><span class="nc-num-nd">—</span><div class="nc-bar"></div></div>
        <div class="nc-cell">
          <span class="nc-num nc-num--real">${realKwh.toFixed(3)}<small> kWh</small></span>
          <div class="nc-bar"><div class="nc-bar-fill nc-bar-fill--real" style="width:${realPct}%"></div></div>
        </div>
        <span class="nc-delta-pill nc-delta-pill--novo">detectado</span>
        ${temReal ? `<span class="nc-mins">${r.minutosLigadoEstimado ?? '—'}<small> min</small></span>` : ''}
      </div>`;
  }).join('');

  const tsHtml = resp?.analisadoEm
    ? `<div class="nilm-ts">Análise: ${new Date(resp.analisadoEm).toLocaleString('pt-BR')} · últimas ${horas}h · ${resp.analise || ''}</div>`
    : '';

  const colReal = temReal ? `<span>Medido (${horas}h)</span>` : `<span>Medido</span>`;
  const colMins = temReal ? `<span>Tempo ligado</span>` : '';

  container.innerHTML = `
    ${avisoMap[modo] || ''}
    <div class="nilm-compare-wrap">
      ${temReal && reais.length ? `
      <div class="nilm-compare-donut">
        <div class="chart-wrap chart-wrap--h240"><canvas id="chart-nilm-donut"></canvas></div>
      </div>` : ''}
      <div class="nilm-compare-table">
        <div class="nc-header">
          <span>Aparelho</span>
          <span>Estimado</span>
          ${colReal}
          <span>Δ Variação</span>
          ${colMins}
        </div>
        ${linhas}
        ${extrasHtml}
        ${tsHtml}
      </div>
    </div>`;

  lucide.createIcons();

  // Donut — consumo real
  if (temReal && reais.length) {
    const ctx = document.getElementById('chart-nilm-donut');
    if (ctx) {
      const existing = Chart.getChart(ctx);
      if (existing) existing.destroy();
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: reais.map(d => d.nome),
          datasets: [{
            data: reais.map(d => +(d.kwhEstimado || 0).toFixed(3)),
            backgroundColor: CORES.slice(0, reais.length),
            borderColor: 'rgba(0,0,0,0.35)',
            borderWidth: 2,
            hoverOffset: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)', font: { family: 'Rajdhani', size: 11 }, padding: 12, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8 } },
            tooltip: { callbacks: { label: c => {
              const s = c.dataset.data.reduce((a,b)=>a+b,0);
              return `  ${c.parsed.toFixed(3)} kWh  (${s>0?((c.parsed/s)*100).toFixed(1):0}%)`;
            }}}
          }
        }
      });
    }
  }
}


// ===================================================
// AUTENTICAÇÃO
// ===================================================

let _token2faTemp = null;

/** Realiza o login do usuário com as credenciais informadas */
async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-pass').value;

  if (!email || !senha) {
    mostrarToast('Por favor, preencha o e-mail e a senha para continuar.', 'aviso');
    return;
  }

  // Feedback visual enquanto aguarda
  const btn = document.querySelector('#page-login .btn-primary');
  if (btn) { btn.textContent = 'Aguarde...'; btn.disabled = true; }

  const resposta = await API.login(email, senha);

  if (btn) { btn.textContent = 'ENTRAR NO SISTEMA'; btn.disabled = false; }

  if (resposta.sucesso) {
    appState.usuario = resposta.usuario;
    // Salva também no localStorage para persistência
    localStorage.setItem('monitech_usuario_system', JSON.stringify(resposta.usuario));

    // DB é fonte de verdade no login — salva no cookie e aplica
    const _temaLogin = resposta.usuario.tema || 'dark';
    window._salvarTemaUsuario?.(resposta.usuario.id, _temaLogin);
    aplicarTema(_temaLogin, true, true);
    console.log('[Login] Usuário logado:', appState.usuario);
    console.log('[Login] Nome recebido:', resposta.usuario?.nome);
    console.log('[Login] Email recebido:', resposta.usuario?.email);
    console.log('[Login] Usuário salvo em localStorage');
    
    // Carrega residências do usuário
    const respResidencias = await API.listarResidencias();
    console.log('[Login] Resposta de residências:', respResidencias);
    
    const temResidencias = respResidencias?.sucesso && respResidencias?.residencias && respResidencias.residencias.length > 0;
    console.log('[Login] Tem residências?', temResidencias, 'Quantidade:', respResidencias?.residencias?.length);
    
    if (temResidencias) {
      // Se tem residências, carrega a primeira e entra no app
      console.log('[Login] Carregando primeira residência...');
      appState.residencias = respResidencias.residencias;
      appState.residencia  = _residenciaPreferida(respResidencias.residencias);

      // Atualiza tarifaKwh com valor vivo da ANEEL (se distribuidora cadastrada)
      if (appState.residencia.distribuidora) {
        try {
          const respTarifa = await fetch(`/api/tarifas/info?distribuidora=${encodeURIComponent(appState.residencia.distribuidora)}`);
          const dadosTarifa = await respTarifa.json();
          if (dadosTarifa.sucesso) appState.residencia.tarifaKwh = dadosTarifa.tarifaTotal;
        } catch (_) { /* mantém tarifaKwh do banco */ }
      }

      const respComodos = await API.obterComodos(appState.residencia.id);
      if (respComodos.sucesso) appState.comodos = respComodos.comodos || [];
      await _sincronizarDispositivos();

      console.log('[Login] Entrando no app...');
      entrarNoApp();
    } else {
      // Se NÃO tem residências, vai para onboarding
      console.log('[Login] Nenhuma residência encontrada. Abrindo onboarding...');
      mostrarPagina('page-onboard');
      atualizarPassosOnboarding(0);
    }
    
    // Atualiza o indicador - não precisa await aqui
    atualizarIndicadorUsuario();
    if (typeof window.carregarFotoPerfilGlobal === 'function') window.carregarFotoPerfilGlobal();

  } else if (resposta.requer2FA && resposta.tokenTemp) {
    _token2faTemp = resposta.tokenTemp;
    document.getElementById('login-step-credentials').style.display = 'none';
    document.getElementById('login-step-2fa').style.display = '';
    document.getElementById('login-2fa-codigo').value = '';
    document.getElementById('login-2fa-codigo').focus();
  } else {
    mostrarToast(resposta.erro || 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.', 'erro');
  }
}

async function verificar2FaLogin() {
  const codigo = document.getElementById('login-2fa-codigo').value.trim();
  if (codigo.length !== 6) { mostrarToast('Digite o código de 6 dígitos.', 'aviso'); return; }

  const btn = document.querySelector('#login-step-2fa .btn-primary');
  if (btn) { btn.textContent = 'Verificando...'; btn.disabled = true; }

  const resposta = await API.verificar2FaLogin(_token2faTemp, codigo);

  if (btn) { btn.textContent = 'VERIFICAR CÓDIGO'; btn.disabled = false; }

  if (resposta.sucesso) {
    appState.usuario = resposta.usuario;
    localStorage.setItem('monitech_usuario_system', JSON.stringify(resposta.usuario));
    const _tema2fa = resposta.usuario?.tema || 'dark';
    window._salvarTemaUsuario?.(resposta.usuario.id, _tema2fa);
    aplicarTema(_tema2fa, true, true);
    cancelar2FaLogin();
    const respResidencias = await API.listarResidencias();
    if (respResidencias?.residencias?.length > 0) {
      appState.residencias = respResidencias.residencias;
      appState.residencia  = _residenciaPreferida(respResidencias.residencias);
      entrarNoApp();
    } else {
      mostrarPagina('page-onboard');
      atualizarPassosOnboarding(0);
    }
    atualizarIndicadorUsuario();
    if (typeof window.carregarFotoPerfilGlobal === 'function') window.carregarFotoPerfilGlobal();
  } else {
    mostrarToast(resposta.erro || 'Código inválido. Tente novamente.', 'erro');
    document.getElementById('login-2fa-codigo').value = '';
    document.getElementById('login-2fa-codigo').focus();
  }
}

function cancelar2FaLogin() {
  _token2faTemp = null;
  document.getElementById('login-step-2fa').style.display = 'none';
  document.getElementById('login-step-credentials').style.display = '';
  document.getElementById('login-2fa-codigo').value = '';
}


// ── Google Login (painel) ─────────────────────────────────────
const GOOGLE_CLIENT_ID_SYSTEM = '1027718748883-khrvgfqkkr6obscdm8uou5l7h2jnjrtr.apps.googleusercontent.com';
let _googleSystemReady = false;
let _googlePreRendered = null; // container pré-renderizado para popup instantâneo

function _inicializarGoogleSDK() {
  if (typeof google === 'undefined' || _googleSystemReady) return;
  google.accounts.id.initialize({
    client_id:             GOOGLE_CLIENT_ID_SYSTEM,
    callback:              _handleGoogleSystemCredential,
    auto_select:           false,
    cancel_on_tap_outside: true,
    use_fedcm_for_prompt:  false
  });
  // Pré-renderiza o botão em segundo plano — o popup abrirá instantaneamente ao clicar
  _googlePreRendered = document.createElement('div');
  _googlePreRendered.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:220px;';
  document.body.appendChild(_googlePreRendered);
  google.accounts.id.renderButton(_googlePreRendered, { type: 'standard', size: 'large' });
  _googleSystemReady = true;
}

// Inicializa assim que o SDK do Google carregar
window.onGoogleLibraryLoad = _inicializarGoogleSDK;
// Fallback: tenta inicializar no DOMContentLoaded caso o SDK já esteja pronto
document.addEventListener('DOMContentLoaded', () => {
  if (typeof google !== 'undefined') _inicializarGoogleSDK();
});

function fazerLoginGoogle() {
  const btn = document.getElementById('system-google-btn');

  if (typeof google === 'undefined') {
    // SDK ainda não carregou — aguarda até 5s
    let waited = 0;
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    const poll = setInterval(() => {
      waited += 200;
      if (typeof google !== 'undefined') {
        clearInterval(poll);
        _inicializarGoogleSDK();
        fazerLoginGoogle();
      } else if (waited >= 5000) {
        clearInterval(poll);
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        mostrarToast('SDK do Google não carregou. Verifique sua conexão e tente novamente.', 'erro');
      }
    }, 200);
    return;
  }

  if (!_googleSystemReady) _inicializarGoogleSDK();

  // Clica no botão pré-renderizado — abre o popup imediatamente sem esperar One Tap
  const gBtn = _googlePreRendered?.querySelector('[data-idom-class]') ||
               _googlePreRendered?.querySelector('div[role="button"]') ||
               _googlePreRendered?.querySelector('[role="button"]');
  if (gBtn) {
    gBtn.click();
    return;
  }

  // Fallback: cria container temporário e clica
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:220px;';
  document.body.appendChild(tmp);
  google.accounts.id.renderButton(tmp, { type: 'standard', size: 'large' });
  setTimeout(() => {
    const fb = tmp.querySelector('[data-idom-class]') || tmp.querySelector('div[role="button"]') || tmp.querySelector('[role="button"]');
    if (fb) fb.click();
    setTimeout(() => { document.body.removeChild(tmp); if (btn) { btn.disabled = false; btn.style.opacity = '1'; } }, 2000);
  }, 300);
}

async function _handleGoogleSystemCredential(response) {
  const idToken = response.credential;
  const btn = document.getElementById('system-google-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

  try {
    const resposta = await fetch('/api/auth/google', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken })
    });
    const data = await resposta.json();

    if (data.sucesso && data.token) {
      localStorage.setItem('monitech_token_system',   data.token);
      localStorage.setItem('monitech_usuario_system', JSON.stringify(data.usuario));
      localStorage.setItem('monitech_expira_system',  data.expiraEm);

      appState.usuario = data.usuario;
      const _temaGgl = data.usuario?.tema || 'dark';
      window._salvarTemaUsuario?.(data.usuario?.id, _temaGgl);
      aplicarTema(_temaGgl, true, true);
      atualizarIndicadorUsuarioDOM(); // exibe foto do Google imediatamente, sem esperar sync da API

      const respResidencias = await API.listarResidencias();
      const temResidencias  = respResidencias?.sucesso && respResidencias?.residencias?.length > 0;

      if (temResidencias) {
        appState.residencias = respResidencias.residencias;
        appState.residencia  = _residenciaPreferida(respResidencias.residencias);
        const respComodos2 = await API.obterComodos(appState.residencia.id);
        if (respComodos2.sucesso) appState.comodos = respComodos2.comodos || [];
        await _sincronizarDispositivos();
        entrarNoApp();
      } else {
        mostrarPagina('page-onboard');
        atualizarPassosOnboarding(0);
      }

      atualizarIndicadorUsuario();
      if (typeof window.carregarFotoPerfilGlobal === 'function') window.carregarFotoPerfilGlobal();
    } else {
      mostrarToast(data.erro || 'Erro ao autenticar com Google.', 'erro');
    }
  } catch (err) {
    console.error('[Google Login System]', err);
    mostrarToast('Erro de conexão. Tente novamente.', 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

/**
 * DESCONTINUADO: Cadastro de usuário foi removido do painel.
 * Usuários agora se cadastram apenas na landing page (index.html)
 * e fazem login direto no painel.
 */
async function cadastrarUsuario() {
  mostrarToast('O cadastro de conta foi movido para a página inicial. Por favor, cadastre-se lá e faça login aqui.', 'info');
}


// ===================================================
// MENU SUSPENSO DO USUÁRIO
// ===================================================

/** Alterna a visibilidade do menu suspenso do usuário */
function alternarMenuUsuario() {
  const menu = document.getElementById('user-dropdown');
  menu.classList.toggle('active');
  
  // Ajustar posição do dropdown para evitar que saia da tela
  if (menu.classList.contains('active')) {
    ajustarPosicaoDropdown();
  }
}

/** Função para ajustar posição do dropdown em mobile */
function ajustarPosicaoDropdown() {
  const menu = document.getElementById('user-dropdown');
  const userBtn = document.getElementById('user-menu-btn');
  
  if (!menu || !userBtn) return;
  
  const viewportWidth = window.innerWidth;
  
  // Se a tela é muito estreita, ajustar para modal
  if (viewportWidth < 480) {
    menu.style.position = 'fixed';
    menu.style.left = '8px';
    menu.style.right = '8px';
    menu.style.width = 'auto';
    menu.style.maxWidth = 'calc(100vw - 16px)';
  } else {
    menu.style.position = 'fixed';
    menu.style.right = '24px';
    menu.style.left = 'auto';
    menu.style.width = 'auto';
    menu.style.maxWidth = '320px';
  }
}

/** Alias para compatibilidade com landing page */
const toggleUserMenu = alternarMenuUsuario;

/** Fecha o menu suspenso do usuário */
function fecharMenuUsuario() {
  const menu = document.getElementById('user-dropdown');
  menu.classList.remove('active');
}

/** Alterna visibilidade do menu de navegação em dispositivos móveis */
function alternarMenuMobile() {
  const btn = document.getElementById('mobile-menu-btn');
  const nav = document.getElementById('nav-tabs-mobile');
  const overlay = document.getElementById('mobile-menu-overlay');
  const ativo = nav.classList.toggle('active');
  btn.classList.toggle('active', ativo);
  overlay.classList.toggle('active', ativo);
}

/** Navega para a página de conta do usuário */
function irParaConta() {
  fecharMenuUsuario();
  exibirAba('account');
  carregarDadosConta();
}


// ===================================================
// ABA: MINHA CONTA
// ===================================================

/** Carrega os dados da conta do usuário nos campos do formulário */
async function carregarDadosConta() {
  // Sincroniza dados frescos da API (garante foto do Google atualizada)
  try { await sincronizarUsuarioDoLocalStorage(); } catch (_) {}
  carregarNotificacoesConta();
  if (appState.usuario) {
    document.getElementById('account-name').value = appState.usuario.nome || '';
    document.getElementById('account-email').value = appState.usuario.email || '';
    document.getElementById('account-phone').value = appState.usuario.telefone || '';
    document.getElementById('account-birth').value = appState.usuario.dataNascimento || '';
    document.getElementById('account-gender').value = appState.usuario.genero || '';
    document.getElementById('account-name-display').textContent = appState.usuario.nome || 'Usuário';
    document.getElementById('account-email-display').textContent = appState.usuario.email || '---';

    // Carrega foto de perfil atual
    const avatarEl = document.getElementById('account-avatar');
    if (avatarEl) {
      const fotoUrlConta = appState.usuario.fotoUrl;
      if (fotoUrlConta) {
        avatarEl.innerHTML = '';
        avatarEl.style.backgroundColor = 'transparent';
        const imgConta = document.createElement('img');
        imgConta.src = fotoUrlConta;
        imgConta.alt = '';
        imgConta.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
        imgConta.onerror = () => {
          avatarEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
          avatarEl.style.backgroundColor = '';
        };
        avatarEl.appendChild(imgConta);
      } else {
        avatarEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        avatarEl.style.backgroundColor = '';
      }
    }

    // Carrega data de membro
    if (appState.usuario.dataCriacao) {
      const data = new Date(appState.usuario.dataCriacao);
      const dataFormatada = data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      document.getElementById('member-date').textContent = dataFormatada;
    }

    // Carrega estatísticas da conta
    document.getElementById('account-residences-count').textContent = appState.residencia ? '1' : '0';
    document.getElementById('account-devices-count').textContent = appState.dispositivos.length;
  }

  // Carrega as preferências de notificações
  const notificacoes = JSON.parse(localStorage.getItem('notificacoes') || '{}');
  document.getElementById('notify-email-alerts').checked = notificacoes.email_alertas !== false;
  document.getElementById('notify-email-summary').checked = notificacoes.email_summary !== false;
  document.getElementById('notify-browser').checked = notificacoes.browser_alertas !== false;
  document.getElementById('notify-sound').checked = notificacoes.browser_som === true;
  document.getElementById('account-summary-frequency').value = notificacoes.frequencia || 'weekly';
}

/** Salva as alterações das informações pessoais da conta */
async function salvarAlteracoesConta() {
  const nome          = document.getElementById('account-name').value.trim();
  const telefone      = document.getElementById('account-phone').value.trim();
  const dataNascimento = document.getElementById('account-birth').value.trim();
  const genero        = document.getElementById('account-gender').value.trim();

  if (!nome) {
    alertaErro('Campo obrigatório', 'Informe seu nome completo.');
    return;
  }

  const token = localStorage.getItem('monitech_token_system');
  if (!token) { alertaErro('Sessão expirada', 'Faça login novamente.'); return; }

  const dados = await apiFetch('/api/usuario/perfil', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      nome,
      telefone:       telefone       || '',
      dataNascimento: dataNascimento || '',
      genero:         genero         || ''
    })
  });

  if (dados.sucesso) {
    appState.usuario.nome          = dados.usuario.nome;
    appState.usuario.telefone      = telefone      || null;
    appState.usuario.dataNascimento = dataNascimento || null;
    appState.usuario.genero        = genero        || null;
    document.getElementById('account-name-display').textContent = dados.usuario.nome;
    atualizarIndicadorUsuario();
    alertaSucesso('Perfil atualizado', 'Informações pessoais salvas com sucesso!');
  } else {
    alertaErro('Erro ao salvar', dados.erro || 'Não foi possível salvar as alterações.');
  }
}

/** Altera a senha do usuário */
async function alterarSenhaConta() {
  const senhaAtual = document.getElementById('account-pass-current').value;
  const novaSenha = document.getElementById('account-pass-new').value;
  const confirmarSenha = document.getElementById('account-pass-confirm').value;

  if (!senhaAtual || !novaSenha || !confirmarSenha) {
    alertaErro('Campos obrigatórios', 'Preencha todos os campos de senha.');
    return;
  }
  if (novaSenha !== confirmarSenha) {
    alertaErro('Senhas diferentes', 'A nova senha e a confirmação não coincidem.');
    return;
  }
  if (novaSenha.length < 8) {
    alertaErro('Senha fraca', 'A nova senha deve ter no mínimo 8 caracteres.');
    return;
  }

  const token = localStorage.getItem('monitech_token_system');
  if (!token) { alertaErro('Sessão expirada', 'Faça login novamente.'); return; }

  const dados = await apiFetch('/api/usuario/senha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ senhaAtual, novaSenha })
  });

  if (dados.sucesso) {
    document.getElementById('account-pass-current').value = '';
    document.getElementById('account-pass-new').value = '';
    document.getElementById('account-pass-confirm').value = '';
    alertaSucesso('Senha alterada', 'Use a nova senha na próxima vez que fizer login.');
  } else {
    alertaErro('Erro ao alterar senha', dados.erro || 'Não foi possível alterar a senha.');
  }
}

/** Salva as preferências de notificação do usuário (aba Conta) */
/** Carrega preferências de notificação do backend e preenche os checkboxes */
async function carregarNotificacoesConta() {
  try {
    const resp = await apiFetch('/api/usuario/notificacoes', { headers: headersAuth() });
    if (!resp?.sucesso) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    set('notify-email-alerts', resp.emailAlertas);
    set('notify-sensor-alerts', resp.alertaSensor);
  } catch (_) {}

  // Preferências locais (browser/som/frequência)
  try {
    const local = JSON.parse(localStorage.getItem('monitech_notif_browser') || '{}');
    const setEl = (id, val, def = true) => { const el = document.getElementById(id); if (el) el.checked = val ?? def; };
    setEl('notify-email-summary', local.resumo_semanal, true);
    setEl('notify-browser',       local.browser_alertas, true);
    setEl('notify-sound',         local.browser_som,     false);
    const freq = document.getElementById('account-summary-frequency');
    if (freq && local.frequencia) freq.value = local.frequencia;
  } catch (_) {}
}

async function salvarNotificacoesConta() {
  const get = (id) => document.getElementById(id);

  // Payload para o backend — controla envio de e-mails e alertas
  const payload = {
    emailAlertas:   get('notify-email-alerts')?.checked  ?? true,
    alertaAnomalia: get('notify-email-alerts')?.checked  ?? true,
    alertaConsumo:  get('notify-email-alerts')?.checked  ?? true,
    alertaTensao:   get('notify-email-alerts')?.checked  ?? true,
    alertaSensor:   get('notify-sensor-alerts')?.checked ?? true,
  };

  // Preferências locais — browser/som/frequência (sem backend)
  const browserCfg = {
    resumo_semanal:  get('notify-email-summary')?.checked ?? true,
    browser_alertas: get('notify-browser')?.checked       ?? true,
    browser_som:     get('notify-sound')?.checked         ?? false,
    frequencia:      get('account-summary-frequency')?.value ?? 'weekly'
  };
  localStorage.setItem('monitech_notif_browser', JSON.stringify(browserCfg));

  try {
    const resp = await apiFetch('/api/usuario/notificacoes', {
      method:  'PUT',
      headers: headersAuth(),
      body:    JSON.stringify(payload)
    });
    if (resp?.sucesso) {
      alertaSucesso('Preferências salvas', 'Suas configurações de notificação foram atualizadas.');
    } else {
      alertaErro('Erro', resp?.erro || 'Não foi possível salvar.');
    }
  } catch {
    alertaErro('Erro de conexão', 'Verifique se o servidor está rodando.');
  }
}

/** Ativa a autenticação de dois fatores — abre modal */
function ativar2FA() { habilitarAutenticacao2FA(); }

/** Exporta os dados da conta do usuário */
async function exportarMeusDados() {
  if (_isPlanoGratuito()) { atualizarPlano(); return; }
  const btn = document.getElementById('btn-export-json');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Exportando...'; lucide.createIcons(); }

  try {
    const [respHistorico, respAlertas] = await Promise.all([
      API.obterHistorico('month'),
      API.obterAlertas(false),
    ]);

    const dados = {
      exportadoEm:  new Date().toISOString(),
      versao:       '2.0',
      usuario:      appState.usuario,
      residencia:   appState.residencia,
      comodos:      appState.comodos,
      dispositivos: appState.dispositivos,
      alertas:      respAlertas?.alertas  ?? [],
      historico:    respHistorico?.dados   ?? [],
    };

    _dispararDownload(
      JSON.stringify(dados, null, 2),
      'application/json',
      `monitech-backup-${new Date().toISOString().slice(0, 10)}.json`
    );

    alertaSucesso('Backup exportado', 'JSON com perfil, dispositivos, alertas e histórico do mês.');
  } catch {
    mostrarToast('Erro ao exportar. Tente novamente.', 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="file-json"></i> JSON'; lucide.createIcons(); }
  }
}

async function exportarHistoricoCSV() {
  if (_isPlanoGratuito()) { atualizarPlano(); return; }
  const btn = document.getElementById('btn-export-csv');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Exportando...'; lucide.createIcons(); }

  try {
    const resp = await API.obterHistorico('month');
    const leituras = resp?.dados ?? [];

    if (leituras.length === 0) {
      mostrarToast('Nenhuma leitura encontrada para o período.', 'aviso');
      return;
    }

    const cabecalho = ['Data', 'Hora', 'kWh', 'Watts', 'Tensão (V)', 'Corrente (A)', 'Fator de Potência'];
    const linhas = leituras.map(l => {
      const dt = new Date(l.timestamp ?? l.data ?? l.label);
      const data = isNaN(dt) ? (l.label ?? '') : dt.toLocaleDateString('pt-BR');
      const hora = isNaN(dt) ? '' : dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return [
        data,
        hora,
        (l.kwh   ?? l.kWh   ?? '').toString().replace('.', ','),
        (l.watts  ?? l.w     ?? '').toString().replace('.', ','),
        (l.tensao ?? l.v     ?? '').toString().replace('.', ','),
        (l.amps   ?? l.a     ?? '').toString().replace('.', ','),
        (l.fp     ?? l.fatorPotencia ?? '').toString().replace('.', ','),
      ].join(';');
    });

    const csv = [cabecalho.join(';'), ...linhas].join('\n');
    _dispararDownload(
      '﻿' + csv, // BOM para Excel reconhecer UTF-8
      'text/csv;charset=utf-8',
      `monitech-historico-${new Date().toISOString().slice(0, 10)}.csv`
    );

    alertaSucesso('Histórico exportado', `${leituras.length} leituras salvas em CSV.`);
  } catch {
    mostrarToast('Erro ao exportar CSV. Tente novamente.', 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="table-2"></i> CSV'; lucide.createIcons(); }
  }
}

function _dispararDownload(conteudo, tipo, nomeArquivo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

/** Abre o modal estilizado de exclusão de conta */
function iniciarExclusaoConta() {
  const input = document.getElementById('sys-delete-input');
  const btn   = document.getElementById('btn-confirmar-exclusao');
  if (input) input.value = '';
  if (btn)   btn.disabled = true;
  abrirModal('modal-delete-account');
}

/** Habilita o botão confirmar somente quando o usuário digita "EXCLUIR" */
function verificarInputExclusao(valor) {
  const btn = document.getElementById('btn-confirmar-exclusao');
  if (btn) btn.disabled = valor !== 'EXCLUIR';
}

/** Executa a exclusão permanente via API */
async function confirmarExclusaoConta() {
  fecharModal('modal-delete-account');

  const token = localStorage.getItem('monitech_token_system');
  if (!token) { alertaErro('Sessão expirada', 'Faça login novamente.'); return; }

  const dados = await apiFetch('/api/usuario', {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body:    JSON.stringify({})
  });

  if (dados.sucesso) {
    alertaSucesso('Conta excluída', 'Obrigado por usar o MONITECH. Você será desconectado.');
    setTimeout(sair, 2500);
  } else {
    alertaErro('Erro ao excluir conta', dados.erro || 'Não foi possível excluir a conta.');
  }
}

/** Atualiza o avatar de perfil ao selecionar uma imagem */
function atualizarAvatarConta() {
  const arquivo = document.getElementById('account-avatar-input').files[0];

  if (!arquivo) return;

  // Valida o tamanho (máximo 5MB)
  if (arquivo.size > 5 * 1024 * 1024) {
    mostrarToast('Arquivo muito grande! O tamanho máximo é 5MB.', 'aviso');
    return;
  }

  // Valida tipo MIME
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!tiposPermitidos.includes(arquivo.type)) {
    mostrarToast('Tipo de arquivo não permitido! Use JPG, PNG ou WebP.', 'aviso');
    return;
  }

  // Preview imediato
  const leitor = new FileReader();
  leitor.onload = (e) => {
    const avatar = document.getElementById('account-avatar');
    avatar.innerHTML = `<img src="${e.target.result}" alt="Foto de perfil" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    avatar.style.backgroundColor = 'transparent';
  };
  leitor.readAsDataURL(arquivo);

  // Faz upload para a API
  const token = localStorage.getItem('monitech_token_system');
  if (!token) {
    alertaErro('Sessão expirada', 'Faça login novamente.');
    return;
  }

  const formData = new FormData();
  formData.append('arquivo', arquivo);

  fetch('/api/usuario/foto', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  })
  .then(res => res.json())
  .then(dados => {
    if (dados.sucesso && dados.fotoUrl) {
      const usuarioStr = localStorage.getItem('monitech_usuario_system');
      if (usuarioStr) {
        const usuario = JSON.parse(usuarioStr);
        usuario.fotoUrl = dados.fotoUrl;
        localStorage.setItem('monitech_usuario_system', JSON.stringify(usuario));
      }
      if (appState.usuario) appState.usuario.fotoUrl = dados.fotoUrl;
      if (typeof window.atualizarFotoEmTodoSiteGlobal === 'function') {
        window.atualizarFotoEmTodoSiteGlobal(dados.fotoUrl, null);
      }
      alertaSucesso('Foto atualizada', 'Foto de perfil salva com sucesso!');
    } else {
      alertaErro('Erro ao salvar foto', dados.erro || 'Erro desconhecido');
      carregarDadosConta();
    }
  })
  .catch(erro => {
    console.error('[ERRO UPLOAD FOTO]', erro);
    alertaErro('Erro de conexão', 'Não foi possível enviar a foto.');
    carregarDadosConta();
  });
}

/** Navega para a aba de configurações */
function irParaConfiguracoes() {
  fecharMenuUsuario();
  exibirAba('settings');
  carregarDadosConfiguracoes();
}

/** Navega para o painel admin */
function irParaAdmin() {
  fecharMenuUsuario();
  if (!isAdmin()) return;
  exibirAba('admin');
}

/** Navega para a aba de Minha Conta (perfil do usuário) */
function irParaMinhaContaSystem() {
  fecharMenuUsuario();
  exibirAba('account');
  carregarDadosConta();
}

/** 
 * SINCRONIZA appState.usuario com dados da API (principal)
 * Fallback para localStorage se a API falhar
 * ⚠️ IMPORTANTE: System APENAS usa tokens com prefixo _system (independente da landing)
 */
async function sincronizarUsuarioDoLocalStorage() {
  console.log('[SYNC] Iniciando sincronização (APENAS dados do SYSTEM)...');
  
  // ⚠️ IMPORTANTE: System APENAS verifica token_system (não usa landing)
  const token = localStorage.getItem('monitech_token_system');
  
  if (!token) {
    console.log('[SYNC] Sem token do SYSTEM, pulando sincronização');
    return false;
  }
  
  try {
    // Passo 1: Tentar obter dados FRESCOS da API
    const response = await fetch('/api/usuario/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.sucesso && data.nome) {
        // Dados da API
        const usuarioAPI = {
          id:             data.id,
          nome:           data.nome,
          email:          data.email,
          telefone:       data.telefone       || null,
          dataNascimento: data.dataNascimento || null,
          genero:         data.genero         || null,
          fotoUrl:        data.fotoUrl,
          dataCriacao:    data.dataCriacao,
          role:           data.role || 'user',
          totpAtivo:      data.totpAtivo ?? false,
          tema:           data.tema || 'dark',
          plano:          data.plano || 'gratuito',
          planoExpiraEm:  data.planoExpiraEm || null
        };

        // Tema gerenciado por cookie (mt_t_{uid}) — não sobrescreve com valor do DB
        // O valor do DB só é usado como fallback durante o login (fazerLogin/Google/2FA)

        console.log('[SYNC] ✓ Dados obtidos da API:', usuarioAPI.nome);

        // Atualiza appState com dados frescos
        appState.usuario = usuarioAPI;

        // Salva APENAS em chaves do SYSTEM
        localStorage.setItem('monitech_usuario_system', JSON.stringify(usuarioAPI));
        
        return true;
      }
    } else {
      console.warn('[SYNC] API retornou erro:', response.status);
    }
  } catch (error) {
    console.warn('[SYNC] Erro ao buscar dados da API:', error.message);
  }
  
  // Passo 2: Fallback para localStorage se API falhar
  try {
    // ⚠️ APENAS verifica token_system
    const usuarioStr = localStorage.getItem('monitech_usuario_system');
    
    if (usuarioStr) {
      const usuario = JSON.parse(usuarioStr);
      if (usuario && usuario.nome) {
        console.log('[SYNC] Usando dados do localStorage:', usuario.nome);
        appState.usuario = usuario;
        return true;
      }
    }
  } catch (e) {
    console.error('[SYNC] Erro ao parse do localStorage:', e);
  }
  
  console.log('[SYNC] Nenhum usuário encontrado');
  return false;
}

/** Atualiza o avatar do usuário logado na barra superior */
async function atualizarIndicadorUsuario() {
  console.log('[UPDATE USER] Iniciando... appState.usuario:', appState.usuario);
  
  // Sincroniza dados frescos da API 
  try {
    await sincronizarUsuarioDoLocalStorage();
    console.log('[UPDATE USER] Dados sincronizados, renderizando...');
  } catch (err) {
    console.warn('[UPDATE USER] Erro na sincronização:', err);
  }
  
  // Renderiza com dados atualizados
  atualizarIndicadorUsuarioDOM();
}

/** Função auxiliar: atualiza apenas o DOM do indicador */
function atualizarIndicadorUsuarioDOM() {
  console.log('[UPDATE USER] Atualizando DOM... appState.usuario:', appState.usuario);
  
  const userAvatar = document.querySelector('.user-avatar');
  
  // Elementos do dropdown
  const dropdownHeader = document.getElementById('user-dropdown-header');
  const dropdownDivider = document.getElementById('user-dropdown-divider');
  const dropdownUserName = document.getElementById('user-dropdown-nome');
  const dropdownUserEmail = document.getElementById('user-dropdown-email');
  const dropdownAvatarLarge = document.getElementById('user-dropdown-avatar-lg');
  const dropdownMinhaConta = document.getElementById('dropdown-minha-conta');
  const dropdownConfig = document.getElementById('dropdown-config');
  const dropdownInstitucional = document.getElementById('dropdown-institucional');
  const dropdownLogout = document.getElementById('dropdown-logout');

  console.log('[UPDATE USER] Condição verificada:');
  console.log('[UPDATE USER] - appState.usuario existe?', !!appState.usuario);
  console.log('[UPDATE USER] - appState.usuario.nome:', appState.usuario?.nome);
  console.log('[UPDATE USER] - dropdownUserName elemento existe?', !!dropdownUserName);
  console.log('[UPDATE USER] - dropdownUserName ID encontrado?', dropdownUserName !== null);

  if (appState.usuario && appState.usuario.nome && appState.usuario.nome.trim() !== '') {
    console.log('[UPDATE USER] ✓ Atualizando com usuário:', appState.usuario);
    const primeiroNome = appState.usuario.nome.split(' ')[0];
    
    // Mostra header e divider quando logado
    if (dropdownHeader) {
      dropdownHeader.style.display = '';
      dropdownHeader.style.removeProperty('display');
    }
    if (dropdownDivider) {
      dropdownDivider.style.display = '';
      dropdownDivider.style.removeProperty('display');
    }
    
    // Atualiza o dropdown com dados do usuário
    if (dropdownUserName) {
      console.log('[UPDATE USER] Nome antes:', dropdownUserName.textContent, '→ Depois:', appState.usuario.nome);
      dropdownUserName.textContent = appState.usuario.nome;
    }
    if (dropdownUserEmail && appState.usuario.email) {
      console.log('[UPDATE USER] Email antes:', dropdownUserEmail.textContent, '→ Depois:', appState.usuario.email);
      dropdownUserEmail.textContent = appState.usuario.email;
    }
    
    // Atualiza avatar grande do dropdown (usa img tag para sobrescrever o gradient do CSS)
    const fotoUrl = appState.usuario.fotoUrl || appState.usuario.foto_url;
    const inicial = primeiroNome.charAt(0).toUpperCase();
    if (dropdownAvatarLarge) {
      if (fotoUrl) {
        console.log('[UPDATE USER] Carregando foto:', fotoUrl);
        dropdownAvatarLarge.innerHTML = '';
        dropdownAvatarLarge.style.backgroundColor = 'transparent';
        const imgLg = document.createElement('img');
        imgLg.src = fotoUrl;
        imgLg.alt = '';
        imgLg.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        imgLg.onerror = () => {
          dropdownAvatarLarge.innerHTML = '';
          dropdownAvatarLarge.textContent = inicial;
          dropdownAvatarLarge.style.backgroundColor = '';
        };
        dropdownAvatarLarge.appendChild(imgLg);
      } else {
        console.log('[UPDATE USER] Sem foto, mostrando inicial:', inicial);
        dropdownAvatarLarge.innerHTML = '';
        dropdownAvatarLarge.textContent = inicial;
      }
    }

    // Atualiza avatar pequeno no navbar
    if (userAvatar) {
      if (fotoUrl) {
        userAvatar.innerHTML = '';
        userAvatar.style.backgroundColor = 'transparent';
        const imgSm = document.createElement('img');
        imgSm.src = fotoUrl;
        imgSm.alt = '';
        imgSm.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        imgSm.onerror = () => {
          userAvatar.innerHTML = '';
          userAvatar.textContent = inicial;
          userAvatar.style.backgroundColor = '';
        };
        userAvatar.appendChild(imgSm);
      } else {
        userAvatar.innerHTML = '';
        userAvatar.textContent = inicial;
      }
    }
    
    // Mostra itens de usuário logado
    if (dropdownMinhaConta) dropdownMinhaConta.style.display = '';
    if (dropdownConfig) dropdownConfig.style.display = '';
    if (dropdownInstitucional) dropdownInstitucional.style.display = '';
    if (dropdownLogout) dropdownLogout.style.display = '';
  } else {
    console.log('[UPDATE USER] ✗ Sem usuário logado ou sem nome. Escondendo dropdown.');
    // Esconde header e divider quando não logado
    if (dropdownHeader) dropdownHeader.style.display = 'none';
    if (dropdownDivider) dropdownDivider.style.display = 'none';
    
    if (dropdownUserName) {
      dropdownUserName.textContent = 'Usuário';
    }
    if (dropdownUserEmail) {
      dropdownUserEmail.textContent = 'usuario@email.com';
    }
    dropdownAvatarLarge.style.backgroundImage = '';
    dropdownAvatarLarge.textContent = 'U';
    
    // Atualiza avatar (quando não logado)
    if (userAvatar) {
      userAvatar.style.backgroundImage = '';
      userAvatar.textContent = 'U';
    }
    
    // Esconde itens de usuário logado
    if (dropdownMinhaConta) dropdownMinhaConta.style.display = 'none';
    if (dropdownConfig) dropdownConfig.style.display = 'none';
    if (dropdownInstitucional) dropdownInstitucional.style.display = 'none';
    if (dropdownLogout) dropdownLogout.style.display = 'none';
  }
}

/** Encerra a sessão do usuário do SYSTEM (não afeta login da landing page) */
function sair() {
  console.log('[SAIR] Deslogando do SYSTEM...');
  
  // Remove APENAS tokens do SYSTEM (a landing page não é afetada)
  localStorage.removeItem('monitech_token_system');
  localStorage.removeItem('monitech_usuario_system');
  localStorage.removeItem('monitech_expira_system');
  localStorage.removeItem('monitech_last_tab');
  
  // Para todos os intervalos de polling
  clearInterval(intervaloAoVivo);
  clearInterval(intervaloResumo);

  appState = {
    usuario:      null,
    role:         'user',
    residencia:   null,
    sensor:       null,
    comodos:      [],
    dispositivos: [],
    leituras:     [],
    alertas:      [],
    dadosAoVivo:  { volts: 0, amps: 0, watts: 0, pf: 0, freq: 0, kwh: 0 }
  };

  // Reseta só o tema anônimo — o cookie por usuário (mt_t_{id}) é preservado para o próximo login
  window._resetarTemaAnonimo?.();
  aplicarTema('dark', true, true);

  // Fecha seções admin que possam ter ficado abertas
  const otaPanel = document.getElementById('ota-avancado');
  if (otaPanel) otaPanel.style.display = 'none';
  esp32TabAberta = false;
  _pararStatusPolling();
  _pararPollingConexao();

  fecharMenuUsuario();
  destruirGraficos();
  mostrarPagina('page-login');
}


// ===================================================
// ABA DE CONFIGURAÇÕES
// ===================================================

/**
 * Exibe o painel de configurações da aba selecionada.
 * @param {string} nomeAba - Nome do painel (profile, house, notifications, personalization, security, billing, about)
 */
function exibirAbaConfiguracoes(nomeAba) {
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));

  const painel = document.getElementById('panel-' + nomeAba);
  const aba = document.getElementById('tab-' + nomeAba);
  if (painel) painel.classList.add('active');
  if (aba) aba.classList.add('active');
}

/** Retorna o tema salvo no navegador */
function obterTemaSalvo() {
  const tema = localStorage.getItem(CHAVE_TEMA_SITE);
  return tema === 'light' ? 'light' : 'dark';
}

/** Atualiza os controles visuais da aba de personalização */
function atualizarControlesTema(tema) {
  const opcaoSelecionada = document.querySelector(`input[name="theme-preference"][value="${tema}"]`);
  if (opcaoSelecionada) opcaoSelecionada.checked = true;

  const indicadorTema = document.getElementById('theme-current-label');
  if (indicadorTema) indicadorTema.textContent = tema === 'light' ? 'Claro' : 'Escuro';
}

/**
 * Aplica o tema na interface e persiste em cookie + localStorage.
 * @param {string}  tema          'light' | 'dark'
 * @param {boolean} persistir     salva em cookie/localStorage (padrão: true)
 * @param {boolean} skipSalvar    só aplica visualmente, não persiste (use em init/login)
 */
function aplicarTema(tema, persistir = true, skipSalvar = false) {
  const temaNormalizado = tema === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', temaNormalizado);
  document.documentElement.setAttribute('data-theme-mode', temaNormalizado);
  document.documentElement.classList.toggle('dark-theme', temaNormalizado === 'dark');
  document.body?.setAttribute('data-theme', temaNormalizado);
  document.body?.classList.toggle('dark-theme', temaNormalizado === 'dark');

  if (persistir) {
    localStorage.setItem(CHAVE_TEMA_SITE, temaNormalizado);
    if (!skipSalvar) {
      // Persiste em cookie por usuário (se logado) e cookie global
      const userId = appState?.usuario?.id
        ?? JSON.parse(localStorage.getItem('monitech_usuario_system') || 'null')?.id;
      window._salvarTemaUsuario?.(userId, temaNormalizado);
    }
  }

  atualizarControlesTema(temaNormalizado);
}

/** Salva a personalização do tema localmente e no banco */
async function salvarPersonalizacao() {
  const temaSelecionado = document.querySelector('input[name="theme-preference"]:checked')?.value || 'dark';
  aplicarTema(temaSelecionado, true);

  const token = localStorage.getItem('monitech_token_system');
  if (!token) return;
  const resp = await apiFetch('/api/usuario/perfil', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body:    JSON.stringify({ tema: temaSelecionado })
  });
  if (resp?.sucesso) {
    if (appState.usuario) appState.usuario.tema = temaSelecionado;
  } else {
    mostrarToast('Erro ao salvar tema. Tente novamente.', 'erro');
  }
}

/** Preenche os campos de configurações com os dados do estado atual */
function carregarDadosConfiguracoes() {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };

  if (appState.usuario) {
    setVal('set-name',     appState.usuario.nome);
    setVal('set-email',    appState.usuario.email);
    setVal('set-phone',    appState.usuario.telefone);
    setVal('set-language', localStorage.getItem('idioma') || 'pt-BR');
  }

  if (appState.residencia) {
    setVal('set-house-name', appState.residencia.nome);
    setVal('set-house-cep',  appState.residencia.cep);
    setVal('set-house-area', appState.residencia.area);
    setVal('set-house-type', appState.residencia.tipo || 'house');

    // Preenche distribuidoras pelo estado e seleciona a salva
    const estado = appState.residencia.estado;
    const distSalva = appState.residencia.distribuidora;
    if (estado) {
      fetch(`/api/tarifas/distribuidoras?estado=${estado}`)
        .then(r => r.json())
        .then(data => {
          const sel = document.getElementById('set-house-dist');
          if (!sel || !data.sucesso) return;
          sel.innerHTML = data.distribuidoras.map(d =>
            `<option value="${d.codigo}"${d.codigo === distSalva ? ' selected' : ''}>${d.nome}</option>`
          ).join('');
          onSetDistribuidoraChange(sel.value);
        }).catch(() => {});
    }
  }

  atualizarControlesTema(obterTemaSalvo());
  carregarNotificacoesSalvas();

  // Aplica idioma salvo ao select e ao <html lang>
  const idiomaAtual = localStorage.getItem('idioma') || 'pt-BR';
  document.documentElement.lang = idiomaAtual;

  // Atualiza o status do 2FA na interface de segurança
  const totpAtivo = appState.usuario?.totpAtivo ?? false;
  _atualizar2FaUi(totpAtivo);
}

/** Salva as alterações de perfil do usuário */
async function salvarPerfil() {
  const nome = document.getElementById('set-name').value.trim();
  const telefone = document.getElementById('set-phone').value.trim();
  const idioma = document.getElementById('set-language').value;

  if (!nome) {
    alertaErro('Campo obrigatório', 'Informe seu nome completo.');
    return;
  }

  const token = localStorage.getItem('monitech_token_system');
  if (!token) { alertaErro('Sessão expirada', 'Faça login novamente.'); return; }

  const dados = await apiFetch('/api/usuario/perfil', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ nome, telefone: telefone || null })
  });

  if (dados.sucesso) {
    appState.usuario.nome     = dados.usuario.nome;
    appState.usuario.telefone = telefone;

    const idiomaAnterior = localStorage.getItem('idioma') || 'pt-BR';
    localStorage.setItem('idioma', idioma);
    atualizarIndicadorUsuario();

    if (idioma !== idiomaAnterior) {
      alertaSucesso('Perfil atualizado', 'Idioma alterado. Recarregando o sistema…');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      alertaSucesso('Perfil atualizado', 'Alterações salvas com sucesso!');
    }
  } else {
    alertaErro('Erro ao salvar', dados.erro || 'Não foi possível salvar as alterações.');
  }
}

/** Salva as configurações da residência */
async function salvarConfiguracoesCasa() {
  const nome = document.getElementById('set-house-name').value.trim();
  const cep = document.getElementById('set-house-cep').value.trim();
  const area = document.getElementById('set-house-area').value;
  const distribuidora = document.getElementById('set-house-dist').value;
  const tarifa = document.getElementById('set-house-rate').value || appState.residencia?.tarifaKwh || 0.74;
  const tipo = document.getElementById('set-house-type').value;

  if (!nome) {
    alertaErro('Campo obrigatório', 'Informe o nome da residência.');
    return;
  }

  if (!appState.residencia?.id) {
    alertaErro('Erro', 'Residência não identificada.');
    return;
  }

  try {
    const resp = await API.atualizarResidencia(appState.residencia.id, {
      nome,
      tipo,
      cep:           cep || null,
      areaM2:        parseFloat(area) || null,
      distribuidora: distribuidora || null,
      tarifaKwh:     parseFloat(tarifa) || 0.74
    });

    if (!resp.sucesso) {
      alertaErro('Erro ao salvar', resp.erro || 'Não foi possível salvar as configurações.');
      return;
    }

    appState.residencia.nome         = nome;
    appState.residencia.cep          = cep;
    appState.residencia.area         = parseFloat(area) || 0;
    appState.residencia.distribuidora = distribuidora;
    appState.residencia.tarifaKwh    = parseFloat(tarifa) || 0.74;
    appState.residencia.tipo         = tipo;

    const labelEl = document.getElementById('house-label');
    if (labelEl) labelEl.textContent = nome;

    alertaSucesso('Residência atualizada', 'As configurações foram salvas com sucesso.');
  } catch (_) {
    alertaErro('Erro ao salvar', 'Verifique sua conexão e tente novamente.');
  }
}

/** Salva as preferências de notificações — persiste no backend */
async function salvarNotificacoes() {
  const get = (id) => document.getElementById(id);
  const payload = {
    emailAlertas:   get('not-email-alerts')?.checked   ?? true,
    alertaConsumo:  get('not-email-cost')?.checked     ?? true,
    alertaAnomalia: get('not-email-anomaly')?.checked  ?? true,
    alertaSensor:   get('not-email-device')?.checked   ?? false,
    alertaTensao:   get('not-email-alerts')?.checked   ?? true,
  };
  // Salva browser prefs localmente (não são concernentes ao backend)
  const browserCfg = {
    browser_alertas: get('not-browser-alerts')?.checked ?? true,
    browser_som:     get('not-browser-sound')?.checked  ?? true,
    frequencia:      get('not-frequency')?.value ?? '15'
  };
  localStorage.setItem('monitech_notif_browser', JSON.stringify(browserCfg));

  // Solicita permissão do browser se toggle ativado
  if (browserCfg.browser_alertas) await _solicitarPermissaoNotificacao();

  try {
    const resp = await apiFetch('/api/usuario/notificacoes', { method: 'PUT', headers: headersAuth(), body: JSON.stringify(payload) });
    if (resp?.sucesso) {
      alertaSucesso('Notificações salvas', 'Suas preferências de alerta foram atualizadas.');
    } else {
      alertaErro('Erro', resp?.erro || 'Não foi possível salvar.');
    }
  } catch {
    alertaErro('Erro de conexão', 'Verifique se o servidor está rodando.');
  }
}

/** Carrega preferências de notificações do backend */
async function carregarNotificacoesSalvas() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  try {
    const data = await apiFetch('/api/usuario/notificacoes', { headers: headersAuth() });
    if (data?.sucesso) {
      set('not-email-alerts',  data.emailAlertas   ?? true);
      set('not-email-cost',    data.alertaConsumo  ?? true);
      set('not-email-anomaly', data.alertaAnomalia ?? true);
      set('not-email-device',  data.alertaSensor   ?? false);
      set('notify-email-alerts', data.emailAlertas ?? true);
    }
  } catch (_) {}
  // Carrega prefs de browser do localStorage
  const raw = localStorage.getItem('monitech_notif_browser');
  if (raw) {
    try {
      const cfg = JSON.parse(raw);
      set('not-browser-alerts', cfg.browser_alertas ?? true);
      set('not-browser-sound',  cfg.browser_som     ?? true);
      const freqEl = document.getElementById('not-frequency');
      if (freqEl && cfg.frequencia) freqEl.value = cfg.frequencia;
    } catch (_) {}
  }
}

/** Processa a alteração de senha do usuário */
async function alterarSenha() {
  const senhaAtual = document.getElementById('set-pass-current').value;
  const novaSenha = document.getElementById('set-pass-new').value;
  const confirmarSenha = document.getElementById('set-pass-confirm').value;

  if (!senhaAtual || !novaSenha || !confirmarSenha) {
    alertaErro('Campos obrigatórios', 'Preencha todos os campos de senha.');
    return;
  }
  if (novaSenha !== confirmarSenha) {
    alertaErro('Senhas diferentes', 'A nova senha e a confirmação não coincidem.');
    return;
  }
  if (novaSenha.length < 8) {
    alertaErro('Senha fraca', 'A nova senha deve ter no mínimo 8 caracteres.');
    return;
  }

  const token = localStorage.getItem('monitech_token_system');
  if (!token) { alertaErro('Sessão expirada', 'Faça login novamente.'); return; }

  const dados = await apiFetch('/api/usuario/senha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ senhaAtual, novaSenha })
  });

  if (dados.sucesso) {
    document.getElementById('set-pass-current').value = '';
    document.getElementById('set-pass-new').value = '';
    document.getElementById('set-pass-confirm').value = '';
    alertaSucesso('Senha alterada', 'Use a nova senha na próxima vez que fizer login.');
  } else {
    alertaErro('Erro ao alterar senha', dados.erro || 'Não foi possível alterar a senha.');
  }
}

/** Abre o modal de 2FA (ativar ou desativar conforme estado atual) */
async function habilitarAutenticacao2FA() {
  const ativo = appState.usuario?.totpAtivo;
  const modal = document.getElementById('modal-2fa');
  if (!modal) return;

  document.getElementById('2fa-step-setup').style.display    = ativo ? 'none' : '';
  document.getElementById('2fa-step-desativar').style.display = ativo ? '' : 'none';

  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [modal] });

  if (!ativo) {
    // Gera secret via API
    const qrBox  = document.getElementById('2fa-qr-box');
    qrBox.innerHTML = '<div class="modal-2fa-spinner"></div>';
    document.getElementById('2fa-secret-text').textContent = '';
    document.getElementById('2fa-code-input').value = '';

    const r = await apiFetch('/api/usuario/2fa/ativar', { method: 'POST', headers: headersAuth() });
    if (!r?.sucesso) {
      fecharModal2FA();
      mostrarAlerta(r?.erro || 'Erro ao gerar QR Code.', 'error');
      return;
    }

    document.getElementById('2fa-secret-text').textContent = r.secret;
    qrBox.innerHTML = '<div id="2fa-qrcode"></div>';
    new QRCode(document.getElementById('2fa-qrcode'), {
      text: r.qrUri,
      width: 180,
      height: 180,
      colorDark: '#7df9ff',
      colorLight: '#1F3A58',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    document.getElementById('2fa-disable-code').value = '';
  }
}

/** Confirma o código e ativa o 2FA */
async function confirmar2FA() {
  const codigo = document.getElementById('2fa-code-input').value.trim().replace(/\s/g, '');
  if (codigo.length !== 6) { mostrarAlerta('Digite o código de 6 dígitos do autenticador.', 'warning'); return; }

  const btn = document.getElementById('btn-confirmar-2fa');
  if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }

  const r = await apiFetch('/api/usuario/2fa/confirmar', {
    method: 'POST',
    headers: { ...headersAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo })
  });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="check" style="width:15px;height:15px;"></i> Confirmar e Ativar'; if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] }); }

  if (r?.sucesso) {
    if (appState.usuario) appState.usuario.totpAtivo = true;
    _atualizar2FaUi(true);
    fecharModal2FA();
    mostrarAlerta('2FA ativado com sucesso! Sua conta está mais protegida.', 'success');
  } else {
    mostrarAlerta(r?.erro || 'Código inválido. Tente novamente.', 'error');
  }
}

/** Desativa o 2FA */
async function desativar2FA() {
  const codigo = document.getElementById('2fa-disable-code').value.trim().replace(/\s/g, '');
  if (codigo.length !== 6) { mostrarAlerta('Digite o código de 6 dígitos do autenticador.', 'warning'); return; }

  const btn = document.getElementById('btn-desativar-2fa');
  if (btn) { btn.disabled = true; btn.textContent = 'Desativando…'; }

  const r = await apiFetch('/api/usuario/2fa', {
    method: 'DELETE',
    headers: { ...headersAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo })
  });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="shield-off" style="width:15px;height:15px;"></i> Desativar 2FA'; if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] }); }

  if (r?.sucesso) {
    if (appState.usuario) appState.usuario.totpAtivo = false;
    _atualizar2FaUi(false);
    fecharModal2FA();
    mostrarAlerta('2FA desativado.', 'success');
  } else {
    mostrarAlerta(r?.erro || 'Código inválido.', 'error');
  }
}

function fecharModal2FA() {
  const modal = document.getElementById('modal-2fa');
  if (modal) modal.style.display = 'none';
}

function _copiar2FaSecret() {
  const s = document.getElementById('2fa-secret-text')?.textContent;
  if (s) navigator.clipboard.writeText(s).then(() => mostrarAlerta('Código copiado!', 'success'));
}

function _atualizar2FaUi(ativo) {
  const badge = document.getElementById('2fa-status-badge');
  const btn   = document.getElementById('btn-2fa');
  if (badge) {
    badge.textContent = ativo ? 'Ativado' : 'Desativado';
    badge.className   = 'twofa-badge ' + (ativo ? 'twofa-badge--on' : 'twofa-badge--off');
  }
  if (btn) {
    btn.textContent = ativo ? 'Desativar 2FA' : 'Ativar 2FA';
    btn.className   = ativo ? 'btn btn-sm' : 'btn btn-secondary btn-sm';
    if (ativo) btn.style.cssText = 'background:#f87171;color:#fff;border:none;';
    else       btn.style.cssText = '';
  }
  // Oculta o aviso de 2FA não ativado no painel de perfil
  const alerta2fa = document.querySelector('.security-alert');
  if (alerta2fa) alerta2fa.style.display = ativo ? 'none' : '';
}

/** Faz upload da foto de perfil selecionada nas Configurações */
async function visualizarAvatar() {
  const arquivo = document.getElementById('set-avatar').files[0];
  if (!arquivo) return;

  if (arquivo.size > 5 * 1024 * 1024) {
    alertaErro('Arquivo muito grande', 'O tamanho máximo é 5MB.');
    return;
  }
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!tiposPermitidos.includes(arquivo.type)) {
    alertaErro('Tipo inválido', 'Use JPG, PNG ou WebP.');
    return;
  }

  // Preview imediato
  const leitor = new FileReader();
  leitor.onload = (e) => {
    const avatar = document.getElementById('profile-avatar');
    avatar.innerHTML = `<img src="${e.target.result}" alt="Foto de perfil" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    avatar.style.backgroundColor = 'transparent';
  };
  leitor.readAsDataURL(arquivo);

  // Upload para a API
  const token = localStorage.getItem('monitech_token_system');
  if (!token) {
    alertaErro('Sessão expirada', 'Faça login novamente.');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('arquivo', arquivo);

    const resp = await fetch('/api/usuario/foto', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const dados = await resp.json();

    if (dados.sucesso && dados.fotoUrl) {
      const usuarioStr = localStorage.getItem('monitech_usuario_system');
      if (usuarioStr) {
        const usuario = JSON.parse(usuarioStr);
        usuario.fotoUrl = dados.fotoUrl;
        localStorage.setItem('monitech_usuario_system', JSON.stringify(usuario));
      }
      if (appState.usuario) appState.usuario.fotoUrl = dados.fotoUrl;
      if (typeof window.atualizarFotoEmTodoSiteGlobal === 'function') {
        window.atualizarFotoEmTodoSiteGlobal(dados.fotoUrl, null);
      }
      alertaSucesso('Foto atualizada', 'Foto de perfil salva com sucesso!');
    } else {
      alertaErro('Erro ao salvar foto', dados.erro || 'Tente novamente.');
    }
  } catch (err) {
    console.error('[visualizarAvatar] Erro:', err);
    alertaErro('Erro de conexão', 'Não foi possível enviar a foto.');
  }
}

/** Exibe modal de upgrade de plano */
function atualizarPlano(mensagem = null) {
  const msg = mensagem || 'Desbloqueie recursos avançados do MONITECH.';

  const _logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" width="36" height="36" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <path d="M100,18 C72,18 50,40 50,66 C50,86 60,100 74,110 C80,114 82,120 82,126 L118,126 C118,120 120,114 126,110 C140,100 150,86 150,66 C150,40 128,18 100,18Z" stroke-width="4"/>
    <path d="M83,130 C91,127 109,127 117,130" stroke-width="3.5"/>
    <path d="M84,138 C92,134 108,134 116,138" stroke-width="3.2"/>
    <path d="M86,146 C93,142 107,142 114,146" stroke-width="3"/>
    <path d="M90,162 C94,158 106,158 110,162" stroke-width="2.5"/>
    <path d="M78,116 C76,100 80,82 86,72 C90,64 96,66 98,76 C100,84 99,98 99,110" stroke-width="3.5"/>
    <path d="M99,110 C99,96 100,82 103,72 C106,62 114,64 116,74 C118,84 116,104 113,118" stroke-width="3.5"/>
  </svg>`;

  const _check = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;


  const beneficios = [
    'Residências ilimitadas',
    'Dispositivos Monitech ilimitados',
    'Histórico completo (365 dias vs 60 dias)',
    'Relatórios em PDF e CSV',
    'Relatórios em PDF',
    'Alertas por e-mail',
  ];

  const overlay = document.createElement('div');
  overlay.id = 'plano-upgrade-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:16px;
    animation:fadeIn .2s ease;
  `;

  overlay.innerHTML = `
    <div style="
      background:var(--bg-card);border:1px solid var(--border-bright);
      border-radius:16px;padding:36px 32px;max-width:460px;width:100%;
      box-shadow:0 24px 60px rgba(0,0,0,.5);text-align:center;
    ">
      <div style="display:flex;justify-content:center;margin-bottom:14px;color:var(--cyan)">
        ${_logo}
      </div>
      <h2 style="font-family:var(--display);font-size:20px;color:var(--ink);margin-bottom:8px">
        Limite do Plano Gratuito
      </h2>
      <p style="color:var(--ink-3);font-size:14px;line-height:1.7;margin-bottom:24px">${msg}</p>

      <div style="
        background:var(--bg-deep);border:1px solid var(--border);
        border-radius:10px;padding:20px;margin-bottom:24px;text-align:left;
      ">
        <div style="font-size:11px;letter-spacing:2px;color:var(--cyan);font-family:var(--mono);margin-bottom:12px">
          PLANO MENSAL — O QUE VOCÊ GANHA
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13.5px;color:var(--ink-3)">
          ${beneficios.map(b => `
            <span style="display:flex;align-items:center;gap:8px">
              <span style="color:var(--success);flex-shrink:0">${_check}</span>
              ${b}
            </span>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:12px">
        <button onclick="document.getElementById('plano-upgrade-overlay').remove()"
          style="
            flex:1;padding:12px;border-radius:8px;
            border:1px solid var(--border-bright);
            background:transparent;color:var(--text-secondary);
            font-size:14px;cursor:pointer;font-family:inherit;
            transition:background .2s;
          "
          onmouseover="this.style.background='var(--topbar-hover)'"
          onmouseout="this.style.background='transparent'">
          Agora não
        </button>
        <a href="/website/pagamento.html"
          style="
            flex:2;padding:12px;border-radius:8px;border:none;
            background:linear-gradient(135deg,var(--blue-core),var(--blue-bright));
            color:#fff;font-size:14px;font-weight:700;cursor:pointer;
            display:flex;align-items:center;justify-content:center;
            text-decoration:none;letter-spacing:.5px;
            box-shadow:0 4px 16px var(--glow-blue);
            transition:opacity .2s,transform .15s;
          "
          onmouseover="this.style.opacity='.9';this.style.transform='translateY(-1px)'"
          onmouseout="this.style.opacity='1';this.style.transform=''">
          Ver Planos →
        </a>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);
}

/** Verifica se há atualizações disponíveis para o sistema */
function verificarAtualizacoes() {
  mostrarToast('Você está usando a versão mais recente do MONITECH (v2.1.0). Nenhuma atualização disponível no momento.', 'sucesso');
}

/** Exporta todos os dados do usuário em formato JSON */
function exportarDados() {
  const dados = {
    usuario: appState.usuario,
    residencia: appState.residencia,
    comodos: appState.comodos,
    dispositivos: appState.dispositivos,
    dataExportacao: new Date().toISOString()
  };

  const json = JSON.stringify(dados, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `monitech-dados-${Date.now()}.json`;
  link.click();

  mostrarToast('Dados exportados com sucesso! O arquivo foi salvo na sua pasta de downloads.', 'sucesso');
}

/** Exclui permanentemente a conta do usuário após confirmação dupla */
function deletarConta() {
  iniciarExclusaoConta();
}


// ===================================================
// MODAIS
// ===================================================

/** Abre um modal pelo seu ID */
function abrirModal(idModal) {
  document.getElementById(idModal).classList.add('open');
}

/** Fecha um modal pelo seu ID */
function fecharModal(idModal) {
  document.getElementById(idModal).classList.remove('open');
}


// ===================================================
// ONBOARDING — CONFIGURAÇÃO INICIAL
// ===================================================
let comodosConfigurados = [];
let dispositivosConfigurados = [];

/**
 * Atualiza o indicador de progresso do onboarding.
 * @param {number} etapaAtiva - Índice da etapa atual (0, 1 ou 2)
 */
// ── Onboarding helpers ────────────────────────────────────────

function selecionarTipoResidencia(el, tipo) {
  document.querySelectorAll('.res-type-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('house-tipo').value = tipo;
}

function mascaraCEP(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
  el.value = v;
  if (v.replace(/\D/g, '').length === 8) buscarCEP(v, el.id);
}

async function buscarCEP(cep, sourceId) {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return;

  // Determine context: settings form (set-house-cep) vs onboarding form (house-cep)
  const isSettings = sourceId === 'set-house-cep';
  const prefix      = isSettings ? 'set-house-' : 'house-';
  const statusId    = isSettings ? 'set-cep-loading' : 'cep-loading';
  const fieldsId    = isSettings ? 'set-cep-address-fields' : 'cep-address-fields';
  const numeroId    = isSettings ? 'set-house-numero' : 'house-numero';

  const status = document.getElementById(statusId);
  const setStatus = (cls, html) => {
    if (!status) return;
    status.className = `cep-status ${cls}`;
    status.innerHTML = html;
  };

  setStatus('cep-buscando', '<span class="cep-spinner"></span>Buscando endereço...');

  try {
    const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await resp.json();

    if (data.erro) {
      setStatus('cep-erro', '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>CEP não encontrado');
      return;
    }

    const set = (suffix, val) => {
      const el = document.getElementById(prefix + suffix);
      if (!el) return;
      el.value = val || '';
      if (val) el.classList.add('cep-auto-filled');
      else el.classList.remove('cep-auto-filled');
    };

    set('logradouro', data.logradouro);
    set('bairro',     data.bairro);
    set('complemento', data.complemento);
    set('cidade',     data.localidade);
    set('estado',     (data.uf || '').toUpperCase());

    // Dispara busca de distribuidoras ao preencher estado pelo CEP
    if (!isSettings && data.uf) onEstadoChange(data.uf.toUpperCase());

    const addrFields = document.getElementById(fieldsId);
    if (addrFields) addrFields.style.display = '';

    setTimeout(() => document.getElementById(numeroId)?.focus(), 50);

    const resumo = [data.logradouro, data.bairro, data.localidade].filter(Boolean).join(', ');
    setStatus('cep-ok',
      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>${resumo} — ${data.uf}`
    );

  } catch (_) {
    setStatus('cep-erro', '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Erro de conexão');
  }
}

// ── TARIFA / DISTRIBUIDORA AUTOMÁTICA ──────────────────────────

async function onEstadoChange(uf) {
  const sel  = document.getElementById('house-dist');
  const inp  = document.getElementById('house-tarifa');
  const badge = document.getElementById('house-bandeira-badge');
  if (!sel) return;

  if (!uf) {
    sel.innerHTML = '<option value="">— selecione o estado primeiro —</option>';
    sel.disabled  = true;
    if (inp)  inp.value = '0.74';
    if (badge) badge.style.display = 'none';
    return;
  }

  sel.innerHTML = '<option value="">Buscando distribuidoras...</option>';
  sel.disabled  = true;

  try {
    const resp = await fetch(`/api/tarifas/distribuidoras?estado=${uf}`);
    const data = await resp.json();

    if (!data.sucesso || !data.distribuidoras?.length) {
      sel.innerHTML = '<option value="">Nenhuma distribuidora encontrada</option>';
      return;
    }

    sel.innerHTML = data.distribuidoras.map(d =>
      `<option value="${d.codigo}">${d.nome}</option>`
    ).join('');
    sel.disabled = false;

    // Já seleciona a primeira e busca a tarifa
    onDistribuidoraChange(sel.value);
  } catch (_) {
    sel.innerHTML = '<option value="">Erro ao buscar — informe manualmente</option>';
    sel.disabled  = false;
  }
}

async function onDistribuidoraChange(codigo) {
  await _aplicarTarifaDisplay(codigo, 'house-tarifa', 'house-tarifa-valor', 'house-bandeira-badge');
}

async function onSetDistribuidoraChange(codigo) {
  await _aplicarTarifaDisplay(codigo, 'set-house-rate', 'set-house-rate-valor', 'set-house-bandeira-badge');
}

async function _aplicarTarifaDisplay(codigo, hiddenId, valorId, badgeId) {
  const hidden = document.getElementById(hiddenId);
  const valor  = document.getElementById(valorId);
  const badge  = document.getElementById(badgeId);
  if (!codigo || !hidden) return;

  try {
    const resp = await fetch(`/api/tarifas/info?distribuidora=${encodeURIComponent(codigo)}`);
    const data = await resp.json();
    if (!data.sucesso) return;

    const tarifaFormatada = `R$ ${data.tarifaTotal.toFixed(4)}`;
    hidden.value = data.tarifaTotal.toFixed(4);
    if (valor) valor.textContent = tarifaFormatada;

    if (badge) {
      const cores = {
        verde:     { bg: '#16a34a', label: '🟢 Verde' },
        amarela:   { bg: '#ca8a04', label: '🟡 Amarela' },
        vermelha1: { bg: '#dc2626', label: '🔴 Vermelha 1' },
        vermelha2: { bg: '#7f1d1d', label: '🔴 Vermelha 2' },
      };
      const c = cores[data.bandeira.cor] || cores.verde;
      badge.textContent      = c.label;
      badge.style.background = c.bg;
      badge.style.color      = '#fff';
      badge.style.display    = 'inline-block';
    }
  } catch (_) { /* sem alteração */ }
}

function toggleComodoCustom() {
  const form = document.getElementById('comodo-custom-form');
  const icon = document.getElementById('comodo-custom-icon');
  const open = form.style.display === 'none';
  form.style.display = open ? 'block' : 'none';
  icon.textContent   = open ? '▼' : '▶';
}

function adicionarComodoRapido(tipo, nomeBase) {
  const existentes = comodosConfigurados.filter(c => c.tipo === tipo);
  const nome = existentes.length === 0 ? nomeBase : `${nomeBase} ${existentes.length + 1}`;
  comodosConfigurados.push({ id: 'c' + Date.now(), tipo, nome, watts: 0 });
  renderizarComodosConfiguracao();
}

const WATTS_POR_TIPO = {
  ar:         1500,
  geladeira:   400,
  tv:          150,
  maquina:    1200,
  chuveiro:   5500,
  computador:  300,
  microondas: 1200,
  iluminacao:  100,
  bomba:       750,
  forno:      2000,
  ferro:      1000,
  outro:       200
};

const NOME_POR_TIPO = {
  ar:         'Ar-condicionado',
  geladeira:  'Geladeira',
  tv:         'Televisão',
  maquina:    'Máq. de Lavar',
  chuveiro:   'Chuveiro Elétrico',
  computador: 'Computador',
  microondas: 'Micro-ondas',
  iluminacao: 'Iluminação',
  bomba:      "Bomba d'água",
  forno:      'Forno Elétrico',
  ferro:      'Ferro de Passar',
  outro:      'Dispositivo'
};

function autoPreencherDispositivo() {
  const tipo = document.getElementById('dev-type')?.value;
  if (!tipo) return;
  const watts = WATTS_POR_TIPO[tipo];
  const nome  = NOME_POR_TIPO[tipo];
  const wattsEl = document.getElementById('dev-watts');
  const nomeEl  = document.getElementById('dev-name');
  const hintEl  = document.getElementById('watts-hint');
  if (wattsEl && !wattsEl.value) wattsEl.value = watts || '';
  if (nomeEl  && !nomeEl.value)  nomeEl.value  = nome  || '';
  if (hintEl) hintEl.textContent = watts ? `Típico: ${watts} W` : '';
}

function atualizarPassosOnboarding(etapaAtiva) {
  // 3 etapas: s0, s1, s2
  for (let i = 0; i < 3; i++) {
    const elemento = document.getElementById('s' + i);
    if (!elemento) continue;
    elemento.className = 'step-item ' + (
      i < etapaAtiva ? 'done' :
        i === etapaAtiva ? 'active' : ''
    );
  }

  document.querySelectorAll('.onboard-step').forEach((etapa, i) => {
    etapa.classList.toggle('active', i === etapaAtiva);
  });
}

/**
 * Avança para a próxima etapa do onboarding.
 * @param {number} etapaAtual - Índice da etapa sendo concluída
 */
function proximoOnboarding(etapaAtual) {
  if (etapaAtual === 0) {
    const nome = document.getElementById('house-name').value.trim();

    if (!nome) {
      mostrarToast('Por favor, informe o nome da sua residência para continuar.', 'aviso');
      return;
    }

    appState.residencia = {
      nome,
      tipo:         document.getElementById('house-tipo')?.value || 'house',
      cep:          document.getElementById('house-cep').value.trim(),
      cidade:       document.getElementById('house-cidade')?.value.trim() || null,
      estado:       document.getElementById('house-estado')?.value.trim().toUpperCase() || null,
      area:         document.getElementById('house-area').value,
      distribuidora: document.getElementById('house-dist').value,
      tarifaKwh:    parseFloat(document.getElementById('house-tarifa')?.value) || 0.74
    };

    atualizarPassosOnboarding(1);

  } else if (etapaAtual === 1) {
    if (comodosConfigurados.length === 0) {
      mostrarToast('Adicione pelo menos um cômodo para continuar. Exemplo: Sala de Estar, Quarto, Cozinha...', 'aviso');
      return;
    }

    preencherSelecoesComodos();
    atualizarPassosOnboarding(2);

  } else if (etapaAtual === 2) {
    finalizarOnboarding();
  }
}

/**
 * Retorna para a etapa anterior do onboarding.
 * @param {number} etapaAtual - Índice da etapa sendo abandonada
 */
function voltarOnboarding(etapaAtual) {
  atualizarPassosOnboarding(etapaAtual - 1);
}

/** Adiciona um novo cômodo na etapa de configuração do onboarding */
function adicionarComodoConfiguracao() {
  const tipo = document.getElementById('new-room-type').value;
  const nome = document.getElementById('new-room-name').value.trim()
    || tipo.charAt(0).toUpperCase() + tipo.slice(1);

  const novoComodo = {
    id: 'c' + Date.now(),
    tipo,
    nome,
    watts: 0 // Consumo será atualizado com dados reais do dispositivo
  };

  comodosConfigurados.push(novoComodo);
  renderizarComodosConfiguracao();
  document.getElementById('new-room-name').value = '';
}

/** Renderiza a lista de cômodos na etapa de configuração */
function renderizarComodosConfiguracao() {
  const container = document.getElementById('rooms-setup-list');

  container.innerHTML = comodosConfigurados.map((comodo, indice) => `
    <div style="display:flex; align-items:center; gap:12px; background:var(--bg-card2); border:1px solid var(--border); border-radius:8px; padding:10px 14px;">
      <span>${obterIconesComodos()[comodo.tipo] || obterIconesComodos()['outro']}</span>
      <span style="flex:1; font-weight:600;">${comodo.nome}</span>
      <span class="tag tag-cyan">${comodo.tipo}</span>
      <button onclick="removerComodoConfiguracao(${indice})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:18px;">×</button>
    </div>
  `).join('');

  corrigirTextosCorrompidosNaPagina(container);
}

/**
 * Remove um cômodo da lista de configuração.
 * @param {number} indice - Posição do cômodo no array
 */
function removerComodoConfiguracao(indice) {
  comodosConfigurados.splice(indice, 1);
  renderizarComodosConfiguracao();
}

/** Adiciona um novo dispositivo na etapa de configuração do onboarding */
function adicionarDispositivoConfiguracao() {
  const tipo = document.getElementById('dev-type').value;
  const nome = document.getElementById('dev-name').value.trim()
    || tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const idComodo = document.getElementById('dev-room').value;
  const nomeComodo = document.getElementById('dev-room').selectedOptions[0]?.text || '—';
  const potencia = parseInt(document.getElementById('dev-watts').value) || 300;

  const novoDispositivo = {
    id: 'd' + Date.now(),
    tipo,
    nome,
    idComodo,
    nomeComodo,
    watts: potencia,
    status: 'on',
    kwh: +(potencia * 8 / 1000).toFixed(2) // Estimativa de 8h diárias de uso
  };

  dispositivosConfigurados.push(novoDispositivo);
  renderizarDispositivosConfiguracao();
}

/** Renderiza a lista de dispositivos na etapa de configuração */
function renderizarDispositivosConfiguracao() {
  const container = document.getElementById('devices-setup-list');

  container.innerHTML = dispositivosConfigurados.map((disp, indice) => `
    <div style="display:flex; align-items:center; gap:12px; background:var(--bg-card2); border:1px solid var(--border); border-radius:8px; padding:10px 14px;">
      <span>${obterIconesDispositivos()[disp.categoria || disp.tipo] || obterIconesDispositivos()['outro']}</span>
      <span style="flex:1; font-weight:600;">${disp.nome}</span>
      <span class="tag tag-blue">${disp.nomeComodo}</span>
      <span style="font-family:'Orbitron',monospace; font-size:12px; color:var(--cyan);">${disp.watts}W</span>
      <button onclick="removerDispositivoConfiguracao(${indice})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:18px;">×</button>
    </div>
  `).join('');

  corrigirTextosCorrompidosNaPagina(container);
}

/**
 * Remove um dispositivo da lista de configuração.
 * @param {number} indice - Posição do dispositivo no array
 */
function removerDispositivoConfiguracao(indice) {
  dispositivosConfigurados.splice(indice, 1);
  renderizarDispositivosConfiguracao();
}

/**
 * Preenche os selects de cômodos em formulários de dispositivos.
 * Usa os cômodos configurados no onboarding ou os do estado da aplicação.
 */
function preencherSelecoesComodos() {
  const seletores = ['dev-room', 'modal-dev-room'];
  const listaComodos = comodosConfigurados.length ? comodosConfigurados : appState.comodos;

  seletores.forEach(idSeletor => {
    const select = document.getElementById(idSeletor);
    if (!select) return;
    select.innerHTML = listaComodos.map(c =>
      `<option value="${c.id}">${c.nome}</option>`
    ).join('');
  });
}

/** Finaliza o onboarding e prepara o acesso ao painel principal */
// ===================================================
// BOTTOM NAV MOBILE
// ===================================================

const BNAV_MAP = {
  dashboard: 'bnav-dashboard',
  rooms:     'bnav-rooms',
  devices:   'bnav-devices',
  alerts:    'bnav-alerts'
};

function sincronizarBnavMobile(nomeAba) {
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  const id = BNAV_MAP[nomeAba];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }
}

function alternarBnavMais() {
  const sheet = document.getElementById('bnav-sheet');
  const overlay = document.getElementById('bnav-sheet-overlay');
  const aberto = sheet?.classList.contains('active');
  if (aberto) {
    fecharBnavMais();
  } else {
    sheet?.classList.add('active');
    overlay?.classList.add('active');
  }
}

function fecharBnavMais() {
  document.getElementById('bnav-sheet')?.classList.remove('active');
  document.getElementById('bnav-sheet-overlay')?.classList.remove('active');
}

function atualizarBadgeAlertasBnav(count) {
  const badge = document.getElementById('bnav-alerts-badge');
  if (!badge) return;
  if (count > 0) {
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
}

// ── QR Code Scanner (usa BarcodeDetector da Web API, Chrome/Edge) ──

let qrStream = null;

async function abrirQRScanner() {
  if (!('BarcodeDetector' in window)) {
    mostrarToast('Seu navegador não suporta leitura de QR Code. Digite o código manualmente no campo acima. (Funciona no Chrome e Edge mais recentes)', 'aviso');
    return;
  }

  const container = document.getElementById('qr-scanner-container');
  const video     = document.getElementById('qr-video');
  if (!container || !video) return;

  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = qrStream;
    video.play();
    container.style.display = '';

    const detector = new BarcodeDetector({ formats: ['qr_code'] });

    const scanner = setInterval(async () => {
      if (!qrStream) { clearInterval(scanner); return; }
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const valor = barcodes[0].rawValue.trim().toUpperCase();
          const campo = document.getElementById('painel-codigo-iot') || document.getElementById('onboard-codigo-iot');
          if (campo) campo.value = valor;
          clearInterval(scanner);
          fecharQRScanner();
          mostrarAlerta('Código lido: ' + valor, 'success');
        }
      } catch (_) {}
    }, 300);

  } catch (e) {
    mostrarToast('Não foi possível acessar a câmera: ' + e.message, 'erro');
  }
}

function fecharQRScanner() {
  const container = document.getElementById('qr-scanner-container');
  const video     = document.getElementById('qr-video');
  if (container) container.style.display = 'none';
  if (video)     video.srcObject = null;
  if (qrStream)  { qrStream.getTracks().forEach(t => t.stop()); qrStream = null; }
}

/** Finaliza o onboarding e entra no painel */
async function finalizarOnboarding() {
  const btnFinalizar = document.getElementById('btn-finalizar-onboard')
    || document.querySelector('[onclick="finalizarOnboarding()"]');
  if (btnFinalizar) { btnFinalizar.textContent = 'Salvando...'; btnFinalizar.disabled = true; }

  try {
    // 1. Salva a residência — só se ainda não foi salva (pode ter sido salva em step-3)
    if (!appState.residencia?.id) {
      const dadosResidencia = {
        nome:          document.getElementById('house-name').value.trim(),
        tipo:          document.getElementById('house-tipo')?.value || 'house',
        cep:           document.getElementById('house-cep')?.value?.trim() || null,
        cidade:        document.getElementById('house-cidade')?.value?.trim() || null,
        estado:        document.getElementById('house-estado')?.value?.trim().toUpperCase() || null,
        areaM2:        parseFloat(document.getElementById('house-area')?.value) || null,
        distribuidora: document.getElementById('house-dist')?.value || null,
        tarifaKwh:     parseFloat(document.getElementById('house-tarifa')?.value) || 0.74
      };
      if (!dadosResidencia.nome) throw new Error('Informe o nome da residência (passo 1).');
      const respResidencia = await API.salvarResidencia(dadosResidencia);
      if (!respResidencia.sucesso) {
        if (respResidencia.upgradePath) {
          atualizarPlano(respResidencia.detalhe);
          return;
        }
        throw new Error(respResidencia.erro || 'Erro ao salvar residência.');
      }
      appState.residencia = respResidencia.residencia;
    }

    // 2. Salva cada cômodo configurado
    const comodosIds = {};
    for (const comodo of comodosConfigurados) {
      if (comodo.idReal) { comodosIds[comodo.id] = comodo.idReal; continue; } // já salvo
      const resp = await API.adicionarComodo({
        idResidencia:  appState.residencia.id,
        nome:          comodo.nome,
        tipo:          comodo.tipo,
        andar:         0,
        ordemExibicao: comodosConfigurados.indexOf(comodo)
      });
      if (resp.sucesso) {
        comodosIds[comodo.id] = resp.comodo.id;
        comodo.idReal = resp.comodo.id;
      }
    }
    appState.comodos = comodosConfigurados.map(c => ({ ...c, id: c.idReal || c.id, watts: 0 }));

    // 3. Salva cada dispositivo configurado
    for (const disp of dispositivosConfigurados) {
      const idComodoReal = comodosIds[disp.idComodo] || disp.idComodo;
      await API.adicionarDispositivo({
        idComodo:        idComodoReal,
        idResidencia:    appState.residencia.id,
        nome:            disp.nome,
        categoria:       disp.tipo,
        potenciaNominal: disp.watts,
        tensao:          220
      });
    }
    appState.dispositivos = dispositivosConfigurados;

    // 4. Entra diretamente no painel (sem modal de aviso — o step-3 já orientou)
    entrarNoApp();
    atualizarIndicadorUsuario();

  } catch (err) {
    console.error('[Onboarding] Erro:', err.message);
    mostrarToast('Erro ao finalizar: ' + err.message, 'erro');
    if (btnFinalizar) { btnFinalizar.textContent = '✓ ACESSAR O PAINEL'; btnFinalizar.disabled = false; }
  }
}


// ===================================================
// ENTRADA NA APLICAÇÃO PRINCIPAL
// ===================================================

/** Inicializa a aplicação principal após login ou onboarding */
function entrarNoApp() {
  mostrarPagina('page-app');

  // Salva e aplica o role do usuário
  appState.role = appState.usuario?.role || 'user';
  _aplicarPermissoes();

  // Atualiza o nome do usuário na barra de navegação
  if (appState.usuario) {
    const elementoNome = document.getElementById('user-badge-text');
    const primeiroNome = appState.usuario.nome.split(' ')[0];
    if (elementoNome) elementoNome.textContent = primeiroNome;
  }

  // Atualiza o label da residência na planta baixa
  if (appState.residencia) {
    document.getElementById('house-label').textContent = appState.residencia.nome || 'Minha Casa';
  }

  // Renderiza o seletor de residência na topbar
  renderizarResidenciaSelector();

  // Restaura a última aba visitada; padrão = dashboard
  const ultimaAba = localStorage.getItem('monitech_last_tab') || 'dashboard';
  exibirAba(ultimaAba);

  // Inicia os processos de atualização em tempo real
  iniciarSimulacaoAoVivo();
  iniciarGraficoAoVivo();

  // Fecha dropdowns ao clicar fora
  document.addEventListener('click', function fecharDropdown(evento) {
    const menu = document.getElementById('user-dropdown');
    const botao = document.querySelector('.user-menu-btn');
    if (menu && botao && !menu.contains(evento.target) && !botao.contains(evento.target)) {
      fecharMenuUsuario();
    }

    const resSelector = document.getElementById('residencia-selector');
    const resDropdown = document.getElementById('residencia-dropdown');
    if (resSelector && resDropdown && !resSelector.contains(evento.target)) {
      resDropdown.classList.remove('open');
    }
  });

  _aplicarBloqueioHistorico();
}

/** Limpa dados de demo - usada só como fallback quando não há residência cadastrada */
function carregarDadosDemo() {
  appState.residencia  = null;
  appState.comodos     = [];
  appState.dispositivos = [];
  comodosConfigurados  = [];
}

// ===================================================
// SELETOR DE RESIDÊNCIA
// ===================================================

/** Retorna a residência salva como preferida; fallback para a primeira da lista */
function _residenciaPreferida(lista) {
  const idSalvo = localStorage.getItem('monitech_residencia_system');
  if (idSalvo) {
    const encontrada = lista.find(r => r.id === idSalvo);
    if (encontrada) return encontrada;
  }
  return lista[0];
}

/** Atualiza o selector da topbar com a lista de residências */
function renderizarResidenciaSelector() {
  const nomeEl = document.getElementById('residencia-nome-topbar');
  const lista  = document.getElementById('residencia-lista');
  if (!nomeEl || !lista) return;

  const nome = appState.residencia?.nome || 'Minha Casa';
  nomeEl.textContent = nome;

  const todas = appState.residencias || [];
  lista.innerHTML = todas.map(r => {
    const ativo = r.id === appState.residencia?.id;
    return `
      <button class="res-drop-item${ativo ? ' res-drop-item--ativo' : ''}"
              onclick="trocarResidencia('${r.id}')">
        <span class="res-drop-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </span>
        <span class="res-drop-nome">${r.nome}</span>
        ${ativo ? '<span class="res-drop-check">✓</span>' : ''}
      </button>`;
  }).join('');
}

/** Abre/fecha o dropdown do seletor */
function toggleResidenciaDropdown(e) {
  e?.stopPropagation();
  document.getElementById('residencia-dropdown')?.classList.toggle('open');
}

/** Troca a residência ativa e recarrega todos os dados */
async function trocarResidencia(id) {
  if (id === appState.residencia?.id) {
    document.getElementById('residencia-dropdown')?.classList.remove('open');
    return;
  }
  const res = appState.residencias.find(r => r.id === id);
  if (!res) return;

  appState.residencia = res;
  localStorage.setItem('monitech_residencia_system', id);
  document.getElementById('residencia-dropdown')?.classList.remove('open');
  renderizarResidenciaSelector();

  if (res.nome) document.getElementById('house-label').textContent = res.nome;

  const [respComodos] = await Promise.all([
    API.obterComodos(id),
    _sincronizarDispositivos()
  ]);
  if (respComodos.sucesso) appState.comodos = respComodos.comodos || [];

  exibirAba(localStorage.getItem('monitech_last_tab') || 'dashboard');
  mostrarToast(`Residência "${res.nome}" carregada.`, 'sucesso');
}

/** Abre o modal de nova residência */
function abrirModalNovaResidencia() {
  document.getElementById('residencia-dropdown')?.classList.remove('open');
  const form = document.getElementById('form-nova-residencia');
  if (form) form.reset();
  const err = document.getElementById('nova-res-erro');
  if (err) err.style.display = 'none';
  abrirModal('modal-nova-residencia');
}

/** Salva nova residência via API */
async function salvarNovaResidencia() {
  const nome = document.getElementById('nova-res-nome')?.value.trim();
  const tipo = document.getElementById('nova-res-tipo')?.value || 'house';
  const cep  = document.getElementById('nova-res-cep')?.value.trim();
  const err  = document.getElementById('nova-res-erro');

  if (!nome) {
    if (err) { err.textContent = 'Nome da residência é obrigatório.'; err.style.display = 'block'; }
    return;
  }

  const btnSalvar = document.getElementById('btn-salvar-nova-res');
  if (btnSalvar) { btnSalvar.textContent = 'Salvando...'; btnSalvar.disabled = true; }

  const resp = await API.salvarResidencia({ nome, tipo, cep: cep || null });

  if (btnSalvar) { btnSalvar.textContent = '+ ADICIONAR'; btnSalvar.disabled = false; }

  if (resp?.sucesso) {
    fecharModal('modal-nova-residencia');
    const nova = resp.residencia;
    appState.residencias.push(nova);
    appState.residencia = nova;
    appState.comodos    = [];
    appState.dispositivos = [];
    renderizarResidenciaSelector();
    if (nova.nome) document.getElementById('house-label').textContent = nova.nome;
    mostrarToast(`Residência "${nova.nome}" criada com sucesso!`, 'sucesso');
  } else if (resp?.upgradePath || resp?.detalhe?.includes('plano')) {
    fecharModal('modal-nova-residencia');
    atualizarPlano(resp.detalhe || 'Para ter mais de uma residência, assine o plano mensal.');
  } else {
    if (err) {
      err.textContent = resp?.erro || resp?.detalhe || 'Erro ao salvar. Tente novamente.';
      err.style.display = 'block';
    }
  }
}

/** Carrega alertas reais do servidor */
async function adicionarAlertasAmostra() {
  if (!appState.residencia?.id) { appState.alertas = []; return; }
  const resp = await API.obterAlertas(false);
  if (resp?.sucesso) {
    appState.alertas = resp.alertas || [];
    _verificarNotificacoesBrowser(appState.alertas);
  }
}


// ===================================================
// GRÁFICOS
// ===================================================
let graficos = {};

/** Destrói todos os gráficos ativos para liberar memória */
function destruirGraficos() {
  Object.values(graficos).forEach(g => g && g.destroy());
  graficos = {};
}

// Configurações padrão compartilhadas por todos os gráficos
const configPadraoGraficos = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#7aa8cc',
        font: { family: 'Rajdhani', size: 12 },
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 8,
        boxHeight: 8,
        padding: 14
      }
    }
  },
  scales: {
    x: {
      ticks: { color: '#7aa8cc', font: { family: 'Rajdhani', size: 11 } },
      grid: { color: 'rgba(0,212,255,0.05)' }
    },
    y: {
      ticks: { color: '#7aa8cc', font: { family: 'Rajdhani', size: 11 } },
      grid: { color: 'rgba(0,212,255,0.05)' }
    }
  }
};

/** Inicializa todos os gráficos da aba Dashboard */
function inicializarGraficos() {
  const periodo   = document.getElementById('period-select')?.value || 'day';
  const historico = gerarHistoricoSimulado(periodo);

  // Gráfico de consumo por hora
  if (graficos.porHora) graficos.porHora.destroy();
  graficos.porHora = new Chart(document.getElementById('chart-hourly'), {
    type: 'line',
    data: {
      labels: historico.map(d => d.label),
      datasets: [{
        label: 'kWh',
        data: historico.map(d => d.kwh),
        borderColor: '#00d4ff',
        backgroundColor: 'rgba(0,212,255,0.06)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#00d4ff',
        tension: 0.4,
        fill: true
      }]
    },
    options: { ...configPadraoGraficos }
  });

  // Gráfico de pizza — potência cadastrada por cômodo (estimado)
  const nomesComodos = appState.comodos.map(c => c.nome);
  const wattsPorComodo = appState.comodos.map(c =>
    appState.dispositivos
      .filter(d => (d.comodo?.id ?? d.comodoId) === c.id)
      .reduce((s, d) => s + (d.watts || 0), 0)
  );
  const coresGrafico = ['#0057ff', '#00d4ff', '#7df9ff', '#1a7eff', '#00a8cc', '#0099ff'];

  if (graficos.pizza) graficos.pizza.destroy();
  graficos.pizza = new Chart(document.getElementById('chart-rooms-pie'), {
    type: 'doughnut',
    data: {
      labels: nomesComodos,
      datasets: [{
        data: wattsPorComodo,
        backgroundColor: coresGrafico,
        borderColor: '#050f1e',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#7aa8cc',
            font: { family: 'Rajdhani', size: 12 },
            padding: 14,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8
          }
        }
      }
    }
  });

  // Gráfico de histórico — usa os mesmos dados do período selecionado
  if (graficos.mensal) graficos.mensal.destroy();
  graficos.mensal = new Chart(document.getElementById('chart-monthly'), {
    type: 'bar',
    data: {
      labels: historico.map(d => d.label),
      datasets: [{
        label: 'kWh',
        data: historico.map(d => d.kwh),
        backgroundColor: 'rgba(0,87,255,0.5)',
        borderColor: '#1a7eff',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: { ...configPadraoGraficos }
  });

  // Gráfico horizontal — top dispositivos por consumo
  const nomesDispositivos = appState.dispositivos.slice(0, 6).map(d => d.nome);
  const kwhDispositivos = appState.dispositivos.slice(0, 6).map(d => d.kwh);

  if (graficos.barraDispositivos) graficos.barraDispositivos.destroy();
  graficos.barraDispositivos = new Chart(document.getElementById('chart-devices-bar'), {
    type: 'bar',
    data: {
      labels: nomesDispositivos,
      datasets: [{
        label: 'kWh/dia (estimado)',
        data: kwhDispositivos,
        backgroundColor: [
          'rgba(0,87,255,0.6)',
          'rgba(0,212,255,0.6)',
          'rgba(255,170,0,0.6)',
          'rgba(255,61,107,0.6)',
          'rgba(0,255,157,0.6)',
          'rgba(125,249,255,0.6)'
        ],
        borderRadius: 4
      }]
    },
    options: { ...configPadraoGraficos, indexAxis: 'y' }
  });
}

// Variáveis para o gráfico ao vivo
let dadosRotulosAoVivo = [];
let dadosKwhAoVivo = [];
let dadosVoltsAoVivo = [];

/** Inicializa o histórico do gráfico ao vivo */
function iniciarGraficoAoVivo() {
  // TODO: Pré-popular com dados históricos do dispositivo
  // GET /api/leituras/historico?periodo=hoje&limite=10
  dadosRotulosAoVivo = [];
  dadosKwhAoVivo = [];
  dadosVoltsAoVivo = [];
}


// ===================================================
// SIMULAÇÃO AO VIVO
// Será substituída pela conexão real com o ESP32
// ===================================================
let intervaloAoVivo;
let intervaloResumo;

/** Inicia o polling real da API para atualizar gauges e cards do dashboard */
function iniciarSimulacaoAoVivo() {
  clearInterval(intervaloAoVivo);
  clearInterval(intervaloResumo);

  // Polling da leitura ao vivo a cada 2,5 segundos
  intervaloAoVivo = setInterval(async () => {
    if (!appState.residencia?.id) return;

    // Busca a última leitura do sensor
    const sensor = appState.sensor || await _obterPrimeiroSensor();
    if (!sensor) return;

    const resp = await API.obterLeituraAoVivo(sensor.id);

    // Atualiza badges de conexão (topbar + planta interativa)
    const online = resp?.sucesso === true;
    ['topbar-live-badge', 'floor-live-badge'].forEach(id => {
      const badge = document.getElementById(id);
      if (!badge) return;
      badge.classList.toggle('live-badge--disconnected', !online);
    });

    // Sincroniza o card de status do dispositivo com o mesmo resultado
    _atualizarStatusCardComResposta(resp);

    if (!resp?.sucesso) return;

    // Atualiza o estado com dados reais
    appState.dadosAoVivo = {
      volts:    Number(resp.tensao            || 0),
      amps:     Number(resp.corrente          || 0),
      watts:    Number(resp.potencia          || 0),
      aparente: Number(resp.potenciaAparente  || 0),
      reativa:  Number(resp.potenciaReativa   || 0),
      pf:       Number(resp.fatorPotencia     || 0),
      freq:     Number(resp.frequenciaHz      || 0),
      kwh:      Number(resp.kwh               || 0)
    };

    const dados = appState.dadosAoVivo;
    atualizarMarcadores(dados);
    atualizarCartasEstatisticas(dados);

    // ── Verificação de discrepância de energia ────────────
    verificarDiscrepanciaEnergia(dados.watts);

    // Alimenta o gráfico ao vivo
    const agora = new Date();
    dadosRotulosAoVivo.push(agora.toLocaleTimeString('pt-BR'));
    dadosKwhAoVivo.push(+(dados.watts / 1000).toFixed(3));
    dadosVoltsAoVivo.push(dados.volts);

    if (dadosRotulosAoVivo.length > 30) {
      dadosRotulosAoVivo.shift();
      dadosKwhAoVivo.shift();
      dadosVoltsAoVivo.shift();
    }

    if (graficos.aoVivo) graficos.aoVivo.update('none');

  }, 2500);

  // Polling do resumo do dashboard a cada 30 segundos
  intervaloResumo = setInterval(async () => {
    await _atualizarResumoCards();
  }, 30000);

  // Carrega imediatamente ao entrar
  _atualizarResumoCards();
}

/** Busca e armazena o primeiro sensor ativo da residência */
async function _obterPrimeiroSensor() {
  if (!appState.residencia?.id) return null;
  const resp = await API.listarSensores(appState.residencia.id);
  if (resp?.sucesso && resp.sensores?.length > 0) {
    appState.sensor = resp.sensores[0];
    // Atualiza label do dispositivo no painel ESP32
    const el = document.getElementById('device-id');
    if (el) el.textContent = appState.sensor.idIot || appState.sensor.id_iot || 'MON-001';
    return appState.sensor;
  }
  return null;
}

/** Atualiza os cards de resumo (kWh, custo, mês) com dados reais */
async function _atualizarResumoCards() {
  if (!appState.residencia?.id) return;
  const resp = await API.obterResumoDashboard(appState.residencia.id);
  if (!resp?.sucesso) return;

  const s = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  s('stat-kwh',   (resp.kwhHoje  || 0).toFixed(1));
  s('stat-cost',  'R$ ' + (resp.custoHoje || 0).toFixed(2));
  s('stat-month', (resp.kwhMes   || 0).toFixed(0));
  s('stat-peak',  (resp.potenciaAtual || 0).toFixed(2));

  // Badge de alertas não lidos
  const badge = document.getElementById('alerts-badge');
  if (badge && resp.alertasNaoLidos > 0) {
    badge.textContent = resp.alertasNaoLidos;
    badge.style.display = 'inline';
  } else if (badge) {
    badge.style.display = 'none';
  }
  atualizarBadgeAlertasBnav(resp.alertasNaoLidos || 0);
}

/**
 * Atualiza os marcadores circulares (gauges) do dashboard.
 * @param {Object} dados - Objeto com os valores de volts, amps, watts, pf, freq e kwh
 */
function atualizarMarcadores(dados) {
  definirMarcador('g-volts',    'gv-volts',    dados.volts,    250,  dados.volts.toFixed(0));
  definirMarcador('g-amps',     'gv-amps',     dados.amps,     30,   dados.amps.toFixed(1));
  definirMarcador('g-watts',    'gv-watts',    dados.watts,    6000, dados.watts.toFixed(0));
  definirMarcador('g-pf',       'gv-pf',       dados.pf,       1,    dados.pf.toFixed(2));

  const freqPct   = dados.freq > 0 ? Math.max(0, (dados.freq - 58) / 4) : 0;
  const freqLabel = dados.freq > 0 ? dados.freq.toFixed(1) : '---';
  definirMarcador('g-freq', 'gv-freq', freqPct, 1, freqLabel);

  const maxWatts  = Math.max(_somaWattsCadastrados(), 3000);
  const cargaPct  = Math.min(1, dados.watts / maxWatts);
  definirMarcador('g-kwh', 'gv-kwh', cargaPct, 1, Math.round(cargaPct * 100) + '%');

  // Potência Aparente (VA) e Reativa (VAr) — só mostra se disponível
  if (dados.aparente > 0)
    definirMarcador('g-aparente', 'gv-aparente', dados.aparente, 6000, dados.aparente.toFixed(0));
  if (dados.reativa > 0)
    definirMarcador('g-reativa',  'gv-reativa',  dados.reativa,  3000, dados.reativa.toFixed(0));
}

/**
 * Define visualmente um marcador circular (gauge) com o valor fornecido.
 * @param {string} idCirculo - ID do elemento SVG circle
 * @param {string} idValor   - ID do elemento de texto do valor
 * @param {number} valor     - Valor atual da métrica
 * @param {number} maximo    - Valor máximo esperado para escala
 * @param {string} rotulo    - Texto a exibir no gauge
 */
function definirMarcador(idCirculo, idValor, valor, maximo, rotulo) {
  const porcentagem = Math.min(1, valor / maximo);
  const circunferencia = 2 * Math.PI * 36;
  const deslocamento = circunferencia * (1 - porcentagem);

  const circulo = document.getElementById(idCirculo);
  const textoVal = document.getElementById(idValor);

  if (circulo) circulo.style.strokeDashoffset = deslocamento;
  if (textoVal) textoVal.textContent = rotulo;
}

/**
 * Atualiza apenas o card de pico de potência com a leitura ao vivo.
 * kWh e custo são gerenciados por _atualizarResumoCards (dados diários reais da API).
 */
function atualizarCartasEstatisticas(dados) {
  const el = document.getElementById('stat-peak');
  if (el) el.textContent = (dados.watts / 1000).toFixed(3);
}


// ===================================================
// SISTEMA DE AVISO DE DISCREPÂNCIA DE ENERGIA
// ===================================================

/**
 * Controle de estado do banner — evita exibir o aviso repetidamente
 * enquanto o usuário já o está vendo ou optou por ignorar temporariamente.
 */
const _discrepancia = {
  ignoradoAte:       0,       // timestamp — usuário clicou em "Ignorar"
  ultimaExibicao:    0,       // evita spam a cada polling
  intervaloCooldown: 60000,   // só reavalia a cada 60 segundos
  limiarPct:         15,      // diferença mínima (%) para disparar o aviso
  limiarFugaPct:     40       // diferença (%) para elevar para "fuga de energia"
};

/**
 * Calcula a soma da potência nominal de todos os dispositivos cadastrados.
 * Aceita tanto o campo `watts` (local) quanto `potenciaNominal` / `PotenciaNominal` (API).
 */
function _somaWattsCadastrados() {
  return appState.dispositivos.reduce((soma, d) => {
    const w = Number(d.watts || d.potenciaNominal || d.PotenciaNominal || 0);
    return soma + w;
  }, 0);
}

/**
 * Verifica se a leitura real do sensor excede significativamente
 * a soma dos watts cadastrados pelo usuário e exibe o banner adequado.
 *
 * @param {number} wattsMedido  - Watts lidos pelo PZEM-004T em tempo real
 */
function verificarDiscrepanciaEnergia(wattsMedido) {
  // Ignora leituras zeradas (sensor desconectado ou sem carga)
  if (!wattsMedido || wattsMedido < 10) {
    _ocultarBanner();
    return;
  }

  // Respeita o cooldown entre verificações
  const agora = Date.now();
  if (agora - _discrepancia.ultimaExibicao < _discrepancia.intervaloCooldown) return;
  if (agora < _discrepancia.ignoradoAte) return;

  _discrepancia.ultimaExibicao = agora;

  const wattsCadastrados = _somaWattsCadastrados();

  // Se não há nenhum dispositivo cadastrado, avisa que precisa cadastrar
  if (wattsCadastrados === 0) {
    if (appState.dispositivos.length === 0 && wattsMedido > 50) {
      _exibirBanner({
        tipo:             'sem-cadastro',
        wattsMedido,
        wattsCadastrados: 0
      });
    }
    return;
  }

  // Calcula a diferença percentual: quanto o medido excede o cadastrado
  const excesso    = wattsMedido - wattsCadastrados;
  const excessoPct = (excesso / wattsCadastrados) * 100;

  if (excessoPct >= _discrepancia.limiarFugaPct) {
    // Diferença muito grande → possível fuga de energia
    _exibirBanner({ tipo: 'fuga', wattsMedido, wattsCadastrados, excessoPct });
  } else if (excessoPct >= _discrepancia.limiarPct) {
    // Diferença moderada → dispositivos não cadastrados
    _exibirBanner({ tipo: 'nao-cadastrado', wattsMedido, wattsCadastrados, excessoPct });
  } else {
    // Dentro do esperado — esconde o banner se estiver visível
    _ocultarBanner();
  }
}

/**
 * Exibe o banner de discrepância com conteúdo adaptado ao tipo detectado.
 * @param {{ tipo, wattsMedido, wattsCadastrados, excessoPct }} ctx
 */
function _exibirBanner({ tipo, wattsMedido, wattsCadastrados, excessoPct = 0 }) {
  const banner = document.getElementById('banner-discrepancia');
  const inner  = document.getElementById('banner-discrepancia-inner');
  if (!banner || !inner) return;

  // Configurações visuais por tipo
  const config = {
    'sem-cadastro': {
      corBorda:  'rgba(255,170,0,0.35)',
      corLateral: '#ffaa00',
      corMedido: '#ffaa00',
      icone:     '📋',
      titulo:    'NENHUM DISPOSITIVO CADASTRADO',
      mensagem: `O sensor está medindo <strong style="color:var(--warn)">${wattsMedido.toFixed(0)}W</strong> de consumo, mas você ainda não cadastrou nenhum dispositivo no sistema.<br>
                 Cadastre os aparelhos da sua residência para que o MONITECH possa analisar o consumo por cômodo e identificar o maior consumidor.`
    },
    'nao-cadastrado': {
      corBorda:  'rgba(255,170,0,0.35)',
      corLateral: '#ffaa00',
      corMedido: '#ffaa00',
      icone:     '⚠️',
      titulo:    `CONSUMO ${excessoPct.toFixed(0)}% ACIMA DO CADASTRADO`,
      mensagem: `O sensor detectou <strong style="color:var(--warn)">${wattsMedido.toFixed(0)}W</strong> de consumo, mas a soma dos dispositivos cadastrados é de apenas
                 <strong style="color:var(--cyan)">${wattsCadastrados.toFixed(0)}W</strong>.<br><br>
                 Isso indica que existem aparelhos ligados que <strong>não foram cadastrados</strong> no sistema.
                 Adicione todos os dispositivos da sua residência para obter análises precisas de consumo por cômodo.`
    },
    'fuga': {
      corBorda:  'rgba(255,61,107,0.4)',
      corLateral: '#ff3d6b',
      corMedido: '#ff3d6b',
      icone:     '🔴',
      titulo:    `ALERTA: POSSÍVEL FUGA DE ENERGIA (+${excessoPct.toFixed(0)}%)`,
      mensagem: `O sensor está medindo <strong style="color:var(--danger)">${wattsMedido.toFixed(0)}W</strong>, mas a soma de todos os dispositivos cadastrados é de apenas
                 <strong style="color:var(--cyan)">${wattsCadastrados.toFixed(0)}W</strong>.<br><br>
                 A diferença de <strong style="color:var(--danger)">${(wattsMedido - wattsCadastrados).toFixed(0)}W</strong> pode indicar:
                 <ul style="margin:8px 0 0 16px; color:var(--text-secondary); font-size:13px; line-height:1.8;">
                   <li>Dispositivos não cadastrados com alto consumo (ar-condicionado, chuveiro elétrico, forno)</li>
                   <li>Fuga de corrente ou curto-circuito no circuito elétrico</li>
                   <li>Consumo oculto em equipamentos defeituosos</li>
                 </ul>
                 Recomendamos verificar a instalação elétrica com um eletricista.`
    }
  };

  const c = config[tipo] || config['nao-cadastrado'];

  // Aplica estilo do container
  inner.style.borderColor = c.corBorda;
  inner.style.background  = tipo === 'fuga'
    ? 'rgba(255,61,107,0.05)'
    : 'rgba(255,170,0,0.04)';

  // Cor lateral
  document.getElementById('banner-cor-lateral').style.background = c.corLateral;

  // Conteúdo
  document.getElementById('banner-icone').textContent    = c.icone;
  document.getElementById('banner-titulo').textContent   = c.titulo;
  document.getElementById('banner-titulo').style.color   = c.corLateral;
  document.getElementById('banner-mensagem').innerHTML   = c.mensagem;

  // Valores numéricos
  document.getElementById('banner-watts-cadastrado').textContent = wattsCadastrados.toFixed(0) + 'W cadastrado';
  document.getElementById('banner-watts-medido').textContent     = wattsMedido.toFixed(0) + 'W medido';
  document.getElementById('banner-watts-medido').style.color     = c.corMedido;

  // Barra de comparação
  const maxRef   = Math.max(wattsMedido, wattsCadastrados, 1);
  const pctCad   = Math.min((wattsCadastrados / maxRef) * 100, 100);
  const pctMed   = Math.min((wattsMedido    / maxRef) * 100, 100);
  document.getElementById('banner-barra-cadastrado').style.width = pctCad + '%';
  document.getElementById('banner-barra-medido').style.width     = pctMed + '%';
  document.getElementById('banner-barra-medido').style.background = c.corMedido;

  // Exibe o banner
  banner.style.display = '';
}

/** Esconde o banner de discrepância */
function _ocultarBanner() {
  const banner = document.getElementById('banner-discrepancia');
  if (banner) banner.style.display = 'none';
}

/**
 * Chamado pelo botão "Ignorar" — oculta o banner por 10 minutos.
 */
function fecharBannerDiscrepancia() {
  _discrepancia.ignoradoAte = Date.now() + 10 * 60 * 1000; // 10 minutos
  _ocultarBanner();
}

/**
 * Dispara uma verificação manual imediata (ex.: ao cadastrar um dispositivo).
 * Ignora o cooldown para dar feedback instantâneo.
 */
function verificarDiscrepanciaImediata() {
  _discrepancia.ultimaExibicao = 0;
  verificarDiscrepanciaEnergia(appState.dadosAoVivo?.watts || 0);
}


// ===================================================
// ABA: CÔMODOS
// ===================================================

/** Renderiza os cartões de cômodos na aba correspondente */
function renderizarComodos() {
  const grade = document.getElementById('rooms-grid');
  const icones = obterIconesComodos();

  // Calcula watts de cada cômodo somando a potência nominal dos dispositivos ativos
  const wattsComodo = id => appState.dispositivos
    .filter(d => d.idComodo === id)
    .reduce((s, d) => s + (Number(d.potenciaNominal) || Number(d.watts) || 0), 0);

  const wattsLista  = appState.comodos.map(c => wattsComodo(c.id));
  const totalWatts  = wattsLista.reduce((s, w) => s + w, 0);
  const maxWatts    = Math.max(...wattsLista, 1);

  grade.innerHTML = appState.comodos.map((comodo, idx) => {
    const watts       = wattsLista[idx];
    const porcentagem = totalWatts > 0 ? Math.round(watts / totalWatts * 100) : 0;
    const ehMaior     = watts > 0 && watts === maxWatts;
    const qtdDispositivos = appState.dispositivos.filter(d => d.idComodo === comodo.id).length;

    return `
      <div class="room-card ${ehMaior ? 'high-consumption' : ''}" onclick="exibirDetalheComodo('${comodo.id}')">
        <div class="room-header">
          <span class="room-icon">${icones[comodo.tipo] || '📦'}</span>
          <span class="room-badge ${ehMaior ? 'badge-high' : 'badge-normal'}">
            ${ehMaior ? '⚠ MAIOR CONSUMO' : 'Normal'}
          </span>
          <button class="room-delete-btn" onclick="deletarComodo('${comodo.id}', event)" title="Deletar cômodo"><i data-lucide="trash-2" style="width:15px;height:15px;pointer-events:none;"></i></button>
        </div>
        <div class="room-name">${comodo.nome}</div>
        <div class="room-devices">${qtdDispositivos} dispositivo${qtdDispositivos !== 1 ? 's' : ''}</div>
        <div class="consumption-bar">
          <div class="consumption-fill ${ehMaior ? 'high' : ''}" style="width:${porcentagem}%"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
          <div class="room-watts">
            <span style="font-family:'Orbitron',monospace; font-size:18px; color:${ehMaior ? 'var(--danger)' : 'var(--cyan)'};">${watts}</span>
            <span style="font-size:12px; color:var(--text-secondary);"> W</span>
          </div>
          <div style="font-size:11px; color:var(--text-secondary);">${porcentagem}% do total</div>
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [grade] });
  corrigirTextosCorrompidosNaPagina(grade);
}

/** Deleta um cômodo e todos os seus dispositivos associados */
async function deletarComodo(idComodo, evento) {
  evento.stopPropagation();

  const comodo = appState.comodos.find(c => c.id === idComodo);
  if (!comodo) return;

  const dispositivos = appState.dispositivos.filter(d => d.idComodo === idComodo);

  const confirmado = await mostrarConfirm({
    icone:    'trash-2',
    titulo:   `Deletar "${comodo.nome}"?`,
    mensagem: `Esta ação removerá o cômodo e ${dispositivos.length} dispositivo(s) associado(s). Não pode ser desfeita.`,
    okLabel:  'Deletar',
    okDanger: true
  });

  if (!confirmado) return;

  try {
    const resp = await API.removerComodo(idComodo);
    if (resp?.sucesso === false) {
      mostrarAlerta('error', 'Erro', resp.erro || 'Não foi possível deletar o cômodo.');
      return;
    }
  } catch (e) {
    mostrarAlerta('error', 'Erro de conexão', 'Não foi possível deletar o cômodo.');
    return;
  }

  appState.comodos      = appState.comodos.filter(c => c.id !== idComodo);
  appState.dispositivos = appState.dispositivos.filter(d => d.idComodo !== idComodo);

  renderizarComodos();
  renderizarPlanta();

  mostrarAlerta('success', 'Cômodo deletado', `"${comodo.nome}" foi removido com sucesso.`);
}

/**
 * Navega para a planta interativa e destaca o cômodo selecionado.
 * @param {string} idComodo - ID do cômodo a destacar
 */
function exibirDetalheComodo(idComodo) {
  exibirAba('planta');
  destacarComodoPlanta(idComodo);
}


// ===================================================
// ABA: PLANTA INTERATIVA — canvas livre
// ===================================================

let _plantaModoEdicao = false;
let _dragState = null; // { comodoId, offsetX, offsetY, fromTray }

// Coordenadas salvas como inteiros 0-1000 (‰ da largura/altura do canvas)
const _pctToStore = (px, dim) => Math.max(0, Math.min(1000, Math.round((px / dim) * 1000)));
const _storeToLeft = v => (v / 10) + '%';
const _storeToTop  = v => (v / 10) + '%';

/** Cria e retorna um elemento card de cômodo para a planta */
function _criarCardPlanta(comodo, icones, totalW, maxW, idTop, noCanvas) {
  const w         = comodo.watts || 0;
  const proporcao = w / maxW;
  const isCritico = proporcao > 0.7;
  const isMedio   = proporcao > 0.4 && !isCritico;
  const cor       = isCritico ? 'var(--danger)' : isMedio ? 'var(--warn)' : 'var(--success)';
  const qtdDisp   = appState.dispositivos.filter(d => d.idComodo === comodo.id).length;
  const pct       = totalW > 0 ? Math.round((w / totalW) * 100) : 0;
  const isTop     = comodo.id === idTop && w > 0;

  const div = document.createElement('div');
  div.className = `floor-room${isCritico ? ' critical' : ''}`;
  div.id = `floor-${comodo.id}`;
  div.dataset.idComodo = comodo.id;

  if (_plantaModoEdicao) {
    div.classList.add('floor-room--draggable');
    div.addEventListener('mousedown',  e => _iniciarDrag(comodo.id, e, !noCanvas));
    div.addEventListener('touchstart', e => _iniciarDrag(comodo.id, e, !noCanvas), { passive: false });
  } else {
    div.addEventListener('click', () => selecionarComodoPlanta(comodo.id));
  }

  div.innerHTML = `
    <div class="heat-overlay" style="background:${cor};"></div>
    ${isTop ? `<div class="room-top-badge"><i data-lucide="crown" style="width:15px;height:15px;"></i></div>` : ''}
    ${_plantaModoEdicao && noCanvas ? `
      <button class="floor-room-remove" title="Remover da planta"
        onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()"
        onclick="event.stopPropagation();removerDaGrade('${comodo.id}')">
        <i data-lucide="x" style="width:11px;height:11px;"></i>
      </button>` : ''}
    <div class="room-icon">${icones[comodo.tipo] || '📦'}</div>
    <div class="room-name" style="color:var(--text-primary);">${comodo.nome}</div>
    <div class="room-kw" style="color:${cor};">${(w / 1000).toFixed(2)} kW</div>
    <div class="room-share-pct">${pct}% da casa</div>
    <div style="font-size:10px;color:var(--text-dim);">${qtdDisp} disp.</div>
    <div class="room-share-bar">
      <div class="room-share-bar__fill" style="width:${pct}%;background:${cor};"></div>
    </div>
  `;
  return div;
}

/** Renderiza o canvas livre da planta */
function renderizarPlanta() {
  const canvas = document.getElementById('floor-canvas');
  if (!canvas) return;

  const icones = obterIconesComodos();

  // Calcula watts de cada cômodo somando potência nominal dos dispositivos (mesma lógica da aba Cômodos)
  const wattsDeComodo = id => appState.dispositivos
    .filter(d => d.idComodo === id)
    .reduce((s, d) => s + (Number(d.potenciaNominal) || Number(d.watts) || 0), 0);
  appState.comodos.forEach(c => { c.watts = wattsDeComodo(c.id); });

  const totalW = appState.comodos.reduce((s, c) => s + (c.watts || 0), 0);
  const maxW   = Math.max(...appState.comodos.map(c => c.watts || 0), 1);
  const idTop  = totalW > 0
    ? appState.comodos.reduce((m, c) => (c.watts || 0) > (m?.watts ?? 0) ? c : m, null)?.id
    : null;

  canvas.innerHTML = '';
  canvas.className = `floor-canvas${_plantaModoEdicao ? ' floor-canvas--editavel' : ''}`;

  const semPosicao = [];
  appState.comodos.forEach(c => {
    if (c.posicaoX != null && c.posicaoY != null) {
      const card = _criarCardPlanta(c, icones, totalW, maxW, idTop, true);
      card.style.left = _storeToLeft(c.posicaoX);
      card.style.top  = _storeToTop(c.posicaoY);
      canvas.appendChild(card);
    } else {
      semPosicao.push(c);
    }
  });

  // Bandeja
  const trayWrap = document.getElementById('floor-tray-wrap');
  const tray     = document.getElementById('floor-tray');
  if (tray) {
    tray.innerHTML = '';
    semPosicao.forEach(c => tray.appendChild(_criarCardPlanta(c, icones, totalW, maxW, idTop, false)));
  }
  if (trayWrap) trayWrap.style.display = (_plantaModoEdicao || semPosicao.length > 0) ? '' : 'none';

  // Botão e dica
  const btn  = document.getElementById('btn-editar-planta');
  const hint = document.getElementById('floor-hint');
  if (btn) btn.innerHTML = _plantaModoEdicao
    ? '<i data-lucide="check" style="width:13px;height:13px;"></i> Concluir'
    : '<i data-lucide="layout-grid" style="width:13px;height:13px;"></i> Editar layout';
  if (hint) hint.textContent = _plantaModoEdicao
    ? 'Arraste os cômodos para qualquer lugar da planta'
    : 'Clique em um cômodo para visualizar consumo detalhado';

  // Botão "Limpar planta" — visível só em modo edição
  const btnLimpar = document.getElementById('btn-limpar-planta');
  if (btnLimpar) btnLimpar.style.display = _plantaModoEdicao ? '' : 'none';

  if (!_plantaModoEdicao) requestAnimationFrame(_desenharConectoresSVG);

  // Ajusta altura e clamp em um único rAF (ordem importa: altura primeiro, depois clamp)
  requestAnimationFrame(() => {
    _ajustarAlturaCanvas();
    const cW = canvas.offsetWidth;
    const cH = canvas.offsetHeight;
    canvas.querySelectorAll('.floor-room').forEach(card => {
      const cardW = card.offsetWidth;
      const cardH = card.offsetHeight;
      const left = parseFloat(card.style.left) / 100 * cW;
      const top  = parseFloat(card.style.top)  / 100 * cH;
      const cl   = Math.max(0, Math.min(cW - cardW, left));
      const ct   = Math.max(0, Math.min(cH - cardH, top));
      if (Math.abs(left - cl) > 1 || Math.abs(top - ct) > 1) {
        card.style.left = (cl / cW * 100) + '%';
        card.style.top  = (ct / cH * 100) + '%';
      }
    });
  });

  corrigirTextosCorrompidosNaPagina(canvas);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/** Desenha linhas SVG entre cômodos posicionados (minimum spanning tree) */
function _desenharConectoresSVG() {
  const canvas = document.getElementById('floor-canvas');
  if (!canvas) return;

  document.getElementById('floor-svg-overlay')?.remove();
  if (_plantaModoEdicao) return;

  const posicionados = appState.comodos.filter(c => c.posicaoX != null && c.posicaoY != null);
  if (posicionados.length < 2) return;

  const rect = canvas.getBoundingClientRect();
  const nos = posicionados.map(c => {
    const card = document.getElementById(`floor-${c.id}`);
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top };
  }).filter(Boolean);

  if (nos.length < 2) return;

  const arestas = [];
  for (let i = 0; i < nos.length; i++)
    for (let j = i + 1; j < nos.length; j++) {
      const dx = nos[i].x - nos[j].x, dy = nos[i].y - nos[j].y;
      arestas.push({ i, j, d: Math.sqrt(dx * dx + dy * dy) });
    }
  arestas.sort((a, b) => a.d - b.d);

  const pai = nos.map((_, i) => i);
  const find = i => pai[i] === i ? i : (pai[i] = find(pai[i]));

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.id = 'floor-svg-overlay';
  svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible;';

  nos.forEach(n => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', n.x); c.setAttribute('cy', n.y); c.setAttribute('r', '4');
    c.setAttribute('fill', 'rgba(0,212,255,.6)');
    svg.appendChild(c);
  });

  for (const { i, j } of arestas) {
    if (find(i) === find(j)) continue;
    pai[find(i)] = find(j);
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', nos[i].x); line.setAttribute('y1', nos[i].y);
    line.setAttribute('x2', nos[j].x); line.setAttribute('y2', nos[j].y);
    line.setAttribute('stroke', 'rgba(0,212,255,.35)');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-dasharray', '5,4');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
  }

  canvas.appendChild(svg);
}

/** Liga/desliga o modo de edição */
function toggleModoEdicaoPlanta() {
  _plantaModoEdicao = !_plantaModoEdicao;
  if (_plantaModoEdicao) {
    document.querySelectorAll('.floor-room').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById('room-detail-panel');
    if (panel) panel.style.display = 'none';
  }
  renderizarPlanta();
}

/** Remove cômodo do canvas (volta para a bandeja) */
async function removerDaGrade(idComodo) {
  const comodo = appState.comodos.find(c => c.id === idComodo);
  if (!comodo) return;
  comodo.posicaoX = null;
  comodo.posicaoY = null;
  await API.atualizarPosicaoComodo(idComodo, null, null);
  renderizarPlanta();
}

/** Remove todos os cômodos do canvas — escape hatch para cards presos */
async function limparPlanta() {
  const posicionados = appState.comodos.filter(c => c.posicaoX != null || c.posicaoY != null);
  if (posicionados.length === 0) return;
  posicionados.forEach(c => { c.posicaoX = null; c.posicaoY = null; });
  await Promise.all(posicionados.map(c => API.atualizarPosicaoComodo(c.id, null, null)));
  renderizarPlanta();
}

// ── Altura dinâmica do canvas ─────────────────────────────

function _ajustarAlturaCanvas() {
  const canvas = document.getElementById('floor-canvas');
  if (!canvas) return;
  const rooms = canvas.querySelectorAll('.floor-room');
  if (rooms.length === 0) {
    canvas.style.height = '';
    return;
  }
  let maxBottom = 0;
  rooms.forEach(r => { maxBottom = Math.max(maxBottom, r.offsetTop + r.offsetHeight); });
  const minH = parseInt(getComputedStyle(canvas).minHeight) || 280;
  canvas.style.height = Math.max(minH, maxBottom + 32) + 'px';
}

// ── Drag livre — mouse e touch ─────────────────────────────

function _clienteXY(e) {
  if (e.touches && e.touches.length > 0)
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches.length > 0)
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function _iniciarDrag(comodoId, e, fromTray) {
  const isTouch = e.type === 'touchstart';
  if (!isTouch && e.button !== 0) return;
  e.preventDefault();

  const { x: clientX, y: clientY } = _clienteXY(e);
  const canvas = document.getElementById('floor-canvas');
  if (!canvas) return;
  const canvasRect = canvas.getBoundingClientRect();

  const comodo = appState.comodos.find(c => c.id === comodoId);
  if (!comodo) return;

  if (fromTray) {
    // Coloca o cômodo no canvas centrado no dedo/cursor e inicia drag
    const initX = _pctToStore(clientX - canvasRect.left - 64, canvasRect.width);
    const initY = _pctToStore(clientY - canvasRect.top  - 55, canvasRect.height);
    comodo.posicaoX = initX;
    comodo.posicaoY = initY;
    renderizarPlanta();
    requestAnimationFrame(() => {
      const card = document.getElementById(`floor-${comodoId}`);
      if (!card) return;
      const r = card.getBoundingClientRect();
      _dragState = { comodoId, offsetX: clientX - r.left, offsetY: clientY - r.top };
      card.classList.add('floor-room--dragging');
      card.style.zIndex = '50';
    });
    return;
  }

  const card = document.getElementById(`floor-${comodoId}`);
  if (!card) return;
  const cardRect = card.getBoundingClientRect();
  _dragState = { comodoId, offsetX: clientX - cardRect.left, offsetY: clientY - cardRect.top };
  card.classList.add('floor-room--dragging');
  card.style.zIndex = '50';
}

function _onDragMover(e) {
  if (!_dragState) return;
  if (e.cancelable) e.preventDefault(); // impede scroll da página durante o drag
  const { comodoId, offsetX, offsetY } = _dragState;
  const canvas = document.getElementById('floor-canvas');
  const card   = document.getElementById(`floor-${comodoId}`);
  if (!canvas || !card) return;

  const { x: clientX, y: clientY } = _clienteXY(e);
  const rect  = canvas.getBoundingClientRect();
  const cardW = card.offsetWidth;
  const cardH = card.offsetHeight;

  // Expande canvas verticalmente se o card estiver chegando à borda inferior
  const yRaw = clientY - rect.top - offsetY;
  if (yRaw + cardH + 20 > canvas.offsetHeight) {
    canvas.style.height = (yRaw + cardH + 40) + 'px';
  }

  const x = Math.max(0, Math.min(canvas.offsetWidth  - cardW, clientX - rect.left - offsetX));
  const y = Math.max(0, Math.min(canvas.offsetHeight - cardH, yRaw));

  card.style.left = (x / canvas.offsetWidth  * 100) + '%';
  card.style.top  = (y / canvas.offsetHeight * 100) + '%';
  _desenharConectoresSVG();
}

async function _onDragSoltar(e) {
  if (!_dragState) return;
  const { comodoId, offsetX, offsetY } = _dragState;
  _dragState = null;

  const canvas = document.getElementById('floor-canvas');
  const card   = document.getElementById(`floor-${comodoId}`);
  if (!canvas || !card) return;

  const { x: clientX, y: clientY } = _clienteXY(e);
  const rect  = canvas.getBoundingClientRect();
  const cardW = card.offsetWidth;
  const cardH = card.offsetHeight;
  const x = Math.max(0, Math.min(rect.width  - cardW, clientX - rect.left - offsetX));
  const y = Math.max(0, Math.min(rect.height - cardH, clientY - rect.top  - offsetY));

  card.classList.remove('floor-room--dragging');
  card.style.zIndex = '';

  const comodo = appState.comodos.find(c => c.id === comodoId);
  if (comodo) {
    comodo.posicaoX = _pctToStore(x, rect.width);
    comodo.posicaoY = _pctToStore(y, rect.height);
    try {
      const resp = await API.atualizarPosicaoComodo(comodoId, comodo.posicaoX, comodo.posicaoY);
      if (!resp?.sucesso) {
        console.error('[Planta] Falha ao salvar posição:', resp);
        mostrarAlerta('error', 'Erro ao salvar posição', resp?.erro || resp?.title || JSON.stringify(resp));
      }
    } catch (err) {
      console.error('[Planta] Erro ao salvar posição:', err);
      mostrarAlerta('error', 'Erro JS', err.message || String(err));
    }
  }
  _ajustarAlturaCanvas(); // recolhe canvas se cômodo subiu
  _desenharConectoresSVG();
}

window.addEventListener('mousemove', _onDragMover);
window.addEventListener('touchmove', _onDragMover, { passive: false });
window.addEventListener('mouseup',   _onDragSoltar);
window.addEventListener('touchend',  _onDragSoltar, { passive: false });

/**
 * Destaca um cômodo na planta baixa com rolagem automática.
 * @param {string} idComodo - ID do cômodo a destacar
 */
function destacarComodoPlanta(idComodo) {
  document.querySelectorAll('.floor-room').forEach(el => el.classList.remove('active'));

  const elemento = document.getElementById('floor-' + idComodo);
  if (elemento) {
    elemento.classList.add('active');
    elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  selecionarComodoPlanta(idComodo);
}

/**
 * Exibe o painel de detalhes do cômodo selecionado na planta.
 * @param {string} idComodo - ID do cômodo selecionado
 */
function selecionarComodoPlanta(idComodo) {
  // Remove destaque de todos os cômodos
  document.querySelectorAll('.floor-room').forEach(el => el.classList.remove('active'));

  const elemento = document.getElementById('floor-' + idComodo);
  if (elemento) elemento.classList.add('active');

  const comodo = appState.comodos.find(c => c.id === idComodo);
  if (!comodo) return;

  // Exibe o painel de detalhes
  const painel = document.getElementById('room-detail-panel');
  painel.style.display = 'block';
  document.getElementById('detail-room-title').textContent = comodo.nome.toUpperCase() + ' — DETALHES E DISPOSITIVOS';

  // Lista os dispositivos do cômodo selecionado
  const dispositivos = appState.dispositivos.filter(d => d.idComodo === idComodo);
  document.getElementById('detail-devices-list').innerHTML = dispositivos.length
    ? dispositivos.map(d => `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border);">
          <span>${obterIconesDispositivos()[d.categoria || d.tipo] || obterIconesDispositivos()['outro']}</span>
          <span style="flex:1; font-size:13px;">${d.nome}</span>
          <span class="device-status ${d.status}">
            <span class="device-status-dot"></span>${d.status === 'on' ? 'Ligado' : 'Desligado'}
          </span>
          <span style="font-family:'Orbitron',monospace; font-size:12px; color:var(--cyan);">${d.potenciaNominal ?? d.watts ?? 0}W</span>
        </div>
      `).join('')
    : '<div style="color:var(--text-dim); font-size:13px;">Nenhum dispositivo cadastrado neste cômodo</div>';

  // Gráfico de consumo do cômodo via NILM + histórico real
  if (graficos.detalheComodo) graficos.detalheComodo.destroy();

  _carregarGraficoComodo(idComodo).then(({ labels, dados, fonte }) => {
    const chartEl = document.getElementById('chart-room-detail');
    if (!chartEl) return;
    const cor = fonte === 'nilm' ? '#00d4ff' : fonte === 'nominal' ? '#a78bfa' : '#64748b';
    graficos.detalheComodo = new Chart(chartEl, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: fonte === 'nilm' ? 'kWh (NILM)' : fonte === 'nominal' ? 'kWh (estimado)' : 'kWh',
          data: dados,
          borderColor: cor,
          backgroundColor: cor.replace(')', ',.08)').replace('rgb', 'rgba'),
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 2
        }]
      },
      options: { ...configPadraoGraficos }
    });
  });

  corrigirTextosCorrompidosNaPagina(painel);
}

/**
 * Calcula os dados do gráfico de consumo de um cômodo.
 * Prioridade: NILM × histórico real → potência nominal × histórico real → zeros
 */
async function _carregarGraficoComodo(idComodo) {
  const comodo      = appState.comodos.find(c => c.id === idComodo);
  const dispositivosDoComodo = appState.dispositivos.filter(d => d.idComodo === idComodo);

  // 1. Busca histórico real do dia e NILM em paralelo
  const [respHist, respNilm] = await Promise.all([
    API.obterHistorico('day'),
    API.analisarNilm?.(24).catch(() => null)
  ]);

  const dadosHist = respHist?.sucesso && respHist.dados?.length ? respHist.dados : null;

  // 2. Tenta calcular % do cômodo pelo NILM
  let pctNilm = 0;
  if (respNilm?.disponivel && dispositivosDoComodo.length > 0) {
    const nomesDisp = dispositivosDoComodo.map(d => (d.nome || '').toLowerCase());
    (respNilm.dispositivos || []).forEach(item => {
      const nomeItem = (item.nome || '').toLowerCase();
      if (nomesDisp.some(n => n.includes(nomeItem) || nomeItem.includes(n))) {
        pctNilm += (item.porcentagem || 0);
      }
    });
  }

  if (pctNilm > 0 && dadosHist) {
    // NILM disponível: aplica % ao histórico medido
    return {
      labels: dadosHist.map(d => d.label),
      dados:  dadosHist.map(d => +((d.kwh * pctNilm / 100)).toFixed(3)),
      fonte:  'nilm'
    };
  }

  // 3. Fallback: proporção de potência nominal × histórico medido
  const totalWCasa = appState.comodos.reduce((s, c) => s + (c.watts || 0), 0);
  const wComodo    = comodo?.watts || 0;
  const pctNominal = totalWCasa > 0 ? wComodo / totalWCasa : 0;

  if (pctNominal > 0 && dadosHist) {
    return {
      labels: dadosHist.map(d => d.label),
      dados:  dadosHist.map(d => +((d.kwh * pctNominal)).toFixed(3)),
      fonte:  'nominal'
    };
  }

  // 4. Sem dados: zeros
  const labels = Array.from({ length: 12 }, (_, i) => `${i * 2}h`);
  return { labels, dados: labels.map(() => 0), fonte: 'sem-dados' };
}


// ===================================================
// ABA: DISPOSITIVOS
// ===================================================

/** Renderiza a tabela de dispositivos e o gráfico comparativo */
function renderizarDispositivos() {
  const corpo = document.getElementById('devices-tbody');
  const icones = obterIconesDispositivos();

  corpo.innerHTML = appState.dispositivos.map(disp => {
    const ativo     = disp.status === 'on' || disp.status === 'ativo';
    const watts     = Number(disp.potenciaNominal ?? disp.watts ?? 0);
    const kwh       = Number(disp.kwh ?? 0);
    const kwhMes    = (watts * 8 / 1000 * 30).toFixed(1);
    const nomeComodo = disp.comodo?.nome ?? disp.nomeComodo ?? '—';
    const icone     = icones[disp.tipo ?? disp.categoria] || icones['outro'];
    return `
    <tr class="${ativo ? '' : 'device-row--inativo'}">
      <td><span style="margin-right:8px;">${icone}</span>${disp.nome || 'Sem nome'}</td>
      <td><span class="tag tag-cyan">${nomeComodo}</span></td>
      <td>
        <span class="device-status ${ativo ? 'on' : 'off'}">
          <span class="device-status-dot"></span>${ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td style="font-family:'Orbitron',monospace; color:var(--cyan);">${watts}W</td>
      <td style="font-family:'Orbitron',monospace;">${kwh.toFixed(2)} kWh</td>
      <td style="font-family:'Orbitron',monospace;">${kwhMes} kWh</td>
      <td>
        <label class="device-toggle" title="${ativo ? 'Desativar dispositivo' : 'Ativar dispositivo'}">
          <input type="checkbox" ${ativo ? 'checked' : ''} onchange="alternarDispositivo('${disp.id}')">
          <span class="device-toggle-track">
            <span class="device-toggle-thumb"></span>
          </span>
          <span class="device-toggle-label">${ativo ? 'Ativo' : 'Inativo'}</span>
        </label>
        <button class="btn btn-sm btn-danger" onclick="removerDispositivo('${disp.id}')" style="margin-left:8px;">✕</button>
      </td>
    </tr>`;
  }).join('');

  corrigirTextosCorrompidosNaPagina(corpo);
}

/**
 * Alterna o status (ligado/desligado) de um dispositivo.
 * @param {string} idDispositivo - ID do dispositivo a alternar
 */
function alternarDispositivo(idDispositivo) {
  const disp = appState.dispositivos.find(d => d.id === idDispositivo);
  if (!disp) return;
  const estaAtivo  = disp.status === 'on' || disp.status === 'ativo';
  const novoStatus = estaAtivo ? 'off' : 'on';
  disp.status = novoStatus;
  renderizarDispositivos();
  API.alterarStatusDispositivo(idDispositivo, novoStatus).catch(e =>
    console.warn('[API] Falha ao alterar status:', e)
  );
}

/**
 * Remove um dispositivo após confirmação do usuário.
 * @param {string} idDispositivo - ID do dispositivo a remover
 */
async function removerDispositivo(idDispositivo) {
  const confirmado = await mostrarConfirm({
    titulo:   'Remover dispositivo',
    mensagem: 'Deseja realmente remover este dispositivo? Esta ação não pode ser desfeita.',
    icone:    'trash-2',
    okLabel:  'Remover',
    okDanger: true,
  });
  if (!confirmado) return;
  appState.dispositivos = appState.dispositivos.filter(d => d.id !== idDispositivo);
  renderizarDispositivos();
  verificarDiscrepanciaImediata();
}


// ===================================================
// MODAIS DE ADIÇÃO
// ===================================================

/** Abre o modal de adição de novo cômodo */
function abrirModalAdicionarComodo() {
  preencherSelecoesComodos();
  abrirModal('modal-room');
}

/** Abre o modal de adição de novo dispositivo */
function abrirModalAdicionarDispositivo() {
  preencherSelecoesComodos();
  abrirModal('modal-device');
}

/** Processa a adição de um novo cômodo a partir do modal */
async function adicionarComodoDoModal() {
  if (!appState.residencia?.id) { mostrarToast('Nenhuma residência configurada.', 'aviso'); return; }

  const tipo = document.getElementById('modal-room-type').value;
  const nome = document.getElementById('modal-room-name').value.trim()
    || tipo.charAt(0).toUpperCase() + tipo.slice(1);

  const btn = document.querySelector('#modal-room .btn-primary');
  if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }

  const resp = await API.adicionarComodo({
    idResidencia:  appState.residencia.id,
    nome, tipo,
    andar:         0,
    ordemExibicao: appState.comodos.length
  });

  if (btn) { btn.textContent = '+ ADICIONAR'; btn.disabled = false; }

  if (resp?.sucesso) {
    appState.comodos.push({ ...resp.comodo, watts: 0 });
    comodosConfigurados = appState.comodos;
    preencherSelecoesComodos();
    fecharModal('modal-room');
    renderizarComodos();
    document.getElementById('modal-room-name').value = '';
  } else {
    mostrarToast(resp?.erro || 'Erro ao adicionar cômodo.', 'erro');
  }
}

/** Processa a adição de um novo dispositivo a partir do modal */
async function adicionarDispositivoDoModal() {
  if (!appState.residencia?.id) { mostrarToast('Nenhuma residência configurada.', 'aviso'); return; }

  const tipo    = document.getElementById('modal-dev-type').value;
  const nome    = document.getElementById('modal-dev-name').value.trim()
    || tipo.charAt(0).toUpperCase() + tipo.slice(1);
  const seletor = document.getElementById('modal-dev-room');
  const idComodo  = seletor.value;
  const nomeComodo = seletor.selectedOptions[0]?.text || '—';
  const potencia  = parseInt(document.getElementById('modal-dev-watts').value) || 300;
  const btn = document.querySelector('#modal-device .btn-primary');
  if (btn) { btn.textContent = 'Salvando...'; btn.disabled = true; }

  const resp = await API.adicionarDispositivo({
    idComodo,
    idResidencia:    appState.residencia.id,
    nome,
    categoria:       tipo,
    potenciaNominal: potencia,
    tensao:          220,
  });

  if (btn) { btn.textContent = '+ ADICIONAR'; btn.disabled = false; }

  if (resp?.sucesso) {
    appState.dispositivos.push({
      ...resp.dispositivo,
      nomeComodo,
      watts: potencia,
      status: 'off',
      kwh: +(potencia * 8 / 1000).toFixed(2)
    });
    fecharModal('modal-device');
    renderizarDispositivos();
    // Reavalia o banner imediatamente após cadastrar novo dispositivo
    verificarDiscrepanciaImediata();
  } else {
    mostrarToast(resp?.erro || 'Erro ao adicionar dispositivo.', 'erro');
  }
}


// ===================================================
// ABA: RELATÓRIOS
// ===================================================

/** Inicializa os gráficos da aba de relatórios */
function inicializarGraficosRelatorio() {
  const periodo   = document.getElementById('report-period')?.value || 'week';
  const historico = gerarHistoricoSimulado(periodo);

  // Destrói gráficos anteriores antes de recriar
  ['diario', 'custo', 'volts', 'amps'].forEach(id => {
    if (graficos['rel_' + id]) graficos['rel_' + id].destroy();
  });

  // Gráfico de consumo diário
  graficos.rel_diario = new Chart(document.getElementById('chart-rep-daily'), {
    type: 'bar',
    data: {
      labels: historico.map(d => d.label),
      datasets: [{
        label: 'kWh', data: historico.map(d => d.kwh),
        backgroundColor: 'rgba(0,87,255,0.5)', borderColor: '#1a7eff',
        borderWidth: 1, borderRadius: 4
      }]
    },
    options: { ...configPadraoGraficos }
  });

  // Gráfico de custo estimado
  graficos.rel_custo = new Chart(document.getElementById('chart-rep-cost'), {
    type: 'line',
    data: {
      labels: historico.map(d => d.label),
      datasets: [{
        label: 'R$', data: historico.map(d => d.custo),
        borderColor: '#ffaa00', backgroundColor: 'rgba(255,170,0,0.06)',
        borderWidth: 2, tension: 0.4, fill: true, pointRadius: 3
      }]
    },
    options: { ...configPadraoGraficos }
  });

  // Gráfico de tensão média
  graficos.rel_volts = new Chart(document.getElementById('chart-rep-volts'), {
    type: 'line',
    data: {
      labels: historico.map(d => d.label),
      datasets: [{
        label: 'Tensão (V)', data: historico.map(d => d.volts),
        borderColor: '#7df9ff', backgroundColor: 'rgba(125,249,255,0.05)',
        borderWidth: 2, tension: 0.4, fill: true, pointRadius: 3
      }]
    },
    options: { ...configPadraoGraficos }
  });

  // Gráfico de corrente média
  graficos.rel_amps = new Chart(document.getElementById('chart-rep-amps'), {
    type: 'line',
    data: {
      labels: historico.map(d => d.label),
      datasets: [{
        label: 'Corrente (A)', data: historico.map(d => d.amps),
        borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.05)',
        borderWidth: 2, tension: 0.4, fill: true, pointRadius: 3
      }]
    },
    options: { ...configPadraoGraficos }
  });

  // Tabela resumo do período
  const corpoTabela = document.getElementById('report-tbody');
  corpoTabela.innerHTML = historico.map(d => `
    <tr>
      <td style="font-family:'Orbitron',monospace; font-size:12px;">${d.label}</td>
      <td style="color:var(--cyan);   font-family:'Orbitron',monospace;">${d.kwh}</td>
      <td style="color:var(--warn);   font-family:'Orbitron',monospace;">R$ ${d.custo.toFixed(2)}</td>
      <td>${d.watts}W</td>
      <td>${d.volts}V</td>
      <td>${d.amps}A</td>
    </tr>
  `).join('');
}

/** Abre/fecha o menu de exportação */
function toggleExportMenu(e) {
  e.stopPropagation();
  document.getElementById('export-menu').classList.toggle('active');
}

function fecharExportMenu() {
  document.getElementById('export-menu')?.classList.remove('active');
}

document.addEventListener('click', fecharExportMenu);

/** Exporta o relatório como CSV com dados brutos da API */
async function exportarCSV() {
  fecharExportMenu();
  if (_isPlanoGratuito()) { atualizarPlano(); return; }

  const btnEl    = document.querySelector('[onclick="exportarCSV()"]');
  const original = btnEl?.innerHTML;
  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Exportando...'; lucide.createIcons(); }

  try {
    const periodo    = document.getElementById('report-period')?.value || 'week';
    const labelMap   = { day: 'Hoje', week: 'Última Semana', month: 'Último Mês', year: 'Último Ano' };
    const fileMap    = { day: 'hoje', week: 'ultima-semana', month: 'ultimo-mes', year: 'ultimo-ano' };
    const agora      = new Date();
    const residencia = appState.residencia?.nome || 'Residência';
    const tarifa     = appState.residencia?.tarifaKwh ?? '---';

    const resp = await API.obterHistorico(periodo);
    const dados = resp?.dados ?? [];

    if (!dados.length) {
      alertaAviso('Sem dados', 'Nenhuma leitura encontrada para o período selecionado.');
      return;
    }

    const num = (v, dec = 3) => {
      const n = parseFloat(v);
      return isNaN(n) ? '' : n.toFixed(dec).replace('.', ',');
    };
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const SEP = ';';

    const totalKwh   = dados.reduce((s, d) => s + (parseFloat(d.kwh)   || 0), 0);
    const totalCusto = dados.reduce((s, d) => s + (parseFloat(d.custo) || 0), 0);
    const picoW      = Math.max(...dados.map(d => parseFloat(d.watts) || 0));

    const cabecalho = [
      q('MONITECH — Relatório de Consumo de Energia'), '', '', '', '', '', ''
    ].join(SEP);

    const meta = [
      [q('Residência:'), q(residencia), '', q('Período:'), q(labelMap[periodo] || periodo), '', ''],
      [q('Tarifa (R$/kWh):'), q(tarifa), '', q('Gerado em:'), q(`${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`), '', ''],
      ['', '', '', '', '', '', ''],
    ].map(r => r.join(SEP));

    const colunas = [
      'Período', 'Consumo (kWh)', 'Custo (R$)', 'Potência Média (W)',
      'Tensão Média (V)', 'Corrente Média (A)', 'Fator de Potência',
    ].map(q).join(SEP);

    const linhas = dados.map(d => [
      q(d.label ?? ''),
      num(d.kwh,   3),
      num(d.custo, 2),
      num(d.watts, 1),
      num(d.volts, 1),
      num(d.amps,  2),
      num(d.fp,    2),
    ].join(SEP));

    const rodape = [
      ['', '', '', '', '', '', ''],
      [q('TOTAIS'), num(totalKwh, 3), num(totalCusto, 2), num(picoW, 1), q('---'), q('---'), q('---')],
    ].map(r => r.join(SEP));

    const csv = ['﻿' + cabecalho, ...meta, colunas, ...linhas, ...rodape].join('\r\n');

    _dispararDownload(
      csv,
      'text/csv;charset=utf-8',
      `monitech-${residencia.replace(/\s+/g, '-').toLowerCase()}-${fileMap[periodo]}-${agora.toISOString().slice(0, 10)}.csv`
    );

    alertaSucesso('CSV exportado', `${dados.length} registros salvos na pasta de downloads.`);
  } catch {
    mostrarToast('Erro ao exportar CSV. Tente novamente.', 'erro');
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = original; lucide.createIcons(); }
  }
}

/** Exporta o relatório como PDF em nova aba com layout profissional */
function exportarPDF() {
  fecharExportMenu();
  if (_isPlanoGratuito()) { atualizarPlano(); return; }

  const periodo    = document.getElementById('report-period')?.value || 'week';
  const labelMap   = { week: 'Última Semana', month: 'Último Mês', year: 'Último Ano' };
  const agora      = new Date();
  const dataStr    = agora.toLocaleDateString('pt-BR', { dateStyle: 'long' });
  const horaStr    = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const residencia = appState.residencia?.nome || 'Residência';
  const tarifa     = appState.residencia?.tarifaKwh ?? '---';

  const kwhTotal  = document.getElementById('rep-kpi-kwh')?.textContent  || '---';
  const custoTotal= document.getElementById('rep-kpi-custo')?.textContent || '---';
  const picoW     = document.getElementById('rep-kpi-pico')?.textContent  || '---';
  const mediaDia  = document.getElementById('rep-kpi-media')?.textContent || '---';

  const linhas = [];
  document.querySelectorAll('#report-tbody tr').forEach(tr => {
    const celulas = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
    if (celulas.length) linhas.push(celulas);
  });

  const tabelaHTML = linhas.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#f8faff' : '#fff'};">
      <td style="padding:10px 14px; font-weight:600; color:#1e293b; border-bottom:1px solid #e2e8f0;">${r[0]}</td>
      <td style="padding:10px 14px; text-align:right; font-family:monospace; color:#0057ff; border-bottom:1px solid #e2e8f0;">${r[1]}</td>
      <td style="padding:10px 14px; text-align:right; font-family:monospace; color:#d97706; border-bottom:1px solid #e2e8f0;">${r[2]}</td>
      <td style="padding:10px 14px; text-align:right; font-family:monospace; color:#dc2626; border-bottom:1px solid #e2e8f0;">${r[3]}</td>
      <td style="padding:10px 14px; text-align:right; font-family:monospace; border-bottom:1px solid #e2e8f0;">${r[4]}</td>
      <td style="padding:10px 14px; text-align:right; font-family:monospace; border-bottom:1px solid #e2e8f0;">${r[5]}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MONITECH — Relatório de Energia</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; background:#f1f5f9; color:#334155; }
    .page { max-width:900px; margin:0 auto; background:#fff; box-shadow:0 0 40px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#0057ff 0%,#0ea5e9 100%); padding:36px 48px; color:#fff; }
    .header-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; }
    .logo { display:flex; align-items:center; gap:14px; }
    .logo-text { font-size:24px; font-weight:800; letter-spacing:3px; }
    .logo-sub { font-size:12px; opacity:0.75; letter-spacing:1px; margin-top:2px; }
    .header-badge { background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:8px; padding:8px 18px; font-size:13px; font-weight:600; letter-spacing:1px; }
    .header-meta { display:grid; grid-template-columns:1fr 1fr; gap:8px 40px; }
    .meta-item { font-size:13px; opacity:0.85; }
    .meta-item strong { opacity:1; font-weight:700; }
    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:0; border-bottom:3px solid #e2e8f0; }
    .kpi { padding:22px 24px; border-right:1px solid #e2e8f0; }
    .kpi:last-child { border-right:none; }
    .kpi-label { font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:#94a3b8; margin-bottom:8px; }
    .kpi-value { font-size:26px; font-weight:700; line-height:1; }
    .kpi-unit { font-size:13px; color:#94a3b8; margin-top:4px; }
    .section { padding:32px 48px; }
    .section-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#94a3b8; margin-bottom:20px; display:flex; align-items:center; gap:10px; }
    .section-title::after { content:''; flex:1; height:1px; background:#e2e8f0; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    thead tr { background:#f8faff; }
    thead th { padding:12px 14px; text-align:right; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#64748b; font-weight:600; border-bottom:2px solid #e2e8f0; }
    thead th:first-child { text-align:left; }
    .footer { padding:20px 48px; background:#f8faff; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#94a3b8; }
    @media print {
      body { background:#fff; }
      .page { box-shadow:none; max-width:100%; }
      .no-print { display:none; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-top">
      <div class="logo">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" width="42" height="48">
          <path d="M100,18 C72,18 50,40 50,66 C50,86 60,100 74,110 C80,114 82,120 82,126 L118,126 C118,120 120,114 126,110 C140,100 150,86 150,66 C150,40 128,18 100,18Z" fill="none" stroke="white" stroke-width="4"/>
          <path d="M83,130 C91,127 109,127 117,130" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M84,138 C92,134 108,134 116,138" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round"/>
          <path d="M78,116 C76,100 80,82 86,72 C90,64 96,66 98,76 C100,84 99,98 99,110" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M99,110 C99,96 100,82 103,72 C106,62 114,64 116,74 C118,84 116,104 113,118" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
        </svg>
        <div>
          <div class="logo-text">MONITECH</div>
          <div class="logo-sub">MONITORAMENTO DE ENERGIA</div>
        </div>
      </div>
      <div class="header-badge">RELATÓRIO ENERGÉTICO</div>
    </div>
    <div class="header-meta">
      <div class="meta-item">Residência: <strong>${residencia}</strong></div>
      <div class="meta-item">Período: <strong>${labelMap[periodo] || periodo}</strong></div>
      <div class="meta-item">Tarifa: <strong>R$ ${tarifa}/kWh</strong></div>
      <div class="meta-item">Gerado em: <strong>${dataStr} às ${horaStr}</strong></div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Consumo Total</div>
      <div class="kpi-value" style="color:#0057ff;">${kwhTotal}</div>
      <div class="kpi-unit">kWh</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Custo Total</div>
      <div class="kpi-value" style="color:#d97706;">R$ ${custoTotal}</div>
      <div class="kpi-unit">Estimado</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Pico Registrado</div>
      <div class="kpi-value" style="color:#dc2626;">${picoW}</div>
      <div class="kpi-unit">Watts</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Média Diária</div>
      <div class="kpi-value" style="color:#059669;">${mediaDia}</div>
      <div class="kpi-unit">kWh/dia</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalhamento por Período</div>
    <table>
      <thead>
        <tr>
          <th>Período</th>
          <th>Consumo (kWh)</th>
          <th>Custo (R$)</th>
          <th>Pico (W)</th>
          <th>Tensão Média (V)</th>
          <th>Corrente Média (A)</th>
        </tr>
      </thead>
      <tbody>${tabelaHTML || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">Sem dados disponíveis</td></tr>'}</tbody>
    </table>
  </div>

  <div class="footer">
    <span>© ${new Date().getFullYear()} MONITECH — Relatório gerado automaticamente</span>
    <button class="no-print" onclick="window.print()" style="background:#0057ff;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;">Imprimir / Salvar PDF</button>
  </div>
</div>
<script>window.onload = () => { /* auto-pronto para impressão */ }<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const janela = window.open(url, '_blank');
  if (!janela) { alertaErro('Pop-up bloqueado', 'Permita pop-ups para este site e tente novamente.'); return; }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Retorna true se o usuário logado está no plano gratuito (ou com plano expirado) */
function _isPlanoGratuito() {
  const u = appState.usuario;
  if (!u) return true;
  if (u.plano === 'gratuito') return true;
  if (u.planoExpiraEm && new Date(u.planoExpiraEm) < new Date()) return true;
  return false;
}

/** Aplica indicadores visuais de bloqueio para funcionalidades do plano pago */
function _aplicarBloqueioHistorico() {
  const gratuito = _isPlanoGratuito();

  // Opção "Último Ano" nos selects de período
  ['period-select', 'report-period'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const optYear = sel.querySelector('option[value="year"]');
    if (!optYear) return;
    if (gratuito) {
      optYear.textContent = id === 'period-select' ? 'Este Ano — Plano Mensal' : 'Último Ano — Plano Mensal';
      optYear.disabled = true;
      optYear.dataset.locked = '1';
    } else {
      optYear.textContent = id === 'period-select' ? 'Este Ano' : 'Último Ano';
      optYear.disabled = false;
      delete optYear.dataset.locked;
    }
  });

  // Botões de exportação
  const exportBtn = document.querySelector('[onclick="toggleExportMenu(event)"]');
  if (exportBtn) {
    if (gratuito) {
      exportBtn.title = 'Disponível no plano mensal';
      exportBtn.style.opacity = '0.6';
    } else {
      exportBtn.title = '';
      exportBtn.style.opacity = '';
    }
  }
  ['btn-export-json', 'btn-export-csv'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (gratuito) {
      btn.title = 'Disponível no plano mensal';
      btn.style.opacity = '0.6';
    } else {
      btn.title = '';
      btn.style.opacity = '';
    }
  });

  // Checkboxes de e-mail nas duas seções de notificações
  const emailCheckIds = [
    'not-email-alerts', 'not-email-cost', 'not-email-anomaly', 'not-email-device',
    'notify-email-alerts', 'notify-sensor-alerts', 'notify-email-summary'
  ];
  const BANNER_ID = 'banner-plano-email';
  emailCheckIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = gratuito;
    if (gratuito) el.checked = false;
    const label = el.closest('label, .toggle-label, .notification-item');
    if (label) label.style.opacity = gratuito ? '0.45' : '';
  });

  // Banners de upgrade nas seções de e-mail
  ['notification-section', 'account-section'].forEach(cls => {
    document.querySelectorAll(`.${cls}`).forEach(sec => {
      const title = sec.querySelector('.notification-title, .account-section-title');
      if (!title) return;
      const txt = title.textContent || '';
      if (!txt.includes('E-mail') && !txt.includes('Notificações')) return;
      // Só na seção que tem checkboxes de e-mail
      const hasEmailCheck = emailCheckIds.some(id => sec.querySelector(`#${id}`));
      if (!hasEmailCheck) return;
      let banner = sec.querySelector(`#${BANNER_ID}`);
      if (gratuito && !banner) {
        banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:8px;background:var(--topbar-hover);border:1px solid var(--border-bright);font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:10px;';
        banner.innerHTML = '🔒 <span>Alertas por e-mail estão disponíveis no <strong style="color:var(--blue-core)">Plano Mensal</strong>. <a href="#" onclick="atualizarPlano();return false;" style="color:var(--blue-core)">Fazer upgrade →</a></span>';
        sec.appendChild(banner);
      } else if (!gratuito && banner) {
        banner.remove();
      }
    });
  });
}

/** Atualiza gráficos, títulos e cards ao alterar o período selecionado */
function atualizarGraficos() {
  const sel    = document.getElementById('period-select');
  const periodo = sel?.value || 'day';

  if (periodo === 'year' && _isPlanoGratuito()) {
    if (sel) sel.value = 'month';
    atualizarPlano();
    return;
  }

  const cfg = {
    day: {
      titleHourly:  'CONSUMO POR HORA (kWh)',
      titleMonthly: 'HISTÓRICO DO DIA (kWh)',
      labelKwh:     'Consumo de Hoje',
      changeKwh:    'Total acumulado hoje',
      labelCost:    'Custo Estimado Hoje',
      changeCost:   'Baseado na tarifa configurada',
      labelMonth:   'Consumo no Mês',
      changeMonth:  'Acumulado até agora',
      labelPeak:    'Pico de Potência',
      changePeak:   'Maior valor registrado hoje',
    },
    week: {
      titleHourly:  'CONSUMO POR DIA (kWh)',
      titleMonthly: 'HISTÓRICO SEMANAL (kWh)',
      labelKwh:     'Consumo da Semana',
      changeKwh:    'Total acumulado na semana',
      labelCost:    'Custo Estimado da Semana',
      changeCost:   'Baseado na tarifa configurada',
      labelMonth:   'Média Diária',
      changeMonth:  'Média dos dias da semana',
      labelPeak:    'Pico de Potência',
      changePeak:   'Maior valor registrado na semana',
    },
    month: {
      titleHourly:  'CONSUMO POR DIA DO MÊS (kWh)',
      titleMonthly: 'HISTÓRICO MENSAL (kWh)',
      labelKwh:     'Consumo do Mês',
      changeKwh:    'Total acumulado no mês',
      labelCost:    'Custo Estimado do Mês',
      changeCost:   'Baseado na tarifa configurada',
      labelMonth:   'Média Diária',
      changeMonth:  'Média dos dias do mês',
      labelPeak:    'Pico de Potência',
      changePeak:   'Maior valor registrado no mês',
    },
    year: {
      titleHourly:  'CONSUMO MENSAL (kWh)',
      titleMonthly: 'HISTÓRICO ANUAL (kWh)',
      labelKwh:     'Consumo do Ano',
      changeKwh:    'Total acumulado no ano',
      labelCost:    'Custo Estimado do Ano',
      changeCost:   'Baseado na tarifa configurada',
      labelMonth:   'Média Mensal',
      changeMonth:  'Média dos meses do ano',
      labelPeak:    'Pico de Potência',
      changePeak:   'Maior valor registrado no ano',
    },
  };

  const c = cfg[periodo] || cfg.day;

  // Títulos dos gráficos
  const el = id => document.getElementById(id);
  if (el('chart-title-hourly'))  el('chart-title-hourly').textContent  = c.titleHourly;
  if (el('chart-title-monthly')) el('chart-title-monthly').textContent = c.titleMonthly;

  // Labels e subtítulos dos cards
  if (el('stat-label-kwh'))    el('stat-label-kwh').textContent    = c.labelKwh;
  if (el('stat-change-kwh'))   el('stat-change-kwh').textContent   = c.changeKwh;
  if (el('stat-label-cost'))   el('stat-label-cost').textContent   = c.labelCost;
  if (el('stat-change-cost'))  el('stat-change-cost').textContent  = c.changeCost;
  if (el('stat-label-month'))  el('stat-label-month').textContent  = c.labelMonth;
  if (el('stat-change-month')) el('stat-change-month').textContent = c.changeMonth;
  if (el('stat-label-peak'))   el('stat-label-peak').textContent   = c.labelPeak;
  if (el('stat-change-peak'))  el('stat-change-peak').textContent  = c.changePeak;

  // Valores dos cards a partir dos dados simulados do período
  const historico = gerarHistoricoSimulado(periodo);
  const totalKwh  = historico.reduce((s, d) => s + d.kwh, 0);
  const totalCost = historico.reduce((s, d) => s + d.custo, 0);
  const peakW     = Math.max(...historico.map(d => d.watts));
  const media     = historico.length ? totalKwh / historico.length : 0;

  if (el('stat-kwh'))   el('stat-kwh').textContent   = totalKwh.toFixed(2);
  if (el('stat-cost'))  el('stat-cost').textContent  = 'R$ ' + totalCost.toFixed(2);
  if (el('stat-month')) el('stat-month').textContent = periodo === 'day'
    ? (appState.dadosDashboard?.kwhMes?.toFixed(1) ?? '---')
    : media.toFixed(2);
  if (el('stat-peak'))  el('stat-peak').textContent  = (peakW / 1000).toFixed(3);

  // Recria os gráficos com o período correto
  inicializarGraficos();
}


// ===================================================
// ABA: ALERTAS
// ===================================================

/** Corrige textos de alerta com ?? no lugar de caracteres especiais */
function _corrigirAlerta(s) {
  if (!s || typeof s !== 'string' || !s.includes('??')) return s;
  return s
    .replace(/subtens\?\?o/gi, 'subtensão')
    .replace(/tens\?\?o/gi, 'tensão')
    .replace(/m\?\?nimo/gi, 'mínimo')
    .replace(/m\?\?ximo/gi, 'máximo')
    .replace(/di\?\?rio/gi, 'diário')
    .replace(/di\?\?ria/gi, 'diária')
    .replace(/pot\?\?ncia/gi, 'potência')
    .replace(/est\?\?o/gi, 'estão')
    .replace(/est\?\?/gi, 'está')
    .replace(/n\?\?o/gi, 'não')
    .replace(/s\?\?o/gi, 'são')
    .replace(/h\?\? /gi, 'há ')
    .replace(/fun\?\?\?\?o/gi, 'função')
    .replace(/fun\?\?\?\?es/gi, 'funções')
    .replace(/conex\?\?o/gi, 'conexão')
    .replace(/informa\?\?\?\?o/gi, 'informação')
    .replace(/configura\?\?\?\?o/gi, 'configuração')
    .replace(/notifica\?\?\?\?o/gi, 'notificação')
    .replace(/vers\?\?o/gi, 'versão')
    .replace(/condi\?\?\?\?o/gi, 'condição')
    .replace(/cr\?\?tico/gi, 'crítico')
    .replace(/cr\?\?tica/gi, 'crítica')
    .replace(/per\?\?odo/gi, 'período')
    .replace(/c\?\?digo/gi, 'código')
    .replace(/c\?\?lculo/gi, 'cálculo')
    .replace(/p\?\?gina/gi, 'página')
    .replace(/m\?\?dia/gi, 'média')
    .replace(/m\?\?s\b/gi, 'mês')
    .replace(/an\?\?lise/gi, 'análise')
    .replace(/al\?\?m/gi, 'além')
    .replace(/tamb\?\?m/gi, 'também');
}

/** Renderiza a lista de alertas gerados */
function renderizarAlertas() {
  const lista = document.getElementById('alerts-list');
  if (!lista) return;

  // Normaliza campos vindos da API (camelCase ou snake_case)
  const alertas = (appState.alertas || []).map(a => ({
    tipo:     a.tipo     || a.type   || 'info',
    icone:    a.icone    || _iconePorTipo(a.tipo || a.type),
    titulo:   _corrigirAlerta(a.titulo   || a.title  || a.Titulo  || 'Alerta'),
    mensagem: _corrigirAlerta(a.mensagem || a.message || a.Mensagem || ''),
    horario:  a.horario  || (a.dataCriacao || a.DataCriacao
                ? new Date(a.dataCriacao || a.DataCriacao).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})
                : ''),
    lido:     a.lido     || a.Lido   || false,
    id:       a.id       || a.Id
  }));

  lista.innerHTML = alertas.length
    ? alertas.map(alerta => `
        <div class="alert-item ${alerta.tipo}" style="${alerta.lido ? 'opacity:0.6' : ''}">
          <span class="alert-icon">${alerta.icone}</span>
          <div class="alert-text">
            <strong>${alerta.titulo}</strong>
            <span>${alerta.mensagem}</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            <span class="alert-time">${alerta.horario}</span>
            ${!alerta.lido && alerta.id ? `<button onclick="marcarAlertaLido('${alerta.id}')" style="font-size:10px;background:none;border:1px solid var(--border);color:var(--text-dim);padding:2px 6px;border-radius:4px;cursor:pointer;">✓ lido</button>` : ''}
          </div>
        </div>`).join('')
    : '<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-title">Nenhum alerta registrado</div></div>';

  corrigirTextosCorrompidosNaPagina(lista);
}

/** Mapeia tipo de alerta para ícone SVG Lucide */
function _iconePorTipo(tipo) {
  const _svg = (path, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const mapa = {
    danger:    _svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', 'var(--danger)'),
    perigo:    _svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', 'var(--danger)'),
    error:     _svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', 'var(--danger)'),
    critical:  _svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', 'var(--danger)'),
    warn:      _svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 'var(--warn)'),
    warning:   _svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 'var(--warn)'),
    aviso:     _svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 'var(--warn)'),
    info:      _svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>', 'var(--cyan)'),
    informacao:_svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>', 'var(--cyan)'),
    success:   _svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', 'var(--success)'),
    sucesso:   _svg('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>', 'var(--success)'),
  };
  return mapa[tipo] || _svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>', 'var(--cyan)');
}

/** Marca um alerta como lido */
async function marcarAlertaLido(id) {
  await API.marcarAlertaLido(id);
  const alerta = appState.alertas.find(a => a.id === id || a.Id === id);
  if (alerta) alerta.lido = true;
  renderizarAlertas();
}

/** Remove todos os alertas da sessão atual */
async function limparAlertas() {
  const confirmado = await mostrarConfirm({
    icone:    'trash-2',
    titulo:   'Limpar todos os alertas?',
    mensagem: 'Todos os alertas serão removidos permanentemente.',
    okLabel:  'Limpar tudo',
    okDanger: true
  });
  if (!confirmado) return;

  const resp = await API.limparTodosAlertas();
  if (resp?.sucesso) {
    appState.alertas = [];
    renderizarAlertas();
    mostrarAlerta('success', 'Alertas limpos', `${resp.removidos || 0} alerta(s) removido(s).`);
  } else {
    mostrarAlerta('error', 'Erro', 'Não foi possível limpar os alertas.');
  }
}

/** Carrega os limites de alerta salvos e preenche o formulário */
async function carregarConfiguracaoAlertas() {
  try {
    const resp = await apiFetch('/api/alertas/config', { headers: headersAuth() });
    if (!resp?.sucesso) return;
    const set = (id, val) => { if (val != null) { const el = document.getElementById(id); if (el) el.value = val; } };
    set('alert-kwh-limit',  resp.limiteKwhDia);
    set('alert-cost-limit', resp.limiteCustoMes);
    set('alert-volt-min',   resp.tensaoMinima);
    set('alert-volt-max',   resp.tensaoMaxima);
  } catch (_) {}
}

/** Salva as configurações de limites de alerta na API */
async function salvarConfiguracaoAlertas() {
  const config = {
    limiteKwhDia:   parseFloat(document.getElementById('alert-kwh-limit')?.value)  || null,
    limiteCustoMes: parseFloat(document.getElementById('alert-cost-limit')?.value) || null,
    tensaoMinima:   parseFloat(document.getElementById('alert-volt-min')?.value)   || null,
    tensaoMaxima:   parseFloat(document.getElementById('alert-volt-max')?.value)   || null
  };

  const resp = await API.salvarConfiguracaoAlertas(config);

  if (resp?.sucesso) {
    alertaSucesso('Limites salvos', 'Configurações de alerta atualizadas com sucesso.');
  } else {
    alertaErro('Erro ao salvar', resp?.erro || 'Verifique se o backend está rodando.');
  }
}


// ===================================================
// ANIMAÇÃO DE PARTÍCULAS — FUNDO DA INTERFACE
// ===================================================
(function iniciarParticulas() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let largura, altura, particulas = [];

  function redimensionar() {
    largura = canvas.width = window.innerWidth;
    altura = canvas.height = window.innerHeight;
  }

  redimensionar();
  window.addEventListener('resize', redimensionar);

  // Ajustar dropdown ao redimensionar
  window.addEventListener('resize', () => {
    const menu = document.getElementById('user-dropdown');
    if (menu && menu.classList.contains('active')) {
      ajustarPosicaoDropdown();
    }
  });

  // Reduz a quantidade de partículas em telas menores para melhorar performance
  const quantidadeParticulas = window.innerWidth < 768 ? 15 : 30;

  for (let i = 0; i < quantidadeParticulas; i++) {
    particulas.push({
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      raio: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.5 + 0.1
    });
  }

  let ultimoFrame = 0;
  const fpsLimitado = 30;

  function desenhar(tempoAtual) {
    // Limita a taxa de atualização para 30 FPS
    if (tempoAtual - ultimoFrame < 1000 / fpsLimitado) {
      requestAnimationFrame(desenhar);
      return;
    }
    ultimoFrame = tempoAtual;

    ctx.clearRect(0, 0, largura, altura);

    particulas.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Reinicia a posição ao sair da tela
      if (p.x < 0) p.x = largura;
      if (p.x > largura) p.x = 0;
      if (p.y < 0) p.y = altura;
      if (p.y > altura) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${p.alpha})`;
      ctx.fill();
    });

    // Desenha linhas entre partículas próximas (com limite de conexões para performance)
    const maxConexoes = 100;
    let conexoes = 0;

    for (let i = 0; i < particulas.length && conexoes < maxConexoes; i++) {
      for (let j = i + 1; j < particulas.length && conexoes < maxConexoes; j++) {
        const dx = particulas[i].x - particulas[j].x;
        const dy = particulas[i].y - particulas[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particulas[i].x, particulas[i].y);
          ctx.lineTo(particulas[j].x, particulas[j].y);
          ctx.strokeStyle = `rgba(0,87,255,${0.05 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          conexoes++;
        }
      }
    }

    requestAnimationFrame(desenhar);
  }

  desenhar(0);
})();


// ===================================================
// MOTOR DE CONEXÃO ESP32
// ===================================================
let estadoESP32 = {
  conectado: false,
  protocolo: 'ws',
  ws: null,
  intervaloHTTP: null,
  portaSerial: null,
  leitorSerial: null,
  tempoConexao: null,
  pacotesRecebidos: 0,
  intervaloUptime: null,
  metricaGrafico: 'volts',
  rotulos: [],
  dados: [],
  ultimoPacote: null
};

let graficoESP32 = null;


// --- Seleção de protocolo de comunicação ---

/**
 * Seleciona o protocolo de comunicação com o ESP32.
 * @param {string} protocolo - 'ws', 'http', 'mqtt' ou 'serial'
 */
function selecionarProtocolo(protocolo) {
  estadoESP32.protocolo = protocolo;

  ['ws', 'http', 'mqtt', 'serial'].forEach(p => {
    const fields = document.getElementById('fields-' + p);
    const btn    = document.getElementById('proto-' + p);
    if (fields) fields.style.display = p === protocolo ? '' : 'none';
    if (btn)    btn.classList.toggle('active', p === protocolo);
  });

  const nomeProtocolo = {
    ws: 'WebSocket',
    http: 'HTTP Polling',
    mqtt: 'MQTT',
    serial: 'Serial/USB'
  };
  const labelEl = document.getElementById('conn-proto-label');
  if (labelEl) labelEl.textContent = nomeProtocolo[protocolo];

  atualizarCrachassBibliotecas(protocolo);
  atualizarVisualizacaoURL();
}

/** Atualiza a pré-visualização da URL de conexão WebSocket */
function atualizarVisualizacaoURL() {
  const ipEl      = document.getElementById('esp-ip');
  const portaEl   = document.getElementById('esp-port-ws');
  const pathEl    = document.getElementById('esp-ws-path');
  const previewEl = document.getElementById('esp-url-preview');
  if (!previewEl) return;
  const ip    = ipEl?.value    || '192.168.1.100';
  const porta = portaEl?.value || '81';
  const path  = pathEl?.value  || '/ws';
  previewEl.textContent = `ws://${ip}:${porta}${path}`;
}

// Atualiza a URL em tempo real ao digitar nos campos
['esp-ip', 'esp-port-ws', 'esp-ws-path'].forEach(idCampo => {
  const elemento = document.getElementById(idCampo);
  if (elemento) elemento.addEventListener('input', atualizarVisualizacaoURL);
});

// Sincroniza o IP do HTTP com o campo OTA
const _espIpHttp = document.getElementById('esp-ip-http');
const _otaIp     = document.getElementById('ota-ip');
if (_espIpHttp && _otaIp) {
  _espIpHttp.addEventListener('input', () => { _otaIp.value = _espIpHttp.value; });
}

/**
 * Atualiza os crachás de bibliotecas necessárias conforme o protocolo selecionado.
 * @param {string} protocolo - Protocolo de comunicação selecionado
 */
function atualizarCrachassBibliotecas(protocolo) {
  const bibliotecas = {
    ws: ['WebSockets (Markus Sattler)', 'ArduinoJson', 'PZEM-004T-v30'],
    http: ['WebServer (built-in)', 'ArduinoJson', 'PZEM-004T-v30'],
    mqtt: ['PubSubClient', 'ArduinoJson', 'PZEM-004T-v30'],
    serial: ['ArduinoJson', 'PZEM-004T-v30']
  };
  const cores = ['tag-blue', 'tag-blue', 'tag-cyan', 'tag-cyan'];

  const libsEl = document.getElementById('libs-needed');
  if (!libsEl) return;
  libsEl.innerHTML =
    (bibliotecas[protocolo] || bibliotecas.ws).map((lib, i) =>
      `<span class="tag ${cores[i] || 'tag-blue'}">${lib}</span>`
    ).join('');
}


// --- Abas de código de referência ---

/**
 * Exibe a aba de código de firmware do ESP32 selecionada.
 * @param {string} aba - 'ws', 'http' ou 'mqtt'
 */
function exibirAbaCodigo(aba) {
  ['ws', 'http', 'mqtt'].forEach(t => {
    const panel = document.getElementById('codetab-' + t);
    const btn   = document.getElementById('code-tab-' + t);
    if (panel) panel.style.display = t === aba ? '' : 'none';
    if (btn)   btn.classList.toggle('active', t === aba);
  });
}

/**
 * Copia o conteúdo de um bloco de código para a área de transferência.
 * @param {string} idElemento - ID do elemento pre que contém o código
 */
function copiarCodigo(idElemento) {
  const texto = document.getElementById(idElemento).textContent;
  navigator.clipboard.writeText(texto).then(() => {
    registrarTerminal('Código copiado para a área de transferência', 'success');
  });
}

/** Gera e injeta os códigos de firmware com os dados reais do formulário */
function preencherCodigo() {
  const ssid      = document.getElementById('fw-ssid')?.value.trim()       || 'SUA_REDE_WIFI';
  const pass      = document.getElementById('fw-pass')?.value.trim()       || 'SUA_SENHA_WIFI';
  const deviceId  = document.getElementById('esp-device-id')?.value.trim() || 'MONITECH-001';
  const intervalo = parseInt(document.getElementById('esp-poll-interval')?.value) || 2000;

  const elWS   = document.getElementById('code-ws');
  const elHTTP = document.getElementById('code-http');
  const elMQTT = document.getElementById('code-mqtt');

  if (elWS)   elWS.textContent   = _fwWS(ssid, pass, deviceId);
  if (elHTTP) elHTTP.textContent = _fwHTTP(intervalo);
  if (elMQTT) elMQTT.textContent = _fwMQTT(ssid, pass, deviceId, intervalo);
}

function _fwHTTP(intervalo) {
  return `#include <WiFi.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Update.h>
#include <ArduinoJson.h>
// #include <PZEM004Tv30.h>   // Descomente para usar o sensor PZEM-004T

// ── Configurações fixas do dispositivo ───────────────────────
const char* AP_SSID  = "MONITECH-SETUP";   // rede de configuração
const char* AP_PASS  = "monitech123";       // senha da rede de configuração
const char* FW_VER   = "1.0.0";
const int   INTERVALO = ${intervalo};

// ── Estado ────────────────────────────────────────────────────
Preferences   prefs;
WebServer     webServer(80);
unsigned long ultimoEnvio = 0;
String        gServerUrl;   // ex: http://192.168.1.50:5000
String        gToken;       // token do dispositivo
String        gDeviceId;    // derivado do endereço MAC
// PZEM004Tv30 pzem(Serial2, 16, 17);

// ── Leituras (substituir pelos métodos reais do PZEM-004T) ───
float lerVolts()  { return 0; }  // return pzem.voltage();
float lerAmps()   { return 0; }  // return pzem.current();
float lerWatts()  { return 0; }  // return pzem.power();
float lerFP()     { return 0; }  // return pzem.pf();
float lerHz()     { return 0; }  // return pzem.frequency();
float lerKwh()    { return 0; }  // return pzem.energy();

// ── Página HTML de configuração ───────────────────────────────
const char* HTML_CONFIG = R"rawhtml(
<!DOCTYPE html><html><head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Monitech — Configuracao</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:sans-serif;background:#0a0f1e;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
  .card{background:#1a2035;border-radius:14px;padding:32px;width:100%;max-width:380px}
  .logo{color:#00d4ff;font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:4px}
  .sub{color:#8899aa;font-size:12px;margin-bottom:20px;line-height:1.5}
  .sec{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#00d4ff;margin-bottom:12px;margin-top:20px;border-top:1px solid #2a3550;padding-top:16px}
  .sec:first-of-type{margin-top:0;border-top:none;padding-top:0}
  label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8899aa;margin-bottom:5px}
  input{width:100%;padding:11px;border-radius:8px;border:1px solid #2a3550;background:#0d1829;color:#fff;font-size:14px;margin-bottom:14px}
  input:focus{outline:none;border-color:#00d4ff}
  .hint{font-size:11px;color:#556677;margin-top:-10px;margin-bottom:14px}
  button{width:100%;padding:13px;border-radius:8px;background:linear-gradient(135deg,#1a7eff,#00d4ff);color:#fff;font-size:15px;font-weight:700;border:none;cursor:pointer;letter-spacing:1px;margin-top:8px}
</style>
</head><body>
<div class='card'>
  <div class='logo'>MONITECH</div>
  <div class='sub'>Preencha os dados para configurar o dispositivo.</div>
  <form action='/salvar' method='POST'>
    <div class='sec'>Rede Wi-Fi</div>
    <label>Nome da rede (SSID)</label>
    <input name='ssid' placeholder='Ex: MinhaRedeCasa' required autocomplete='off'>
    <label>Senha da rede</label>
    <input name='senha' type='password' placeholder='Senha do Wi-Fi' autocomplete='off'>
    <div class='sec'>Servidor Monitech</div>
    <label>URL do Servidor</label>
    <input name='serverUrl' placeholder='Ex: http://192.168.1.50:5000' required autocomplete='off'>
    <div class='hint'>IP do computador na rede local</div>
    <label>Token do Dispositivo</label>
    <input name='token' placeholder='Token gerado pelo sistema' required autocomplete='off'>
    <div class='hint'>Encontrado no painel Monitech</div>
    <button type='submit'>SALVAR E CONECTAR</button>
  </form>
</div>
</body></html>
)rawhtml";

// ── Salva configurações e reinicia ────────────────────────────
void handleSalvar() {
  String ssid      = webServer.arg("ssid");
  String senha     = webServer.arg("senha");
  String serverUrl = webServer.arg("serverUrl");
  String token     = webServer.arg("token");
  if (ssid.length() == 0 || serverUrl.length() == 0 || token.length() == 0) {
    webServer.send(400, "text/plain", "Campos obrigatorios em falta");
    return;
  }

  prefs.begin("cfg", false);
  prefs.putString("ssid",      ssid);
  prefs.putString("senha",     senha);
  prefs.putString("serverUrl", serverUrl);
  prefs.putString("token",     token);
  prefs.end();

  webServer.send(200, "text/html",
    "<!DOCTYPE html><html><body style='font-family:sans-serif;background:#0a0f1e;color:#fff;"
    "display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center'>"
    "<div><div style='color:#00ff88;font-size:48px;margin-bottom:16px'>&#10003;</div>"
    "<h2 style='color:#00d4ff'>Configurado!</h2>"
    "<p style='color:#8899aa;margin-top:8px'>O dispositivo vai reiniciar e se conectar a sua rede.</p></div></body></html>");
  delay(2000);
  ESP.restart();
}

// ── Modo AP: portal de configuração ──────────────────────────
void modoConfiguracao() {
  Serial.println("[MONITECH] Iniciando modo de configuracao...");
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.print("[MONITECH] Rede Wi-Fi criada: "); Serial.println(AP_SSID);
  Serial.print("[MONITECH] Senha: ");             Serial.println(AP_PASS);
  Serial.print("[MONITECH] Acesse: http://");     Serial.println(WiFi.softAPIP());

  webServer.on("/",       HTTP_GET,  []() { webServer.send(200, "text/html", HTML_CONFIG); });
  webServer.on("/salvar", HTTP_POST, handleSalvar);
  webServer.onNotFound(   []() { webServer.sendHeader("Location", "/"); webServer.send(302); });
  webServer.begin();

  while (true) { webServer.handleClient(); delay(1); }
}

// ── Conecta ao Wi-Fi salvo ────────────────────────────────────
bool conectarWifi(const String& ssid, const String& senha) {
  Serial.printf("[MONITECH] Conectando a: %s\\n", ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), senha.c_str());
  for (int i = 0; i < 24 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[MONITECH] IP: "); Serial.println(WiFi.localIP());
    return true;
  }
  Serial.println("[MONITECH] Falha ao conectar.");
  return false;
}

// ── Envia leitura para o servidor ─────────────────────────────
void enviarMedicao() {
  if (WiFi.status() != WL_CONNECTED) return;
  StaticJsonDocument<320> doc;
  doc["dispositivoId"]  = gDeviceId;
  doc["token"]          = gToken;
  doc["tensao"]         = lerVolts();
  doc["corrente"]       = lerAmps();
  doc["potencia"]       = lerWatts();
  doc["energiKwh"]      = lerKwh();
  doc["fatorPotencia"]  = lerFP();
  doc["frequencia"]     = lerHz();
  doc["rssiDbm"]        = (short)WiFi.RSSI();
  doc["heapLivre"]      = (int)ESP.getFreeHeap();
  doc["ip"]             = WiFi.localIP().toString();
  doc["ssidWifi"]       = WiFi.SSID();
  doc["versaoFirmware"] = FW_VER;
  String payload;
  serializeJson(doc, payload);
  HTTPClient http;
  http.begin(gServerUrl + "/api/medicoes");
  http.addHeader("Content-Type", "application/json");
  int codigo = http.POST(payload);
  Serial.printf("[MONITECH] POST /api/medicoes -> HTTP %d\\n", codigo);
  http.end();
}

// ── OTA via browser (sem cabo USB) ───────────────────────────
void configurarOTA() {
  webServer.on("/update", HTTP_OPTIONS, []() {
    webServer.sendHeader("Access-Control-Allow-Origin",  "*");
    webServer.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    webServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    webServer.send(204);
  });
  webServer.on("/ota-check", HTTP_OPTIONS, []() {
    webServer.sendHeader("Access-Control-Allow-Origin",  "*");
    webServer.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    webServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    webServer.send(204);
  });
  webServer.on("/ota-check", HTTP_POST, []() {
    webServer.sendHeader("Access-Control-Allow-Origin", "*");
    webServer.send(200, "text/plain", "OK");
    delay(100);
    WiFiClient client;
    t_httpUpdate_return ret = httpUpdate.update(client, gServerUrl + "/api/firmware");
    if (ret != HTTP_UPDATE_OK) ESP.restart();
  });
  webServer.on("/update", HTTP_POST,
    []() {
      webServer.sendHeader("Access-Control-Allow-Origin", "*");
      webServer.send(200, "text/plain", !Update.hasError() ? "OK" : "FALHA");
      delay(500); ESP.restart();
    },
    []() {
      HTTPUpload& upload = webServer.upload();
      if      (upload.status == UPLOAD_FILE_START) { Update.begin(UPDATE_SIZE_UNKNOWN); }
      else if (upload.status == UPLOAD_FILE_WRITE) { Update.write(upload.buf, upload.currentSize); }
      else if (upload.status == UPLOAD_FILE_END)   { Update.end(true); }
    }
  );
  webServer.begin();
  Serial.println("[MONITECH] OTA ativo em http://" + WiFi.localIP().toString());
}

void setup() {
  Serial.begin(115200);

  // Deriva ID unico do endereco MAC
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char macStr[13];
  sprintf(macStr, "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  gDeviceId = String("ESP32-") + macStr;
  Serial.print("[MONITECH] Device ID: "); Serial.println(gDeviceId);

  // Le configuracoes salvas na memoria
  prefs.begin("cfg", true);
  String wifiSsid  = prefs.getString("ssid",      "");
  String wifiSenha = prefs.getString("senha",     "");
  gServerUrl       = prefs.getString("serverUrl", "");
  gToken           = prefs.getString("token",     "");
  prefs.end();

  // Se falta alguma configuracao ou a conexao falhar -> modo de configuracao
  if (wifiSsid.isEmpty() || gServerUrl.isEmpty() || gToken.isEmpty() || !conectarWifi(wifiSsid, wifiSenha)) {
    modoConfiguracao();  // nunca retorna — reinicia apos salvar
  }

  configurarOTA();
}

void loop() {
  webServer.handleClient();
  if (millis() - ultimoEnvio >= INTERVALO) {
    enviarMedicao();
    ultimoEnvio = millis();
  }
}`;
}

function _fwWS(ssid, pass, deviceId) {
  return `#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
// #include <PZEM004Tv30.h>

const char* SSID      = "${ssid}";
const char* PASSWORD  = "${pass}";
const char* DEVICE_ID = "${deviceId}";
const char* FW_VER    = "1.0.0";

WebSocketsServer ws(81);
// PZEM004Tv30 pzem(Serial2, 16, 17);
unsigned long ultimoEnvio = 0;
const int INTERVALO = 2000;

float lerVolts()  { return 0; }  // return pzem.voltage();
float lerAmps()   { return 0; }  // return pzem.current();
float lerWatts()  { return 0; }  // return pzem.power();
float lerFP()     { return 0; }  // return pzem.pf();
float lerHz()     { return 0; }  // return pzem.frequency();
float lerKwh()    { return 0; }  // return pzem.energy();

void enviarDados() {
  StaticJsonDocument<256> doc;
  doc["id"]     = DEVICE_ID;
  doc["fw"]     = FW_VER;
  doc["chip"]   = ESP.getEfuseMac();
  doc["ip"]     = WiFi.localIP().toString();
  doc["ssid"]   = WiFi.SSID();
  doc["rssi"]   = WiFi.RSSI();
  doc["heap"]   = ESP.getFreeHeap();
  doc["sensor"] = "Leitor Monitech";
  doc["volts"]  = lerVolts();
  doc["amps"]   = lerAmps();
  doc["watts"]  = lerWatts();
  doc["pf"]     = lerFP();
  doc["hz"]     = lerHz();
  doc["kwh"]    = lerKwh();
  doc["ts"]     = millis();
  String payload;
  serializeJson(doc, payload);
  ws.broadcastTXT(payload);
}

void eventoWS(uint8_t num, WStype_t tipo, uint8_t* payload, size_t tamanho) {
  if (tipo == WStype_CONNECTED) enviarDados();
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(SSID, PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  ws.begin();
  ws.onEvent(eventoWS);
}

void loop() {
  ws.loop();
  if (millis() - ultimoEnvio >= INTERVALO) { enviarDados(); ultimoEnvio = millis(); }
}`;
}

function _fwMQTT(ssid, pass, deviceId, intervalo) {
  return `#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
// #include <PZEM004Tv30.h>

const char* SSID        = "${ssid}";
const char* PASSWORD    = "${pass}";
const char* MQTT_SERVER = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* TOPICO      = "MONITECH/home/energy";
const char* DEVICE_ID   = "${deviceId}";
const int   INTERVALO   = ${intervalo};

WiFiClient   espClient;
PubSubClient mqtt(espClient);
// PZEM004Tv30 pzem(Serial2, 16, 17);
unsigned long ultimaMensagem = 0;

float lerVolts()  { return 0; }  // return pzem.voltage();
float lerAmps()   { return 0; }  // return pzem.current();
float lerWatts()  { return 0; }  // return pzem.power();
float lerFP()     { return 0; }  // return pzem.pf();
float lerHz()     { return 0; }  // return pzem.frequency();
float lerKwh()    { return 0; }  // return pzem.energy();

void reconectar() {
  while (!mqtt.connected()) {
    if (mqtt.connect(DEVICE_ID)) mqtt.publish(TOPICO "/status", "online");
    else delay(3000);
  }
}

void publicarDados() {
  StaticJsonDocument<256> doc;
  doc["id"]    = DEVICE_ID;
  doc["volts"] = lerVolts(); doc["amps"]  = lerAmps();
  doc["watts"] = lerWatts(); doc["pf"]    = lerFP();
  doc["hz"]    = lerHz();    doc["kwh"]   = lerKwh();
  doc["rssi"]  = WiFi.RSSI(); doc["ts"]  = millis();
  char buf[256];
  serializeJson(doc, buf);
  mqtt.publish(TOPICO, buf);
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(SSID, PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
}

void loop() {
  if (!mqtt.connected()) reconectar();
  mqtt.loop();
  if (millis() - ultimaMensagem > INTERVALO) { publicarDados(); ultimaMensagem = millis(); }
}`;
}

/** Abre/fecha o painel avançado de OTA */
function toggleOtaAvancado(btn) {
  const painel  = document.getElementById('ota-avancado');
  const chevron = btn.querySelector('.ota-chevron');
  const aberto  = painel.style.display !== 'none';
  painel.style.display = aberto ? 'none' : '';
  chevron?.classList.toggle('open', !aberto);
}

/** Carrega versão disponível no servidor e versão instalada no dispositivo */
// ── Upload de firmware (admin) ────────────────────────────────
let _fwUploadFile = null;

function fwDropHandler(e) {
  e.preventDefault();
  document.getElementById('fw-dropzone')?.classList.remove('fw-dropzone--drag');
  const file = e.dataTransfer?.files?.[0];
  if (file) _fwSetFile(file);
}

function fwFileSelected(input) {
  const file = input.files?.[0];
  if (file) _fwSetFile(file);
}

function _fwSetFile(file) {
  if (!file.name.toLowerCase().endsWith('.bin')) {
    mostrarToast('Selecione um arquivo .bin gerado pelo Arduino IDE (Sketch > Export Compiled Binary).', 'aviso');
    return;
  }
  _fwUploadFile = file;
  const dropText = document.getElementById('fw-drop-text');
  const dropSub  = document.getElementById('fw-drop-sub');
  const btn      = document.getElementById('btn-fw-upload');
  const zone     = document.getElementById('fw-dropzone');
  if (dropText) dropText.textContent = file.name;
  if (dropSub)  dropSub.textContent  = `${(file.size / 1024).toFixed(1)} KB`;
  if (btn)      btn.disabled = false;
  if (zone)     zone.classList.add('fw-dropzone--ready');
}

async function uploadFirmware() {
  if (!_fwUploadFile) return;
  const btn     = document.getElementById('btn-fw-upload');
  const status  = document.getElementById('fw-upload-status');
  const versao  = document.getElementById('fw-upload-ver')?.value?.trim() || '1.0.0';

  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  if (status) { status.textContent = ''; }

  try {
    const form = new FormData();
    form.append('arquivo', _fwUploadFile);
    form.append('versao', versao);

    const resp = await fetch('/api/firmware/upload', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${obterToken()}` },
      body:    form
    });
    const data = await resp.json();

    if (data.sucesso) {
      if (status) { status.textContent = `✓ ${data.mensagem}`; status.style.color = 'var(--success)'; }
      _fwUploadFile = null;
      const dropText = document.getElementById('fw-drop-text');
      const dropSub  = document.getElementById('fw-drop-sub');
      const zone     = document.getElementById('fw-dropzone');
      const input    = document.getElementById('fw-upload-input');
      if (dropText) dropText.textContent = 'Arraste o .bin aqui ou clique para selecionar';
      if (dropSub)  dropSub.textContent  = '';
      if (zone)     zone.classList.remove('fw-dropzone--ready');
      if (input)    input.value = '';
      carregarInfoFirmware();
    } else {
      if (status) { status.textContent = data.erro || 'Erro ao enviar.'; status.style.color = 'var(--danger)'; }
    }
  } catch (err) {
    console.error('[FW Upload]', err);
    if (status) { status.textContent = 'Erro de conexão.'; status.style.color = 'var(--danger)'; }
  } finally {
    if (btn) {
      btn.disabled = !_fwUploadFile;
      btn.innerHTML = '<i data-lucide="upload"></i> Publicar para usuários';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

async function carregarInfoFirmware() {
  const elAtual   = document.getElementById('ota-fw-atual');
  const elServer  = document.getElementById('ota-fw-server');
  const btnUpdate = document.getElementById('btn-ota-auto');

  // Versão instalada: vem das infos do dispositivo conectado
  const fwAtual = document.getElementById('esp-fw')?.textContent?.trim();
  if (elAtual) elAtual.textContent = (fwAtual && fwAtual !== '---') ? fwAtual : 'Desconhecido';

  // Versão no servidor
  try {
    const resp = await fetch('/api/firmware/info');
    const info = await resp.json();
    if (elServer) elServer.textContent = info.disponivel ? `v${info.versao}` : 'Nenhuma';
    if (btnUpdate) btnUpdate.disabled = !info.disponivel;
  } catch {
    if (elServer) elServer.textContent = 'Erro';
  }
}

/** Verifica se o firmware do dispositivo está atualizado */
async function verificarAtualizacaoFirmware() {
  const btn    = document.getElementById('btn-ota-auto');
  const result = document.getElementById('ota-check-result');

  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Verificando...'; lucide.createIcons(); }
  if (result) result.style.display = 'none';

  try {
    const resp = await fetch('/api/firmware/info');
    const info = await resp.json();

    const fwDispositivo = appState.sensor?.versaoFirmware ?? document.getElementById('esp-fw')?.textContent?.trim();
    const fwServidor    = info.versao;

    // Atualiza os dois cards de versão
    const elAtual  = document.getElementById('ota-fw-atual');
    const elServer = document.getElementById('ota-fw-server');
    if (elAtual)  elAtual.textContent  = fwDispositivo ? `v${fwDispositivo}` : 'Desconhecido';
    if (elServer) elServer.textContent = info.disponivel ? `v${fwServidor}` : 'Nenhuma publicada';

    if (!fwDispositivo || fwDispositivo === '---') {
      result.style.cssText = 'display:block;background:rgba(255,180,0,.1);border:1px solid rgba(255,180,0,.3);color:#f5a623;margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.5;';
      result.innerHTML = '<strong>⚠ Dispositivo offline ou sem versão registrada.</strong><br>Conecte o Dispositivo Monitech à sua rede e tente novamente.';
    } else if (!info.disponivel) {
      result.style.cssText = 'display:block;background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.25);color:var(--text-secondary);margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.5;';
      result.innerHTML = `<strong>ℹ Nenhuma atualização publicada.</strong><br>Versão instalada: <strong>v${fwDispositivo}</strong>.`;
    } else if (fwDispositivo === fwServidor) {
      result.style.cssText = 'display:block;background:rgba(0,180,122,.1);border:1px solid rgba(0,180,122,.3);color:#00b47a;margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.5;';
      result.innerHTML = `<strong>✓ Dispositivo atualizado.</strong><br>Versão instalada: <strong>v${fwDispositivo}</strong> — a mais recente disponível.`;
    } else {
      result.style.cssText = 'display:block;background:rgba(255,100,0,.1);border:1px solid rgba(255,100,0,.3);color:#ff7043;margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.5;';
      result.innerHTML = `<strong>⬆ Atualização disponível: v${fwServidor}</strong><br>Versão instalada: v${fwDispositivo}. Use a <strong>Instalação manual</strong> abaixo para atualizar.`;
    }
  } catch {
    if (result) {
      result.style.cssText = 'display:block;background:rgba(220,0,0,.1);border:1px solid rgba(220,0,0,.3);color:#f44;margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;';
      result.innerHTML = 'Erro ao verificar. Tente novamente em instantes.';
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw"></i> Verificar Atualização'; lucide.createIcons(); }
  }
}

/** Instala atualização automaticamente pelo Wi-Fi (sem arquivo) */
async function atualizarDispositivo() {
  const ip    = document.getElementById('ota-ip')?.value.trim()    || document.getElementById('esp-ip-http')?.value.trim() || '192.168.1.100';
  const porta = document.getElementById('ota-porta')?.value.trim() || document.getElementById('esp-port-http')?.value.trim() || '80';
  const btn   = document.getElementById('btn-ota-auto');
  const wrap  = document.getElementById('ota-progress-wrap');
  const bar   = document.getElementById('ota-progress-bar');
  const status = document.getElementById('ota-status');

  // Pede ao ESP32 para baixar e gravar o firmware direto do servidor
  const serverOrigin = window.location.origin;
  const firmwareUrl  = `${serverOrigin}/api/firmware`;

  wrap.style.display  = '';
  btn.disabled        = true;
  bar.style.width     = '5%';
  bar.style.background = '';
  status.style.color  = '';
  status.textContent  = 'Conectando ao dispositivo...';
  registrarTerminal(`OTA automático → http://${ip}:${porta}/ota-check`, 'info');

  try {
    const resp = await fetch(`http://${ip}:${porta}/ota-check`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url: firmwareUrl })
    });

    if (resp.ok) {
      bar.style.width = '30%';
      status.textContent = 'Dispositivo baixando firmware... aguarde (~30s)';
      // Aguarda o ESP32 reiniciar e reporta sucesso
      setTimeout(() => {
        bar.style.width     = '100%';
        bar.style.background = 'linear-gradient(90deg,#00b47a,#00ff9d)';
        status.style.color   = 'var(--success)';
        status.textContent   = '✓ Firmware instalado! O dispositivo está reiniciando.';
        btn.disabled = false;
        registrarTerminal('OTA automático concluído.', 'success');
      }, 30000);
    } else {
      throw new Error(`HTTP ${resp.status}`);
    }
  } catch {
    // Fallback: envia o .bin diretamente (mesmo fluxo do manual)
    status.textContent = 'Modo direto: buscando firmware do servidor...';
    bar.style.width    = '15%';

    try {
      const binResp = await fetch('/api/firmware');
      if (!binResp.ok) throw new Error('Firmware não disponível no servidor.');
      const blob = await binResp.blob();

      const formData = new FormData();
      formData.append('update', blob, 'monitech.bin');

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        bar.style.width    = pct + '%';
        status.textContent = `Enviando para o dispositivo... ${pct}%`;
      };
      xhr.onload = () => {
        btn.disabled = false;
        if (xhr.status === 200 && xhr.responseText.trim() === 'OK') {
          bar.style.width     = '100%';
          bar.style.background = 'linear-gradient(90deg,#00b47a,#00ff9d)';
          status.style.color   = 'var(--success)';
          status.textContent   = '✓ Atualização concluída! O dispositivo está reiniciando.';
          registrarTerminal('OTA concluído com sucesso.', 'success');
        } else {
          status.style.color  = 'var(--danger)';
          status.textContent  = 'Falha na instalação. Tente novamente.';
        }
      };
      xhr.onerror = () => {
        btn.disabled = false;
        status.style.color  = 'var(--danger)';
        status.textContent  = 'Não foi possível conectar ao dispositivo. Verifique se está na mesma rede Wi-Fi.';
        registrarTerminal(`OTA: dispositivo não encontrado em ${ip}:${porta}`, 'error');
      };
      xhr.open('POST', `http://${ip}:${porta}/update`);
      xhr.send(formData);
    } catch (e) {
      btn.disabled = false;
      status.style.color  = 'var(--danger)';
      status.textContent  = e.message || 'Erro ao buscar firmware.';
    }
  }
}

/** Envia firmware .bin para o ESP32 via OTA (sem cabo USB) */
async function enviarOTA() {
  const fileInput = document.getElementById('ota-file-input');
  const arquivo   = fileInput?.files?.[0];
  if (!arquivo) { mostrarToast('Selecione o arquivo .bin antes de enviar.', 'aviso'); return; }

  const ip    = document.getElementById('ota-ip')?.value.trim()    || '192.168.1.100';
  const porta = document.getElementById('ota-porta')?.value.trim() || '80';
  const url   = `http://${ip}:${porta}/update`;

  const wrap   = document.getElementById('ota-progress-wrap');
  const bar    = document.getElementById('ota-progress-bar');
  const status = document.getElementById('ota-status');
  const btn    = document.getElementById('btn-ota-enviar');

  wrap.style.display = '';
  btn.disabled = true;
  bar.style.width = '0%';
  status.textContent = 'Conectando ao dispositivo...';
  status.style.color = '';

  const formData = new FormData();
  formData.append('update', arquivo, arquivo.name);

  const xhr = new XMLHttpRequest();

  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    bar.style.width = pct + '%';
    status.textContent = `Enviando firmware... ${pct}%  (${(e.loaded / 1024).toFixed(0)} / ${(e.total / 1024).toFixed(0)} KB)`;
  };

  xhr.onload = () => {
    btn.disabled = false;
    if (xhr.status === 200 && xhr.responseText.trim() === 'OK') {
      bar.style.width = '100%';
      bar.style.background = 'linear-gradient(90deg,#00b47a,#00ff9d)';
      status.style.color = 'var(--success)';
      status.textContent = '✓ Firmware atualizado com sucesso! O dispositivo está reiniciando...';
      registrarTerminal('OTA concluído — firmware enviado e dispositivo reiniciando.', 'success');
    } else {
      status.style.color = 'var(--danger)';
      status.textContent = 'Erro: ' + (xhr.responseText || `HTTP ${xhr.status}`);
      registrarTerminal('Erro OTA: ' + xhr.responseText, 'error');
    }
  };

  xhr.onerror = () => {
    btn.disabled = false;
    status.style.color = 'var(--danger)';
    status.textContent = 'Falha de conexão. Verifique o IP, a porta e se o ESP32 está na mesma rede.';
    registrarTerminal('OTA: erro de rede — verifique se o ESP32 está acessível em ' + url, 'error');
  };

  xhr.open('POST', url);
  xhr.send(formData);
  registrarTerminal(`OTA iniciado → ${url}  (${(arquivo.size / 1024).toFixed(1)} KB)`, 'info');
}

/** Faz download do código de firmware como arquivo .ino */
function baixarFirmware(protocolo) {
  const idMap = { ws: 'code-ws', http: 'code-http', mqtt: 'code-mqtt' };
  const codigo = document.getElementById(idMap[protocolo])?.textContent;
  if (!codigo?.trim()) { mostrarToast('Atualize o código primeiro.', 'aviso'); return; }

  const deviceId = document.getElementById('esp-device-id')?.value.trim() || 'monitech';
  const nome = `monitech_${protocolo}_${deviceId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const blob = new Blob([codigo], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${nome}.ino`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  registrarTerminal(`Firmware ${nome}.ino baixado`, 'success');
}


// --- Terminal de Log ---

/**
 * Registra uma mensagem no terminal de log da conexão ESP32.
 * @param {string} mensagem - Texto a exibir
 * @param {string} tipo     - 'info', 'success', 'error', 'warn' ou 'data'
 */
function registrarTerminal(mensagem, tipo = 'info') {
  const terminal = document.getElementById('esp-terminal');

  const cores = {
    info: 'var(--text-secondary)',
    success: 'var(--success)',
    error: 'var(--danger)',
    warn: 'var(--warn)',
    data: 'var(--cyan)'
  };
  const prefixos = {
    info: '[i]',
    success: '[ok]',
    error: '[x]',
    warn: '[!]',
    data: '[>]'
  };

  const horario = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  const linha = document.createElement('div');

  linha.innerHTML = `
    <span style="color:var(--text-dim);">[${horario}]</span>
    <span style="color:${cores[tipo] || cores.info};">${prefixos[tipo] || '[?]'} ${corrigirTextoCorrompido(mensagem)}</span>
  `;

  terminal.appendChild(linha);

  if (document.getElementById('esp-autoscroll').checked) {
    terminal.scrollTop = terminal.scrollHeight;
  }
}

/** Limpa o conteúdo do terminal de log */
function limparTerminal() {
  document.getElementById('esp-terminal').innerHTML = '';
  registrarTerminal('Terminal limpo com sucesso', 'info');
}


// --- Seleção de métrica do gráfico ESP32 ---

/**
 * Define a métrica exibida no gráfico de leitura ao vivo do ESP32.
 * @param {string} metrica - 'volts', 'amps' ou 'watts'
 */
function definirMetricaGraficoESP32(metrica) {
  estadoESP32.metricaGrafico = metrica;

  ['volts', 'amps', 'watts'].forEach(m => {
    document.getElementById('esp-ch-' + m).classList.toggle('active', m === metrica);
  });

  if (graficoESP32) {
    const configuracoes = {
      volts: { cor: '#1a7eff', rotulo: 'Tensão (V)' },
      amps: { cor: '#00d4ff', rotulo: 'Corrente (A)' },
      watts: { cor: '#00ff9d', rotulo: 'Potência (W)' }
    };
    const cfg = configuracoes[metrica];

    graficoESP32.data.datasets[0].label = cfg.rotulo;
    graficoESP32.data.datasets[0].borderColor = cfg.cor;
    graficoESP32.data.datasets[0].backgroundColor = cfg.cor + '18';
    graficoESP32.data.datasets[0].pointBackgroundColor = cfg.cor;
    graficoESP32.update('none');
  }
}

/** Inicializa o gráfico de leitura ao vivo do ESP32 */
function inicializarGraficoESP32() {
  if (graficoESP32) graficoESP32.destroy();

  const configuracoes = {
    volts: { cor: '#1a7eff', rotulo: 'Tensão (V)' },
    amps: { cor: '#00d4ff', rotulo: 'Corrente (A)' },
    watts: { cor: '#00ff9d', rotulo: 'Potência (W)' }
  };
  const metrica = estadoESP32.metricaGrafico;
  const cfg = configuracoes[metrica];

  graficoESP32 = new Chart(document.getElementById('chart-esp-live'), {
    type: 'line',
    data: {
      labels: estadoESP32.rotulos,
      datasets: [{
        label: cfg.rotulo,
        data: estadoESP32.dados,
        borderColor: cfg.cor,
        backgroundColor: cfg.cor + '18',
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: cfg.cor,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { labels: { color: '#7aa8cc', font: { family: 'Rajdhani', size: 12 }, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 14 } }
      },
      scales: {
        x: {
          ticks: { color: '#7aa8cc', font: { family: 'Rajdhani', size: 10 }, maxTicksLimit: 10 },
          grid: { color: 'rgba(0,212,255,0.05)' }
        },
        y: {
          ticks: { color: '#7aa8cc', font: { family: 'Rajdhani', size: 10 } },
          grid: { color: 'rgba(0,212,255,0.05)' }
        }
      }
    }
  });

  document.getElementById('esp-chart-overlay').style.display = 'none';
}

/**
 * Adiciona uma nova leitura ao gráfico ao vivo do ESP32.
 * @param {Object} dados - Objeto com os valores de volts, amps e watts
 */
function adicionarLeituraESP32(dados) {
  const valor = { volts: dados.volts, amps: dados.amps, watts: dados.watts }[estadoESP32.metricaGrafico];
  const horario = new Date().toLocaleTimeString('pt-BR', { hour12: false });

  estadoESP32.rotulos.push(horario);
  estadoESP32.dados.push(+(valor || 0).toFixed(2));

  // Mantém no máximo 60 pontos no gráfico
  if (estadoESP32.rotulos.length > 60) {
    estadoESP32.rotulos.shift();
    estadoESP32.dados.shift();
  }

  if (graficoESP32) {
    graficoESP32.data.labels = estadoESP32.rotulos;
    graficoESP32.data.datasets[0].data = estadoESP32.dados;
    graficoESP32.update('none');
  }
}


// --- Processamento de dados recebidos do ESP32 ---

/**
 * Processa um pacote JSON recebido do dispositivo ESP32.
 * @param {string} bruto - String JSON bruta recebida
 */
function processarDadosESP32(bruto) {
  let dados;

  try {
    dados = JSON.parse(bruto);
  } catch (e) {
    registrarTerminal('Pacote inválido ou mal formatado: ' + bruto, 'warn');
    return;
  }

  estadoESP32.pacotesRecebidos++;
  estadoESP32.ultimoPacote = dados;

  // Atualiza o contador de pacotes recebidos
  document.getElementById('conn-packets').textContent = estadoESP32.pacotesRecebidos;

  // Exibe o último pacote JSON na interface
  document.getElementById('esp-last-packet').textContent = JSON.stringify(dados, null, 2);

  // Sincroniza as leituras com os medidores do dashboard
  if (dados.volts !== undefined) {
    appState.dadosAoVivo.volts = +dados.volts;
    appState.dadosAoVivo.amps = +dados.amps || appState.dadosAoVivo.amps;
    appState.dadosAoVivo.watts = +dados.watts || appState.dadosAoVivo.watts;
    appState.dadosAoVivo.pf = +dados.pf || appState.dadosAoVivo.pf;
    appState.dadosAoVivo.freq = +dados.hz || appState.dadosAoVivo.freq;
    appState.dadosAoVivo.kwh = +dados.kwh || appState.dadosAoVivo.kwh;

    atualizarMarcadores(appState.dadosAoVivo);
    atualizarCartasEstatisticas(appState.dadosAoVivo);

    // Verificação de discrepância de energia (via conexão direta WebSocket/HTTP)
    verificarDiscrepanciaEnergia(appState.dadosAoVivo.watts);
  }

  // Atualiza o indicador de sinal Wi-Fi do dispositivo
  if (dados.rssi !== undefined) {
    document.getElementById('conn-rssi').textContent = dados.rssi + ' dBm';
  }

  // Exibe as informações de firmware e hardware do dispositivo
  if (dados.fw || dados.chip) {
    document.getElementById('esp-info-empty').style.display = 'none';
    document.getElementById('esp-info-data').style.display = '';

    document.getElementById('esp-fw').textContent = dados.fw || 'Desconhecido';
    document.getElementById('esp-chip').textContent = dados.chip ? '0x' + dados.chip.toString(16).toUpperCase() : 'Desconhecido';
    document.getElementById('esp-local-ip').textContent = dados.ip || 'Desconhecido';
    document.getElementById('esp-ssid').textContent = dados.ssid || 'Desconhecido';
    document.getElementById('esp-sensor').textContent = dados.sensor || 'Leitor Monitech';
    document.getElementById('esp-heap').textContent = dados.heap ? (dados.heap / 1024).toFixed(1) + ' KB' : 'Indisponível';
    document.getElementById('device-id').textContent = dados.id || '---';
  }

  if (dados.id) {
    document.getElementById('device-id').textContent = dados.id;
  }

  adicionarLeituraESP32(dados);

  registrarTerminal(
    `RX: V=${(+dados.volts || 0).toFixed(1)}V  ` +
    `A=${(+dados.amps || 0).toFixed(2)}A  ` +
    `W=${(+dados.watts || 0).toFixed(0)}W  ` +
    `kWh=${(+dados.kwh || 0).toFixed(3)}`,
    'data'
  );
}


// --- Atualização da interface de conexão ---

/**
 * Atualiza todos os elementos visuais conforme o estado de conexão.
 * @param {boolean} conectado - true = conectado, false = desconectado
 * @param {string} rotulo     - Texto do badge de status (ex: 'WS ATIVO', 'HTTP POLL')
 */
function definirEstadoConexao(conectado, rotulo = '') {
  estadoESP32.conectado = conectado;

  const badge        = document.getElementById('esp-live-badge');
  const ponto        = document.getElementById('esp-dot');
  const textoStatus  = document.getElementById('esp-live-text');
  const iconeEsp     = document.getElementById('esp-icon');
  const pontoNav     = document.getElementById('esp32-nav-dot');
  const linhaConn    = document.getElementById('conn-line');
  const pulsoConn    = document.getElementById('conn-pulse');
  const btnConectar  = document.getElementById('btn-connect');
  const btnDesconectar = document.getElementById('btn-disconnect');

  // Elementos admin-only podem não existir para usuários comuns
  if (!badge) return;

  if (conectado) {
    badge.style.cssText = 'background:rgba(0,255,157,0.1); border-color:rgba(0,255,157,0.25); color:var(--success);';
    if (ponto) ponto.style.cssText = 'width:8px; height:8px; border-radius:50%; background:var(--success); box-shadow:0 0 8px var(--success); animation:blink 2s infinite;';
    if (textoStatus) textoStatus.textContent = rotulo || 'CONECTADO';
    if (iconeEsp) { iconeEsp.style.opacity = '1'; iconeEsp.style.filter = 'drop-shadow(0 0 12px var(--cyan))'; }
    if (pontoNav) pontoNav.style.display = 'block';
    if (linhaConn) linhaConn.style.background = 'rgba(0,212,255,0.3)';
    if (pulsoConn) pulsoConn.style.display = 'block';
    if (btnConectar) btnConectar.disabled = true;
    if (btnDesconectar) btnDesconectar.disabled = false;

    // Inicia o contador de tempo ativo (uptime)
    estadoESP32.tempoConexao = Date.now();
    clearInterval(estadoESP32.intervaloUptime);

    estadoESP32.intervaloUptime = setInterval(() => {
      const segundos = Math.floor((Date.now() - estadoESP32.tempoConexao) / 1000);
      const horas = Math.floor(segundos / 3600);
      const minutos = Math.floor((segundos % 3600) / 60);
      const segs = segundos % 60;

      document.getElementById('conn-uptime').textContent =
        `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
    }, 1000);

    // Para a simulação ao vivo (dados reais do ESP32 assumem o controle)
    clearInterval(intervaloAoVivo);

  } else {
    badge.style.cssText = 'background:rgba(61,96,128,0.2); border-color:rgba(61,96,128,0.3); color:var(--text-dim);';
    if (ponto) ponto.style.cssText = 'width:8px; height:8px; border-radius:50%; background:var(--text-dim);';
    if (textoStatus) textoStatus.textContent = 'DESCONECTADO';
    if (iconeEsp) { iconeEsp.style.opacity = '0.35'; iconeEsp.style.filter = ''; }
    if (pontoNav) pontoNav.style.display = 'none';
    if (linhaConn) linhaConn.style.background = 'rgba(61,96,128,0.3)';
    if (pulsoConn) pulsoConn.style.display = 'none';
    if (btnConectar) btnConectar.disabled = false;
    if (btnDesconectar) btnDesconectar.disabled = true;

    clearInterval(estadoESP32.intervaloUptime);

    const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setT('conn-uptime', '00:00:00');
    setT('conn-latency', '--');
    setT('conn-rssi', '--');

    // Retoma a simulação ao vivo após desconexão
    iniciarSimulacaoAoVivo();
  }
}


// --- Conexão via WebSocket ---

/** Inicia uma conexão WebSocket com o dispositivo ESP32 */
function conectarWebSocket() {
  const ip = document.getElementById('esp-ip').value.trim() || '192.168.1.100';
  const porta = document.getElementById('esp-port-ws').value.trim() || '81';
  const caminho = document.getElementById('esp-ws-path').value.trim() || '/ws';
  const url = `ws://${ip}:${porta}${caminho}`;

  registrarTerminal(`Tentando conectar via WebSocket: ${url}`, 'info');
  document.getElementById('conn-latency').textContent = '...';

  try {
    const ws = new WebSocket(url);
    estadoESP32.ws = ws;
    const inicioTempo = Date.now();

    ws.onopen = () => {
      const latencia = Date.now() - inicioTempo;
      document.getElementById('conn-latency').textContent = latencia;
      registrarTerminal(`WebSocket conectado com sucesso em ${latencia}ms`, 'success');
      definirEstadoConexao(true, 'WS ATIVO');
      inicializarGraficoESP32();
    };

    ws.onmessage = (evento) => processarDadosESP32(evento.data);

    ws.onerror = () => {
      registrarTerminal(
        'Erro no WebSocket — falha ao conectar. ' +
        'Verifique o endereço IP, porta e se o ESP32 está na mesma rede Wi-Fi.',
        'error'
      );
      desconectarESP32();
    };

    ws.onclose = () => {
      registrarTerminal('Conexão WebSocket encerrada', 'warn');
      if (estadoESP32.conectado) desconectarESP32();
    };

  } catch (erro) {
    registrarTerminal('Não foi possível criar a conexão WebSocket: ' + erro.message, 'error');
  }
}


// --- Conexão via HTTP Polling ---

/** Inicia o polling HTTP para receber dados do dispositivo ESP32 */
function conectarHTTP() {
  const ip = document.getElementById('esp-ip-http').value.trim() || '192.168.1.100';
  const porta = document.getElementById('esp-port-http').value.trim() || '80';
  const caminho = document.getElementById('esp-http-path').value.trim() || '/api/data';
  const intervalo = parseInt(document.getElementById('esp-poll-interval').value) || 2000;
  const url = `http://${ip}:${porta}${caminho}`;

  registrarTerminal(`HTTP Polling iniciado: ${url} (a cada ${intervalo}ms)`, 'info');

  const buscarDados = () => {
    if (!estadoESP32.conectado) return;

    const inicio = Date.now();

    fetch(url)
      .then(resposta => resposta.json())
      .then(dados => {
        const latencia = Date.now() - inicio;
        document.getElementById('conn-latency').textContent = latencia;
        processarDadosESP32(JSON.stringify(dados));
      })
      .catch(erro => {
        registrarTerminal(
          'Erro HTTP: ' + erro.message +
          ' → Certifique-se de que o ESP32 configurou o cabeçalho Access-Control-Allow-Origin: *',
          'error'
        );
      });
  };

  definirEstadoConexao(true, 'HTTP POLL');
  inicializarGraficoESP32();

  buscarDados();
  estadoESP32.intervaloHTTP = setInterval(buscarDados, intervalo);
}


// --- Conexão via MQTT (WebSocket bridge) ---

/** Inicia a conexão MQTT com o dispositivo ESP32 */
function conectarMQTT() {
  const broker = document.getElementById('esp-mqtt-broker').value.trim() || 'broker.hivemq.com';
  const porta = document.getElementById('esp-mqtt-port').value.trim() || '8884';
  const topico = document.getElementById('esp-mqtt-topic').value.trim() || 'MONITECH/home/energy';
  const clientId = document.getElementById('esp-mqtt-cid').value.trim() || 'MONITECH-WEB';

  registrarTerminal(`MQTT via WebSocket broker: wss://${broker}:${porta}/mqtt`, 'info');
  registrarTerminal(`Tópico inscrito: ${topico} | Client ID: ${clientId}`, 'info');
  registrarTerminal(
    'Atenção: Para MQTT completo em produção, integre a biblioteca mqtt.js (npm install mqtt). Modo demonstração ativo.',
    'warn'
  );

  // Modo demonstração para MQTT.
  // Em produção: import mqtt from 'mqtt'; const client = mqtt.connect(wsUrl);
  // Os dados virão diretamente do dispositivo de monitoramento conectado.
  definirEstadoConexao(true, 'MQTT ATIVO');
  inicializarGraficoESP32();
  registrarTerminal('Conexão MQTT estabelecida. Aguardando publicações do dispositivo...', 'success');

  // TODO: Integrar com broker MQTT real via mqtt.js
}


// --- Seleção de porta Serial/USB ---

/** Solicita ao usuário que selecione uma porta serial para comunicação com o ESP32 */
async function selecionarPortaSerial() {
  if (!('serial' in navigator)) {
    registrarTerminal(
      'Web Serial API não suportada neste navegador. ' +
      'Utilize Google Chrome ou Microsoft Edge para usar esta funcionalidade.',
      'error'
    );
    return;
  }

  try {
    estadoESP32.portaSerial = await navigator.serial.requestPort();
    document.getElementById('serial-port-info').style.display = '';
    registrarTerminal('Porta serial selecionada com sucesso. Clique em CONECTAR para iniciar.', 'success');
  } catch (erro) {
    registrarTerminal('Nenhuma porta selecionada: ' + erro.message, 'warn');
  }
}


// --- Conexão via Serial/USB ---

/** Inicia a leitura de dados via porta Serial/USB */
async function conectarSerial() {
  if (!estadoESP32.portaSerial) {
    registrarTerminal('Selecione uma porta serial antes de conectar.', 'error');
    return;
  }

  const baudRate = parseInt(document.getElementById('esp-baud').value) || 115200;

  try {
    await estadoESP32.portaSerial.open({ baudRate });
    registrarTerminal(`Porta serial aberta: ${baudRate} baud`, 'success');

    definirEstadoConexao(true, 'SERIAL/USB');
    inicializarGraficoESP32();

    // Configura o leitor de stream de texto
    const decodificador = new TextDecoderStream();
    estadoESP32.portaSerial.readable.pipeTo(decodificador.writable);

    const leitor = decodificador.readable.getReader();
    estadoESP32.leitorSerial = leitor;

    let buffer = '';

    // Loop assíncrono de leitura dos dados da porta serial
    (async () => {
      while (true) {
        const { value, done } = await leitor.read();
        if (done) break;

        buffer += value;
        const linhas = buffer.split('\n');
        buffer = linhas.pop(); // mantém o fragmento incompleto no buffer

        linhas.forEach(linha => {
          linha = linha.trim();
          if (linha.startsWith('{')) {
            processarDadosESP32(linha);
          } else if (linha) {
            registrarTerminal('ESP32: ' + linha, 'info');
          }
        });
      }
    })();

  } catch (erro) {
    registrarTerminal('Erro ao abrir porta serial: ' + erro.message, 'error');
  }
}


// --- Dispatcher principal de conexão ---

/** Inicia a conexão com o ESP32 conforme o protocolo selecionado */
async function conectarESP32() {
  registrarTerminal('Iniciando conexão com o dispositivo ESP32...', 'info');

  estadoESP32.pacotesRecebidos = 0;
  document.getElementById('conn-packets').textContent = '0';

  const idDispositivo = document.getElementById('esp-device-id').value.trim() || 'MONITECH-001';
  const apelido       = document.getElementById('esp-device-alias').value.trim() || null;
  document.getElementById('device-id').textContent = idDispositivo;

  // Se o sensor ainda não está registrado, tenta registrar automaticamente
  if (appState.residencia?.id && !appState.sensor) {
    registrarTerminal('Verificando registro do sensor na API...', 'info');
    const respSensor = await API.registrarSensor({
      idResidencia: appState.residencia.id,
      idIot:        idDispositivo,
      apelido:      apelido,
      protocolo:    estadoESP32.protocolo,
      intervaloMs:  2000
    });

    if (respSensor?.sucesso) {
      appState.sensor = { id: respSensor.idSensor, idIot: respSensor.idIot };
      const token = respSensor.tokenSecreto;
      registrarTerminal(`✓ Sensor registrado! ID: ${respSensor.idIot}`, 'success');
      registrarTerminal(`TOKEN SECRETO (copie para o ESP32): ${token}`, 'success');

      // Mostra o token na UI para o usuário copiar
      const tokenEl  = document.getElementById('esp-token-display');
      const tokenBox = document.getElementById('esp-token-box');
      if (tokenEl && tokenBox) {
        tokenEl.textContent = token;
        tokenBox.style.display = '';
      }
      // Auto-preenche o código de firmware com o token gerado
      preencherCodigo();
    } else if (respSensor?.erro?.includes('já registrado')) {
      registrarTerminal('Sensor já registrado nesta residência.', 'info');
    } else {
      registrarTerminal('Aviso: ' + (respSensor?.erro || 'Sensor não registrado na API.'), 'warn');
    }
  }

  const protocolo = estadoESP32.protocolo;
  if (protocolo === 'ws')     conectarWebSocket();
  else if (protocolo === 'http')   conectarHTTP();
  else if (protocolo === 'mqtt')   conectarMQTT();
  else if (protocolo === 'serial') conectarSerial();
}


// --- Desconexão ---

/** Encerra a conexão ativa com o dispositivo ESP32 */
function desconectarESP32() {
  // Fecha o WebSocket se ativo
  if (estadoESP32.ws) {
    try { estadoESP32.ws.close(); } catch (_) { }
    estadoESP32.ws = null;
  }

  // Para o polling HTTP se ativo
  if (estadoESP32.intervaloHTTP) {
    clearInterval(estadoESP32.intervaloHTTP);
    estadoESP32.intervaloHTTP = null;
  }

  // Fecha o leitor serial se ativo
  if (estadoESP32.leitorSerial) {
    try { estadoESP32.leitorSerial.cancel(); } catch (_) { }
    estadoESP32.leitorSerial = null;
  }

  // Fecha a porta serial se aberta
  if (estadoESP32.portaSerial && estadoESP32.portaSerial.readable) {
    try { estadoESP32.portaSerial.close(); } catch (_) { }
  }

  definirEstadoConexao(false);
  registrarTerminal('Dispositivo ESP32 desconectado com sucesso.', 'warn');

  // Oculta as informações do dispositivo
  document.getElementById('esp-info-empty').style.display = '';
  document.getElementById('esp-info-data').style.display = 'none';

  // Limpa e exibe o overlay no gráfico ao vivo
  if (graficoESP32) {
    graficoESP32.data.labels = [];
    graficoESP32.data.datasets[0].data = [];
    graficoESP32.update();
  }
  document.getElementById('esp-chart-overlay').style.display = 'flex';
}


// --- Teste de conectividade (PING) ---

/** Executa um teste de conectividade com o dispositivo ESP32 */
async function verificarConexaoESP32() {
  const protocolo = estadoESP32.protocolo;

  if (protocolo === 'ws') {
    if (estadoESP32.ws && estadoESP32.ws.readyState === WebSocket.OPEN) {
      const inicio = Date.now();
      estadoESP32.ws.send(JSON.stringify({ cmd: 'ping' }));
      registrarTerminal('PING enviado via WebSocket', 'info');
      document.getElementById('conn-latency').textContent = (Date.now() - inicio) + 'ms*';
    } else {
      registrarTerminal('WebSocket não está conectado. Clique em CONECTAR primeiro.', 'error');
    }

  } else if (protocolo === 'http') {
    const ip = document.getElementById('esp-ip-http').value || '192.168.1.100';
    const porta = document.getElementById('esp-port-http').value || '80';
    const inicio = Date.now();

    fetch(`http://${ip}:${porta}/api/data`)
      .then(() => {
        const latencia = Date.now() - inicio;
        document.getElementById('conn-latency').textContent = latencia + 'ms';
        registrarTerminal(`PING OK: ${latencia}ms — dispositivo respondeu`, 'success');
      })
      .catch(erro => {
        registrarTerminal('PING falhou: ' + erro.message, 'error');
      });

  } else {
    registrarTerminal('Teste de PING disponível apenas para WebSocket e HTTP.', 'warn');
  }
}


// --- Inicialização da aba ESP32 ---

// Flag para evitar reinicialização ao trocar de aba
let esp32TabAberta = false;

/** Inicializa a aba de conexão ESP32 na primeira abertura */
async function _carregarStatusDispositivoUsuario() {
  if (isAdmin() || !appState.residencia?.id || _modoTrocarDispositivo) return;

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val ?? '—'; };

  try {
    const [rSensores, rDash] = await Promise.all([
      fetch(`/api/sensores/${appState.residencia.id}`, { headers: headersAuth() }).then(r => r.json()),
      fetch(`/api/dashboard/resumo?idResidencia=${appState.residencia.id}`, { headers: headersAuth() }).then(r => r.json())
    ]);

    const sensor = rSensores?.sensores?.[0];

    if (sensor && sensor.ultimaVisualizacao) {
      // Sensor que já enviou dados ao menos uma vez → painel de status
      _pararPollingConexao();
      _mostrarEstadoDispositivo('com-sensor');

      // Atualiza apenas informações estáticas — Online/Offline é gerenciado exclusivamente
      // pelo polling de 2,5s via _atualizarStatusCardComResposta (sincronizado com badge AO VIVO)
      set('user-device-id', sensor.idIot || null);
      set('user-fw-ver',  sensor.versaoFirmware ? `v${sensor.versaoFirmware}` : null);
      set('user-rssi',    sensor.rssiDbm ? `${sensor.rssiDbm} dBm` : null);
      set('user-modelo',  sensor.modeloSensor || sensor.apelido);
      set('user-ssid',    sensor.ssidWifi);
      set('user-ip',      sensor.enderecoIp || null);
      set('user-protocolo', sensor.protocolo ? sensor.protocolo.toUpperCase() : null);

      if (rDash?.sucesso) {
        set('user-volts', rDash.tensaoAtual   != null ? rDash.tensaoAtual.toFixed(1)   : null);
        set('user-amps',  rDash.correnteAtual != null ? rDash.correnteAtual.toFixed(2) : null);
        set('user-watts', rDash.potenciaAtual != null ? rDash.potenciaAtual.toFixed(0) : null);
        set('user-kwh',   rDash.kwhHoje       != null ? rDash.kwhHoje.toFixed(3)       : null);
        const ts = document.getElementById('user-reading-ts');
        if (ts) ts.textContent = rDash.ultimaLeitura
          ? `Atualizado: ${new Date(rDash.ultimaLeitura).toLocaleString('pt-BR')}`
          : 'Sem leituras registradas ainda.';
      }
    } else if (sensor && !sensor.ultimaVisualizacao) {
      // Sensor registrado mas ainda não conectou → mantém estado de aguardando
      _mostrarEstadoDispositivo('sem-sensor');
      _mostrarEstadoVinculacao('aguardando');
      appState.sensor = { id: sensor.id, idIot: sensor.idIot };

      // Recupera o token salvo (se a página foi recarregada)
      const tokenSalvo = appState.residencia?.id
        ? localStorage.getItem(`monitech_token_${appState.residencia.id}`)
        : null;
      const idIotSalvo = appState.residencia?.id
        ? localStorage.getItem(`monitech_idiot_${appState.residencia.id}`)
        : sensor.idIot;
      const idIotValor = document.getElementById('painel-idiot-valor');
      if (idIotValor) idIotValor.textContent = idIotSalvo ?? sensor.idIot ?? '—';
      const tokenValor   = document.getElementById('painel-token-valor');
      const avisoVazio   = document.getElementById('token-aviso-vazio');
      const avisoCopiar  = document.getElementById('token-aviso-copiar');
      const btnCopiarTok = document.getElementById('btn-copiar-token');
      if (tokenSalvo) {
        if (tokenValor)   { tokenValor.textContent = tokenSalvo; tokenValor.style.display = ''; }
        if (avisoVazio)   avisoVazio.style.display   = 'none';
        if (avisoCopiar)  avisoCopiar.style.display  = '';
        if (btnCopiarTok) btnCopiarTok.style.display = '';
      } else {
        if (tokenValor)   { tokenValor.textContent = ''; tokenValor.style.display = 'none'; }
        if (avisoVazio)   avisoVazio.style.display   = '';
        if (avisoCopiar)  avisoCopiar.style.display  = 'none';
        if (btnCopiarTok) btnCopiarTok.style.display = 'none';
      }

      if (!_pollingConexaoTimer) _iniciarPollingConexao();
    } else {
      // Sem sensor → formulário de vinculação
      _mostrarEstadoDispositivo('sem-sensor');
      _mostrarEstadoVinculacao('form');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [document.querySelector('.esp32-user-view')] });
  } catch (err) {
    console.warn('[StatusUsuario]', err);
  }
}

function _mostrarEstadoDispositivo(estado) {
  const semSensor = document.getElementById('device-sem-sensor');
  const comSensor = document.getElementById('device-com-sensor');
  if (semSensor) semSensor.style.display = estado === 'sem-sensor' ? '' : 'none';
  if (comSensor) comSensor.style.display = estado === 'com-sensor' ? '' : 'none';
}

function _mostrarEstadoVinculacao(estado) {
  const formState    = document.getElementById('device-form-state');
  const waitingState = document.getElementById('device-waiting-state');
  if (formState)    formState.style.display    = estado === 'form'      ? '' : 'none';
  if (waitingState) waitingState.style.display = estado === 'aguardando' ? '' : 'none';
  if (estado === 'aguardando') atualizarUrlServidorPainel();
}

let _modoTrocarDispositivo = false;

function mostrarVincularDispositivo() {
  _modoTrocarDispositivo = true;
  _pararPollingConexao();
  _pararStatusPolling();
  if (appState.residencia?.id) localStorage.removeItem(`monitech_token_${appState.residencia.id}`);
  _mostrarEstadoDispositivo('sem-sensor');
  _mostrarEstadoVinculacao('form');
  const cod = document.getElementById('painel-codigo-iot');
  const ape = document.getElementById('painel-apelido-iot');
  if (cod) cod.value = '';
  if (ape) ape.value = '';
}

async function desvincularDispositivo() {
  if (!appState.sensor?.id) {
    mostrarVincularDispositivo();
    return;
  }

  const confirmar = await mostrarConfirm({
    icone:    'unlink',
    titulo:   'Desvincular dispositivo',
    mensagem: 'O Dispositivo Monitech será removido desta residência. Você poderá vincular outro a qualquer momento.',
    okLabel:  'Desvincular',
    okDanger: true
  });
  if (!confirmar) return;

  const btn = document.querySelector('[onclick="desvincularDispositivo()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" style="width:13px;height:13px"></i> Removendo…'; if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] }); }

  const resp = await apiFetch(`/api/sensores/${appState.sensor.id}`, { method: 'DELETE', headers: headersAuth() });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="unlink" style="width:13px;height:13px"></i> Desvincular dispositivo'; if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] }); }

  if (resp?.sucesso === true) {
    appState.sensor = null;
    mostrarAlerta('Dispositivo desvinculado.', 'success');
    mostrarVincularDispositivo();
  } else {
    mostrarAlerta('Erro ao desvincular: ' + (resp?.erro || 'Tente novamente.'), 'error');
  }
}

async function registrarSensorPainel() {
  if (!appState.residencia?.id) {
    mostrarAlerta('Nenhuma residência encontrada.', 'error');
    return;
  }

  const apelido = document.getElementById('painel-apelido-iot').value.trim() || 'Medidor Principal';

  const btn = document.getElementById('btn-vincular-sensor');
  if (btn) { btn.textContent = 'Registrando...'; btn.disabled = true; }

  const resp = await API.registrarSensor({
    idResidencia: appState.residencia.id,
    apelido,
    protocolo:    'http',
    intervaloMs:  2000
  });

  if (btn) { btn.innerHTML = '<i data-lucide="link"></i> Gerar Token de Acesso'; btn.disabled = false; }

  if (resp?.sucesso) {
    appState.sensor = { id: resp.idSensor, idIot: resp.idIot };

    // Persiste token e IdIot no localStorage para sobreviver a recargas
    if (appState.residencia?.id) {
      localStorage.setItem(`monitech_token_${appState.residencia.id}`, resp.tokenSecreto);
      localStorage.setItem(`monitech_idiot_${appState.residencia.id}`, resp.idIot);
    }

    const tokenValor   = document.getElementById('painel-token-valor');
    const avisoVazio   = document.getElementById('token-aviso-vazio');
    const avisoCopiar  = document.getElementById('token-aviso-copiar');
    const btnCopiarTok = document.getElementById('btn-copiar-token');
    if (tokenValor)   { tokenValor.textContent = resp.tokenSecreto; tokenValor.style.display = ''; }
    if (avisoVazio)   avisoVazio.style.display   = 'none';
    if (avisoCopiar)  avisoCopiar.style.display  = '';
    if (btnCopiarTok) btnCopiarTok.style.display = '';

    const idIotValor = document.getElementById('painel-idiot-valor');
    if (idIotValor) idIotValor.textContent = resp.idIot;

    _modoTrocarDispositivo = false;
    _mostrarEstadoVinculacao('aguardando');
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [document.getElementById('device-waiting-state')] });
    _iniciarPollingConexao();
    _iniciarStatusPolling();
    mostrarAlerta('Dispositivo registrado! Configure-o com o token gerado.', 'success');
  } else if (resp?.upgradePath) {
    atualizarPlano(resp.detalhe);
  } else if (resp?.erro?.toLowerCase().includes('já registrado')) {
    mostrarAlerta('Este código já está registrado. Se for seu dispositivo, o token já foi gerado anteriormente.', 'warning');
  } else {
    mostrarAlerta('Erro ao registrar: ' + (resp?.erro || 'Verifique se o servidor está rodando.'), 'error');
  }
}

async function atualizarUrlServidorPainel() {
  const el = document.getElementById('painel-servidor-url');
  if (!el) return;

  try {
    const resp = await fetch('/api/info/ip');
    const info = await resp.json();
    // Usa a primeira URL de rede local; se não houver, cai no origin
    el.textContent = info.urls?.[0] ?? window.location.origin;
  } catch {
    el.textContent = window.location.origin;
  }
}

function copiarUrlServidorPainel() {
  const url = document.getElementById('painel-servidor-url')?.textContent;
  if (url) navigator.clipboard.writeText(url).then(() => mostrarAlerta('URL copiada!', 'success'));
}

function _copiarToken() {
  const val = document.getElementById('painel-token-valor')?.textContent?.trim();
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => mostrarAlerta('Token copiado!', 'success'));
}

function _copiarIdIot() {
  const val = document.getElementById('painel-idiot-valor')?.textContent?.trim();
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => mostrarAlerta('ID copiado!', 'success'));
}

let _pollingConexaoTimer = null;

function _iniciarPollingConexao() {
  _pararPollingConexao();
  _pollingConexaoTimer = setInterval(_checarConexaoSensor, 10000);
}

function _pararPollingConexao() {
  if (_pollingConexaoTimer) {
    clearInterval(_pollingConexaoTimer);
    _pollingConexaoTimer = null;
  }
}

let _statusPollingTimer = null;

function _iniciarStatusPolling() {
  if (_statusPollingTimer) return;
  _statusPollingTimer = setInterval(_carregarStatusDispositivoUsuario, 15000);
}

function _pararStatusPolling() {
  if (_statusPollingTimer) {
    clearInterval(_statusPollingTimer);
    _statusPollingTimer = null;
  }
}

function _atualizarStatusCardComResposta(resp) {
  const dot  = document.getElementById('user-status-dot');
  const txt  = document.getElementById('user-status-text');
  const sub  = document.getElementById('user-status-since');
  if (!dot || !txt) return;

  const online = !!resp?.sucesso;
  dot.className = 'user-status-indicator ' + (online ? 'user-status--online' : 'user-status--offline');
  txt.textContent = online ? 'Online' : 'Offline';

  if (!sub) return;

  if (online) {
    sub.textContent = 'Última atividade: agora mesmo';
  } else if (resp?.timestamp) {
    // Garante parse UTC correto: adiciona 'Z' se o servidor omitir o fuso
    const rawTs  = String(resp.timestamp);
    const tsStr  = rawTs.endsWith('Z') || rawTs.includes('+') ? rawTs : rawTs + 'Z';
    const secsAtras = Math.floor((Date.now() - new Date(tsStr).getTime()) / 1000);
    if (secsAtras > 0) {
      sub.textContent = secsAtras < 60
        ? `Última atividade: ${secsAtras}s atrás`
        : `Última atividade: ${Math.floor(secsAtras / 60)} min atrás`;
    } else {
      sub.textContent = 'Última atividade: agora mesmo';
    }
  } else {
    sub.textContent = 'Sem atividade recente';
  }
}

async function _checarConexaoSensor() {
  try {
    if (!appState.residencia?.id) return;
    const r = await fetch(`/api/sensores/${appState.residencia.id}`, { headers: headersAuth() }).then(res => res.json());
    const sensor = r?.sensores?.[0];
    if (sensor?.ultimaVisualizacao) {
      _pararPollingConexao();
      localStorage.removeItem(`monitech_token_${appState.residencia.id}`);
      mostrarAlerta('Dispositivo conectado com sucesso!', 'success');
      await _carregarStatusDispositivoUsuario();
    }
  } catch (_) {}
}

async function _verificarConexaoAgora() {
  const btn = document.getElementById('btn-verificar-conexao');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;"></i> Verificando…'; if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] }); }
  await _checarConexaoSensor();
  if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Verificar conexão agora'; if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn] }); }
}

function inicializarAbaEsp32() {
  esp32TabAberta = true;

  registrarTerminal('MONITECH ESP32 — Interface de conexão inicializada', 'success');
  registrarTerminal('Selecione o protocolo de comunicação, configure o endereço IP e clique em CONECTAR', 'info');
  registrarTerminal('Certifique-se de que o dispositivo ESP32 está conectado à mesma rede Wi-Fi que este computador', 'info');

  selecionarProtocolo('http');
  definirEstadoConexao(false);
  preencherCodigo();
  exibirAbaCodigo('http');
  carregarInfoFirmware();
}

/** Wrapper chamado pelo HTML para selecionar o protocolo de conexão */
function selecionarProtocoloConexao(protocolo) {
  selecionarProtocolo(protocolo);
}


// ===================================================
// UTILITÁRIOS DE TEXTO — CORREÇÃO DE ENCODING
// ===================================================

/**
 * Corrige textos com encoding UTF-8 corrompido (dupla codificação).
 * @param {string} texto - Texto possivelmente corrompido
 * @returns {string} Texto corrigido
 */
function corrigirTextoCorrompido(texto) {
  if (typeof texto !== 'string') return texto;

  // Detecta padrão de dupla codificação UTF-8
  if (!/(\u00C3|\u00C2|\u00E2|\u00F0|\u00EF|\uFFFD)/.test(texto)) return texto;

  try {
    const bytes = Uint8Array.from(texto, c => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch (_) {
    return texto;
  }
}

/**
 * Percorre o DOM a partir de um elemento raiz e corrige todos os textos corrompidos.
 * @param {Element} raiz - Elemento raiz da varredura (padrão: document.body)
 */
function corrigirTextosCorrompidosNaPagina(raiz = document.body) {
  if (!raiz) return;

  const atributos = ['placeholder', 'title', 'aria-label', 'value'];
  const elementos = raiz.querySelectorAll('*');

  elementos.forEach(el => {
    // Corrige atributos de texto
    atributos.forEach(attr => {
      if (el.hasAttribute && el.hasAttribute(attr)) {
        el.setAttribute(attr, corrigirTextoCorrompido(el.getAttribute(attr)));
      }
    });

    // Corrige nós de texto diretos
    el.childNodes.forEach(no => {
      if (no.nodeType === Node.TEXT_NODE) {
        no.textContent = corrigirTextoCorrompido(no.textContent);
      }
    });
  });

  document.title = corrigirTextoCorrompido(document.title);
}

// Substitui alert e confirm nativos para corrigir encoding automaticamente
const alertaNativo = window.alert.bind(window);
const confirmacaoNativa = window.confirm.bind(window);

window.alert = function (mensagem) {
  const textoCorrigido = corrigirTextoCorrompido(String(mensagem));
  const linhas = textoCorrigido.split('\n');
  const titulo = linhas[0] || '';
  const texto = linhas.slice(1).join('\n');

  // Detecta tipo pelo conteúdo
  let tipo = 'info';
  if (textoCorrigido.includes('✓')) tipo = 'success';
  if (textoCorrigido.includes('✕') || textoCorrigido.toLowerCase().includes('erro')) tipo = 'error';
  if (textoCorrigido.includes('⚠') || textoCorrigido.toLowerCase().includes('aviso')) tipo = 'warning';

  // Usa o sistema customizado
  inicializarContainerAlertas();
  mostrarAlerta(tipo, titulo, texto, 5000);
};

window.confirm = (msg) => confirmacaoNativa(corrigirTextoCorrompido(String(msg)));

// Executa a correção de encoding assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  inicializarContainerAlertas();
  aplicarTema(obterTemaSalvo(), false);
  corrigirTextosCorrompidosNaPagina();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  // Restaura a sessão se houver token válido
  await restaurarSessao();
});

/**
 * Restaura a sessão do usuário se houver token válido no localStorage
 * Verifica token, sincroniza usuário, mostra o app
 * ⚠️ System.js USA APENAS tokens com prefixo _system (independente da landing page)
 */
async function restaurarSessao() {
  console.log('[RESTAURAR-SESSÃO] Verificando tokens DO SYSTEM...');
  
  // ⚠️ IMPORTANTE: System APENAS verifica token_system (não usa landing)
  const token = localStorage.getItem('monitech_token_system');
  const expira = localStorage.getItem('monitech_expira_system');
  
  console.log('[RESTAURAR-SESSÃO] Token System?', !!token);
  console.log('[RESTAURAR-SESSÃO] Expira?', expira);
  
  // Verifica se tem token válido
  if (token && expira && new Date(expira) > new Date()) {
    console.log('[RESTAURAR-SESSÃO] ✓ Token do SYSTEM válido encontrado. Sincronizando usuário...');
    
    // Sincroniza dados do localStorage (await obrigatório — função async)
    const sincronizado = await sincronizarUsuarioDoLocalStorage();
    if (sincronizado) {
      console.log('[RESTAURAR-SESSÃO] ✓ Usuário sincronizado:', appState.usuario);

      // DB é fonte de verdade — salva no cookie para que landing page leia corretamente
      const _tema = appState.usuario?.tema || 'dark';
      window._salvarTemaUsuario?.(appState.usuario?.id, _tema);
      aplicarTema(_tema, true, true);
      
      // Se não tem residências, carrega da API
      if (!appState.residencia) {
        console.log('[RESTAURAR-SESSÃO] Carregando residências...');
        try {
          const respResidencias = await API.listarResidencias();
          if (respResidencias?.sucesso && respResidencias?.residencias?.length > 0) {
            appState.residencias = respResidencias.residencias;
            appState.residencia  = _residenciaPreferida(respResidencias.residencias);
            appState.comodos = (await API.obterComodos(appState.residencia.id))?.comodos || [];
            await _sincronizarDispositivos();
            console.log('[RESTAURAR-SESSÃO] ✓ Residência carregada');
          }
        } catch (err) {
          console.warn('[RESTAURAR-SESSÃO] Erro ao carregar residências:', err);
        }
      }

      // Atualiza a tela com os dados do usuário
      console.log('[RESTAURAR-SESSÃO] Atualizando indicador do usuário...');
      atualizarIndicadorUsuarioDOM();

      // Sem residência cadastrada → mantém no onboarding
      if (!appState.residencia) {
        console.log('[RESTAURAR-SESSÃO] Nenhuma residência — redirecionando para onboarding...');
        mostrarPagina('page-onboard');
        atualizarPassosOnboarding(0);
        atualizarIndicadorUsuario();
        return;
      }

      // Entra no app
      console.log('[RESTAURAR-SESSÃO] ✓ Entrando no app...');
      entrarNoApp();
      return;
    }
  }
  
  console.log('[RESTAURAR-SESSÃO] ✗ Nenhum token do SYSTEM válido. Mostrando página de login.');
  mostrarPagina('page-login');
}


// =====================================================
// ADMIN PANEL
// =====================================================

let _adminPagina    = 1;
let _adminBuscaTimer = null;

async function carregarAdminDashboard() {
  await Promise.all([carregarAdminStats(), carregarAdminUsuarios(1, '')]);
}

async function carregarAdminStats() {
  const resp = await API.adminStats();
  if (!resp?.sucesso) return;
  const s = resp.stats;
  document.getElementById('adm-total-usuarios').textContent = s.totalUsuarios.toLocaleString('pt-BR');
  document.getElementById('adm-ativos').textContent         = s.usuariosAtivos.toLocaleString('pt-BR');
  document.getElementById('adm-suspensos').textContent      = s.usuariosSuspensos.toLocaleString('pt-BR');
  document.getElementById('adm-novos-mes').textContent      = s.novosEsteMes.toLocaleString('pt-BR');
  document.getElementById('adm-residencias').textContent    = s.totalResidencias.toLocaleString('pt-BR');
  document.getElementById('adm-dispositivos').textContent   = s.totalDispositivos.toLocaleString('pt-BR');
  document.getElementById('adm-leituras').textContent       = s.totalLeituras.toLocaleString('pt-BR');
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [document.getElementById('admin-stats-grid')] });
}

async function carregarAdminUsuarios(pagina = 1, search = '') {
  _adminPagina = pagina;
  const resp = await API.adminUsuarios(pagina, search);
  if (!resp?.sucesso) return;

  const tbody  = document.getElementById('admin-tbody');
  const vazio  = document.getElementById('admin-table-empty');
  const paging = document.getElementById('admin-pagination');

  if (!resp.usuarios?.length) {
    tbody.innerHTML = '';
    vazio.style.display  = '';
    paging.innerHTML = '';
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [vazio] });
    return;
  }

  vazio.style.display = 'none';
  tbody.innerHTML = resp.usuarios.map(u => {
    const nomeInicial = (u.nome || 'U')[0].toUpperCase();
    const avatar      = u.fotoUrl
      ? `<div class="admin-user-avatar"><img src="${u.fotoUrl}" alt="" onerror="this.parentNode.textContent='${nomeInicial}'"></div>`
      : `<div class="admin-user-avatar">${nomeInicial}</div>`;

    const roleBadge   = u.role === 'admin'
      ? `<span class="admin-badge admin-badge--admin"><i data-lucide="shield" style="width:11px;height:11px"></i> Admin</span>`
      : `<span class="admin-badge admin-badge--user">Usuário</span>`;

    const statusBadge = u.status === 'active'
      ? `<span class="admin-badge admin-badge--active">Ativo</span>`
      : `<span class="admin-badge admin-badge--suspended">Suspenso</span>`;

    const dataCadastro = new Date(u.dataCriacao).toLocaleDateString('pt-BR');
    const ultimoAcesso = u.ultimaLogin
      ? new Date(u.ultimaLogin).toLocaleDateString('pt-BR')
      : '—';

    const isMensal   = u.plano === 'mensal' && (!u.planoExpiraEm || new Date(u.planoExpiraEm) > new Date());
    const planoBadge = isMensal
      ? `<span class="admin-badge admin-badge--active">Mensal</span>`
      : `<span class="admin-badge">Gratuito</span>`;

    const isSelf     = u.id === appState.usuario?.id;
    const btnStatus  = isSelf ? '' : u.status === 'active'
      ? `<button class="admin-btn admin-btn--danger" onclick="adminAlterarStatus('${u.id}','suspended')">Suspender</button>`
      : `<button class="admin-btn admin-btn--success" onclick="adminAlterarStatus('${u.id}','active')">Reativar</button>`;
    const btnRole    = isSelf ? '' : u.role === 'admin'
      ? `<button class="admin-btn" onclick="adminAlterarRole('${u.id}','user')">Rebaixar</button>`
      : `<button class="admin-btn admin-btn--promote" onclick="adminAlterarRole('${u.id}','admin')">Promover</button>`;
    const btnPlano   = isSelf ? '' : isMensal
      ? `<button class="admin-btn admin-btn--danger" onclick="adminAlterarPlano('${u.id}','gratuito')">→ Gratuito</button>`
      : `<button class="admin-btn admin-btn--success" onclick="adminAlterarPlano('${u.id}','mensal')">→ Mensal</button>`;

    return `
      <tr>
        <td><div class="admin-user-cell">${avatar}<span class="admin-user-name">${u.nome}</span></div></td>
        <td style="color:var(--text-secondary);font-size:13px">${u.email}</td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td>${planoBadge}</td>
        <td style="color:var(--text-secondary);font-size:13px;white-space:nowrap">${dataCadastro}</td>
        <td style="color:var(--text-secondary);font-size:13px;white-space:nowrap">${ultimoAcesso}</td>
        <td class="admin-td-center" style="color:var(--text-secondary)">${u.qtdResidencias}</td>
        <td><div class="admin-actions">${btnStatus}${btnRole}${btnPlano}</div></td>
      </tr>`;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [tbody] });

  // Paginação
  const total = resp.totalPaginas || 1;
  paging.innerHTML = '';
  if (total <= 1) return;

  const searchVal = search || document.getElementById('admin-search')?.value || '';
  const addBtn = (label, page, disabled, active) => {
    const btn = document.createElement('button');
    btn.className  = 'admin-page-btn' + (active ? ' active' : '');
    btn.textContent = label;
    btn.disabled   = disabled;
    btn.onclick    = () => carregarAdminUsuarios(page, searchVal);
    paging.appendChild(btn);
  };

  addBtn('‹', pagina - 1, pagina <= 1, false);
  for (let p = 1; p <= total; p++) {
    if (total > 7 && Math.abs(p - pagina) > 2 && p !== 1 && p !== total) {
      if (p === pagina - 3 || p === pagina + 3) {
        const dots = document.createElement('span');
        dots.textContent = '…';
        dots.style.cssText = 'padding:0 4px;color:var(--text-secondary)';
        paging.appendChild(dots);
      }
      continue;
    }
    addBtn(p, p, false, p === pagina);
  }
  addBtn('›', pagina + 1, pagina >= total, false);
}

function adminBuscarUsuarios(valor) {
  clearTimeout(_adminBuscaTimer);
  _adminBuscaTimer = setTimeout(() => carregarAdminUsuarios(1, valor), 400);
}

// ══════════════════════════════════════════════════════════════
//  NOTIFICAÇÕES NO NAVEGADOR
// ══════════════════════════════════════════════════════════════

const _NOTIF_VISTOS_KEY = 'monitech_notif_vistos';
const _NOTIF_TIPO_TS_KEY = 'monitech_notif_tipo_ts';

function _notifBrowserCfg() {
  try { return JSON.parse(localStorage.getItem('monitech_notif_browser') || '{}'); } catch { return {}; }
}

async function _solicitarPermissaoNotificacao() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

function _tocarSomAlerta() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* browser sem suporte a AudioContext */ }
}

function _verificarNotificacoesBrowser(alertas) {
  const cfg = _notifBrowserCfg();
  if (!cfg.browser_alertas) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!alertas?.length) return;

  const vistos  = new Set(JSON.parse(localStorage.getItem(_NOTIF_VISTOS_KEY) || '[]'));
  const tipoTs  = JSON.parse(localStorage.getItem(_NOTIF_TIPO_TS_KEY) || '{}');
  const freqMs  = (Number(cfg.frequencia) || 15) * 60 * 1000;
  const agora   = Date.now();
  let   tocouSom = false;
  const novosVistos = [...vistos];

  for (const a of alertas) {
    const id   = String(a.id   ?? a.Id   ?? '');
    const lido = a.lido ?? a.Lido ?? false;
    if (!id || vistos.has(id) || lido) continue;

    const tipo       = a.tipo ?? a.Tipo ?? 'geral';
    const ultimaVez  = tipoTs[tipo] ?? 0;
    if (agora - ultimaVez < freqMs) continue;

    const titulo  = a.titulo   ?? a.Titulo   ?? 'MONITECH — Alerta';
    const mensagem = a.mensagem ?? a.Mensagem ?? '';

    new Notification(titulo, {
      body: mensagem,
      icon: '/favicon.svg',
      tag:  `monitech-${tipo}`
    });

    tipoTs[tipo] = agora;
    novosVistos.push(id);
    if (!tocouSom && cfg.browser_som) { _tocarSomAlerta(); tocouSom = true; }
  }

  localStorage.setItem(_NOTIF_VISTOS_KEY, JSON.stringify(novosVistos.slice(-500)));
  localStorage.setItem(_NOTIF_TIPO_TS_KEY, JSON.stringify(tipoTs));
}

async function adminAlterarStatus(id, novoStatus) {
  const suspender = novoStatus === 'suspended';
  const confirmado = await mostrarConfirm({
    icone:    suspender ? '🚫' : '✅',
    titulo:   suspender ? 'Suspender usuário' : 'Reativar usuário',
    mensagem: suspender
      ? 'O usuário perderá acesso imediatamente e todas as sessões serão encerradas.'
      : 'O usuário poderá voltar a acessar o sistema normalmente.',
    okLabel:  suspender ? 'Suspender' : 'Reativar',
    okDanger: suspender
  });
  if (!confirmado) return;
  const resp = await API.adminAtualizarStatus(id, novoStatus);
  if (!resp?.sucesso) { mostrarAlerta(resp?.erro || 'Erro ao alterar status.', 'erro'); return; }
  const search = document.getElementById('admin-search')?.value || '';
  await Promise.all([carregarAdminStats(), carregarAdminUsuarios(_adminPagina, search)]);
}

async function adminAlterarRole(id, novoRole) {
  const promover = novoRole === 'admin';
  const confirmado = await mostrarConfirm({
    icone:    promover ? '🛡️' : '👤',
    titulo:   promover ? 'Promover a Administrador' : 'Rebaixar a Usuário',
    mensagem: promover
      ? 'Este usuário terá acesso total ao painel administrativo.'
      : 'Este usuário perderá os privilégios de administrador.',
    okLabel:  promover ? 'Promover' : 'Rebaixar',
    okDanger: !promover
  });
  if (!confirmado) return;
  const resp = await API.adminAtualizarRole(id, novoRole);
  if (!resp?.sucesso) { mostrarAlerta(resp?.erro || 'Erro ao alterar cargo.', 'erro'); return; }
  const search = document.getElementById('admin-search')?.value || '';
  await carregarAdminUsuarios(_adminPagina, search);
}

async function adminAlterarPlano(id, novoPlano) {
  const paraMensal = novoPlano === 'mensal';
  const confirmado = await mostrarConfirm({
    icone:    paraMensal ? '⭐' : '🔽',
    titulo:   paraMensal ? 'Ativar Plano Mensal (teste)' : 'Reverter para Gratuito',
    mensagem: paraMensal
      ? 'O usuário terá acesso ao plano mensal por 30 dias (apenas para testes).'
      : 'O usuário voltará às limitações do plano gratuito imediatamente.',
    okLabel:  paraMensal ? 'Ativar Mensal' : 'Reverter',
    okDanger: !paraMensal
  });
  if (!confirmado) return;
  const resp = await API.adminAtualizarPlano(id, novoPlano, paraMensal ? 30 : null);
  if (!resp?.sucesso) { mostrarAlerta(resp?.erro || 'Erro ao alterar plano.', 'erro'); return; }
  const search = document.getElementById('admin-search')?.value || '';
  await carregarAdminUsuarios(_adminPagina, search);
}

// ── TOASTS ──────────────────────────────────────────────────────────────────
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
  const titulos = { sucesso: 'Sucesso', erro: 'Erro', aviso: 'Atenção', info: 'Informação' };

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
        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>`;

  const fechar = () => {
    toast.classList.add('toast-saindo');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  toast.querySelector('.toast-fechar').addEventListener('click', fechar);
  container.appendChild(toast);
  setTimeout(fechar, 4500);
}

let _confirmResolve = null;
function mostrarConfirm({ icone = 'help-circle', titulo = 'Confirmar', mensagem = '', okLabel = 'Confirmar', okDanger = false } = {}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    const iconEl = document.getElementById('modal-confirm-icon');
    iconEl.innerHTML = `<i data-lucide="${icone}" style="width:36px;height:36px;color:${okDanger ? 'var(--danger)' : 'var(--cyan)'};"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [iconEl] });
    document.getElementById('modal-confirm-titulo').textContent   = titulo;
    document.getElementById('modal-confirm-mensagem').textContent = mensagem;
    const okBtn = document.getElementById('modal-confirm-ok');
    okBtn.textContent = okLabel;
    okBtn.className   = okDanger ? 'btn btn-danger' : 'btn btn-primary';
    document.getElementById('modal-confirm').style.display = 'flex';
  });
}
function _fecharConfirm(resultado) {
  document.getElementById('modal-confirm').style.display = 'none';
  if (_confirmResolve) { _confirmResolve(resultado); _confirmResolve = null; }
}

