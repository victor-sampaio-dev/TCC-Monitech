// ============================================================
//  MONITECH — Serviço Cliente NILM
//  Arquivo: Services/NilmClientService.cs
//  Função:  Chama o microserviço Python para análise NILM
// ============================================================

using System.Text;
using System.Text.Json;
using Monitech.API.Data;
using Monitech.API.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Monitech.API.Services;

public class NilmClientService(IHttpClientFactory http, AppDbContext db)
{
    private static readonly JsonSerializerOptions Opts = new()
    {
        PropertyNamingPolicy        = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    // ── Solicita análise ao microserviço Python ──────────────
    public async Task<NilmResultadoResponse?> AnalisarAsync(string idResidencia, int horas = 24)
    {
        var desde = DateTime.UtcNow.AddHours(-horas);

        // 1. Busca leituras do banco
        var leituras = await db.Leituras
            .Where(l => l.IdResidencia == idResidencia && l.Timestamp >= desde)
            .OrderBy(l => l.Timestamp)
            .Select(l => new
            {
                ts       = l.Timestamp,
                potencia = (double)l.Potencia,
                tensao   = (double)l.Tensao,
                corrente = (double)l.Corrente,
                energia  = (double)l.Kwh
            })
            .ToListAsync();

        if (leituras.Count < 10) return null;

        // 2. Busca dispositivos cadastrados (assinaturas de consumo)
        var dispositivos = await db.Dispositivos
            .Where(d => d.IdResidencia == idResidencia)
            .Select(d => new
            {
                nome      = d.Nome,
                categoria = d.Categoria,
                potencia  = (double)d.PotenciaNominal,
                status    = d.Status
            })
            .ToListAsync();

        // 3. Monta payload para o Python
        var payload = new { residencia_id = idResidencia, horas, leituras, dispositivos };
        var body    = new StringContent(JsonSerializer.Serialize(payload, Opts), Encoding.UTF8, "application/json");

        try
        {
            var client = http.CreateClient("nilm");
            var resp   = await client.PostAsync("/analisar", body);
            if (!resp.IsSuccessStatusCode) return null;

            var json = await resp.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<NilmResultadoResponse>(json, Opts);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[NILM] Erro: {ex.Message}");
            return null;
        }
    }

    public async Task<bool> PingAsync()
    {
        try
        {
            var r = await http.CreateClient("nilm").GetAsync("/status");
            return r.IsSuccessStatusCode;
        }
        catch { return false; }
    }
}
