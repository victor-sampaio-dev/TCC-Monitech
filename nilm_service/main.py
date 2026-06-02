# ============================================================
#  MONITECH — Microserviço NILM (Python + FastAPI)
#  Arquivo: nilm_service/main.py
#  Porta:   8001
# ============================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from nilm_engine import NilmEngine

app = FastAPI(
    title="MONITECH NILM Service",
    description="Desagregação de carga por detecção de eventos (Hart 1992)",
    version="1.0.0"
)

app.add_middleware(CORSMiddleware, allow_origins=["*"],
                  allow_methods=["*"], allow_headers=["*"])

engine = NilmEngine()


# ── Modelos ──────────────────────────────────────────────────
class LeituraItem(BaseModel):
    ts:       datetime
    potencia: float
    tensao:   float
    corrente: float
    energia:  float

class DispositivoItem(BaseModel):
    nome:      str
    categoria: str
    potencia:  float
    status:    str

class AnalisarRequest(BaseModel):
    residencia_id: str
    horas:         int
    leituras:      list[LeituraItem]
    dispositivos:  list[DispositivoItem]

class DispositivoResultado(BaseModel):
    nome:                    str
    categoria:               str
    kwh_estimado:            float
    porcentagem:             float
    minutos_ligado_estimado: int
    ativo:                   bool

class AnalisarResponse(BaseModel):
    disponivel:               bool
    dispositivo_mais_consome: str
    consumo_porcentagem:      float
    dispositivos:             list[DispositivoResultado]
    analise:                  str
    analisado_em:             datetime


# ── Endpoints ────────────────────────────────────────────────

@app.get("/status")
def status():
    return {"status": "online", "servico": "MONITECH NILM", "versao": "1.0.0"}


@app.post("/analisar", response_model=AnalisarResponse)
def analisar(req: AnalisarRequest):
    if len(req.leituras) < 10:
        raise HTTPException(422, "Mínimo de 10 leituras necessárias.")

    leituras_raw = [(l.ts, l.potencia, l.tensao, l.corrente, l.energia)
                    for l in req.leituras]
    dispositivos_raw = [(d.nome, d.categoria, d.potencia, d.status)
                        for d in req.dispositivos]

    resultado = engine.analisar(leituras_raw, dispositivos_raw)
    return AnalisarResponse(**resultado, analisado_em=datetime.utcnow())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001)
