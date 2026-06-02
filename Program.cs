// ============================================================
//  MONITECH — Backend C# (ASP.NET Core 8 + MySQL)
//  Arquivo: Program.cs
// ============================================================

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Monitech.API.Data;
using Monitech.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ── MySQL ────────────────────────────────────────────────────
var connString = builder.Configuration.GetConnectionString("MySQL")!;
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseMySql(connString, ServerVersion.AutoDetect(connString), 
        options => options.EnableRetryOnFailure(5, TimeSpan.FromSeconds(1), null)));

// ── JWT ──────────────────────────────────────────────────────
var jwtChave = builder.Configuration["Jwt:Chave"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt => opt.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtChave)),
        ValidateIssuer           = false,
        ValidateAudience         = false,
        ClockSkew                = TimeSpan.Zero
    });

builder.Services.AddAuthorization();

// ── Serviços ─────────────────────────────────────────────────
builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<NilmClientService>();
builder.Services.AddSingleton<TarifaService>();
builder.Services.AddHostedService<SensorOfflineMonitor>();

// HttpClient para o microserviço Python NILM
builder.Services.AddHttpClient("nilm", c =>
{
    c.BaseAddress = new Uri(builder.Configuration["NilmService:Url"]!);
    c.Timeout     = TimeSpan.FromSeconds(30);
});

// HttpClient para API pública da ANEEL (bandeira tarifária)
builder.Services.AddHttpClient("aneel", c =>
{
    c.BaseAddress = new Uri("https://dadosabertos.aneel.gov.br");
    c.Timeout     = TimeSpan.FromSeconds(10);
});

// ── CORS — origens permitidas ─────────────────────────────────
builder.Services.AddCors(opt =>
    opt.AddPolicy("front", p =>
        p.WithOrigins(
            "http://localhost:5000",
            "https://localhost:5000",
            "http://monitech.net.br",
            "https://monitech.net.br",
            "http://www.monitech.net.br",
            "https://www.monitech.net.br"
        )
        .AllowAnyMethod()
        .AllowAnyHeader()));

builder.Services.AddControllers()
    .AddJsonOptions(o => {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        o.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => c.SwaggerDoc("v1", new() { Title = "MONITECH API", Version = "v1" }));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("front");
app.UseAuthentication();
app.UseAuthorization();

// Bloqueia usuários suspensos mesmo com JWT ainda válido
app.Use(async (ctx, next) => {
    if (ctx.User.Identity?.IsAuthenticated == true)
    {
        var id = ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (id is not null)
        {
            var db = ctx.RequestServices.GetRequiredService<AppDbContext>();
            var usuario = await db.Usuarios.FindAsync(id);
            if (usuario?.Status != "active")
            {
                ctx.Response.StatusCode = 401;
                await ctx.Response.WriteAsJsonAsync(new { sucesso = false, erro = "Conta suspensa." });
                return;
            }
        }
    }
    await next();
});

// Permite Google OAuth popup via postMessage (COOP unsafe-none)
app.Use(async (ctx, next) => {
    ctx.Response.Headers["Cross-Origin-Opener-Policy"] = "unsafe-none";
    ctx.Response.Headers["Cross-Origin-Embedder-Policy"] = "unsafe-none";
    await next();
});

// Serve os arquivos do frontend (pasta wwwroot)
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();
app.Run("http://0.0.0.0:5000");
