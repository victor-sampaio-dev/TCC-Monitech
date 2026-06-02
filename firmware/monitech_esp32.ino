// ============================================================
//  MONITECH — Firmware ESP32
//  Hardware: ESP32 DevKit V1 + Leitor Monitech + Sensor Monitech
//  Bibliotecas necessárias (instalar no Arduino IDE):
//    - PZEM-004T-10-Arduino-Library  (olebedev/PZEM-004T-v30)
//    - ArduinoJson  (Benoit Blanchon)
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <PZEM004Tv30.h>

// ── CONFIGURAÇÃO — preencha antes de gravar ─────────────────
const char* SSID      = "SUA_REDE_WIFI";
const char* PASSWORD  = "SUA_SENHA_WIFI";
const char* DEVICE_ID = "MON-001";          // IdIot cadastrado no painel
const char* TOKEN     = "TOKEN_DO_PAINEL";  // Token gerado no painel
const char* SERVER    = "http://10.0.0.156:5000/api/medicoes";
const char* FW_VER    = "1.0.0";
// ────────────────────────────────────────────────────────────

// Leitor Monitech: RX2=GPIO16, TX2=GPIO17
PZEM004Tv30 pzem(Serial2, 16, 17);

unsigned long ultimoEnvio = 0;
const int INTERVALO = 5000;

float lerVolts() { return pzem.voltage();   }
float lerAmps()  { return pzem.current();   }
float lerWatts() { return pzem.power();     }
float lerFP()    { return pzem.pf();        }
float lerHz()    { return pzem.frequency(); }
float lerKwh()   { return pzem.energy();    }

void enviarDados() {
  float volts = lerVolts();
  float amps  = lerAmps();
  float watts = lerWatts();

  // Se leitura inválida usa zero (permite testar conexão sem AC)
  if (isnan(volts)) volts = 0;
  if (isnan(amps))  amps  = 0;
  if (isnan(watts)) watts = 0;

  Serial.printf("[PZEM] V=%.1f A=%.3f W=%.1f kWh=%.4f Hz=%.1f FP=%.2f\n",
                volts, amps, watts, lerKwh(), lerHz(), lerFP());

  // Reconecta Wi-Fi se necessário
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconectando...");
    WiFi.reconnect();
    delay(3000);
    return;
  }

  // Monta JSON com os campos que o backend MONITECH espera
  StaticJsonDocument<384> doc;
  doc["dispositivoId"]    = DEVICE_ID;
  doc["token"]            = TOKEN;
  doc["tensao"]           = volts;
  doc["corrente"]         = amps;
  doc["potencia"]         = watts;
  doc["energiKwh"]        = lerKwh();
  float aparente = volts * amps;
  float reativa  = sqrt(max(0.0f, aparente * aparente - watts * watts));

  doc["potenciaAparente"] = aparente;
  doc["potenciaReativa"]  = reativa;
  doc["fatorPotencia"]    = lerFP();
  doc["frequencia"]       = lerHz();
  doc["rssiDbm"]          = WiFi.RSSI();
  doc["heapLivre"]        = (int)ESP.getFreeHeap();
  doc["versaoFirmware"]   = FW_VER;
  doc["ssidWifi"]         = WiFi.SSID();
  doc["ip"]               = WiFi.localIP().toString();

  String payload;
  serializeJson(doc, payload);

  // Envia HTTP POST
  HTTPClient http;
  http.begin(SERVER);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  int code = http.POST(payload);

  if (code == 200)
    Serial.println("[HTTP] ✓ Leitura registrada");
  else
    Serial.printf("[HTTP] ✗ Erro %d: %s\n", code, http.getString().c_str());

  http.end();
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n[MONITECH] Iniciando...");

  WiFi.begin(SSID, PASSWORD);
  Serial.print("[WiFi] Conectando");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\n[WiFi] ✓ IP: " + WiFi.localIP().toString());
}

void loop() {
  if (millis() - ultimoEnvio >= INTERVALO) {
    enviarDados();
    ultimoEnvio = millis();
  }
}
