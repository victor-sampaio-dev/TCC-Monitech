// ============================================================
//  MONITECH — Serviço de Autenticação
//  Arquivo: Services/AuthService.cs
// ============================================================

using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Monitech.API.Data;
using Monitech.API.DTOs;
using Monitech.API.Models;

namespace Monitech.API.Services;

public class AuthService(AppDbContext db, IConfiguration config, EmailService email, IWebHostEnvironment env, IHttpClientFactory http)
{
    private const string ADMIN_EMAIL = "victorsampaio.dev@gmail.com";
    // ── Cadastro ─────────────────────────────────────────────
    public async Task<Usuario> CadastrarAsync(CadastroRequest req)
    {
        try
        {
            Console.WriteLine($"[CADASTRO] Tentando cadastrar: {req.Email}");

            if (await db.Usuarios.AnyAsync(u => u.Email == req.Email.ToLower()))
            {
                Console.WriteLine($"[CADASTRO] E-mail já existe!");
                throw new InvalidOperationException("E-mail já cadastrado.");
            }

            // Separa nome completo em nome + sobrenome
            var partes    = req.Nome.Trim().Split(' ', 2);
            var nome      = partes[0];
            var sobrenome = partes.Length > 1 ? partes[1] : null;

            Console.WriteLine($"[CADASTRO] Nome: {nome}, Sobrenome: {sobrenome}");

            var emailNorm = req.Email.ToLower().Trim();
            var usuario = new Usuario
            {
                Id        = Guid.NewGuid().ToString(),
                Nome      = nome,
                Sobrenome = sobrenome,
                Email     = emailNorm,
                HashSenha = BCrypt.Net.BCrypt.HashPassword(req.Senha),
                Telefone  = req.Telefone,
                Role      = emailNorm == ADMIN_EMAIL ? "admin" : "user"
            };

            Console.WriteLine($"[CADASTRO] Usuário criado com ID: {usuario.Id}");

            db.Usuarios.Add(usuario);
            await db.SaveChangesAsync();

            Console.WriteLine($"[CADASTRO] Usuário salvo no banco!");
            return usuario;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CADASTRO ERROR] {ex.GetType().Name}: {ex.Message}");
            Console.WriteLine($"[CADASTRO STACK] {ex.StackTrace}");
            throw;
        }
    }

    // ── Login ────────────────────────────────────────────────
    public async Task<LoginResponse> LoginAsync(LoginRequest req, string? ip)
    {
        try
        {
            Console.WriteLine($"[LOGIN] Tentando login para: {req.Email}");
            
            var usuario = await db.Usuarios
                .FirstOrDefaultAsync(u => u.Email == req.Email.ToLower())
                ?? throw new UnauthorizedAccessException("E-mail ou senha incorretos.");

            Console.WriteLine($"[LOGIN] Usuário encontrado: {usuario.Id}");

            if (!BCrypt.Net.BCrypt.Verify(req.Senha, usuario.HashSenha))
                throw new UnauthorizedAccessException("E-mail ou senha incorretos.");

            Console.WriteLine($"[LOGIN] Senha verificada!");

            if (usuario.Status != "active")
                throw new UnauthorizedAccessException("Conta inativa ou suspensa.");

            if (usuario.TotpAtivo && !string.IsNullOrEmpty(usuario.TotpSecret))
            {
                var tokenTemp = GerarTokenTemp(usuario.Id);
                return new LoginResponse(Sucesso: true, Requer2FA: true, TokenTemp: tokenTemp);
            }

            var expira = DateTime.UtcNow.AddHours(24);
            var token  = GerarToken(usuario, expira);

            Console.WriteLine($"[LOGIN] Token gerado!");

            // Persiste sessão
            var sessao = new Sessao
            {
                Id         = Guid.NewGuid().ToString(),
                IdUsuario  = usuario.Id,
                HashToken  = HashToken(token),
                EnderecoIp = ip,
                ExpiraEm   = expira
            };
            db.Sessoes.Add(sessao);

            Console.WriteLine($"[LOGIN] Sessão criada: {sessao.Id}");

            usuario.UltimaLogin     = DateTime.UtcNow;
            usuario.DataAtualizacao = DateTime.UtcNow;
            await db.SaveChangesAsync();

            Console.WriteLine($"[LOGIN] Dados salvos no banco!");

            var response = new LoginResponse(
                Sucesso:  true,
                Token:    token,
                Usuario:  new UsuarioDto(usuario.Id, $"{usuario.Nome} {usuario.Sobrenome}".Trim(), usuario.Email, usuario.FotoUrl, usuario.DataCriacao, usuario.Role, usuario.Tema, usuario.Plano, usuario.PlanoExpiraEm),
                ExpiraEm: expira
            );

            Console.WriteLine($"[LOGIN] Response criada!");
            return response;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LOGIN ERROR] {ex.GetType().Name}: {ex.Message}");
            Console.WriteLine($"[LOGIN STACK] {ex.StackTrace}");
            throw;
        }
    }

    // ── Login via Google OAuth ────────────────────────────────
    public async Task<LoginResponse> GoogleLoginAsync(string idToken)
    {
        // 1. Verifica o ID Token com as chaves públicas do Google
        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new[] { config["Google:ClientId"] }
        };
        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);

        var emailNorm = payload.Email.ToLower().Trim();

        // 2. Busca ou cria o usuário
        var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Email == emailNorm);
        if (usuario is null)
        {
            var partes = (payload.Name ?? payload.Email).Split(' ', 2);
            var id = Guid.NewGuid().ToString();
            usuario = new Usuario
            {
                Id              = id,
                Nome            = partes[0],
                Sobrenome       = partes.Length > 1 ? partes[1] : null,
                Email           = emailNorm,
                HashSenha       = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
                FotoUrl         = await BaixarFotoGoogleAsync(payload.Picture, id),
                EmailVerificado = true,
                Status          = "active",
                DataCriacao     = DateTime.UtcNow,
                DataAtualizacao = DateTime.UtcNow,
                Role            = emailNorm == ADMIN_EMAIL ? "admin" : "user"
            };
            db.Usuarios.Add(usuario);
        }
        else
        {
            // Atualiza foto se: não tem foto, ainda usa URL do Google, ou arquivo local foi removido
            if (!string.IsNullOrEmpty(payload.Picture))
            {
                bool deveAtualizar =
                    string.IsNullOrEmpty(usuario.FotoUrl) ||
                    usuario.FotoUrl.StartsWith("https://lh") ||
                    usuario.FotoUrl.StartsWith("https://googleusercontent") ||
                    (usuario.FotoUrl.StartsWith("/") &&
                     !File.Exists(Path.Combine(env.WebRootPath, usuario.FotoUrl.TrimStart('/'))));

                if (deveAtualizar)
                {
                    usuario.FotoUrl         = await BaixarFotoGoogleAsync(payload.Picture, usuario.Id);
                    usuario.DataAtualizacao = DateTime.UtcNow;
                }
            }
        }

        // 3. Cria sessão
        var expira = DateTime.UtcNow.AddHours(24);
        var token  = GerarToken(usuario, expira);

        var sessao = new Sessao
        {
            Id        = Guid.NewGuid().ToString(),
            IdUsuario = usuario.Id,
            HashToken = HashToken(token),
            ExpiraEm  = expira
        };
        db.Sessoes.Add(sessao);

        usuario.UltimaLogin     = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return new LoginResponse(
            Sucesso:  true,
            Token:    token,
            Usuario:  new UsuarioDto(usuario.Id, $"{usuario.Nome} {usuario.Sobrenome}".Trim(), usuario.Email, usuario.FotoUrl, usuario.DataCriacao, usuario.Role, usuario.Tema, usuario.Plano, usuario.PlanoExpiraEm),
            ExpiraEm: expira
        );
    }

    // ── Recuperação de senha ─────────────────────────────────
    public async Task SolicitarRecuperacaoSenhaAsync(string emailReq, string urlBase)
    {
        var emailNorm = emailReq.ToLower().Trim();
        var usuario   = await db.Usuarios.FirstOrDefaultAsync(u => u.Email == emailNorm);
        if (usuario is null) return; // Não revela se e-mail existe

        // Invalida tokens antigos
        var tokensAntigos = db.TokensRecuperacao
            .Where(t => t.IdUsuario == usuario.Id && !t.Usado);
        await tokensAntigos.ExecuteUpdateAsync(s => s.SetProperty(t => t.Usado, true));

        // Gera novo token seguro (64 hex chars)
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        db.TokensRecuperacao.Add(new TokenRecuperacao
        {
            Id        = Guid.NewGuid().ToString(),
            IdUsuario = usuario.Id,
            Token     = token,
            ExpiraEm  = DateTime.UtcNow.AddHours(1)
        });
        await db.SaveChangesAsync();

        var link = $"{urlBase}/pages-documents/resetar-senha.html?token={token}";
        await email.EnviarRecuperacaoSenhaAsync(usuario.Email, usuario.Nome, link);
    }

    public async Task<bool> ResetarSenhaAsync(string token, string novaSenha)
    {
        var rec = await db.TokensRecuperacao
            .Include(t => t.Usuario)
            .FirstOrDefaultAsync(t => t.Token == token && !t.Usado && t.ExpiraEm > DateTime.UtcNow);

        if (rec?.Usuario is null) return false;

        rec.Usuario.HashSenha        = BCrypt.Net.BCrypt.HashPassword(novaSenha);
        rec.Usuario.DataAtualizacao  = DateTime.UtcNow;
        rec.Usado                    = true;

        // Invalida todas as sessões existentes
        await db.Sessoes
            .Where(s => s.IdUsuario == rec.IdUsuario)
            .ExecuteDeleteAsync();

        await db.SaveChangesAsync();
        return true;
    }

    // ── Baixa foto do Google e salva localmente ───────────────
    private async Task<string?> BaixarFotoGoogleAsync(string? urlGoogle, string usuarioId)
    {
        if (string.IsNullOrWhiteSpace(urlGoogle)) return null;
        try
        {
            // Pede 200px para evitar foto muito pequena
            var url = urlGoogle.Contains("=s96-c") ? urlGoogle.Replace("=s96-c", "=s200-c") : urlGoogle;

            var client = http.CreateClient();
            var resp   = await client.GetAsync(url);
            if (!resp.IsSuccessStatusCode) return urlGoogle; // fallback: URL original

            var bytes = await resp.Content.ReadAsByteArrayAsync();
            var mime  = resp.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            var ext   = mime.Contains("png") ? ".png" : ".jpg";

            var pasta  = Path.Combine(env.WebRootPath, "uploads", "fotos");
            Directory.CreateDirectory(pasta);

            var arquivo = $"usuario-{usuarioId}-google{ext}";
            await File.WriteAllBytesAsync(Path.Combine(pasta, arquivo), bytes);

            Console.WriteLine($"[GOOGLE FOTO] Salva localmente: /uploads/fotos/{arquivo}");
            return $"/uploads/fotos/{arquivo}";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GOOGLE FOTO] Falha ao baixar foto, usando URL original: {ex.Message}");
            return urlGoogle; // fallback seguro
        }
    }

    // ── Gera JWT temporário para 2FA pending (5 min) ─────────
    public string GerarTokenTemp(string userId)
    {
        var chave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Chave"]!));
        var creds = new SigningCredentials(chave, SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(
            claims: [
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim("tipo", "2fa-pending")
            ],
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }

    // ── Gera JWT ─────────────────────────────────────────────
    public string GerarToken(Usuario u, DateTime expira)
    {
        var chave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Chave"]!));
        var creds = new SigningCredentials(chave, SecurityAlgorithms.HmacSha256);

        var jwt = new JwtSecurityToken(
            claims: [
                new Claim(ClaimTypes.NameIdentifier, u.Id),
                new Claim(ClaimTypes.Email,           u.Email),
                new Claim(ClaimTypes.Name,            u.Nome),
                new Claim(ClaimTypes.Role,            u.Role)
            ],
            expires:           expira,
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }

    public static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLower();
    }
}
