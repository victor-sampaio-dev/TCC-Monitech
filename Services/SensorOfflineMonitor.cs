// ============================================================
//  MONITECH — Job em background: detecta sensores offline
//  Arquivo: Services/SensorOfflineMonitor.cs
// ============================================================

using Microsoft.EntityFrameworkCore;
using Monitech.API.Data;
using Monitech.API.Models;

namespace Monitech.API.Services;

public class SensorOfflineMonitor(
    IServiceScopeFactory scopeFactory,
    ILogger<SensorOfflineMonitor> logger) : BackgroundService
{
    // Intervalo entre verificações
    private static readonly TimeSpan Intervalo    = TimeSpan.FromSeconds(10);
    // Sensor considerado offline se não reportar neste período
    private static readonly TimeSpan LimiteOffline = TimeSpan.FromSeconds(10);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Aguarda 5s no boot para o banco estar pronto
        await Task.Delay(TimeSpan.FromSeconds(5), ct);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await VerificarAsync();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[SENSOR MONITOR] Erro na verificação de offline");
            }

            await Task.Delay(Intervalo, ct);
        }
    }

    private async Task VerificarAsync()
    {
        using var scope  = scopeFactory.CreateScope();
        var db    = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var email = scope.ServiceProvider.GetRequiredService<EmailService>();

        var corteOffline = DateTime.UtcNow - LimiteOffline;

        // Sensores que o sistema ainda marca "online" mas pararam de reportar
        var sensores = await db.Sensores
            .Where(s => s.Status == "online" && s.UltimaVisualizacao < corteOffline)
            .ToListAsync();

        foreach (var sensor in sensores)
        {
            sensor.Status          = "offline";
            sensor.DataAtualizacao = DateTime.UtcNow;

            var residencia = await db.Residencias.FindAsync(sensor.IdResidencia);
            if (residencia is null) continue;

            var prefs   = await db.NotificacoesUsuarios.FindAsync(residencia.IdUsuario);
            var usuario = await db.Usuarios.FindAsync(residencia.IdUsuario);

            // Respeita preferência do usuário
            if (prefs is not null && !prefs.AlertaSensor) continue;

            // Dedup: 1 alerta por sensor a cada 24h
            var corteAlerta = DateTime.UtcNow.AddHours(-24);
            var jaExiste = await db.Alertas.AnyAsync(a =>
                a.IdSensor    == sensor.Id &&
                a.Categoria   == "sensor" &&
                a.DataCriacao >= corteAlerta);

            if (jaExiste) continue;

            var apelido   = sensor.Apelido ?? sensor.IdIot;
            var ultimaVez = sensor.UltimaVisualizacao?.ToString("dd/MM 'às' HH:mm") ?? "data desconhecida";
            var titulo    = $"Sensor offline: {apelido}";
            var mensagem  = $"O sensor \"{apelido}\" não envia leituras desde {ultimaVez}. " +
                            $"Verifique a conexão Wi-Fi, a alimentação elétrica do dispositivo " +
                            $"ou se o sensor está funcionando corretamente.";

            db.Alertas.Add(new Alerta
            {
                Id           = Guid.NewGuid().ToString(),
                IdResidencia = sensor.IdResidencia,
                IdUsuario    = residencia.IdUsuario,
                IdSensor     = sensor.Id,
                Tipo         = "error",
                Categoria    = "sensor",
                Titulo       = titulo,
                Mensagem     = mensagem
            });

            if ((prefs is null || prefs.EmailAlertas) && usuario is not null)
            {
                _ = email.EnviarAlertaAsync(usuario.Email, usuario.Nome, titulo, mensagem, "error")
                    .ContinueWith(
                        t => logger.LogError(t.Exception, "[EMAIL SENSOR OFFLINE] {Sensor}", apelido),
                        TaskContinuationOptions.OnlyOnFaulted);
            }
        }

        if (sensores.Count > 0)
            await db.SaveChangesAsync();
    }
}
