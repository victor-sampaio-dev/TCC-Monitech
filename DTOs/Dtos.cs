// ============================================================
//  MONITECH — DTOs
//  Arquivo: DTOs/Dtos.cs
//  Nomes mapeados 1:1 com os stubs do system.js
// ============================================================

namespace Monitech.API.DTOs;

// ── AUTH ─────────────────────────────────────────────────────

/// POST /api/auth/cadastro
public record CadastroRequest(
    string Nome,
    string Email,
    string Senha,
    string? Telefone = null
);

/// POST /api/auth/login
public record LoginRequest(
    string Email,
    string Senha
);

/// POST /api/auth/google
public record GoogleLoginRequest(string IdToken);

public record EsqueceuSenhaRequest(string Email);
public record ResetarSenhaRequest(string Token, string NovaSenha);

public record LoginResponse(
    bool       Sucesso,
    string?    Token     = null,
    UsuarioDto? Usuario  = null,
    DateTime?  ExpiraEm  = null,
    bool       Requer2FA = false,
    string?    TokenTemp = null
);

public record Verificar2FaLoginRequest(string TokenTemp, string Codigo);

public record UsuarioDto(
    string Id,
    string Nome,
    string Email,
    string? FotoUrl = null,
    DateTime? DataCriacao = null,
    string Role = "user",
    string Tema = "dark",
    string Plano = "gratuito",
    DateTime? PlanoExpiraEm = null
);

// ── RESIDENCIAS ──────────────────────────────────────────────

/// POST /api/residencia
public record CriarResidenciaRequest(
    string  Nome,
    string  Tipo          = "house",
    string? Endereco      = null,
    string? Cidade        = null,
    string? Estado        = null,
    string? Cep           = null,
    decimal? AreaM2       = null,
    string? Distribuidora = null,
    decimal TarifaKwh     = 0.74m
);

/// PATCH /api/residencia/{id}
public record AtualizarResidenciaRequest(
    string? Nome          = null,
    string? Tipo          = null,
    string? Cep           = null,
    string? Cidade        = null,
    string? Estado        = null,
    decimal? AreaM2       = null,
    string? Distribuidora = null,
    decimal? TarifaKwh    = null
);

// ── COMODOS ──────────────────────────────────────────────────

/// POST /api/comodos
public record CriarComodoRequest(
    string  IdResidencia,
    string  Nome,
    string  Tipo          = "outro",
    short   Andar         = 0,
    decimal? AreaM2       = null,
    short   OrdemExibicao = 0
);

// ── DISPOSITIVOS ─────────────────────────────────────────────

/// POST /api/dispositivos
public record CriarDispositivoRequest(
    string  IdComodo,
    string  IdResidencia,
    string  Nome,
    string  Categoria      = "outro",
    string? Marca          = null,
    string? Modelo         = null,
    decimal PotenciaNominal = 0,
    short   Tensao          = 220,
    string? IdDispositivoIot = null
);

// ── SENSORES / REGISTRO DO ESP32 ─────────────────────────────

/// POST /api/sensores/registrar
public record RegistrarSensorRequest(
    string  IdResidencia,
    string? IdIot      = null,   // gerado automaticamente se omitido
    string? Apelido    = null,
    string  Protocolo  = "http",
    int     IntervaloMs = 2000
);

public record RegistrarSensorResponse(
    bool   Sucesso,
    string IdSensor,
    string IdIot,
    string TokenSecreto,   // retornado UMA VEZ — gravar no ESP32
    string Mensagem
);

// ── LEITURAS DO ESP32 (payload enviado pelo hardware) ────────

/// POST /api/medicoes  (sem JWT — usa token do sensor no body)
public record MedicaoEsp32Request(
    string  DispositivoId,   // IdIot do sensor: MON-001
    string  Token,           // token secreto gerado no cadastro
    decimal Tensao,
    decimal Corrente,
    decimal Potencia,
    decimal EnergiKwh,
    decimal? PotenciaAparente = null,
    decimal? PotenciaReativa  = null,
    decimal? FatorPotencia    = null,
    decimal? Frequencia       = null,
    short?  RssiDbm           = null,
    int?    HeapLivre         = null,
    string? VersaoFirmware    = null,
    string? SsidWifi          = null,
    string? Ip                = null
);

public record MedicaoResponse(string Status, string Mensagem, DateTime Timestamp);

// ── DASHBOARD ────────────────────────────────────────────────

/// GET /api/dashboard/resumo?idResidencia=...
public record DashboardResumoResponse(
    bool    Sucesso,
    decimal KwhHoje,
    decimal CustoHoje,
    decimal PotenciaAtual,
    decimal TensaoAtual,
    decimal CorrenteAtual,
    decimal FrequenciaAtual,
    decimal FatorPotenciaAtual,
    decimal KwhMes,
    decimal CustoMes,
    int     AlertasNaoLidos,
    string  StatusSensor,
    DateTime? UltimaLeitura
);

/// GET /api/leituras/aovivo/:idSensor
public record LeituraAoVivoResponse(
    bool    Sucesso,
    decimal Tensao,
    decimal Corrente,
    decimal Potencia,
    decimal? PotenciaAparente,
    decimal? PotenciaReativa,
    decimal? FatorPotencia,
    decimal? FrequenciaHz,
    decimal  Kwh,
    DateTime Timestamp
);

// ── USUÁRIO / PERFIL ─────────────────────────────────────────

/// GET /api/usuario/me — dados completos do usuário logado
public record UsuarioCompletoResponse(
    bool      Sucesso,
    string    Id,
    string    Nome,
    string?   Sobrenome,
    string    Email,
    string?   Telefone,
    string?   DataNascimento,
    string?   Genero,
    string?   FotoUrl,
    DateTime  DataCriacao,
    string    Role     = "user",
    bool      TotpAtivo = false,
    string    Tema     = "dark"
);

/// PATCH /api/usuario/perfil — atualizar perfil do usuário
public record AtualizarPerfilRequest(
    string? Nome = null,
    string? Sobrenome = null,
    string? Telefone = null,
    string? DataNascimento = null,
    string? Genero = null,
    string? Tema = null
);

public record AtualizarPerfilResponse(
    bool    Sucesso,
    string  Mensagem,
    UsuarioDto Usuario
);

/// POST /api/usuario/foto — resposta do upload
public record UploadFotoResponse(
    bool    Sucesso,
    string  Mensagem,
    string? FotoUrl = null,
    int?    TamanhoBytes = null
);

/// DELETE /api/usuario/foto — remover foto
public record RemoverFotoResponse(
    bool    Sucesso,
    string  Mensagem
);

/// POST /api/usuario/senha — alterar senha
public record AlterarSenhaRequest(
    string SenhaAtual,
    string NovaSenha
);

/// DELETE /api/usuario — excluir conta (senha opcional para Google users)
public record ExcluirContaRequest(
    string? Senha = null
);

// ── ADMIN ─────────────────────────────────────────────────────

public record AdminStatsDto(
    int  TotalUsuarios,
    int  UsuariosAtivos,
    int  UsuariosSuspensos,
    int  NovosEsteMes,
    int  TotalResidencias,
    int  TotalDispositivos,
    long TotalLeituras
);

public record AdminUsuarioDto(
    string    Id,
    string    Nome,
    string    Email,
    string?   FotoUrl,
    string    Status,
    string    Role,
    DateTime  DataCriacao,
    DateTime? UltimaLogin,
    int       QtdResidencias
);

public record AdminAtualizarStatusRequest(string Status);
public record AdminAtualizarRoleRequest(string Role);

/// GET /api/leituras/historico?idResidencia=...&periodo=day
public record LeituraHistoricoItem(
    string  Label,
    decimal Kwh,
    decimal Potencia,
    decimal? PotenciaAparente,
    decimal? PotenciaReativa,
    decimal Tensao,
    decimal Corrente,
    decimal? FatorPotencia,
    decimal Custo
);

// ── NILM ─────────────────────────────────────────────────────

/// GET /api/nilm/analisar?idResidencia=...
public record NilmResultadoResponse(
    bool    Disponivel,
    string  DispositivoMaisConsome,
    decimal ConsumoPorcentagem,
    List<NilmDispositivoItem> Dispositivos,
    string  Analise,
    DateTime AnalisadoEm
);

public record NilmDispositivoItem(
    string  Nome,
    string  Categoria,
    decimal KwhEstimado,
    decimal Porcentagem,
    int     MinutosLigadoEstimado,
    bool    Ativo
);

// ── ALERTAS ──────────────────────────────────────────────────

public record AlertaDto(
    string  Id,
    string  Tipo,
    string  Categoria,
    string  Titulo,
    string  Mensagem,
    decimal? ValorDisparador,
    decimal? ValorLimiar,
    bool    Lido,
    DateTime DataCriacao
);

// ── CONFIGURAÇÃO DE ALERTAS ──────────────────────────────────

/// POST /api/alertas/config
public record AlertaConfigRequest(
    decimal? LimiteKwhDia       = null,
    decimal? LimiteCustoMes     = null,
    decimal? TensaoMinima       = null,
    decimal? TensaoMaxima       = null,
    decimal? LimitePotenciaPico = null,
    bool     NotificacaoEmail   = true,
    bool     NotificacaoPush    = false
);

// ── NOTIFICAÇÕES DO USUÁRIO ───────────────────────────────────

/// GET /api/usuario/notificacoes
public record NotificacoesResponse(
    bool    Sucesso,
    bool    EmailAlertas,
    bool    AlertaAnomalia,
    bool    AlertaConsumo,
    bool    AlertaTensao,
    bool    AlertaSensor,
    decimal? LimiteKwh,
    decimal? LimiteCusto,
    decimal? TensaoMin = null,
    decimal? TensaoMax = null
);

/// PUT /api/usuario/notificacoes
public record SalvarNotificacoesRequest(
    bool    EmailAlertas,
    bool    AlertaAnomalia,
    bool    AlertaConsumo,
    bool    AlertaTensao,
    bool    AlertaSensor,
    decimal? LimiteKwh   = null,
    decimal? LimiteCusto = null,
    decimal? TensaoMin   = null,
    decimal? TensaoMax   = null
);

// ── 2FA ──────────────────────────────────────────────────────

/// POST /api/usuario/2fa/ativar
public record Ativar2FaResponse(bool Sucesso, string Secret, string QrUri, string Mensagem);

/// POST /api/usuario/2fa/confirmar
public record Confirmar2FaRequest(string Codigo);

/// DELETE /api/usuario/2fa
public record Desativar2FaRequest(string Codigo);

// ── TARIFAS / BANDEIRA ────────────────────────────────────────

/// GET /api/tarifas/distribuidoras?estado=SP
public record DistribuidoraDto(string Codigo, string Nome, decimal TarifaB1);

/// GET /api/tarifas/bandeira
public record BandeiraDto(string Cor, string Nome, decimal AdicionalPor100Kwh);

// ── PAGAMENTO ─────────────────────────────────────────────────

/// POST /api/pagamento/verificar
public record VerificarPagamentoRequest(string PaymentId);

/// GET /api/tarifas/info?distribuidora=CEMIG
public record TarifaInfoResponse(
    bool    Sucesso,
    decimal TarifaBase,
    decimal TarifaTotal,
    BandeiraDto Bandeira
);
