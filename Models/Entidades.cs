// ============================================================
//  MONITECH — Modelos (mapeiam as tabelas MySQL)
//  Arquivo: Models/Entidades.cs
// ============================================================

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Monitech.API.Models;

[Table("usuarios")]
public class Usuario
{
    [Column("id")]               public string  Id               { get; set; } = Guid.NewGuid().ToString();
    [Column("nome")]             public string  Nome             { get; set; } = "";
    [Column("sobrenome")]        public string? Sobrenome        { get; set; }
    [Column("email")]            public string  Email            { get; set; } = "";
    [Column("hash_senha")]       public string  HashSenha        { get; set; } = "";
    [Column("telefone")]         public string?   Telefone        { get; set; }
    [Column("data_nascimento")]  public DateOnly? DataNascimento  { get; set; }
    [Column("genero")]           public string?   Genero          { get; set; }
    [Column("foto_url")]         public string?   FotoUrl         { get; set; }
    [Column("status")]           public string  Status           { get; set; } = "active";
    [Column("email_verificado")] public bool    EmailVerificado  { get; set; } = false;
    [Column("data_criacao")]     public DateTime DataCriacao     { get; set; } = DateTime.UtcNow;
    [Column("data_atualizacao")] public DateTime DataAtualizacao { get; set; } = DateTime.UtcNow;
    [Column("ultima_login")]     public DateTime? UltimaLogin    { get; set; }
    [Column("fuso_horario")]     public string  FusoHorario      { get; set; } = "America/Sao_Paulo";
    [Column("role")]             public string  Role             { get; set; } = "user";
    [Column("totp_secret")]      public string? TotpSecret       { get; set; }
    [Column("totp_ativo")]       public bool    TotpAtivo        { get; set; } = false;

    public List<Residencia> Residencias { get; set; } = [];
    public List<Sessao>     Sessoes     { get; set; } = [];
}

[Table("residencias")]
public class Residencia
{
    [Column("id")]                 public string  Id               { get; set; } = Guid.NewGuid().ToString();
    [Column("id_usuario")]         public string  IdUsuario        { get; set; } = "";
    [Column("nome")]               public string  Nome             { get; set; } = "";
    [Column("tipo")]               public string  Tipo             { get; set; } = "house";
    [Column("endereco")]           public string? Endereco         { get; set; }
    [Column("cidade")]             public string? Cidade           { get; set; }
    [Column("estado")]             public string? Estado           { get; set; }
    [Column("cep")]                public string? Cep              { get; set; }
    [Column("area_m2")]            public decimal? AreaM2          { get; set; }
    [Column("distribuidora")]      public string? Distribuidora    { get; set; }
    [Column("tarifa_kwh")]         public decimal TarifaKwh        { get; set; } = 0.74m;
    [Column("ativo")]              public bool    Ativo            { get; set; } = true;
    [Column("data_criacao")]       public DateTime DataCriacao     { get; set; } = DateTime.UtcNow;
    [Column("data_atualizacao")]   public DateTime DataAtualizacao { get; set; } = DateTime.UtcNow;

    public Usuario?       Usuario  { get; set; }
    public List<Comodo>   Comodos  { get; set; } = [];
    public List<Sensor>   Sensores { get; set; } = [];
}

[Table("comodos")]
public class Comodo
{
    [Column("id")]              public string  Id            { get; set; } = Guid.NewGuid().ToString();
    [Column("id_residencia")]   public string  IdResidencia  { get; set; } = "";
    [Column("nome")]            public string  Nome          { get; set; } = "";
    [Column("tipo")]            public string  Tipo          { get; set; } = "outro";
    [Column("andar")]           public short   Andar         { get; set; } = 0;
    [Column("area_m2")]         public decimal? AreaM2       { get; set; }
    [Column("ordem_exibicao")]  public short   OrdemExibicao { get; set; } = 0;
    [Column("data_criacao")]    public DateTime DataCriacao  { get; set; } = DateTime.UtcNow;
    [Column("data_atualizacao")] public DateTime DataAtualizacao { get; set; } = DateTime.UtcNow;

    public Residencia?      Residencia { get; set; }
    public List<Dispositivo> Dispositivos { get; set; } = [];
}

[Table("dispositivos")]
public class Dispositivo
{
    [Column("id")]                   public string  Id               { get; set; } = Guid.NewGuid().ToString();
    [Column("id_comodo")]            public string  IdComodo         { get; set; } = "";
    [Column("id_residencia")]        public string  IdResidencia     { get; set; } = "";
    [Column("nome")]                 public string  Nome             { get; set; } = "";
    [Column("categoria")]            public string  Categoria        { get; set; } = "outro";
    [Column("marca")]                public string? Marca            { get; set; }
    [Column("modelo")]               public string? Modelo           { get; set; }
    [Column("potencia_nominal")]     public decimal PotenciaNominal  { get; set; } = 0;
    [Column("tensao")]               public short   Tensao           { get; set; } = 220;
    [Column("status")]               public string  Status           { get; set; } = "off";
    [Column("monitorado")]           public bool    Monitorado       { get; set; } = true;
    [Column("id_dispositivo_iot")]   public string? IdDispositivoIot { get; set; }
    [Column("data_criacao")]         public DateTime DataCriacao     { get; set; } = DateTime.UtcNow;
    [Column("data_atualizacao")]     public DateTime DataAtualizacao { get; set; } = DateTime.UtcNow;

    public Comodo?     Comodo     { get; set; }
    public Residencia? Residencia { get; set; }
}

[Table("sensores")]
public class Sensor
{
    [Column("id")]                   public string  Id                { get; set; } = Guid.NewGuid().ToString();
    [Column("id_residencia")]        public string  IdResidencia      { get; set; } = "";
    [Column("id_dispositivo")]       public string? IdDispositivo     { get; set; }
    [Column("id_iot")]               public string  IdIot             { get; set; } = "";
    [Column("apelido")]              public string? Apelido           { get; set; }
    [Column("token_secreto")]        public string  TokenSecreto      { get; set; } = "";  // hash bcrypt
    [Column("versao_firmware")]      public string? VersaoFirmware    { get; set; }
    [Column("id_chip")]              public string? IdChip            { get; set; }
    [Column("endereco_ip")]          public string? EnderecoIp        { get; set; }
    [Column("ssid_wifi")]            public string? SsidWifi          { get; set; }
    [Column("protocolo")]            public string  Protocolo         { get; set; } = "http";
    [Column("intervalo_polling_ms")] public int     IntervaloPollingMs { get; set; } = 2000;
    [Column("modelo_sensor")]        public string? ModeloSensor      { get; set; } = "PZEM-004T";
    [Column("ultima_visualizacao")]  public DateTime? UltimaVisualizacao { get; set; }
    [Column("status")]               public string  Status            { get; set; } = "offline";
    [Column("rssi_dbm")]             public short?  RssiDbm           { get; set; }
    [Column("bytes_heap_livre")]     public int?    BytesHeapLivre    { get; set; }
    [Column("data_criacao")]         public DateTime DataCriacao      { get; set; } = DateTime.UtcNow;
    [Column("data_atualizacao")]     public DateTime DataAtualizacao  { get; set; } = DateTime.UtcNow;

    public Residencia?    Residencia { get; set; }
    public List<Leitura>  Leituras   { get; set; } = [];
}

[Table("leituras")]
public class Leitura
{
    [Column("id")]                public long    Id               { get; set; }
    [Column("id_sensor")]         public string  IdSensor         { get; set; } = "";
    [Column("id_dispositivo")]    public string? IdDispositivo    { get; set; }
    [Column("id_residencia")]     public string  IdResidencia     { get; set; } = "";
    [Column("tensao")]            public decimal Tensao           { get; set; }
    [Column("corrente")]          public decimal Corrente         { get; set; }
    [Column("potencia")]          public decimal Potencia         { get; set; }
    [Column("potencia_aparente")] public decimal? PotenciaAparente { get; set; }
    [Column("potencia_reativa")]  public decimal? PotenciaReativa  { get; set; }
    [Column("fator_potencia")]    public decimal? FatorPotencia    { get; set; }
    [Column("frequencia_hz")]     public decimal? FrequenciaHz     { get; set; }
    [Column("kwh")]               public decimal Kwh              { get; set; }
    [Column("timestamp")]         public DateTime Timestamp        { get; set; } = DateTime.UtcNow;
    [Column("qualidade")]         public short   Qualidade         { get; set; } = 100;

    public Sensor? Sensor { get; set; }
}

[Table("alertas")]
public class Alerta
{
    [Column("id")]               public string  Id              { get; set; } = Guid.NewGuid().ToString();
    [Column("id_residencia")]    public string  IdResidencia    { get; set; } = "";
    [Column("id_usuario")]       public string  IdUsuario       { get; set; } = "";
    [Column("id_sensor")]        public string? IdSensor        { get; set; }
    [Column("id_dispositivo")]   public string? IdDispositivo   { get; set; }
    [Column("tipo")]             public string  Tipo            { get; set; } = "info";
    [Column("categoria")]        public string  Categoria       { get; set; } = "custom";
    [Column("titulo")]           public string  Titulo          { get; set; } = "";
    [Column("mensagem")]         public string  Mensagem        { get; set; } = "";
    [Column("valor_disparador")] public decimal? ValorDisparador { get; set; }
    [Column("valor_limiar")]     public decimal? ValorLimiar     { get; set; }
    [Column("lido")]             public bool     Lido            { get; set; } = false;
    [Column("resolvido")]        public bool     Resolvido       { get; set; } = false;
    [Column("data_resolucao")]   public DateTime? DataResolucao  { get; set; }
    [Column("data_criacao")]     public DateTime  DataCriacao    { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Residencia? Residencia { get; set; }
    public Usuario?    Usuario    { get; set; }
}

[Table("notificacoes_usuario")]
public class NotificacoesUsuario
{
    [Column("id_usuario")]        public string Id           { get; set; } = "";
    [Column("email_alertas")]     public bool   EmailAlertas { get; set; } = true;
    [Column("alerta_anomalia")]   public bool   AlertaAnomalia { get; set; } = true;
    [Column("alerta_consumo")]    public bool   AlertaConsumo  { get; set; } = true;
    [Column("alerta_tensao")]     public bool   AlertaTensao   { get; set; } = true;
    [Column("alerta_sensor")]     public bool   AlertaSensor   { get; set; } = true;
    [Column("limite_kwh")]        public decimal? LimiteKwh   { get; set; }
    [Column("limite_custo")]      public decimal? LimiteCusto  { get; set; }
    [Column("tensao_min")]        public decimal? TensaoMin    { get; set; }
    [Column("tensao_max")]        public decimal? TensaoMax    { get; set; }
    [Column("data_atualizacao")]  public DateTime DataAtualizacao { get; set; } = DateTime.UtcNow;

    public Usuario? Usuario { get; set; }
}

[Table("tokens_recuperacao")]
public class TokenRecuperacao
{
    [Column("id")]           public string   Id          { get; set; } = Guid.NewGuid().ToString();
    [Column("id_usuario")]   public string   IdUsuario   { get; set; } = "";
    [Column("token")]        public string   Token       { get; set; } = "";
    [Column("expira_em")]    public DateTime ExpiraEm    { get; set; }
    [Column("usado")]        public bool     Usado       { get; set; } = false;
    [Column("data_criacao")] public DateTime DataCriacao { get; set; } = DateTime.UtcNow;

    public Usuario? Usuario { get; set; }
}

[Table("sessoes")]
public class Sessao
{
    [Column("id")]             public string   Id          { get; set; } = Guid.NewGuid().ToString();
    [Column("id_usuario")]     public string   IdUsuario   { get; set; } = "";
    [Column("hash_token")]     public string   HashToken   { get; set; } = "";
    [Column("endereco_ip")]    public string?  EnderecoIp  { get; set; }
    [Column("expira_em")]      public DateTime ExpiraEm    { get; set; }
    [Column("data_criacao")]   public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    [Column("revogado_em")]    public DateTime? RevogadoEm { get; set; }

    public Usuario? Usuario { get; set; }
}
