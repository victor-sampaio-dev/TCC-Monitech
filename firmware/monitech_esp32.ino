
// ============================================================
//  MONITECH — Firmware ESP32 v2.0
//  Hardware : ESP32 DevKit V1 + Leitor Monitech (PZEM-004T v3.0)
//             + Sensor Monitech (CT 100A)
//
//  Bibliotecas necessárias (instalar no Arduino IDE):
//    - PZEM-004T-10-Arduino-Library  (olebedev/PZEM-004T-v30)
//    - ArduinoJson                   (Benoit Blanchon)
//    - ESP32 board package           (Espressif Systems)
//
//  Fluxo de primeiro uso:
//    1. Gravar este firmware no ESP32 via USB
//    2. Ligar o dispositivo
//    3. No celular: conectar ao Wi-Fi "MONITECH-Setup" (senha: monitech123)
//    4. Acessar http://192.168.4.1 no navegador
//    5. Preencher: rede Wi-Fi, senha e Token do painel MONITECH
//    6. Salvar → dispositivo reinicia e começa a enviar leituras
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <PZEM004Tv30.h>

// ── Configurações fixas ──────────────────────────────────────
const char* AP_SSID  = "MONITECH-Setup";
const char* AP_PASS  = "monitech123";
const char* FW_VER   = "2.0.0";
const int   INTERVALO = 2000;    // 2s mínimo para NILM detectar transições

// ── Hardware: Leitor Monitech → RX2=GPIO16, TX2=GPIO17 ───────
PZEM004Tv30 pzem(Serial2, 16, 17);

// ── Estado global ─────────────────────────────────────────────
Preferences   prefs;
WebServer     servidor(80);
unsigned long ultimoEnvio = 0;
String        gIdIot;      // MON-XXXXXXXX gerado pelo painel MONITECH
String        gToken;
String        gServerUrl;

// ── Página de configuração (portal captivo) ──────────────────
const char* HTML_CONFIG = R"rawhtml(
<!DOCTYPE html><html lang='pt-BR'><head>
<meta charset='utf-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<title>MONITECH — Configuração</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}

  :root{
    --bg:    #0a0f1e;
    --card:  #1a2035;
    --input: #0d1829;
    --bord:  #2a3550;
    --ink:   #fff;
    --muted: #8899aa;
    --hint:  #556677;
    --cyan:  #00d4ff;
    --sec-bord: #2a3550;
  }
  .light{
    --bg:    #eef3f8;
    --card:  #ffffff;
    --input: #f6f9fc;
    --bord:  #ccd8e6;
    --ink:   #0d1829;
    --muted: #4a6080;
    --hint:  #7a9ab8;
    --cyan:  #0057ff;
    --sec-bord: #d0dcea;
  }

  body{font-family:sans-serif;background:var(--bg);color:var(--ink);
       min-height:100vh;display:flex;align-items:center;
       justify-content:center;padding:16px;transition:background .25s,color .25s}

  .card{background:var(--card);border-radius:16px;padding:32px;width:100%;
        max-width:400px;box-shadow:0 8px 40px rgba(0,0,0,.18);
        border:1px solid var(--bord);transition:background .25s,border-color .25s}

  .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
  .logo{color:var(--cyan);font-size:20px;font-weight:700;letter-spacing:2px}
  .theme-btn{background:none;border:1.5px solid var(--bord);border-radius:50%;
             width:36px;height:36px;cursor:pointer;display:flex;align-items:center;
             justify-content:center;color:var(--muted);font-size:17px;
             transition:border-color .2s,color .2s;flex-shrink:0}
  .theme-btn:hover{border-color:var(--cyan);color:var(--cyan)}

  .sub{color:var(--muted);font-size:12px;margin-bottom:24px;line-height:1.6}

  .sec{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--cyan);
       margin:20px 0 12px;border-top:1px solid var(--sec-bord);padding-top:16px}
  .sec:first-of-type{margin-top:0;border-top:none;padding-top:0}

  label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1px;
        color:var(--muted);margin-bottom:5px}

  input{width:100%;padding:11px;border-radius:8px;border:1px solid var(--bord);
        background:var(--input);color:var(--ink);font-size:14px;margin-bottom:14px;
        transition:border-color .2s,background .25s}
  input:focus{outline:none;border-color:var(--cyan)}

  .hint{font-size:11px;color:var(--hint);margin-top:-10px;margin-bottom:14px;line-height:1.5}

  button[type=submit]{width:100%;padding:13px;border-radius:10px;
    background:linear-gradient(135deg,#1a7eff,#00d4ff);
    color:#fff;font-size:15px;font-weight:700;border:none;cursor:pointer;
    letter-spacing:1px;margin-top:8px;transition:opacity .2s}
  button[type=submit]:hover{opacity:.9}
</style>
</head>
<body id='body'>
<div class='card'>
  <div class='topbar'>
    <div class='logo'>MONITECH</div>
    <button class='theme-btn' onclick='toggleTema()' id='tBtn' title='Alternar tema'>&#9790;</button>
  </div>
  <div class='sub'>Preencha os dados abaixo para configurar o Dispositivo Monitech.</div>
  <form action='/salvar' method='POST'>
    <div class='sec'>Rede Wi-Fi da sua casa</div>
    <label>Nome da rede (SSID)</label>
    <input name='ssid' placeholder='Ex: MinhaRedeCasa' required autocomplete='off'>
    <label>Senha da rede</label>
    <input name='senha' type='password' placeholder='Senha do Wi-Fi' autocomplete='off'>
    <div class='sec'>Painel MONITECH</div>
    <label>URL do Servidor</label>
    <input name='serverUrl' placeholder='Ex: http://192.168.1.15:5000' required autocomplete='off'>
    <div class='hint'>&#9888; <strong>Aten&ccedil;&atilde;o:</strong> use o IP do computador na <strong>rede Wi-Fi da sua casa</strong>, n&atilde;o o IP desta rede de configura&ccedil;&atilde;o. Voc&ecirc; encontra esse IP no painel MONITECH &rarr; Dispositivo Monitech &rarr; URL do servidor.</div>
    <label>ID do Dispositivo</label>
    <input name='idIot' placeholder='Ex: MON-A3F2B1C4' required autocomplete='off'>
    <div class='hint'>Vá em: Painel &#8594; Dispositivo Monitech &#8594; copie o <strong>ID do dispositivo</strong>.</div>
    <label>Token do Dispositivo</label>
    <input name='token' placeholder='Token gerado no painel MONITECH' required autocomplete='off'>
    <div class='hint'>Copie o <strong>Token de autenticação</strong> exibido no mesmo painel.</div>
    <button type='submit'>SALVAR E CONECTAR</button>
  </form>
</div>
<script>
  var light = localStorage.getItem('mt_tema') === '1';
  function aplicar(){
    document.getElementById('body').className = light ? 'light' : '';
    document.getElementById('tBtn').innerHTML = light ? '&#9728;' : '&#9790;';
  }
  function toggleTema(){ light = !light; localStorage.setItem('mt_tema', light ? '1' : '0'); aplicar(); }
  aplicar();
</script>
</body></html>
)rawhtml";

// ── Página de sucesso ─────────────────────────────────────────
const char* HTML_OK = R"rawhtml(
<!DOCTYPE html><html><head>
<meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>MONITECH — Configurado!</title>
<style>
  body{font-family:sans-serif;background:#0a0f1e;color:#fff;min-height:100vh;
       display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
  .check{color:#00ff88;font-size:64px;margin-bottom:16px}
  h2{color:#00d4ff;font-size:24px;margin-bottom:12px}
  p{color:#8899aa;line-height:1.7}
</style>
</head><body>
<div>
  <div class='check'>&#10003;</div>
  <h2>Dispositivo Configurado!</h2>
  <p>As configurações foram salvas com sucesso.<br>
     O dispositivo vai reiniciar e conectar à sua rede Wi-Fi.<br><br>
     <strong style='color:#fff'>Desconecte-se da rede MONITECH-Setup</strong><br>
     e reconecte à sua rede Wi-Fi normal.<br><br>
     O sensor aparecerá como <strong style='color:#00d4ff'>Online</strong> no painel em instantes.</p>
</div>
</body></html>
)rawhtml";

// ── Handler: salvar e reiniciar ───────────────────────────────
void handleSalvar() {
  String ssid      = servidor.arg("ssid");
  String senha     = servidor.arg("senha");
  String serverUrl = servidor.arg("serverUrl");
  String idIot     = servidor.arg("idIot");
  String token     = servidor.arg("token");

  if (ssid.isEmpty() || serverUrl.isEmpty() || idIot.isEmpty() || token.isEmpty()) {
    servidor.send(400, "text/html",
      "<p style='font-family:sans-serif;color:red;padding:24px'>"
      "Preencha todos os campos obrigatórios.</p>");
    return;
  }

  prefs.begin("cfg", false);
  prefs.putString("ssid",      ssid);
  prefs.putString("senha",     senha);
  prefs.putString("serverUrl", serverUrl);
  prefs.putString("idIot",     idIot);
  prefs.putString("token",     token);
  prefs.end();

  servidor.send(200, "text/html", HTML_OK);
  delay(2500);
  ESP.restart();
}

// ── Modo AP: portal de configuração ──────────────────────────
void modoConfiguracao() {
  Serial.println("\n[MONITECH] Configuração ausente — iniciando modo AP");
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);

  Serial.println("[AP] Rede:   " + String(AP_SSID));
  Serial.println("[AP] Senha:  " + String(AP_PASS));
  Serial.println("[AP] Portal: http://" + WiFi.softAPIP().toString());

  servidor.on("/",       HTTP_GET,  []() { servidor.send(200, "text/html", HTML_CONFIG); });
  servidor.on("/salvar", HTTP_POST, handleSalvar);
  servidor.onNotFound([]() {
    servidor.sendHeader("Location", "/");
    servidor.send(302);
  });
  servidor.begin();

  while (true) {
    servidor.handleClient();
    delay(1);
  }
}

// ── Conecta ao Wi-Fi salvo ────────────────────────────────────
bool conectarWifi(const String& ssid, const String& senha) {
  Serial.printf("[WiFi] Conectando a: %s\n", ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), senha.c_str());

  for (int i = 0; i < 24 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WiFi] ✓ IP: " + WiFi.localIP().toString());
    return true;
  }

  Serial.println("[WiFi] ✗ Falha ao conectar.");
  return false;
}

// ── Envia leitura ao servidor ─────────────────────────────────
void enviarMedicao() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Desconectado — reconectando...");
    WiFi.reconnect();
    delay(3000);
    return;
  }

  float volts = pzem.voltage();
  float amps  = pzem.current();
  float watts = pzem.power();
  float kwh   = pzem.energy();
  float fp    = pzem.pf();
  float hz    = pzem.frequency();

  if (isnan(volts))  volts  = 0;
  if (isnan(amps))   amps   = 0;
  if (isnan(watts))  watts  = 0;
  if (isnan(kwh))    kwh    = 0;
  if (isnan(fp))     fp     = 0;
  if (isnan(hz))     hz     = 0;

  float aparente = volts * amps;
  float reativa  = sqrt(max(0.0f, aparente * aparente - watts * watts));

  Serial.printf("[PZEM] V=%.1f A=%.3f W=%.1f kWh=%.4f Hz=%.1f FP=%.2f VA=%.1f VAr=%.1f\n",
                volts, amps, watts, kwh, hz, fp, aparente, reativa);

  StaticJsonDocument<512> doc;
  doc["dispositivoId"]    = gIdIot;
  doc["token"]            = gToken;
  doc["tensao"]           = volts;
  doc["corrente"]         = amps;
  doc["potencia"]         = watts;
  doc["energiKwh"]        = kwh;
  doc["potenciaAparente"] = aparente;
  doc["potenciaReativa"]  = reativa;
  doc["fatorPotencia"]    = fp;
  doc["frequencia"]       = hz;
  doc["rssiDbm"]          = (int)WiFi.RSSI();
  doc["heapLivre"]        = (int)ESP.getFreeHeap();
  doc["versaoFirmware"]   = FW_VER;
  doc["ssidWifi"]         = WiFi.SSID();
  doc["ip"]               = WiFi.localIP().toString();

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(gServerUrl + "/api/medicoes");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  int code = http.POST(payload);
  if (code == 200)
    Serial.println("[HTTP] ✓ Leitura registrada");
  else
    Serial.printf("[HTTP] ✗ Erro HTTP %d\n", code);

  http.end();
}

// ── Reset por botão BOOT (GPIO0) ──────────────────────────────
unsigned long _bootPressionadoEm = 0;

void checarBotaoReset() {
  if (digitalRead(0) == LOW) {
    if (_bootPressionadoEm == 0) {
      _bootPressionadoEm = millis();
      Serial.println("[RESET] BOOT pressionado — segure 3s para redefinir...");
    } else if (millis() - _bootPressionadoEm >= 3000) {
      Serial.println("[RESET] Apagando configurações e reiniciando...");
      prefs.begin("cfg", false);
      prefs.clear();
      prefs.end();
      delay(300);
      ESP.restart();
    }
  } else {
    if (_bootPressionadoEm > 0) {
      Serial.println("[RESET] Solto antes de 3s — cancelado.");
    }
    _bootPressionadoEm = 0;
  }
}

// ── Setup ─────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(0, INPUT_PULLUP);
  Serial.println("\n[MONITECH] Iniciando firmware v" + String(FW_VER));

  Serial.println("[MONITECH] Firmware v" + String(FW_VER) + " pronto.");

  // Carrega configurações salvas na memória flash
  prefs.begin("cfg", true);
  String wifiSsid  = prefs.getString("ssid",      "");
  String wifiSenha = prefs.getString("senha",      "");
  gServerUrl       = prefs.getString("serverUrl",  "");
  gIdIot           = prefs.getString("idIot",      "");
  gToken           = prefs.getString("token",      "");
  prefs.end();

  bool temConfig = !wifiSsid.isEmpty() && !gServerUrl.isEmpty() && !gIdIot.isEmpty() && !gToken.isEmpty();

  if (!temConfig || !conectarWifi(wifiSsid, wifiSenha)) {
    modoConfiguracao();   // nunca retorna — reinicia após salvar
  }

  servidor.begin();
  Serial.println("[MONITECH] Pronto — enviando a cada " + String(INTERVALO) + "ms");
}

// ── Loop ──────────────────────────────────────────────────────
void loop() {
  checarBotaoReset();
  servidor.handleClient();

  if (millis() - ultimoEnvio >= INTERVALO) {
    enviarMedicao();
    ultimoEnvio = millis();
  }
}
