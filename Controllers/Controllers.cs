// ============================================================
//  MONITECH — Controllers da API
//  Arquivo: Controllers/Controllers.cs
//  Todos os endpoints espelham os stubs do system.js
// ============================================================

using Google.Apis.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Monitech.API.Data;
using Monitech.API.DTOs;
using Monitech.API.Models;
using Monitech.API.Services;

namespace Monitech.API.Controllers;

// ════════════════════════════════════════════════════════════
//  AUTH  /api/auth
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/auth")]
public class AuthController(AuthService auth, AppDbContext db, IConfiguration config) : ControllerBase
{
    /// POST /api/auth/cadastro
    [HttpPost("cadastro")]
    public async Task<IActionResult> Cadastro([FromBody] CadastroRequest req)
    {
        try
        {
            var u = await auth.CadastrarAsync(req);
            return Ok(new { sucesso = true, usuario = new { u.Id, u.Nome, u.Email } });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { sucesso = false, erro = ex.Message });
        }
        catch (Exception ex)
        {
            // Log do erro para debug
            Console.WriteLine($"[ERRO CADASTRO] {ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao criar conta. Tente novamente." });
        }
    }

    /// POST /api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        try
        {
            var ip   = HttpContext.Connection.RemoteIpAddress?.ToString();
            var resp = await auth.LoginAsync(req, ip);
            return Ok(resp);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { sucesso = false, erro = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO LOGIN] {ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao processar login. Tente novamente." });
        }
    }

    /// POST /api/auth/google — login ou cadastro via Google OAuth
    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.IdToken))
            return BadRequest(new { sucesso = false, erro = "Token Google não fornecido." });
        try
        {
            var resp = await auth.GoogleLoginAsync(req.IdToken);
            return Ok(resp);
        }
        catch (InvalidJwtException)
        {
            return Unauthorized(new { sucesso = false, erro = "Token Google inválido ou expirado." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO GOOGLE] {ex.GetType().Name}: {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao autenticar com Google." });
        }
    }

    /// POST /api/auth/esqueceu-senha
    [HttpPost("esqueceu-senha")]
    public async Task<IActionResult> EsqueceuSenha([FromBody] EsqueceuSenhaRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { sucesso = false, erro = "E-mail é obrigatório." });
        try
        {
            var urlBase = $"{Request.Scheme}://{Request.Host}";
            await auth.SolicitarRecuperacaoSenhaAsync(req.Email, urlBase);
            return Ok(new { sucesso = true, mensagem = "Se o e-mail estiver cadastrado, você receberá as instruções em breve." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO ESQUECEU-SENHA] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao processar solicitação. Tente novamente." });
        }
    }

    /// POST /api/auth/resetar-senha
    [HttpPost("resetar-senha")]
    public async Task<IActionResult> ResetarSenha([FromBody] ResetarSenhaRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.NovaSenha))
            return BadRequest(new { sucesso = false, erro = "Token e nova senha são obrigatórios." });
        if (req.NovaSenha.Length < 8)
            return BadRequest(new { sucesso = false, erro = "A senha deve ter pelo menos 8 caracteres." });

        var ok = await auth.ResetarSenhaAsync(req.Token, req.NovaSenha);
        if (!ok)
            return BadRequest(new { sucesso = false, erro = "Link inválido ou expirado. Solicite um novo." });

        return Ok(new { sucesso = true, mensagem = "Senha redefinida com sucesso!" });
    }

    /// POST /api/auth/2fa/verificar — valida código TOTP após login com email/senha
    [HttpPost("2fa/verificar")]
    public async Task<IActionResult> Verificar2FaLogin([FromBody] Verificar2FaLoginRequest req)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var chave   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Chave"]!));
            var parms   = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey         = chave,
                ValidateIssuer           = false,
                ValidateAudience         = false,
                ClockSkew                = TimeSpan.Zero
            };

            ClaimsPrincipal principal;
            try   { principal = handler.ValidateToken(req.TokenTemp, parms, out _); }
            catch { return Unauthorized(new { sucesso = false, erro = "Sessão expirada. Faça login novamente." }); }

            if (principal.FindFirst("tipo")?.Value != "2fa-pending")
                return Unauthorized(new { sucesso = false, erro = "Token inválido." });

            var userId  = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var usuario = await db.Usuarios.FindAsync(userId);

            if (usuario is null || usuario.Status != "active")
                return Unauthorized(new { sucesso = false, erro = "Usuário não encontrado ou suspenso." });

            if (string.IsNullOrEmpty(usuario.TotpSecret) || !_VerificarTotp(_Base32Decode(usuario.TotpSecret), req.Codigo))
                return Unauthorized(new { sucesso = false, erro = "Código inválido. Tente novamente." });

            var expira = DateTime.UtcNow.AddHours(24);
            var token  = auth.GerarToken(usuario, expira);

            db.Sessoes.Add(new Sessao
            {
                Id        = Guid.NewGuid().ToString(),
                IdUsuario = usuario.Id,
                HashToken = AuthService.HashToken(token),
                ExpiraEm  = expira
            });
            usuario.UltimaLogin     = DateTime.UtcNow;
            usuario.DataAtualizacao = DateTime.UtcNow;
            await db.SaveChangesAsync();

            return Ok(new LoginResponse(
                Sucesso:  true,
                Token:    token,
                Usuario:  new UsuarioDto(usuario.Id, $"{usuario.Nome} {usuario.Sobrenome}".Trim(), usuario.Email, usuario.FotoUrl, usuario.DataCriacao, usuario.Role),
                ExpiraEm: expira
            ));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO 2FA-VERIFICAR] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao verificar código." });
        }
    }

    private static bool _VerificarTotp(byte[] secret, string codigo, int janela = 1)
    {
        if (!int.TryParse(codigo, out var code)) return false;
        var t = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        for (var d = -janela; d <= janela; d++)
            if (_GerarTotp(secret, t + d) == code) return true;
        return false;
    }

    private static int _GerarTotp(byte[] secret, long contador)
    {
        var cb = BitConverter.GetBytes(contador);
        if (BitConverter.IsLittleEndian) Array.Reverse(cb);
        using var hmac = new System.Security.Cryptography.HMACSHA1(secret);
        var hash = hmac.ComputeHash(cb);
        var off  = hash[^1] & 0x0F;
        return (((hash[off] & 0x7F) << 24) | ((hash[off+1] & 0xFF) << 16)
              | ((hash[off+2] & 0xFF) << 8)  | (hash[off+3] & 0xFF)) % 1_000_000;
    }

    private static byte[] _Base32Decode(string input)
    {
        const string A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var s      = input.ToUpperInvariant().TrimEnd('=');
        var output = new byte[s.Length * 5 / 8];
        int buf = 0, bits = 0, idx = 0;
        foreach (var c in s) { var v = A.IndexOf(c); if (v < 0) continue; buf = (buf << 5) | v; bits += 5; if (bits >= 8 && idx < output.Length) { bits -= 8; output[idx++] = (byte)((buf >> bits) & 0xFF); } }
        return output;
    }
}

// ════════════════════════════════════════════════════════════
//  RESIDENCIAS  /api/residencia
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/residencia"), Authorize]
public class ResidenciaController(AppDbContext db) : ControllerBase
{
    private string UsuarioId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// POST /api/residencia
    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarResidenciaRequest req)
    {
        var r = new Residencia
        {
            Id            = Guid.NewGuid().ToString(),
            IdUsuario     = UsuarioId,
            Nome          = req.Nome,
            Tipo          = req.Tipo,
            Endereco      = req.Endereco,
            Cidade        = req.Cidade,
            Estado        = req.Estado,
            Cep           = req.Cep,
            AreaM2        = req.AreaM2,
            Distribuidora = req.Distribuidora,
            TarifaKwh     = req.TarifaKwh
        };
        db.Residencias.Add(r);
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true, residencia = r });
    }

    /// GET /api/residencia
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        var lista = await db.Residencias
            .Where(r => r.IdUsuario == UsuarioId && r.Ativo)
            .OrderByDescending(r => r.DataCriacao)
            .ToListAsync();
        return Ok(new { sucesso = true, residencias = lista });
    }

    /// GET /api/residencia/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> Obter(string id)
    {
        var r = await db.Residencias.FirstOrDefaultAsync(r => r.Id == id && r.IdUsuario == UsuarioId);
        if (r is null) return NotFound(new { sucesso = false, erro = "Residência não encontrada." });
        return Ok(new { sucesso = true, residencia = r });
    }

    /// PATCH /api/residencia/{id}
    [HttpPatch("{id}")]
    public async Task<IActionResult> Atualizar(string id, [FromBody] AtualizarResidenciaRequest req)
    {
        var r = await db.Residencias.FirstOrDefaultAsync(r => r.Id == id && r.IdUsuario == UsuarioId);
        if (r is null) return NotFound(new { sucesso = false, erro = "Residência não encontrada." });

        if (req.Nome          is not null) r.Nome          = req.Nome;
        if (req.Tipo          is not null) r.Tipo          = req.Tipo;
        if (req.Cep           is not null) r.Cep           = req.Cep;
        if (req.Cidade        is not null) r.Cidade        = req.Cidade;
        if (req.Estado        is not null) r.Estado        = req.Estado;
        if (req.AreaM2        is not null) r.AreaM2        = req.AreaM2;
        if (req.Distribuidora is not null) r.Distribuidora = req.Distribuidora;
        if (req.TarifaKwh     is not null) r.TarifaKwh     = req.TarifaKwh.Value;

        r.DataAtualizacao = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true, residencia = r });
    }
}

// ════════════════════════════════════════════════════════════
//  COMODOS  /api/comodos
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/comodos"), Authorize]
public class ComodosController(AppDbContext db) : ControllerBase
{
    private string UsuarioId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// GET /api/comodos/:idResidencia
    [HttpGet("{idResidencia}")]
    public async Task<IActionResult> Listar(string idResidencia)
    {
        try
        {
            var temAcesso = await db.Residencias.AnyAsync(r => r.Id == idResidencia && r.IdUsuario == UsuarioId);
            if (!temAcesso) return Forbid();

            var comodos = await db.Comodos
                .Where(c => c.IdResidencia == idResidencia)
                .OrderBy(c => c.OrdemExibicao)
                .Include(c => c.Dispositivos)
                .ToListAsync();

            return Ok(new { sucesso = true, comodos });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { sucesso = false, erro = ex.Message, detalhe = ex.InnerException?.Message });
        }
    }

    /// POST /api/comodos
    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarComodoRequest req)
    {
        var temAcesso = await db.Residencias
            .AnyAsync(r => r.Id == req.IdResidencia && r.IdUsuario == UsuarioId);
        if (!temAcesso) return Forbid();

        var c = new Comodo
        {
            Id            = Guid.NewGuid().ToString(),
            IdResidencia  = req.IdResidencia,
            Nome          = req.Nome,
            Tipo          = req.Tipo,
            Andar         = req.Andar,
            AreaM2        = req.AreaM2,
            OrdemExibicao = req.OrdemExibicao
        };
        db.Comodos.Add(c);
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true, comodo = c });
    }

    /// DELETE /api/comodos/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Remover(string id)
    {
        var c = await db.Comodos
            .Include(c => c.Residencia)
            .FirstOrDefaultAsync(c => c.Id == id && c.Residencia!.IdUsuario == UsuarioId);
        if (c is null) return NotFound();
        db.Comodos.Remove(c);
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true });
    }
}

// ════════════════════════════════════════════════════════════
//  DISPOSITIVOS  /api/dispositivos
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/dispositivos"), Authorize]
public class DispositivosController(AppDbContext db) : ControllerBase
{
    private string UsuarioId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// GET /api/dispositivos/:idResidencia
    [HttpGet("{idResidencia}")]
    public async Task<IActionResult> Listar(string idResidencia)
    {
        try
        {
            var temAcesso = await db.Residencias
                .AnyAsync(r => r.Id == idResidencia && r.IdUsuario == UsuarioId);
            if (!temAcesso) return Forbid();

            var lista = await db.Dispositivos
                .Where(d => d.IdResidencia == idResidencia)
                .Include(d => d.Comodo)
                .OrderBy(d => d.Comodo!.Nome).ThenBy(d => d.Nome)
                .ToListAsync();

            return Ok(new { sucesso = true, dispositivos = lista });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { sucesso = false, erro = ex.Message, detalhe = ex.InnerException?.Message });
        }
    }

    /// POST /api/dispositivos
    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarDispositivoRequest req)
    {
        var temAcesso = await db.Residencias
            .AnyAsync(r => r.Id == req.IdResidencia && r.IdUsuario == UsuarioId);
        if (!temAcesso) return Forbid();

        var d = new Dispositivo
        {
            Id               = Guid.NewGuid().ToString(),
            IdComodo         = req.IdComodo,
            IdResidencia     = req.IdResidencia,
            Nome             = req.Nome,
            Categoria        = req.Categoria,
            Marca            = req.Marca,
            Modelo           = req.Modelo,
            PotenciaNominal  = req.PotenciaNominal,
            Tensao           = req.Tensao,
            IdDispositivoIot = req.IdDispositivoIot
        };
        db.Dispositivos.Add(d);
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true, dispositivo = d });
    }

    /// PATCH /api/dispositivos/{id}/status
    [HttpPatch("{id}/status")]
    public async Task<IActionResult> AlterarStatus(string id, [FromBody] string novoStatus)
    {
        if (string.IsNullOrWhiteSpace(novoStatus))
            return BadRequest(new { sucesso = false, erro = "Status inválido." });

        var d = await db.Dispositivos
            .Include(d => d.Residencia)
            .FirstOrDefaultAsync(d => d.Id == id && d.Residencia!.IdUsuario == UsuarioId);
        if (d is null) return NotFound();
        d.Status          = novoStatus;
        d.DataAtualizacao = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true, dispositivo = d });
    }
}

// ════════════════════════════════════════════════════════════
//  SENSORES  /api/sensores
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/sensores"), Authorize]
public class SensoresController(AppDbContext db) : ControllerBase
{
    private string UsuarioId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// POST /api/sensores/registrar  — usuário vincula ESP32 à conta
    [HttpPost("registrar")]
    public async Task<IActionResult> Registrar([FromBody] RegistrarSensorRequest req)
    {
        var temAcesso = await db.Residencias
            .AnyAsync(r => r.Id == req.IdResidencia && r.IdUsuario == UsuarioId);
        if (!temAcesso) return Forbid();

        if (await db.Sensores.AnyAsync(s => s.IdIot == req.IdIot.ToUpper()))
            return Conflict(new { sucesso = false, erro = "Código IoT já registrado." });

        // Gera token secreto — o ESP32 vai usar isso para autenticar
        var tokenCru   = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var tokenHash  = BCrypt.Net.BCrypt.HashPassword(tokenCru);

        var s = new Sensor
        {
            Id               = Guid.NewGuid().ToString(),
            IdResidencia     = req.IdResidencia,
            IdIot            = req.IdIot.ToUpper().Trim(),
            Apelido          = req.Apelido,
            Protocolo        = req.Protocolo,
            IntervaloPollingMs = req.IntervaloMs,
            TokenSecreto     = tokenHash,
            Status           = "offline"
        };
        db.Sensores.Add(s);
        await db.SaveChangesAsync();

        return Ok(new RegistrarSensorResponse(
            Sucesso:      true,
            IdSensor:     s.Id,
            IdIot:        s.IdIot,
            TokenSecreto: tokenCru,   // retornado UMA VEZ — não fica salvo em texto puro
            Mensagem:     "Sensor registrado! Grave o token no firmware do ESP32 — ele não será exibido novamente."
        ));
    }

    /// GET /api/sensores/{idResidencia}
    [HttpGet("{idResidencia}")]
    public async Task<IActionResult> Listar(string idResidencia)
    {
        var sensores = await db.Sensores
            .Where(s => s.IdResidencia == idResidencia)
            .Select(s => new
            {
                s.Id, s.IdIot, s.Apelido, s.Status, s.Protocolo,
                s.EnderecoIp, s.SsidWifi, s.VersaoFirmware,
                s.UltimaVisualizacao, s.RssiDbm, s.ModeloSensor
            })
            .ToListAsync();
        return Ok(new { sucesso = true, sensores });
    }
}

// ════════════════════════════════════════════════════════════
//  MEDICOES  /api/medicoes  — chamado pelo ESP32
//  Não usa JWT, usa token secreto do sensor
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/medicoes")]
public class MedicoesController(AppDbContext db, EmailService email, IServiceScopeFactory scopeFactory) : ControllerBase
{
    /// POST /api/medicoes
    [HttpPost]
    public async Task<IActionResult> Receber([FromBody] MedicaoEsp32Request req)
    {
        // 1. Encontra o sensor pelo IdIot
        var sensor = await db.Sensores
            .FirstOrDefaultAsync(s => s.IdIot == req.DispositivoId.ToUpper());

        if (sensor is null)
            return Unauthorized(new { status = "erro", mensagem = "Dispositivo não encontrado." });

        // 2. Valida o token
        if (!BCrypt.Net.BCrypt.Verify(req.Token, sensor.TokenSecreto))
            return Unauthorized(new { status = "erro", mensagem = "Token inválido." });

        // 3. Salva a leitura
        var leitura = new Leitura
        {
            IdSensor         = sensor.Id,
            IdResidencia     = sensor.IdResidencia,
            Tensao           = req.Tensao,
            Corrente         = req.Corrente,
            Potencia         = req.Potencia,
            PotenciaAparente = req.PotenciaAparente,
            PotenciaReativa  = req.PotenciaReativa,
            FatorPotencia    = req.FatorPotencia,
            FrequenciaHz     = req.Frequencia,
            Kwh              = req.EnergiKwh,
            Timestamp        = DateTime.UtcNow
        };
        db.Leituras.Add(leitura);

        // 4. Atualiza info do sensor
        sensor.Status             = "online";
        sensor.UltimaVisualizacao = DateTime.UtcNow;
        sensor.RssiDbm            = req.RssiDbm;
        sensor.VersaoFirmware     = req.VersaoFirmware ?? sensor.VersaoFirmware;
        sensor.SsidWifi           = req.SsidWifi ?? sensor.SsidWifi;
        sensor.EnderecoIp         = req.Ip ?? sensor.EnderecoIp;
        sensor.DataAtualizacao    = DateTime.UtcNow;

        await db.SaveChangesAsync();

        // 5. Verifica alertas em background com scope próprio — evita uso do DbContext
        //    do request após ele ser descartado no fim do ciclo de vida do controller.
        var sensorId  = sensor.Id;
        var leituraId = leitura.Id;
        _ = Task.Run(async () =>
        {
            await using var scope  = scopeFactory.CreateAsyncScope();
            var scopedDb           = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var scopedEmail        = scope.ServiceProvider.GetRequiredService<EmailService>();
            var s = await scopedDb.Sensores.FindAsync(sensorId);
            var l = await scopedDb.Leituras.FindAsync(leituraId);
            if (s is not null && l is not null)
                await new _AlertaHelper(scopedDb, scopedEmail).VerificarAsync(s, l);
        });

        return Ok(new MedicaoResponse("ok", "Leitura registrada.", leitura.Timestamp));
    }

}

// ── Lógica de alertas com DbContext próprio (usado pelo Task.Run do background) ──
internal sealed class _AlertaHelper(AppDbContext db, EmailService email)
{
    public async Task VerificarAsync(Sensor sensor, Leitura leitura)
    {
        try
        {
            var residencia = await db.Residencias.FindAsync(sensor.IdResidencia);
            if (residencia is null) return;

            var prefs   = await db.NotificacoesUsuarios.FindAsync(residencia.IdUsuario);
            var usuario = await db.Usuarios.FindAsync(residencia.IdUsuario);

            await DetectarEventoDispositivoAsync(sensor, leitura.Potencia);
            await ChecarDiscrepanciaAsync(sensor, leitura.Potencia, residencia, prefs, usuario);
            await ChecarTensaoAsync(sensor, leitura.Tensao, residencia, prefs, usuario);
            await ChecarLimiteKwhAsync(sensor, residencia, prefs, usuario);
            await ChecarLimiteCustoAsync(sensor, residencia, prefs, usuario);
        }
        catch { }
    }

    private async Task DetectarEventoDispositivoAsync(Sensor sensor, decimal potenciaAtual)
    {
        var ultimas = await db.Leituras
            .Where(l => l.IdSensor == sensor.Id)
            .OrderByDescending(l => l.Timestamp)
            .Take(2)
            .ToListAsync();

        if (ultimas.Count < 2) return;

        var delta = potenciaAtual - ultimas[1].Potencia;
        if (Math.Abs(delta) < 15) return;

        var dispositivos = await db.Dispositivos
            .Where(d => d.IdResidencia == sensor.IdResidencia && d.Monitorado)
            .ToListAsync();

        var candidatos = dispositivos
            .Where(d => delta > 0 ? d.Status == "off" : d.Status == "on")
            .ToList();

        var absDelta = Math.Abs(delta);
        var melhor   = candidatos
            .Select(d => (disp: d, erro: Math.Abs(d.PotenciaNominal - absDelta)))
            .Where(x => x.disp.PotenciaNominal > 0 &&
                        x.erro <= x.disp.PotenciaNominal * 0.30m)
            .OrderBy(x => x.erro)
            .FirstOrDefault();

        if (melhor.disp is null) return;

        melhor.disp.Status          = delta > 0 ? "on" : "off";
        melhor.disp.DataAtualizacao = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    private async Task ChecarDiscrepanciaAsync(Sensor sensor, decimal potenciaMedida,
        Residencia residencia, NotificacoesUsuario? prefs, Usuario? usuario)
    {
        if (potenciaMedida < 10) return;

        var somaAtivos = await db.Dispositivos
            .Where(d => d.IdResidencia == sensor.IdResidencia && d.Status == "on")
            .SumAsync(d => d.PotenciaNominal);

        var somaCadastrada = somaAtivos > 0
            ? somaAtivos
            : await db.Dispositivos
                .Where(d => d.IdResidencia == sensor.IdResidencia)
                .SumAsync(d => d.PotenciaNominal);

        if (somaCadastrada == 0) return;

        var diferenca    = potenciaMedida - somaCadastrada;
        var diferencaPct = (double)(diferenca / somaCadastrada) * 100;

        if (diferencaPct >= 40)
        {
            var corte = DateTime.UtcNow.AddHours(-2);
            if (await db.Alertas.AnyAsync(a => a.IdResidencia == sensor.IdResidencia &&
                    a.Categoria == "anomaly" && a.Tipo == "error" && a.DataCriacao >= corte)) return;

            var titulo   = $"Consumo muito acima do esperado (+{diferencaPct:F0}%)";
            var mensagem = $"O sensor mediu {potenciaMedida:F0}W, mas o total dos dispositivos cadastrados é {somaCadastrada:F0}W " +
                           $"({Math.Abs(diferenca):F0}W a mais). Verifique se há aparelhos não cadastrados ou fuga de energia.";

            await SalvarAlertaAsync(sensor, residencia, "error", "anomaly", titulo, mensagem, potenciaMedida, somaCadastrada);
            if ((prefs is null || (prefs.EmailAlertas && prefs.AlertaAnomalia)) && usuario is not null)
                _ = email.EnviarAlertaAsync(usuario.Email, usuario.Nome, titulo, mensagem, "error");
        }
        else if (diferencaPct >= 15)
        {
            var corte = DateTime.UtcNow.AddHours(-1);
            if (await db.Alertas.AnyAsync(a => a.IdResidencia == sensor.IdResidencia &&
                    a.Categoria == "consumption" && a.Tipo == "warning" &&
                    a.Titulo!.StartsWith("Consumo acima") && a.DataCriacao >= corte)) return;

            var titulo   = $"Consumo acima do esperado (+{diferencaPct:F0}%)";
            var mensagem = $"O sensor mediu {potenciaMedida:F0}W, mas o total dos dispositivos ligados é {somaCadastrada:F0}W " +
                           $"({Math.Abs(diferenca):F0}W a mais). Provável dispositivo não cadastrado.";

            await SalvarAlertaAsync(sensor, residencia, "warning", "consumption", titulo, mensagem, potenciaMedida, somaCadastrada);
            if ((prefs is null || (prefs.EmailAlertas && prefs.AlertaConsumo)) && usuario is not null)
                _ = email.EnviarAlertaAsync(usuario.Email, usuario.Nome, titulo, mensagem, "warning");
        }
        else if (diferencaPct <= -40)
        {
            var corte = DateTime.UtcNow.AddHours(-2);
            if (await db.Alertas.AnyAsync(a => a.IdResidencia == sensor.IdResidencia &&
                    a.Categoria == "anomaly" && a.Tipo == "warning" &&
                    a.Titulo!.StartsWith("Consumo muito abaixo") && a.DataCriacao >= corte)) return;

            var titulo   = $"Consumo muito abaixo do esperado ({diferencaPct:F0}%)";
            var mensagem = $"O sensor mediu {potenciaMedida:F0}W, mas o total cadastrado é {somaCadastrada:F0}W. " +
                           $"Algum aparelho pode estar desconectado ou com potência cadastrada incorretamente.";

            await SalvarAlertaAsync(sensor, residencia, "warning", "anomaly", titulo, mensagem, potenciaMedida, somaCadastrada);
            if ((prefs is null || (prefs.EmailAlertas && prefs.AlertaAnomalia)) && usuario is not null)
                _ = email.EnviarAlertaAsync(usuario.Email, usuario.Nome, titulo, mensagem, "warning");
        }
        else if (diferencaPct <= -20)
        {
            var corte = DateTime.UtcNow.AddHours(-1);
            if (await db.Alertas.AnyAsync(a => a.IdResidencia == sensor.IdResidencia &&
                    a.Categoria == "consumption" && a.Tipo == "info" &&
                    a.Titulo!.StartsWith("Consumo abaixo") && a.DataCriacao >= corte)) return;

            var titulo   = $"Consumo abaixo do esperado ({diferencaPct:F0}%)";
            var mensagem = $"O sensor mediu {potenciaMedida:F0}W, mas o total cadastrado é {somaCadastrada:F0}W. " +
                           $"Verifique se todos os aparelhos estão ligados.";

            await SalvarAlertaAsync(sensor, residencia, "info", "consumption", titulo, mensagem, potenciaMedida, somaCadastrada);
            if ((prefs is null || (prefs.EmailAlertas && prefs.AlertaConsumo)) && usuario is not null)
                _ = email.EnviarAlertaAsync(usuario.Email, usuario.Nome, titulo, mensagem, "info");
        }
    }

    private async Task ChecarTensaoAsync(Sensor sensor, decimal tensao,
        Residencia residencia, NotificacoesUsuario? prefs, Usuario? usuario)
    {
        if (prefs is not null && !prefs.AlertaTensao) return;
        if (tensao <= 0) return;

        var VOLT_MIN = prefs?.TensaoMin ?? 198m;
        var VOLT_MAX = prefs?.TensaoMax ?? 242m;
        if (tensao >= VOLT_MIN && tensao <= VOLT_MAX) return;

        var corte = DateTime.UtcNow.AddMinutes(-30);
        if (await db.Alertas.AnyAsync(a => a.IdResidencia == sensor.IdResidencia &&
                a.Categoria == "voltage" && a.DataCriacao >= corte)) return;

        string titulo, mensagem, tipo;
        if (tensao < VOLT_MIN)
        {
            tipo     = "warning";
            titulo   = $"Tensão baixa detectada ({tensao:F1}V)";
            mensagem = $"Tensão ({tensao:F1}V) abaixo do mínimo ANEEL ({VOLT_MIN}V). Pode danificar aparelhos.";
        }
        else
        {
            tipo     = "error";
            titulo   = $"Tensão alta detectada ({tensao:F1}V)";
            mensagem = $"Tensão ({tensao:F1}V) acima do máximo ANEEL ({VOLT_MAX}V). Risco de danos aos equipamentos.";
        }

        await SalvarAlertaAsync(sensor, residencia, tipo, "voltage", titulo, mensagem, tensao, tensao < VOLT_MIN ? VOLT_MIN : VOLT_MAX);
        if ((prefs is null || prefs.EmailAlertas) && usuario is not null)
            _ = email.EnviarAlertaAsync(usuario.Email, usuario.Nome, titulo, mensagem, tipo);
    }

    private async Task ChecarLimiteKwhAsync(Sensor sensor,
        Residencia residencia, NotificacoesUsuario? prefs, Usuario? usuario)
    {
        if (prefs?.LimiteKwh is null or <= 0) return;

        var hoje   = DateTime.UtcNow.Date;
        var amanha = hoje.AddDays(1);
        var leituras = await db.Leituras
            .Where(l => l.IdResidencia == sensor.IdResidencia &&
                        l.Timestamp >= hoje && l.Timestamp < amanha)
            .OrderBy(l => l.Timestamp)
            .ToListAsync();

        if (leituras.Count < 2) return;

        var kwhHoje = Math.Max(0, leituras.Last().Kwh - leituras.First().Kwh);
        if (kwhHoje <= prefs.LimiteKwh.Value) return;

        var corte = DateTime.UtcNow.AddHours(-4);
        if (await db.Alertas.AnyAsync(a => a.IdResidencia == sensor.IdResidencia &&
                a.Categoria == "consumption" && a.Tipo == "warning" &&
                a.Titulo!.StartsWith("Limite diário") && a.DataCriacao >= corte)) return;

        var titulo   = $"Limite diário de consumo atingido ({kwhHoje:F2} kWh)";
        var mensagem = $"Consumo hoje ({kwhHoje:F2} kWh) ultrapassou seu limite de {prefs.LimiteKwh.Value:F2} kWh/dia.";

        await SalvarAlertaAsync(sensor, residencia, "warning", "consumption", titulo, mensagem, kwhHoje, prefs.LimiteKwh.Value);
        if (prefs.EmailAlertas && prefs.AlertaConsumo && usuario is not null)
            _ = email.EnviarAlertaAsync(usuario.Email, usuario.Nome, titulo, mensagem, "warning");
    }

    private async Task ChecarLimiteCustoAsync(Sensor sensor,
        Residencia residencia, NotificacoesUsuario? prefs, Usuario? usuario)
    {
        if (prefs?.LimiteCusto is null or <= 0) return;

        var mesInicio = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var leituras  = await db.Leituras
            .Where(l => l.IdResidencia == sensor.IdResidencia && l.Timestamp >= mesInicio)
            .OrderBy(l => l.Timestamp)
            .ToListAsync();

        if (leituras.Count < 2) return;

        var kwhMes   = Math.Max(0, leituras.Last().Kwh - leituras.First().Kwh);
        var custoMes = kwhMes * residencia.TarifaKwh;
        if (custoMes <= prefs.LimiteCusto.Value) return;

        var corte = DateTime.UtcNow.AddHours(-24);
        if (await db.Alertas.AnyAsync(a => a.IdResidencia == sensor.IdResidencia &&
                a.Categoria == "consumption" && a.Tipo == "warning" &&
                a.Titulo!.StartsWith("Limite mensal") && a.DataCriacao >= corte)) return;

        var titulo   = $"Limite mensal de custo atingido (R$ {custoMes:F2})";
        var mensagem = $"Custo estimado do mês (R$ {custoMes:F2}) ultrapassou o limite de R$ {prefs.LimiteCusto.Value:F2}. Consumo: {kwhMes:F2} kWh.";

        await SalvarAlertaAsync(sensor, residencia, "warning", "consumption", titulo, mensagem, custoMes, prefs.LimiteCusto.Value);
        if (prefs.EmailAlertas && prefs.AlertaConsumo && usuario is not null)
            _ = email.EnviarAlertaAsync(usuario.Email, usuario.Nome, titulo, mensagem, "warning");
    }

    private async Task SalvarAlertaAsync(Sensor sensor, Residencia residencia,
        string tipo, string categoria, string titulo, string mensagem,
        decimal valorDisparador, decimal valorLimiar)
    {
        db.Alertas.Add(new Alerta
        {
            Id              = Guid.NewGuid().ToString(),
            IdResidencia    = sensor.IdResidencia,
            IdUsuario       = residencia.IdUsuario,
            IdSensor        = sensor.Id,
            Tipo            = tipo,
            Categoria       = categoria,
            Titulo          = titulo,
            Mensagem        = mensagem,
            ValorDisparador = valorDisparador,
            ValorLimiar     = valorLimiar
        });
        await db.SaveChangesAsync();
    }
}

// ════════════════════════════════════════════════════════════
//  DASHBOARD  /api/dashboard
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/dashboard"), Authorize]
public class DashboardController(AppDbContext db, TarifaService tarifas) : ControllerBase
{
    private string UsuarioId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// GET /api/dashboard/resumo?idResidencia=...
    [HttpGet("resumo")]
    public async Task<IActionResult> Resumo([FromQuery] string idResidencia)
    {
        var residencia = await db.Residencias
            .FirstOrDefaultAsync(r => r.Id == idResidencia && r.IdUsuario == UsuarioId);
        if (residencia is null) return Forbid();

        var hoje   = DateTime.UtcNow.Date;
        var amanha = hoje.AddDays(1);
        var mesInicio = new DateTime(hoje.Year, hoje.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        // Última leitura
        var ultima = await db.Leituras
            .Where(l => l.IdResidencia == idResidencia)
            .OrderByDescending(l => l.Timestamp)
            .FirstOrDefaultAsync();

        // Leituras de hoje — kWh = diferença entre última e primeira do dia
        var leiturasHoje = await db.Leituras
            .Where(l => l.IdResidencia == idResidencia
                     && l.Timestamp >= hoje && l.Timestamp < amanha)
            .OrderBy(l => l.Timestamp)
            .ToListAsync();

        decimal kwhHoje = leiturasHoje.Count > 1
            ? Math.Max(0, leiturasHoje.Last().Kwh - leiturasHoje.First().Kwh)
            : 0;

        // kWh do mês
        var leiturasmes = await db.Leituras
            .Where(l => l.IdResidencia == idResidencia && l.Timestamp >= mesInicio)
            .OrderBy(l => l.Timestamp)
            .ToListAsync();

        decimal kwhMes = leiturasmes.Count > 1
            ? Math.Max(0, leiturasmes.Last().Kwh - leiturasmes.First().Kwh)
            : 0;

        var alertas = await db.Alertas
            .CountAsync(a => a.IdResidencia == idResidencia && !a.Lido);

        var sensor = await db.Sensores
            .Where(s => s.IdResidencia == idResidencia)
            .OrderByDescending(s => s.UltimaVisualizacao)
            .Select(s => new { s.Status })
            .FirstOrDefaultAsync();

        // Tarifa viva: usa ANEEL (cache 24h) + bandeira vigente. Fallback = valor do banco.
        var tarifaKwh = residencia.TarifaKwh;
        if (!string.IsNullOrEmpty(residencia.Distribuidora))
        {
            await tarifas.AtualizarTarifasAsync();
            var dist = tarifas.GetDistribuidora(residencia.Distribuidora);
            if (dist is not null)
            {
                var bandeira  = await tarifas.GetBandeiraAsync();
                tarifaKwh     = dist.TarifaB1 + bandeira.AdicionalPor100Kwh / 100m;
            }
        }

        return Ok(new DashboardResumoResponse(
            Sucesso:            true,
            KwhHoje:            kwhHoje,
            CustoHoje:          Math.Round(kwhHoje * tarifaKwh, 2),
            PotenciaAtual:      ultima?.Potencia ?? 0,
            TensaoAtual:        ultima?.Tensao ?? 0,
            CorrenteAtual:      ultima?.Corrente ?? 0,
            FrequenciaAtual:    ultima?.FrequenciaHz ?? 0,
            FatorPotenciaAtual: ultima?.FatorPotencia ?? 0,
            KwhMes:             kwhMes,
            CustoMes:           Math.Round(kwhMes * tarifaKwh, 2),
            AlertasNaoLidos:    alertas,
            StatusSensor:       sensor?.Status ?? "offline",
            UltimaLeitura:      ultima?.Timestamp
        ));
    }

    /// GET /api/leituras/aovivo/:idSensor
    [HttpGet("/api/leituras/aovivo/{idSensor}")]
    public async Task<IActionResult> AoVivo(string idSensor)
    {
        var sensor = await db.Sensores
            .Include(s => s.Residencia)
            .FirstOrDefaultAsync(s => s.Id == idSensor && s.Residencia!.IdUsuario == UsuarioId);
        if (sensor is null) return Forbid();

        var ultima = await db.Leituras
            .Where(l => l.IdSensor == idSensor)
            .OrderByDescending(l => l.Timestamp)
            .FirstOrDefaultAsync();

        if (ultima is null)
            return Ok(new { sucesso = false, mensagem = "Nenhuma leitura disponível ainda." });

        // Considera offline se a última leitura tem mais de 30 segundos
        var ativa = (DateTime.UtcNow - ultima.Timestamp).TotalSeconds <= 30;

        return Ok(new LeituraAoVivoResponse(
            Sucesso:          ativa,
            Tensao:           ultima.Tensao,
            Corrente:         ultima.Corrente,
            Potencia:         ultima.Potencia,
            PotenciaAparente: ultima.PotenciaAparente,
            PotenciaReativa:  ultima.PotenciaReativa,
            FatorPotencia:    ultima.FatorPotencia,
            FrequenciaHz:     ultima.FrequenciaHz,
            Kwh:              ultima.Kwh,
            Timestamp:        ultima.Timestamp
        ));
    }

    /// GET /api/leituras/historico?idResidencia=...&periodo=day
    [HttpGet("/api/leituras/historico")]
    public async Task<IActionResult> Historico([FromQuery] string idResidencia, [FromQuery] string periodo = "day")
    {
        var desde = periodo switch
        {
            "week"  => DateTime.UtcNow.AddDays(-7),
            "month" => DateTime.UtcNow.AddDays(-30),
            "year"  => DateTime.UtcNow.AddDays(-365),
            _       => DateTime.UtcNow.AddHours(-24)
        };

        var leituras = await db.Leituras
            .Where(l => l.IdResidencia == idResidencia && l.Timestamp >= desde)
            .OrderBy(l => l.Timestamp)
            .ToListAsync();

        // Agrupa por hora (day), dia (week/month) ou mês (year)
        var agrupado = periodo switch
        {
            "day"  => leituras.GroupBy(l => l.Timestamp.ToString("HH:mm")),
            "year" => leituras.GroupBy(l => l.Timestamp.ToString("MM/yyyy")),
            _      => leituras.GroupBy(l => l.Timestamp.ToString("dd/MM"))
        };

        var resultado = agrupado.Select(g => new LeituraHistoricoItem(
            Label:            g.Key,
            Kwh:              Math.Round(g.Max(l => l.Kwh) - g.Min(l => l.Kwh), 3),
            Potencia:         (decimal)Math.Round(g.Average(l => (double)l.Potencia), 1),
            PotenciaAparente: g.Any(l => l.PotenciaAparente.HasValue)
                ? (decimal?)Math.Round(g.Where(l => l.PotenciaAparente.HasValue).Average(l => (double)l.PotenciaAparente!.Value), 1)
                : null,
            PotenciaReativa:  g.Any(l => l.PotenciaReativa.HasValue)
                ? (decimal?)Math.Round(g.Where(l => l.PotenciaReativa.HasValue).Average(l => (double)l.PotenciaReativa!.Value), 1)
                : null,
            Tensao:           (decimal)Math.Round(g.Average(l => (double)l.Tensao), 1),
            Corrente:         (decimal)Math.Round(g.Average(l => (double)l.Corrente), 3),
            FatorPotencia:    g.Any(l => l.FatorPotencia.HasValue)
                ? (decimal?)Math.Round(g.Where(l => l.FatorPotencia.HasValue).Average(l => (double)l.FatorPotencia!.Value), 3)
                : null,
            Custo:            0  // calculado no frontend com a tarifa
        )).ToList();

        return Ok(new { sucesso = true, dados = resultado });
    }

    /// GET /api/dashboard/alertas?idResidencia=...
    [HttpGet("alertas")]
    public async Task<IActionResult> Alertas([FromQuery] string idResidencia, [FromQuery] bool apenasNaoLidos = false)
    {
        var temAcesso = await db.Residencias.AnyAsync(r => r.Id == idResidencia && r.IdUsuario == UsuarioId);
        if (!temAcesso) return Forbid();

        var q = db.Alertas.Where(a => a.IdResidencia == idResidencia);
        if (apenasNaoLidos) q = q.Where(a => !a.Lido);

        var lista = await q
            .OrderByDescending(a => a.DataCriacao)
            .Take(50)
            .Select(a => new AlertaDto(
                a.Id, a.Tipo, a.Categoria, a.Titulo, a.Mensagem,
                a.ValorDisparador, a.ValorLimiar, a.Lido, a.DataCriacao))
            .ToListAsync();

        return Ok(new { sucesso = true, alertas = lista });
    }

    /// PATCH /api/dashboard/alertas/{id}/lido
    [HttpPatch("alertas/{id}/lido")]
    public async Task<IActionResult> MarcarLido(string id)
    {
        var a = await db.Alertas
            .Include(a => a.Residencia)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (a is null) return NotFound(new { sucesso = false });
        a.Lido = true;
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true });
    }

    /// DELETE /api/dashboard/alertas/{id}  — remove um alerta
    [HttpDelete("alertas/{id}")]
    public async Task<IActionResult> RemoverAlerta(string id)
    {
        var a = await db.Alertas
            .Include(a => a.Residencia)
            .FirstOrDefaultAsync(a => a.Id == id && a.Residencia!.IdUsuario == UsuarioId);
        if (a is null) return NotFound(new { sucesso = false });
        db.Alertas.Remove(a);
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true });
    }

    /// DELETE /api/dashboard/alertas?idResidencia=...  — limpa todos os alertas lidos
    [HttpDelete("alertas")]
    public async Task<IActionResult> LimparAlertas([FromQuery] string idResidencia)
    {
        var temAcesso = await db.Residencias.AnyAsync(r => r.Id == idResidencia && r.IdUsuario == UsuarioId);
        if (!temAcesso) return Forbid();
        var alertas = await db.Alertas
            .Where(a => a.IdResidencia == idResidencia && a.Lido)
            .ToListAsync();
        db.Alertas.RemoveRange(alertas);
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true, removidos = alertas.Count });
    }

    /// GET /api/alertas/config
    [HttpGet("/api/alertas/config")]
    public async Task<IActionResult> ObterConfiguracaoAlertas()
    {
        var prefs = await db.NotificacoesUsuarios.FindAsync(UsuarioId);
        return Ok(new
        {
            sucesso      = true,
            limiteKwhDia   = prefs?.LimiteKwh,
            limiteCustoMes = prefs?.LimiteCusto,
            tensaoMinima   = prefs?.TensaoMin,
            tensaoMaxima   = prefs?.TensaoMax
        });
    }

    /// POST /api/alertas/config
    [HttpPost("/api/alertas/config")]
    public async Task<IActionResult> SalvarConfiguracaoAlertas([FromBody] AlertaConfigRequest req)
    {
        try
        {
            var prefs = await db.NotificacoesUsuarios.FindAsync(UsuarioId);
            if (prefs is null)
            {
                prefs = new NotificacoesUsuario { Id = UsuarioId };
                db.NotificacoesUsuarios.Add(prefs);
            }

            prefs.LimiteKwh       = req.LimiteKwhDia;
            prefs.LimiteCusto     = req.LimiteCustoMes;
            prefs.TensaoMin       = req.TensaoMinima;
            prefs.TensaoMax       = req.TensaoMaxima;
            prefs.DataAtualizacao = DateTime.UtcNow;

            await db.SaveChangesAsync();
            return Ok(new { sucesso = true, mensagem = "Configurações de alerta salvas." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO CONFIG ALERTA] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao salvar configurações." });
        }
    }
}

// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
//  PROXY DE FOTO  /api/foto-proxy
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/foto-proxy")]
public class FotoProxyController(IHttpClientFactory httpFactory) : ControllerBase
{
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, (byte[] Data, string Mime, DateTime Expira)> _cache = new();

    /// GET /api/foto-proxy?url=https://lh3.googleusercontent.com/...
    [HttpGet]
    public async Task<IActionResult> Proxy([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith("https://lh3.googleusercontent.com/"))
            return BadRequest();

        // Serve do cache por 1 hora
        if (_cache.TryGetValue(url, out var cached) && cached.Expira > DateTime.UtcNow)
            return File(cached.Data, cached.Mime);

        try
        {
            var client = httpFactory.CreateClient();
            var resp = await client.GetAsync(url);
            if (!resp.IsSuccessStatusCode) return StatusCode((int)resp.StatusCode);

            var bytes = await resp.Content.ReadAsByteArrayAsync();
            var mime  = resp.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            _cache[url] = (bytes, mime, DateTime.UtcNow.AddHours(1));
            return File(bytes, mime);
        }
        catch
        {
            return StatusCode(502);
        }
    }
}

//  USUÁRIO / PERFIL  /api/usuario
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/usuario"), Authorize]
public class UsuarioController(AppDbContext db, IWebHostEnvironment env) : ControllerBase
{
    private string UsuarioId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    private const long TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB
    private static readonly string[] TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

    /// GET /api/usuario/me — dados completos do usuário logado
    [HttpGet("me")]
    public async Task<IActionResult> ObterPerfilCompleto()
    {
        try
        {
            var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Id == UsuarioId);
            if (usuario is null)
                return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });

            return Ok(new UsuarioCompletoResponse(
                Sucesso:        true,
                Id:             usuario.Id,
                Nome:           usuario.Nome,
                Sobrenome:      usuario.Sobrenome,
                Email:          usuario.Email,
                Telefone:       usuario.Telefone,
                DataNascimento: usuario.DataNascimento?.ToString("yyyy-MM-dd"),
                Genero:         usuario.Genero,
                FotoUrl:        usuario.FotoUrl,
                DataCriacao:    usuario.DataCriacao,
                Role:           usuario.Role,
                TotpAtivo:      usuario.TotpAtivo
            ));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO GET PERFIL] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao obter perfil." });
        }
    }

    /// PATCH /api/usuario/perfil — atualizar dados do perfil
    [HttpPatch("perfil")]
    public async Task<IActionResult> AtualizarPerfil([FromBody] AtualizarPerfilRequest req)
    {
        try
        {
            var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Id == UsuarioId);
            if (usuario is null)
                return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });

            if (!string.IsNullOrWhiteSpace(req.Nome))
                usuario.Nome = req.Nome;

            if (!string.IsNullOrWhiteSpace(req.Sobrenome))
                usuario.Sobrenome = req.Sobrenome;

            // Telefone: permite apagar (string vazia = null)
            usuario.Telefone = string.IsNullOrWhiteSpace(req.Telefone) ? null : req.Telefone;

            // DataNascimento: aceita "yyyy-MM-dd" ou vazio para limpar
            if (req.DataNascimento is not null)
                usuario.DataNascimento = string.IsNullOrWhiteSpace(req.DataNascimento)
                    ? null
                    : DateOnly.TryParse(req.DataNascimento, out var dt) ? dt : usuario.DataNascimento;

            // Genero: permite apagar (string vazia = null)
            if (req.Genero is not null)
                usuario.Genero = string.IsNullOrWhiteSpace(req.Genero) ? null : req.Genero;

            usuario.DataAtualizacao = DateTime.UtcNow;
            await db.SaveChangesAsync();

            return Ok(new AtualizarPerfilResponse(
                Sucesso:   true,
                Mensagem:  "Perfil atualizado com sucesso.",
                Usuario:   new UsuarioDto(usuario.Id, usuario.Nome, usuario.Email, usuario.FotoUrl, usuario.DataCriacao, usuario.Role)
            ));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO ATUALIZAR PERFIL] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao atualizar perfil." });
        }
    }

    /// POST /api/usuario/foto — fazer upload de foto de perfil
    [HttpPost("foto")]
    public async Task<IActionResult> UploadFoto([FromForm] IFormFile arquivo)
    {
        try
        {
            var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Id == UsuarioId);
            if (usuario is null)
                return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });

            // Valida se arquivo foi enviado
            if (arquivo == null || arquivo.Length == 0)
                return BadRequest(new { sucesso = false, erro = "Nenhum arquivo foi enviado." });

            // Valida tamanho
            if (arquivo.Length > TAMANHO_MAXIMO_BYTES)
                return BadRequest(new { sucesso = false, erro = "Arquivo muito grande (máx 5MB)." });

            // Valida tipo MIME
            if (!TIPOS_PERMITIDOS.Contains(arquivo.ContentType))
                return BadRequest(new { sucesso = false, erro = "Tipo de arquivo não permitido. Use JPG, PNG ou WebP." });

            // Cria pasta de uploads se não existir
            var pastaUploads = Path.Combine(env.WebRootPath, "uploads", "fotos");
            Directory.CreateDirectory(pastaUploads);

            // Remove foto anterior se existir
            if (!string.IsNullOrEmpty(usuario.FotoUrl))
            {
                var caminhoAntigo = Path.Combine(env.WebRootPath, usuario.FotoUrl.TrimStart('/'));
                if (System.IO.File.Exists(caminhoAntigo))
                    System.IO.File.Delete(caminhoAntigo);
            }

            // Gera nome único para o arquivo
            var extensao = Path.GetExtension(arquivo.FileName);
            var nomeArquivo = $"usuario-{UsuarioId}-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{extensao}";
            var caminhoCompleto = Path.Combine(pastaUploads, nomeArquivo);

            // Salva o arquivo
            using (var stream = new FileStream(caminhoCompleto, FileMode.Create))
            {
                await arquivo.CopyToAsync(stream);
            }

            // Atualiza a URL da foto no banco
            var fotoUrl = $"/uploads/fotos/{nomeArquivo}";
            usuario.FotoUrl = fotoUrl;
            usuario.DataAtualizacao = DateTime.UtcNow;
            await db.SaveChangesAsync();

            return Ok(new UploadFotoResponse(
                Sucesso:        true,
                Mensagem:       "Foto de perfil atualizada com sucesso.",
                FotoUrl:        fotoUrl,
                TamanhoBytes:   (int)arquivo.Length
            ));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO UPLOAD FOTO] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao fazer upload da foto." });
        }
    }

    /// DELETE /api/usuario/foto — remover foto de perfil
    [HttpDelete("foto")]
    public async Task<IActionResult> RemoverFoto()
    {
        try
        {
            var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Id == UsuarioId);
            if (usuario is null)
                return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });

            if (string.IsNullOrEmpty(usuario.FotoUrl))
                return BadRequest(new { sucesso = false, erro = "Usuário não possui foto de perfil." });

            // Remove arquivo do servidor
            var caminho = Path.Combine(env.WebRootPath, usuario.FotoUrl.TrimStart('/'));
            if (System.IO.File.Exists(caminho))
                System.IO.File.Delete(caminho);

            // Limpa a URL no banco
            usuario.FotoUrl = null;
            usuario.DataAtualizacao = DateTime.UtcNow;
            await db.SaveChangesAsync();

            return Ok(new RemoverFotoResponse(
                Sucesso:    true,
                Mensagem:   "Foto de perfil removida com sucesso."
            ));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO REMOVER FOTO] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao remover foto." });
        }
    }

    /// POST /api/usuario/senha — alterar senha
    [HttpPost("senha")]
    public async Task<IActionResult> AlterarSenha([FromBody] AlterarSenhaRequest req)
    {
        try
        {
            var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Id == UsuarioId);
            if (usuario is null)
                return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });

            if (string.IsNullOrWhiteSpace(req.SenhaAtual) || string.IsNullOrWhiteSpace(req.NovaSenha))
                return BadRequest(new { sucesso = false, erro = "Preencha todos os campos de senha." });

            if (string.IsNullOrEmpty(usuario.HashSenha))
                return BadRequest(new { sucesso = false, erro = "Sua conta usa login pelo Google e não possui senha cadastrada." });

            if (!BCrypt.Net.BCrypt.Verify(req.SenhaAtual, usuario.HashSenha))
                return Unauthorized(new { sucesso = false, erro = "Senha atual incorreta." });

            if (req.NovaSenha.Length < 8)
                return BadRequest(new { sucesso = false, erro = "A nova senha deve ter pelo menos 8 caracteres." });

            usuario.HashSenha        = BCrypt.Net.BCrypt.HashPassword(req.NovaSenha);
            usuario.DataAtualizacao  = DateTime.UtcNow;
            await db.SaveChangesAsync();

            return Ok(new { sucesso = true, mensagem = "Senha alterada com sucesso." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO ALTERAR SENHA] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao alterar senha." });
        }
    }

    /// DELETE /api/usuario — excluir conta permanentemente
    [HttpDelete]
    public async Task<IActionResult> ExcluirConta([FromBody] ExcluirContaRequest? req = null)
    {
        try
        {
            var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Id == UsuarioId);
            if (usuario is null)
                return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });

            if (!string.IsNullOrWhiteSpace(req?.Senha))
            {
                if (!BCrypt.Net.BCrypt.Verify(req.Senha, usuario.HashSenha))
                    return Unauthorized(new { sucesso = false, erro = "Senha incorreta. Conta não excluída." });
            }

            // Remove foto de perfil do disco
            if (!string.IsNullOrEmpty(usuario.FotoUrl))
            {
                var caminho = Path.Combine(env.WebRootPath, usuario.FotoUrl.TrimStart('/'));
                if (System.IO.File.Exists(caminho))
                    System.IO.File.Delete(caminho);
            }

            // Alertas têm FK RESTRICT em id_usuario — precisa remover antes do usuário
            var alertas = await db.Alertas.Where(a => a.IdUsuario == UsuarioId).ToListAsync();
            if (alertas.Count > 0) db.Alertas.RemoveRange(alertas);

            // Remove o usuário — EF Core cascata via as FKs configuradas como CASCADE:
            // Residencias → Comodos → Dispositivos
            // Residencias → Sensores → Leituras
            // Sessoes, TokensRecuperacao
            db.Usuarios.Remove(usuario);

            await db.SaveChangesAsync();

            return Ok(new { sucesso = true, mensagem = "Conta excluída com sucesso." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO EXCLUIR CONTA] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao excluir conta." });
        }
    }

    /// GET /api/usuario/notificacoes
    [HttpGet("notificacoes")]
    public async Task<IActionResult> ObterNotificacoes()
    {
        var prefs = await db.NotificacoesUsuarios.FindAsync(UsuarioId);
        if (prefs is null)
        {
            return Ok(new NotificacoesResponse(
                Sucesso: true,
                EmailAlertas: true, AlertaAnomalia: true, AlertaConsumo: true,
                AlertaTensao: true, AlertaSensor: true,
                LimiteKwh: null, LimiteCusto: null
            ));
        }
        return Ok(new NotificacoesResponse(
            Sucesso: true,
            EmailAlertas:   prefs.EmailAlertas,
            AlertaAnomalia: prefs.AlertaAnomalia,
            AlertaConsumo:  prefs.AlertaConsumo,
            AlertaTensao:   prefs.AlertaTensao,
            AlertaSensor:   prefs.AlertaSensor,
            LimiteKwh:      prefs.LimiteKwh,
            LimiteCusto:    prefs.LimiteCusto,
            TensaoMin:      prefs.TensaoMin,
            TensaoMax:      prefs.TensaoMax
        ));
    }

    /// PUT /api/usuario/notificacoes
    [HttpPut("notificacoes")]
    public async Task<IActionResult> SalvarNotificacoes([FromBody] SalvarNotificacoesRequest req)
    {
        try
        {
            var prefs = await db.NotificacoesUsuarios.FindAsync(UsuarioId);
            if (prefs is null)
            {
                prefs = new NotificacoesUsuario { Id = UsuarioId };
                db.NotificacoesUsuarios.Add(prefs);
            }

            prefs.EmailAlertas    = req.EmailAlertas;
            prefs.AlertaAnomalia  = req.AlertaAnomalia;
            prefs.AlertaConsumo   = req.AlertaConsumo;
            prefs.AlertaTensao    = req.AlertaTensao;
            prefs.AlertaSensor    = req.AlertaSensor;
            prefs.LimiteKwh       = req.LimiteKwh;
            prefs.LimiteCusto     = req.LimiteCusto;
            prefs.TensaoMin       = req.TensaoMin;
            prefs.TensaoMax       = req.TensaoMax;
            prefs.DataAtualizacao = DateTime.UtcNow;

            await db.SaveChangesAsync();
            return Ok(new { sucesso = true, mensagem = "Preferências de notificação salvas." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERRO NOTIF] {ex.Message}");
            return StatusCode(500, new { sucesso = false, erro = "Erro ao salvar preferências." });
        }
    }

    // ── 2FA ──────────────────────────────────────────────────────

    /// POST /api/usuario/2fa/ativar — gera secret e URI para o QR code
    [HttpPost("2fa/ativar")]
    public async Task<IActionResult> Ativar2Fa()
    {
        var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Id == UsuarioId);
        if (usuario is null) return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });

        var secretBytes = System.Security.Cryptography.RandomNumberGenerator.GetBytes(20);
        var secret = _Base32Encode(secretBytes);

        usuario.TotpSecret = secret;
        await db.SaveChangesAsync();

        var qrUri = $"otpauth://totp/MONITECH:{Uri.EscapeDataString(usuario.Email)}?secret={secret}&issuer=MONITECH&digits=6&period=30";
        return Ok(new { sucesso = true, secret, qrUri, mensagem = "Escaneie o QR Code e confirme com o código de 6 dígitos." });
    }

    /// POST /api/usuario/2fa/confirmar — verifica código e ativa
    [HttpPost("2fa/confirmar")]
    public async Task<IActionResult> Confirmar2Fa([FromBody] Confirmar2FaRequest req)
    {
        var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Id == UsuarioId);
        if (usuario is null) return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });
        if (string.IsNullOrWhiteSpace(usuario.TotpSecret))
            return BadRequest(new { sucesso = false, erro = "Inicie o processo de ativação primeiro." });

        if (!_VerificarTotp(_Base32Decode(usuario.TotpSecret), req.Codigo))
            return BadRequest(new { sucesso = false, erro = "Código inválido ou expirado. Tente novamente." });

        usuario.TotpAtivo = true;
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true, mensagem = "Autenticação de dois fatores ativada com sucesso." });
    }

    /// DELETE /api/usuario/2fa — desativa 2FA (requer código do autenticador)
    [HttpDelete("2fa")]
    public async Task<IActionResult> Desativar2Fa([FromBody] Desativar2FaRequest req)
    {
        var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Id == UsuarioId);
        if (usuario is null) return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });
        if (!usuario.TotpAtivo) return BadRequest(new { sucesso = false, erro = "2FA não está ativo." });

        if (!_VerificarTotp(_Base32Decode(usuario.TotpSecret!), req.Codigo))
            return BadRequest(new { sucesso = false, erro = "Código inválido." });

        usuario.TotpAtivo  = false;
        usuario.TotpSecret = null;
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true, mensagem = "Autenticação de dois fatores desativada." });
    }

    // ── Helpers TOTP ──────────────────────────────────────────

    private static bool _VerificarTotp(byte[] secret, string codigo, int janela = 1)
    {
        if (!int.TryParse(codigo, out var code)) return false;
        var t = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        for (var d = -janela; d <= janela; d++)
            if (_GerarTotp(secret, t + d) == code) return true;
        return false;
    }

    private static int _GerarTotp(byte[] secret, long contador)
    {
        var cb = BitConverter.GetBytes(contador);
        if (BitConverter.IsLittleEndian) Array.Reverse(cb);
        using var hmac = new System.Security.Cryptography.HMACSHA1(secret);
        var hash = hmac.ComputeHash(cb);
        var off = hash[^1] & 0x0F;
        return (((hash[off] & 0x7F) << 24) | ((hash[off+1] & 0xFF) << 16)
              | ((hash[off+2] & 0xFF) << 8)  | (hash[off+3] & 0xFF)) % 1_000_000;
    }

    private static string _Base32Encode(byte[] data)
    {
        const string A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var sb = new System.Text.StringBuilder();
        int buf = data[0], next = 1, bits = 8;
        while (bits > 0 || next < data.Length)
        {
            if (bits < 5) { if (next < data.Length) { buf = (buf << 8) | data[next++]; bits += 8; } else { buf <<= 5 - bits; bits = 5; } }
            bits -= 5;
            sb.Append(A[(buf >> bits) & 0x1F]);
        }
        return sb.ToString();
    }

    private static byte[] _Base32Decode(string input)
    {
        const string A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var s = input.ToUpperInvariant().TrimEnd('=');
        var output = new byte[s.Length * 5 / 8];
        int buf = 0, bits = 0, idx = 0;
        foreach (var c in s) { var v = A.IndexOf(c); if (v < 0) continue; buf = (buf << 5) | v; bits += 5; if (bits >= 8 && idx < output.Length) { bits -= 8; output[idx++] = (byte)((buf >> bits) & 0xFF); } }
        return output;
    }
}

// ════════════════════════════════════════════════════════════
//  NILM  /api/nilm
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/nilm"), Authorize]
public class NilmController(NilmClientService nilm, AppDbContext db) : ControllerBase
{
    private string UsuarioId => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

    /// GET /api/nilm/analisar?idResidencia=...&horas=24
    [HttpGet("analisar")]
    public async Task<IActionResult> Analisar([FromQuery] string idResidencia, [FromQuery] int horas = 24)
    {
        var temAcesso = await db.Residencias
            .AnyAsync(r => r.Id == idResidencia && r.IdUsuario == UsuarioId);
        if (!temAcesso) return Forbid();

        var resultado = await nilm.AnalisarAsync(idResidencia, horas);

        if (resultado is null)
            return Ok(new
            {
                disponivel = false,
                mensagem   = "Dados insuficientes para análise NILM. Continue coletando leituras."
            });

        return Ok(resultado);
    }

    /// GET /api/nilm/status
    [HttpGet("status")]
    public async Task<IActionResult> Status()
    {
        var online = await nilm.PingAsync();
        return Ok(new
        {
            online,
            mensagem = online ? "Microserviço NILM ativo." : "Microserviço NILM offline."
        });
    }
}

// ════════════════════════════════════════════════════════════
//  FIRMWARE OTA  /api/firmware
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/firmware")]
public class FirmwareController(IWebHostEnvironment env) : ControllerBase
{
    // GET info é público (ESP32 precisa checar versão sem autenticação)
    // GET download é público (ESP32 precisa baixar sem autenticação)
    // Futuramente: POST para upload do .bin requer [Authorize(Roles = "admin")]
    private static readonly string VERSAO_FALLBACK = "1.0.0";
    private string ObterVersao()
    {
        var verPath = Path.Combine(env.WebRootPath, "assets", "firmware", "version.txt");
        return System.IO.File.Exists(verPath)
            ? System.IO.File.ReadAllText(verPath).Trim()
            : VERSAO_FALLBACK;
    }

    /// GET /api/firmware/info — versão disponível no servidor
    [HttpGet("info")]
    public IActionResult Info()
    {
        var binPath = Path.Combine(env.WebRootPath, "assets", "firmware", "monitech.bin");
        var existe  = System.IO.File.Exists(binPath);
        var tamanho = existe ? new FileInfo(binPath).Length : 0;
        var versao  = ObterVersao();

        return Ok(new
        {
            versao,
            disponivel    = existe,
            tamanhoBytes  = tamanho,
            url           = existe ? "/assets/firmware/monitech.bin" : null,
            dataLancamento = existe
                ? new FileInfo(binPath).LastWriteTimeUtc.ToString("dd/MM/yyyy")
                : null
        });
    }

    /// GET /api/firmware — baixa o binário
    [HttpGet]
    public IActionResult Download()
    {
        var binPath = Path.Combine(env.WebRootPath, "assets", "firmware", "monitech.bin");
        if (!System.IO.File.Exists(binPath))
            return NotFound(new { erro = "Nenhum firmware disponível no servidor ainda." });

        var bytes = System.IO.File.ReadAllBytes(binPath);
        return File(bytes, "application/octet-stream", $"monitech_{ObterVersao()}.bin");
    }

    /// POST /api/firmware/upload — admin faz upload do .bin compilado
    [HttpPost("upload")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Upload(IFormFile arquivo, [FromForm] string versao = "1.0.0")
    {
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { sucesso = false, erro = "Nenhum arquivo enviado." });

        if (!arquivo.FileName.EndsWith(".bin", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { sucesso = false, erro = "Apenas arquivos .bin são aceitos." });

        if (arquivo.Length > 4 * 1024 * 1024)
            return BadRequest(new { sucesso = false, erro = "Arquivo muito grande. Máximo 4 MB." });

        var versaoLimpa = versao.Trim();
        if (string.IsNullOrWhiteSpace(versaoLimpa)) versaoLimpa = VERSAO_FALLBACK;

        var dir     = Path.Combine(env.WebRootPath, "assets", "firmware");
        Directory.CreateDirectory(dir);

        var binPath = Path.Combine(dir, "monitech.bin");
        var verPath = Path.Combine(dir, "version.txt");

        using (var stream = new FileStream(binPath, FileMode.Create))
            await arquivo.CopyToAsync(stream);

        await System.IO.File.WriteAllTextAsync(verPath, versaoLimpa);

        Console.WriteLine($"[FIRMWARE] Upload v{versaoLimpa} — {arquivo.Length / 1024} KB");

        return Ok(new
        {
            sucesso      = true,
            mensagem     = $"Firmware v{versaoLimpa} publicado com sucesso.",
            tamanhoBytes = arquivo.Length,
            versao       = versaoLimpa
        });
    }
}

// ════════════════════════════════════════════════════════════
//  TARIFAS  /api/tarifas
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/tarifas")]
public class TarifaController(TarifaService tarifas) : ControllerBase
{
    /// GET /api/tarifas/distribuidoras?estado=SP
    [HttpGet("distribuidoras")]
    public async Task<IActionResult> GetDistribuidoras([FromQuery] string estado)
    {
        if (string.IsNullOrWhiteSpace(estado))
            return BadRequest(new { sucesso = false, erro = "Informe o estado (UF)." });

        // Atualiza tarifas da ANEEL se o cache expirou (no-op se ainda válido)
        await tarifas.AtualizarTarifasAsync();

        var lista = tarifas.GetDistribuidoras(estado)
            .Select(d => new DistribuidoraDto(d.Codigo, d.Nome, d.TarifaB1));

        return Ok(new { sucesso = true, distribuidoras = lista });
    }

    /// GET /api/tarifas/bandeira
    [HttpGet("bandeira")]
    public async Task<IActionResult> GetBandeira()
    {
        var b = await tarifas.GetBandeiraAsync();
        return Ok(new
        {
            sucesso  = true,
            bandeira = new BandeiraDto(b.Cor, b.Nome, b.AdicionalPor100Kwh)
        });
    }

    /// GET /api/tarifas/info?distribuidora=CEMIG
    [HttpGet("info")]
    public async Task<IActionResult> GetInfo([FromQuery] string distribuidora)
    {
        if (string.IsNullOrWhiteSpace(distribuidora))
            return BadRequest(new { sucesso = false, erro = "Informe a distribuidora." });

        await tarifas.AtualizarTarifasAsync();

        var d = tarifas.GetDistribuidora(distribuidora);
        if (d is null)
            return NotFound(new { sucesso = false, erro = "Distribuidora não encontrada." });

        var b = await tarifas.GetBandeiraAsync();
        var adicional = b.AdicionalPor100Kwh / 100m;

        return Ok(new TarifaInfoResponse(
            Sucesso:      true,
            TarifaBase:   d.TarifaB1,
            TarifaTotal:  Math.Round(d.TarifaB1 + adicional, 4),
            Bandeira:     new BandeiraDto(b.Cor, b.Nome, b.AdicionalPor100Kwh)
        ));
    }
}

// ════════════════════════════════════════════════════════════
//  ADMIN  /api/admin
// ════════════════════════════════════════════════════════════
[ApiController, Route("api/admin"), Authorize(Roles = "admin")]
public class AdminController(AppDbContext db) : ControllerBase
{
    /// GET /api/admin/stats
    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var agora     = DateTime.UtcNow;
        var inicioMes = new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var stats = new AdminStatsDto(
            TotalUsuarios:    await db.Usuarios.CountAsync(),
            UsuariosAtivos:   await db.Usuarios.CountAsync(u => u.Status == "active"),
            UsuariosSuspensos:await db.Usuarios.CountAsync(u => u.Status == "suspended"),
            NovosEsteMes:     await db.Usuarios.CountAsync(u => u.DataCriacao >= inicioMes),
            TotalResidencias: await db.Residencias.CountAsync(),
            TotalDispositivos:await db.Dispositivos.CountAsync(),
            TotalLeituras:    await db.Leituras.LongCountAsync()
        );

        return Ok(new { sucesso = true, stats });
    }

    /// GET /api/admin/usuarios?search=&page=1&limit=20
    [HttpGet("usuarios")]
    public async Task<IActionResult> ListarUsuarios(
        [FromQuery] string? search = null,
        [FromQuery] int page  = 1,
        [FromQuery] int limit = 20)
    {
        page  = Math.Max(1, page);
        limit = Math.Clamp(limit, 5, 100);

        var query = db.Usuarios.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower().Trim();
            query = query.Where(u => u.Nome.ToLower().Contains(s)
                                  || (u.Sobrenome != null && u.Sobrenome.ToLower().Contains(s))
                                  || u.Email.ToLower().Contains(s));
        }

        var total = await query.CountAsync();

        var usuarios = await query
            .OrderByDescending(u => u.DataCriacao)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Include(u => u.Residencias)
            .Select(u => new AdminUsuarioDto(
                u.Id,
                $"{u.Nome} {u.Sobrenome}".Trim(),
                u.Email,
                u.FotoUrl,
                u.Status,
                u.Role,
                u.DataCriacao,
                u.UltimaLogin,
                u.Residencias.Count
            ))
            .ToListAsync();

        return Ok(new
        {
            sucesso      = true,
            usuarios,
            total,
            pagina       = page,
            totalPaginas = (int)Math.Ceiling(total / (double)limit)
        });
    }

    /// PATCH /api/admin/usuarios/{id}/status
    [HttpPatch("usuarios/{id}/status")]
    public async Task<IActionResult> AtualizarStatus(string id, [FromBody] AdminAtualizarStatusRequest req)
    {
        if (req?.Status is not ("active" or "suspended"))
            return BadRequest(new { sucesso = false, erro = "Status inválido." });

        var usuario = await db.Usuarios.FindAsync(id);
        if (usuario is null)
            return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });

        var idAdmin = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (usuario.Id == idAdmin)
            return BadRequest(new { sucesso = false, erro = "Você não pode alterar seu próprio status." });

        usuario.Status          = req.Status;
        usuario.DataAtualizacao = DateTime.UtcNow;

        if (req.Status == "suspended")
        {
            var sessoes = await db.Sessoes.Where(s => s.IdUsuario == id).ToListAsync();
            db.Sessoes.RemoveRange(sessoes);
        }

        await db.SaveChangesAsync();
        return Ok(new { sucesso = true });
    }

    /// PATCH /api/admin/usuarios/{id}/role
    [HttpPatch("usuarios/{id}/role")]
    public async Task<IActionResult> AtualizarRole(string id, AdminAtualizarRoleRequest req)
    {
        if (req.Role is not ("admin" or "user"))
            return BadRequest(new { sucesso = false, erro = "Cargo inválido." });

        var usuario = await db.Usuarios.FindAsync(id);
        if (usuario is null)
            return NotFound(new { sucesso = false, erro = "Usuário não encontrado." });

        var idAdmin = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (usuario.Id == idAdmin)
            return BadRequest(new { sucesso = false, erro = "Você não pode alterar seu próprio cargo." });

        usuario.Role            = req.Role;
        usuario.DataAtualizacao = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { sucesso = true });
    }
}
