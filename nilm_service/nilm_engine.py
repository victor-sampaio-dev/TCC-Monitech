# ============================================================
#  MONITECH — Motor NILM (Desagregação de Carga)
#  Arquivo: nilm_service/nilm_engine.py
#
#  Referência: Hart, G.W. (1992)
#  "Nonintrusive Appliance Load Monitoring"
#  Proceedings of the IEEE, 80(12), 1870-1891
# ============================================================

import numpy as np
from datetime import datetime


class NilmEngine:
    """
    Algoritmo NILM baseado em detecção de eventos por delta de potência.

    Pipeline:
      1. Suavização do sinal (média móvel) → remove ruído do PZEM
      2. Detecção de eventos → |ΔP| > limiar = aparelho ligou/desligou
      3. Associação → compara delta com potência nominal do dispositivo
      4. Estimativa de kWh por dispositivo
      5. Normalização → soma bate com o kWh total medido
    """

    LIMIAR_EVENTO_W  = 25      # mínimo delta para ser evento (W)
    JANELA_SUAVIZACAO = 5      # amostras para média móvel
    MARGEM_MATCH_PCT  = 0.25   # tolerância de ±25% para associar evento

    # Faixas de potência padrão por categoria (W)
    FAIXAS_PADRAO = {
        "ar":           (700,  2500),
        "geladeira":    (100,   300),
        "chuveiro":     (3500, 7500),
        "microondas":   (700,  1500),
        "maquina":      (300,   800),
        "tv":           (50,    250),
        "computador":   (100,   600),
        "iluminacao":   (5,     200),
        "bomba":        (200,   750),
        "forno":        (1000, 3000),
        "aquecedor":    (500,  2000),
        "carregador_ev":(3000, 7000),
        "outro":        (30,   5000),
    }

    def analisar(self, leituras: list[tuple], dispositivos: list[tuple]) -> dict:
        """
        Parâmetros
        ----------
        leituras :    [(ts, potencia, tensao, corrente, energia), ...]
        dispositivos: [(nome, categoria, potencia_nominal, status), ...]

        Retorna dict compatível com AnalisarResponse
        """
        if len(leituras) < 10:
            return self._vazio()

        # Arrays numpy
        timestamps = [r[0] for r in leituras]
        potencias  = np.array([float(r[1]) for r in leituras])
        energias   = np.array([float(r[4]) for r in leituras])

        # 1. Suavização
        pot_suave = self._suavizar(potencias)

        # 2. Detecção de eventos
        eventos = self._detectar_eventos(pot_suave, timestamps)

        # 3. Duração e kWh total do período
        duracao_h = self._duracao_horas(timestamps)
        kwh_total = max(float(energias[-1] - energias[0]), 0.001)

        # 4. Estimativa por dispositivo
        estimativas = self._estimar(dispositivos, eventos, potencias, duracao_h, kwh_total)

        # 5. Normalização
        estimativas = self._normalizar(estimativas, kwh_total)

        if not estimativas:
            return self._vazio()

        maior   = estimativas[0]   # já ordenado por kwh desc
        analise = self._texto(estimativas, kwh_total, duracao_h, maior)

        return {
            "disponivel":               True,
            "dispositivo_mais_consome": maior["nome"],
            "consumo_porcentagem":      round(maior["porcentagem"], 1),
            "dispositivos":             estimativas,
            "analise":                  analise,
        }

    # ── 1. Suavização ─────────────────────────────────────────
    def _suavizar(self, p: np.ndarray) -> np.ndarray:
        j = self.JANELA_SUAVIZACAO
        return np.convolve(p, np.ones(j) / j, mode="same")

    # ── 2. Detecção de eventos ────────────────────────────────
    def _detectar_eventos(self, p: np.ndarray, ts: list) -> list[dict]:
        eventos = []
        for i in range(1, len(p)):
            delta = float(p[i]) - float(p[i - 1])
            if abs(delta) >= self.LIMIAR_EVENTO_W:
                eventos.append({
                    "i":     i,
                    "ts":    ts[i],
                    "delta": delta,
                    "tipo":  "ligar" if delta > 0 else "desligar",
                    "nivel": float(p[i]),
                })
        return eventos

    # ── 3. Duração em horas ───────────────────────────────────
    def _duracao_horas(self, ts: list) -> float:
        if len(ts) < 2:
            return 1.0
        diff = (ts[-1] - ts[0]).total_seconds()
        return max(diff / 3600, 0.01)

    # ── 4. Estimativa de consumo ──────────────────────────────
    def _estimar(self, dispositivos, eventos, potencias, duracao_h, kwh_total) -> list[dict]:
        total_nominal = sum(float(d[2]) for d in dispositivos if float(d[2]) > 0) or 1.0
        resultado     = []

        for nome, categoria, pot_nom, status in dispositivos:
            pot_nom = float(pot_nom)
            if pot_nom <= 0:
                faixa   = self.FAIXAS_PADRAO.get(categoria, (50, 5000))
                pot_nom = (faixa[0] + faixa[1]) / 2.0

            # Conta eventos compatíveis com a assinatura deste dispositivo
            n_eventos = self._match_eventos(eventos, pot_nom)

            # Estimativa de tempo ligado
            proporcao       = pot_nom / total_nominal
            min_ligado      = int(proporcao * duracao_h * 60)
            min_ligado      = max(min_ligado, n_eventos * 4)  # 4 min mínimo por evento

            kwh_est = round((pot_nom / 1000) * (min_ligado / 60), 4)
            kwh_est = min(kwh_est, kwh_total)

            resultado.append({
                "nome":                    nome,
                "categoria":               categoria,
                "kwh_estimado":            kwh_est,
                "porcentagem":             0.0,
                "minutos_ligado_estimado": min_ligado,
                "ativo":                   status in ("on", "ligado"),
            })

        return resultado

    def _match_eventos(self, eventos, pot_nom) -> int:
        margem = pot_nom * self.MARGEM_MATCH_PCT
        return sum(1 for e in eventos if abs(abs(e["delta"]) - pot_nom) <= margem)

    # ── 5. Normalização ───────────────────────────────────────
    def _normalizar(self, est: list[dict], kwh_total: float) -> list[dict]:
        soma = sum(e["kwh_estimado"] for e in est)
        if soma <= 0:
            return est

        fator = kwh_total / soma
        for e in est:
            e["kwh_estimado"] = round(e["kwh_estimado"] * fator, 4)
            e["porcentagem"]  = round((e["kwh_estimado"] / kwh_total) * 100, 1)

        return sorted(est, key=lambda x: x["kwh_estimado"], reverse=True)

    # ── Texto explicativo ─────────────────────────────────────
    def _texto(self, est, kwh_total, duracao_h, maior) -> str:
        top3  = est[:3]
        itens = [f"{e['nome']} ({e['porcentagem']:.1f}%)" for e in top3]
        custo = round(kwh_total * 0.74, 2)
        return (
            f"Período analisado: {duracao_h:.1f}h. "
            f"Consumo total medido: {kwh_total:.3f} kWh (≈ R$ {custo:.2f}). "
            f"Maior consumidor: '{maior['nome']}' com {maior['porcentagem']:.1f}% do total. "
            f"Top 3: {', '.join(itens)}."
        )

    def _vazio(self) -> dict:
        return {
            "disponivel":               False,
            "dispositivo_mais_consome": "Indeterminado",
            "consumo_porcentagem":      0.0,
            "dispositivos":             [],
            "analise":                  "Dados insuficientes. Continue coletando leituras.",
        }
