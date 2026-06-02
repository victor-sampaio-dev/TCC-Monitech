
/* ─── CANVAS HERO ─── */
(function () {
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, t = 0;
  let vBase = 220, iBase = 8.4, vTarget = 220, iTarget = 8.4;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  setInterval(() => {
    vTarget = 217 + Math.random() * 6;
    iTarget = 7.5 + Math.random() * 2;
  }, 2500);

  const lerp = (a, b, k) => a + (b - a) * k;

  /* Detect dark mode */
  function isDark() {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  function draw() {
    vBase = lerp(vBase, vTarget, 0.03);
    iBase = lerp(iBase, iTarget, 0.03);
    ctx.clearRect(0, 0, W, H);

    const dark = isDark();
    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(11,18,32,0.06)';
    const centerColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(11,18,32,0.1)';

    /* Grid */
    ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += W / 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += H / 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    /* Linha central */
    ctx.strokeStyle = centerColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

    const ampV = (H / 2 - 16) * (vBase / 260);
    const ampI = (H / 2 - 16) * (iBase / 30) * 0.6;
    const pts = 400;

    /* Fill tensão */
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * W;
      const y = H / 2 - Math.sin((i / pts) * Math.PI * 2 * 3 + t) * ampV;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H / 2); ctx.lineTo(0, H / 2); ctx.closePath();
    const gV = ctx.createLinearGradient(0, H / 2 - ampV, 0, H / 2 + ampV);
    gV.addColorStop(0, 'rgba(0,87,255,0.18)');
    gV.addColorStop(1, 'rgba(0,87,255,0.01)');
    ctx.fillStyle = gV; ctx.fill();

    /* Linha tensão */
    ctx.beginPath(); ctx.strokeStyle = '#0057ff'; ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0,87,255,0.5)'; ctx.shadowBlur = 12;
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * W;
      const y = H / 2 - Math.sin((i / pts) * Math.PI * 2 * 3 + t) * ampV;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;

    /* Linha corrente */
    ctx.beginPath(); ctx.strokeStyle = '#00aacc'; ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0,212,255,0.4)'; ctx.shadowBlur = 8;
    ctx.setLineDash([6, 3]);
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * W;
      const y = H / 2 - Math.sin((i / pts) * Math.PI * 2 * 3 + t - 0.3) * ampI;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;

    t += 0.013;

    const watts = +(vBase * iBase * 0.92).toFixed(0);
    const kwh = +(4.21 + t * 0.0006).toFixed(2);

    document.getElementById('pm-v').innerHTML = vBase.toFixed(0) + '<span>V</span>';
    document.getElementById('pm-w').innerHTML = watts + '<span>W</span>';
    document.getElementById('pm-k').innerHTML = kwh.toFixed(2) + '<span>kWh</span>';
    document.getElementById('pj-v').textContent = vBase.toFixed(1);
    document.getElementById('pj-a').textContent = iBase.toFixed(2);
    document.getElementById('pj-w').textContent = watts;
    document.getElementById('pj-k').textContent = kwh.toFixed(3);

    requestAnimationFrame(draw);
  }
  draw();
})();

/* ─── CONTADORES ─── */
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function countUp(el, target, duration) {
  const start = performance.now();
  (function frame(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(easeOut(p) * target);
    if (p < 1) requestAnimationFrame(frame);
  })(start);
}

const statsObs = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) {
    countUp(document.getElementById('s1'), 4, 1000);
    countUp(document.getElementById('s2'), 6, 1100);
    countUp(document.getElementById('s3'), 2, 800);
    countUp(document.getElementById('s4'), 100, 1500);
    statsObs.disconnect();
  }
}, { threshold: 0.4 });
statsObs.observe(document.querySelector('.stats-grid'));

/* ─── SCROLL REVEAL ─── */
const observer = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 80);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.feat-card, .step, .proto-item, .hw-card, .hw-board-wrap, .reveal').forEach(el => observer.observe(el));

/* ─── PROTO SELECTOR ─── */
const protos = [
  {
    icon: 'zap', name: 'WebSocket', badge: 'Recomendado',
    desc: 'Conexão em tempo real entre o Dispositivo MONITECH e o painel. Os dados são transmitidos automaticamente a cada 2 segundos, sem necessidade de recarregar a página. A forma mais rápida e estável de monitorar sua energia.',
    specs: ['Atualização a cada 2 segundos', 'Comunicação bidirecional', 'Detecta desconexão automaticamente', 'Suporte a múltiplos painéis'],
    url: 'ws://192.168.1.100:81/ws'
  },
  {
    icon: 'refresh-cw', name: 'HTTP Polling', badge: 'Compatível',
    desc: 'O painel consulta o Dispositivo MONITECH em intervalos regulares via HTTP. Funciona em qualquer rede, mesmo atrás de firewalls ou proxies corporativos. Intervalo ajustável conforme a necessidade.',
    specs: ['Intervalo configurável (500ms–60s)', 'Funciona atrás de firewalls', 'Compatível com qualquer navegador', 'Simples e confiável'],
    url: 'http://192.168.1.100:80/api/data'
  },
  {
    icon: 'usb', name: 'Serial / USB', badge: 'Offline',
    desc: 'Conexão direta via cabo USB entre o Dispositivo MONITECH e seu computador. Não precisa de rede Wi-Fi. Ideal para configuração inicial, diagnóstico e atualização de firmware do dispositivo.',
    specs: ['Funciona sem rede Wi-Fi', 'Ideal para configuração inicial', 'Diagnóstico e atualização de firmware', 'Requer navegador Chrome ou Edge'],
    url: 'serial://COM3 — 115200 baud'
  },
  {
    icon: 'radio', name: 'MQTT', badge: 'Avançado',
    desc: 'Protocolo publish/subscribe para integração avançada do Dispositivo MONITECH com outros sistemas IoT. Suporta brokers públicos e privados com autenticação segura por credenciais.',
    specs: ['Broker público ou privado', 'Autenticação por usuário e senha', 'Múltiplos tópicos configuráveis', 'QoS Level 0, 1 e 2'],
    url: 'mqtt://broker.hivemq.com:1883'
  }
];

function selectProto(idx, el) {
  document.querySelectorAll('.proto-item').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  const p = protos[idx];
  const detail = document.getElementById('proto-detail');
  detail.style.opacity = '0';
  detail.style.transform = 'translateX(8px)';
  setTimeout(() => {
    const iconEl = document.getElementById('pd-icon');
    iconEl.innerHTML = `<i data-lucide="${p.icon}"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [iconEl] });
    document.getElementById('pd-name').textContent = p.name;
    document.getElementById('pd-badge').textContent = p.badge;
    document.getElementById('pd-desc').textContent = p.desc;
    document.getElementById('pd-url').textContent = p.url;
    document.getElementById('pd-specs').innerHTML = p.specs.map(s => `<div class="proto-spec">${s}</div>`).join('');
    detail.style.opacity = '1';
    detail.style.transform = 'translateX(0)';
    detail.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  }, 120);
}

/* ─── NAV SCROLL ─── */
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 40);
});

function alternarMenuMobile() {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('nav-menu-mobile');
  const backdrop = document.getElementById('nav-backdrop');
  const ativo = menu.classList.toggle('active');
  btn.classList.toggle('active', ativo);
  backdrop.classList.toggle('active', ativo);
}
