// ============================================================
//  MONITECH — Contexto do Banco de Dados (MySQL)
//  Arquivo: Data/AppDbContext.cs
// ============================================================

using Microsoft.EntityFrameworkCore;
using Monitech.API.Models;

namespace Monitech.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Usuario>     Usuarios     { get; set; }
    public DbSet<Residencia>  Residencias  { get; set; }
    public DbSet<Comodo>      Comodos      { get; set; }
    public DbSet<Dispositivo> Dispositivos { get; set; }
    public DbSet<Sensor>      Sensores     { get; set; }
    public DbSet<Leitura>     Leituras     { get; set; }
    public DbSet<Alerta>      Alertas      { get; set; }
    public DbSet<Sessao>               Sessoes               { get; set; }
    public DbSet<TokenRecuperacao>     TokensRecuperacao     { get; set; }
    public DbSet<NotificacoesUsuario>  NotificacoesUsuarios  { get; set; }

    protected override void OnModelCreating(ModelBuilder m)
    {
        // ── Configurar tipos de colunas para IDs (evita conversão automática para GUID) ───
        m.Entity<Usuario>(e =>
        {
            e.Property(u => u.Id).HasColumnType("varchar(36)");
        });

        m.Entity<Residencia>(e =>
        {
            e.Property(r => r.Id).HasColumnType("varchar(36)");
            e.Property(r => r.IdUsuario).HasColumnType("varchar(36)");
        });

        m.Entity<Comodo>(e =>
        {
            e.Property(c => c.Id).HasColumnType("varchar(36)");
            e.Property(c => c.IdResidencia).HasColumnType("varchar(36)");
        });

        m.Entity<Dispositivo>(e =>
        {
            e.Property(d => d.Id).HasColumnType("varchar(36)");
            e.Property(d => d.IdComodo).HasColumnType("varchar(36)");
            e.Property(d => d.IdResidencia).HasColumnType("varchar(36)");
        });

        m.Entity<Sensor>(e =>
        {
            e.Property(s => s.Id).HasColumnType("varchar(36)");
            e.Property(s => s.IdResidencia).HasColumnType("varchar(36)");
            e.Property(s => s.IdDispositivo).HasColumnType("varchar(36)");
        });

        m.Entity<Sessao>(e =>
        {
            e.Property(s => s.Id).HasColumnType("varchar(36)");
            e.Property(s => s.IdUsuario).HasColumnType("varchar(36)");
        });

        // ── Índices únicos ───────────────────────────────────
        m.Entity<Usuario>()
            .HasIndex(u => u.Email).IsUnique();

        m.Entity<Sensor>()
            .HasIndex(s => s.IdIot).IsUnique();

        // ── Usuário → Residências ────────────────────────────
        m.Entity<Residencia>()
            .HasOne(r => r.Usuario)
            .WithMany(u => u.Residencias)
            .HasForeignKey(r => r.IdUsuario)
            .OnDelete(DeleteBehavior.Cascade);

        // ── Residência → Cômodos ─────────────────────────────
        m.Entity<Comodo>()
            .HasOne(c => c.Residencia)
            .WithMany(r => r.Comodos)
            .HasForeignKey(c => c.IdResidencia)
            .OnDelete(DeleteBehavior.Cascade);

        // ── Cômodo → Dispositivos ────────────────────────────
        m.Entity<Dispositivo>()
            .HasOne(d => d.Comodo)
            .WithMany(c => c.Dispositivos)
            .HasForeignKey(d => d.IdComodo)
            .OnDelete(DeleteBehavior.Cascade);

        m.Entity<Dispositivo>()
            .HasOne(d => d.Residencia)
            .WithMany()
            .HasForeignKey(d => d.IdResidencia)
            .OnDelete(DeleteBehavior.Restrict);

        // ── Residência → Sensores ────────────────────────────
        m.Entity<Sensor>()
            .HasOne(s => s.Residencia)
            .WithMany(r => r.Sensores)
            .HasForeignKey(s => s.IdResidencia)
            .OnDelete(DeleteBehavior.Cascade);

        // ── Sensor → Leituras ────────────────────────────────
        m.Entity<Leitura>()
            .HasOne(l => l.Sensor)
            .WithMany(s => s.Leituras)
            .HasForeignKey(l => l.IdSensor)
            .OnDelete(DeleteBehavior.Cascade);

        // ── TokenRecuperacao ─────────────────────────────────
        m.Entity<TokenRecuperacao>(e =>
        {
            e.Property(t => t.Id).HasColumnType("varchar(36)");
            e.Property(t => t.IdUsuario).HasColumnType("varchar(36)");
            e.Property(t => t.Token).HasColumnType("varchar(64)");
        });
        m.Entity<TokenRecuperacao>()
            .HasOne(t => t.Usuario)
            .WithMany()
            .HasForeignKey(t => t.IdUsuario)
            .OnDelete(DeleteBehavior.Cascade);

        // ── Usuário → Sessões ────────────────────────────────
        m.Entity<Sessao>()
            .HasOne(s => s.Usuario)
            .WithMany(u => u.Sessoes)
            .HasForeignKey(s => s.IdUsuario)
            .OnDelete(DeleteBehavior.Cascade);

        // ── Alerta → Residência ──────────────────────────────
        m.Entity<Alerta>()
            .HasOne(a => a.Residencia)
            .WithMany()
            .HasForeignKey(a => a.IdResidencia)
            .OnDelete(DeleteBehavior.Cascade);

        m.Entity<Alerta>()
            .HasOne(a => a.Usuario)
            .WithMany()
            .HasForeignKey(a => a.IdUsuario)
            .OnDelete(DeleteBehavior.Restrict);

        // ── NotificacoesUsuario ──────────────────────────────
        m.Entity<NotificacoesUsuario>(e =>
        {
            e.HasKey(n => n.Id);
            e.Property(n => n.Id).HasColumnType("varchar(36)");
        });
        m.Entity<NotificacoesUsuario>()
            .HasOne(n => n.Usuario)
            .WithOne()
            .HasForeignKey<NotificacoesUsuario>(n => n.Id)
            .OnDelete(DeleteBehavior.Cascade);

        // ── Precisão decimal ─────────────────────────────────
        m.Entity<Leitura>().Property(l => l.Tensao).HasPrecision(7, 3);
        m.Entity<Leitura>().Property(l => l.Corrente).HasPrecision(7, 4);
        m.Entity<Leitura>().Property(l => l.Potencia).HasPrecision(10, 3);
        m.Entity<Leitura>().Property(l => l.Kwh).HasPrecision(14, 4);
        m.Entity<Leitura>().Property(l => l.FatorPotencia).HasPrecision(4, 3);
        m.Entity<Leitura>().Property(l => l.FrequenciaHz).HasPrecision(5, 2);
        m.Entity<Residencia>().Property(r => r.TarifaKwh).HasPrecision(6, 4);
        m.Entity<Dispositivo>().Property(d => d.PotenciaNominal).HasPrecision(8, 2);
    }
}
