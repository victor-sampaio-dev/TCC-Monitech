// ============================================================
//  MONITECH — Serviço de Tarifas e Bandeira Tarifária
//  Arquivo: Services/TarifaService.cs
// ============================================================

using System.Globalization;
using System.Text.Json;

namespace Monitech.API.Services;

public record DistribuidoraInfo(string Codigo, string Nome, string Estado, decimal TarifaB1);
public record BandeiraInfo(string Cor, string Nome, decimal AdicionalPor100Kwh, DateTime AtualizadoEm);

public class TarifaService
{
    // ── Estrutura estado → distribuidoras (TarifaB1 = fallback hardcoded 2024) ──
    private static readonly Dictionary<string, List<DistribuidoraInfo>> _porEstado = new()
    {
        ["AC"] = [new("ENERGISA-AC",       "Energisa Acre",                          "AC", 0.9234m)],
        ["AL"] = [new("EQUATORIAL-AL",     "Equatorial Alagoas",                     "AL", 0.8756m)],
        ["AM"] = [new("AMAZONAS-ENERGIA",  "Amazonas Energia",                       "AM", 1.0234m)],
        ["AP"] = [new("CEA",               "CEA (Equatorial Amapá)",                 "AP", 0.9123m)],
        ["BA"] = [new("COELBA",            "COELBA (Neoenergia Bahia)",              "BA", 0.8512m)],
        ["CE"] = [new("ENEL-CE",           "ENEL Ceará",                             "CE", 0.8234m)],
        ["DF"] = [new("CEB",               "CEB (Neoenergia Brasília)",              "DF", 0.8034m)],
        ["ES"] = [new("EDP-ES",            "EDP Espírito Santo",                     "ES", 0.7923m)],
        ["GO"] = [new("ENEL-GO",           "ENEL Goiás",                             "GO", 0.7823m)],
        ["MA"] = [new("EQUATORIAL-MA",     "Equatorial Maranhão",                    "MA", 0.8923m)],
        ["MG"] = [new("CEMIG",             "CEMIG",                                  "MG", 0.8186m)],
        ["MS"] = [new("ENERGISA-MS",       "Energisa Mato Grosso do Sul",            "MS", 0.8456m)],
        ["MT"] = [new("ENERGISA-MT",       "Energisa Mato Grosso",                   "MT", 0.8634m)],
        ["PA"] = [new("EQUATORIAL-PA",     "Equatorial Pará",                        "PA", 0.8734m)],
        ["PB"] = [new("ENERGISA-PB",       "Energisa Paraíba",                       "PB", 0.8756m)],
        ["PE"] = [new("CELPE",             "CELPE (Neoenergia Pernambuco)",          "PE", 0.8512m)],
        ["PI"] = [new("EQUATORIAL-PI",     "Equatorial Piauí",                       "PI", 0.8923m)],
        ["PR"] = [new("COPEL",             "COPEL",                                  "PR", 0.7841m)],
        ["RJ"] = [
            new("ENEL-RJ",  "ENEL Rio de Janeiro",  "RJ", 0.9234m),
            new("LIGHT",    "Light",                 "RJ", 0.9512m)
        ],
        ["RN"] = [new("COSERN",            "COSERN (Neoenergia Rio Grande do Norte)", "RN", 0.8234m)],
        ["RO"] = [new("ENERGISA-RO",       "Energisa Rondônia",                      "RO", 0.9034m)],
        ["RR"] = [new("RORAIMA-ENERGIA",   "Roraima Energia",                        "RR", 1.1234m)],
        ["RS"] = [
            new("RGE",  "RGE (CPFL Rio Grande do Sul)", "RS", 0.7456m),
            new("CEEE", "CEEE (Equatorial Sul)",         "RS", 0.7234m)
        ],
        ["SC"] = [new("CELESC",            "CELESC",                                 "SC", 0.7823m)],
        ["SE"] = [new("ENERGISA-SE",       "Energisa Sergipe",                       "SE", 0.8456m)],
        ["SP"] = [
            new("ENEL-SP",          "ENEL São Paulo (Grande SP)",       "SP", 0.8742m),
            new("CPFL-PAULISTA",    "CPFL Paulista (interior SP)",      "SP", 0.8234m),
            new("CPFL-PIRATININGA", "CPFL Piratininga (interior SP)",   "SP", 0.8456m),
            new("EDP-SP",           "EDP São Paulo",                    "SP", 0.8123m),
            new("ELEKTRO",          "Elektro (interior SP/MS)",         "SP", 0.7934m)
        ],
        ["TO"] = [new("ENERGISA-TO",       "Energisa Tocantins",                     "TO", 0.8923m)],
    };

    // ── Mapeamento código interno → SigAgente da ANEEL (dadosabertos.aneel.gov.br) ──
    private static readonly Dictionary<string, string[]> _sigAgenteMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ENERGISA-AC"]       = ["ENERGISA ACRE"],
        ["EQUATORIAL-AL"]     = ["EQUATORIAL ALAGOAS"],
        ["AMAZONAS-ENERGIA"]  = ["AMAZONAS ENERGIA"],
        ["CEA"]               = ["CEA", "EQUATORIAL AMAPÁ", "EQUATORIAL AMAPA"],
        ["COELBA"]            = ["COELBA"],
        ["ENEL-CE"]           = ["ENEL DISTRIBUIÇÃO CEARÁ", "ENEL DISTRIBUICAO CEARA", "ENEL CE"],
        ["CEB"]               = ["CEB DISTRIBUIÇÃO", "CEB DISTRIBUICAO", "CEB"],
        ["EDP-ES"]            = ["EDP ESPÍRITO SANTO", "EDP ESPIRITO SANTO"],
        ["ENEL-GO"]           = ["ENEL DISTRIBUIÇÃO GOIÁS", "ENEL DISTRIBUICAO GOIAS", "ENEL GO"],
        ["EQUATORIAL-MA"]     = ["EQUATORIAL MARANHÃO", "EQUATORIAL MARANHAO"],
        ["CEMIG"]             = ["CEMIG-D", "CEMIG DISTRIBUIÇÃO", "CEMIG DISTRIBUICAO"],
        ["ENERGISA-MS"]       = ["ENERGISA MATO GROSSO DO SUL"],
        ["ENERGISA-MT"]       = ["ENERGISA MATO GROSSO"],
        ["EQUATORIAL-PA"]     = ["EQUATORIAL PARÁ", "EQUATORIAL PARA"],
        ["ENERGISA-PB"]       = ["ENERGISA PARAÍBA", "ENERGISA PARAIBA"],
        ["CELPE"]             = ["CELPE"],
        ["EQUATORIAL-PI"]     = ["EQUATORIAL PIAUÍ", "EQUATORIAL PIAUI"],
        ["COPEL"]             = ["COPEL DISTRIBUIÇÃO", "COPEL DISTRIBUICAO", "COPEL-DIS"],
        ["ENEL-RJ"]           = ["ENEL DISTRIBUIÇÃO RIO DE JANEIRO", "ENEL DISTRIBUICAO RIO DE JANEIRO", "ENEL RJ"],
        ["LIGHT"]             = ["LIGHT"],
        ["COSERN"]            = ["COSERN"],
        ["ENERGISA-RO"]       = ["ENERGISA RONDÔNIA", "ENERGISA RONDONIA"],
        ["RORAIMA-ENERGIA"]   = ["RORAIMA ENERGIA"],
        ["RGE"]               = ["RGE", "CPFL RGE"],
        ["CEEE"]              = ["CEEE DISTRIBUIÇÃO", "CEEE DISTRIBUICAO", "CEEE-D", "EQUATORIAL SUL"],
        ["CELESC"]            = ["CELESC"],
        ["ENERGISA-SE"]       = ["ENERGISA SERGIPE"],
        ["ENEL-SP"]           = ["ENEL DISTRIBUIÇÃO SÃO PAULO", "ENEL DISTRIBUICAO SAO PAULO", "ENEL SP"],
        ["CPFL-PAULISTA"]     = ["CPFL PAULISTA"],
        ["CPFL-PIRATININGA"]  = ["CPFL PIRATININGA"],
        ["EDP-SP"]            = ["EDP SÃO PAULO", "EDP SAO PAULO"],
        ["ELEKTRO"]           = ["ELEKTRO"],
        ["ENERGISA-TO"]       = ["ENERGISA TOCANTINS"],
    };

    // ── Cache vivo de tarifas B1 (código interno → R$/kWh da ANEEL) ──
    private static Dictionary<string, decimal> _tarifasVivas = InitFallback();
    private static DateTime _tarifasExpiry = DateTime.MinValue;
    private static readonly SemaphoreSlim _tarifasLock = new(1, 1);

    private static Dictionary<string, decimal> InitFallback() =>
        _porEstado.Values.SelectMany(x => x)
            .ToDictionary(d => d.Codigo, d => d.TarifaB1, StringComparer.OrdinalIgnoreCase);

    // ── Cache de bandeira tarifária ──
    private BandeiraInfo _bandeiraCache = new("verde", "Verde", 0m, DateTime.MinValue);
    private DateTime _bandeiraCacheExpiry = DateTime.MinValue;

    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<TarifaService> _logger;

    public TarifaService(IHttpClientFactory httpFactory, ILogger<TarifaService> logger)
    {
        _httpFactory = httpFactory;
        _logger = logger;
    }

    // ── Retorna distribuidoras do estado com tarifa viva (ANEEL ou fallback) ──
    public IEnumerable<DistribuidoraInfo> GetDistribuidoras(string estado)
    {
        var uf = estado.Trim().ToUpper();
        if (!_porEstado.TryGetValue(uf, out var lista)) return [];
        return lista.Select(d => d with { TarifaB1 = _tarifasVivas.GetValueOrDefault(d.Codigo, d.TarifaB1) });
    }

    public DistribuidoraInfo? GetDistribuidora(string codigo)
    {
        var d = _porEstado.Values.SelectMany(x => x)
            .FirstOrDefault(d => d.Codigo.Equals(codigo, StringComparison.OrdinalIgnoreCase));
        if (d is null) return null;
        return d with { TarifaB1 = _tarifasVivas.GetValueOrDefault(d.Codigo, d.TarifaB1) };
    }

    // ── Atualiza tarifas B1 via API pública da ANEEL (cache 24h, fallback no erro) ──
    public async Task AtualizarTarifasAsync()
    {
        if (DateTime.UtcNow < _tarifasExpiry) return;

        // Se já está atualizando em outra thread, não bloqueia — retorna com cache atual
        if (!await _tarifasLock.WaitAsync(0)) return;

        try
        {
            var client = _httpFactory.CreateClient("aneel");

            // Dataset: Tarifas Homologadas (subgrupo B1 residencial convencional)
            // resource_id: fcf2906c-7c32-4b9b-a637-054e7a5234f4
            var filters = Uri.EscapeDataString("{\"DscSubGrupo\":\"B1\",\"DscModalidadeTarifaria\":\"Convencional\"}");
            var url = $"/api/3/action/datastore_search" +
                      $"?resource_id=fcf2906c-7c32-4b9b-a637-054e7a5234f4" +
                      $"&filters={filters}" +
                      $"&sort=DatInicioVigencia+desc" +
                      $"&limit=1000";

            var json  = await client.GetStringAsync(url);
            var doc   = JsonDocument.Parse(json);
            var ok    = doc.RootElement.GetProperty("success").GetBoolean();
            if (!ok) throw new InvalidOperationException("ANEEL retornou success=false");

            var records = doc.RootElement.GetProperty("result").GetProperty("records");
            var hoje    = DateTime.UtcNow.Date;

            // Mapa reverso: SigAgente (ANEEL) → código interno
            // Pré-computa para evitar N² no loop
            var reverso = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var (codigo, aliases) in _sigAgenteMap)
                foreach (var alias in aliases)
                    reverso.TryAdd(alias, codigo);

            var novas = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

            foreach (var r in records.EnumerateArray())
            {
                // Filtra baixa renda (DscSubClasse ou DscDetalhe contém "Baixa Renda")
                var subclasse = GetStr(r, "DscSubClasse");
                var detalhe   = GetStr(r, "DscDetalhe");
                if (subclasse.Contains("Baixa Renda", StringComparison.OrdinalIgnoreCase) ||
                    detalhe.Contains("Baixa Renda", StringComparison.OrdinalIgnoreCase))
                    continue;

                // Filtra vigência — aceita apenas tarifas válidas hoje
                if (!TryParseDate(GetStr(r, "DatInicioVigencia"), out var dtInicio)) continue;
                if (!TryParseDate(GetStr(r, "DatFimVigencia"),    out var dtFim))    continue;
                if (dtInicio > hoje || dtFim < hoje) continue;

                // SigAgente → código interno
                var sig = GetStr(r, "SigAgente").Trim();
                if (!reverso.TryGetValue(sig, out var codigo))
                {
                    // Tenta correspondência parcial (ex: "ENEL CE" dentro de nossa lista)
                    codigo = reverso.Keys
                        .FirstOrDefault(k => sig.Contains(k, StringComparison.OrdinalIgnoreCase) ||
                                             k.Contains(sig, StringComparison.OrdinalIgnoreCase))
                        is { } match ? reverso[match] : null;
                }
                if (codigo is null) continue;

                // ANEEL retorna em R$/MWh — divide por 1000 para R$/kWh
                var tusd   = ParseDecimal(r, "VlrTUSD") / 1000m;
                var te     = ParseDecimal(r, "VlrTE")   / 1000m;
                var tarifa = tusd + te;
                if (tarifa <= 0) continue;

                // Mantém o mais recente (sort desc garante que o primeiro é o mais atual)
                novas.TryAdd(codigo, Math.Round(tarifa, 4));
            }

            if (novas.Count > 0)
            {
                // Preenche distribuidoras não encontradas na ANEEL com fallback
                foreach (var d in _porEstado.Values.SelectMany(x => x))
                    novas.TryAdd(d.Codigo, d.TarifaB1);

                _tarifasVivas  = novas;
                _tarifasExpiry = DateTime.UtcNow.AddHours(24);
                _logger.LogInformation("[TarifaService] Tarifas ANEEL atualizadas: {Count}/{Total} distribuidoras",
                    novas.Count - (_porEstado.Values.SelectMany(x => x).Count() - novas.Count(kv => _porEstado.Values.SelectMany(x => x).Any(d => d.Codigo == kv.Key && d.TarifaB1 == kv.Value))),
                    _porEstado.Values.SelectMany(x => x).Count());
            }
            else
            {
                _logger.LogWarning("[TarifaService] ANEEL não retornou nenhum registro válido — mantendo fallback");
                _tarifasExpiry = DateTime.UtcNow.AddHours(1);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[TarifaService] Falha ao buscar tarifas da ANEEL: {Msg} — mantendo fallback", ex.Message);
            _tarifasExpiry = DateTime.UtcNow.AddHours(1); // tenta novamente em 1h
        }
        finally
        {
            _tarifasLock.Release();
        }
    }

    public async Task<BandeiraInfo> GetBandeiraAsync()
    {
        if (DateTime.UtcNow < _bandeiraCacheExpiry)
            return _bandeiraCache;

        try
        {
            var client = _httpFactory.CreateClient("aneel");
            var resp = await client.GetStringAsync(
                "/api/3/action/datastore_search?resource_id=08f03df1-bf83-4c64-942e-1e7b1cd86e2d&limit=1&sort=data+desc");

            var json = JsonDocument.Parse(resp);
            var records = json.RootElement
                .GetProperty("result")
                .GetProperty("records");

            if (records.GetArrayLength() > 0)
            {
                var first = records[0];
                var descricao = first.TryGetProperty("DscBandeiraTarifaria", out var d)
                    ? d.GetString() ?? "Verde"
                    : "Verde";
                var adicional = first.TryGetProperty("VlrAdicional", out var v)
                    ? v.GetDecimal()
                    : 0m;

                var cor = descricao.ToLower() switch
                {
                    var s when s.Contains("vermelha 2") || s.Contains("vermelha2") => "vermelha2",
                    var s when s.Contains("vermelha")                               => "vermelha1",
                    var s when s.Contains("amarela")                                => "amarela",
                    _                                                                => "verde"
                };

                _bandeiraCache      = new BandeiraInfo(cor, descricao, adicional, DateTime.UtcNow);
                _bandeiraCacheExpiry = DateTime.UtcNow.AddHours(24);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[TarifaService] Falha ao buscar bandeira da ANEEL: {Msg}", ex.Message);
            _bandeiraCacheExpiry = DateTime.UtcNow.AddHours(1);
        }

        return _bandeiraCache;
    }

    public static IEnumerable<string> ListarEstados() => _porEstado.Keys.Order();

    // ── Helpers de parsing ──────────────────────────────────────────────────
    private static string GetStr(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) ? v.GetString() ?? "" : "";

    private static bool TryParseDate(string s, out DateTime dt)
    {
        dt = default;
        if (string.IsNullOrWhiteSpace(s)) return false;
        return DateTime.TryParseExact(s, ["yyyy-MM-dd", "dd/MM/yyyy", "yyyy-MM-ddTHH:mm:ss"],
            CultureInfo.InvariantCulture, DateTimeStyles.None, out dt);
    }

    private static decimal ParseDecimal(JsonElement el, string prop)
    {
        if (!el.TryGetProperty(prop, out var v)) return 0m;
        if (v.ValueKind == JsonValueKind.Number) return v.GetDecimal();
        var s = v.GetString();
        if (string.IsNullOrWhiteSpace(s)) return 0m;
        // ANEEL usa formato pt-BR: vírgula = decimal, ponto = milhar (ex: "1.234,56")
        // Normaliza para invariant: remove ponto de milhar, troca vírgula por ponto
        var normalizado = s.Replace(".", "").Replace(",", ".");
        return decimal.TryParse(normalizado, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;
    }
}
