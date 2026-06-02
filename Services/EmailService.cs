// ============================================================
//  MONITECH — Serviço de E-mail (MailKit — substitui SmtpClient obsoleto)
// ============================================================

using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Monitech.API.Services;

public class EmailService(IConfiguration config)
{
  public async Task EnviarRecuperacaoSenhaAsync(string destinatario, string nome, string linkReset)
  {
    var host = config["Email:Host"]!;
    var porta = int.Parse(config["Email:Porta"]!);
    var usuario = config["Email:Usuario"]!;
    var senha = config["Email:Senha"]!;
    var remetente = config["Email:Remetente"]!;

    var mensagem = new MimeMessage();
    mensagem.From.Add(new MailboxAddress("MONITECH", remetente));
    mensagem.To.Add(new MailboxAddress(nome, destinatario));
    mensagem.Subject = "Recuperação de Senha — MONITECH";

    mensagem.Body = new TextPart("html")
    {
      Text = $"""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet">
            </head>
            <body style="margin:0;padding:40px 20px;background:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
              <div style="max-width:540px;margin:0 auto;background:#111827;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                <div style="background:linear-gradient(135deg,#0057ff 0%,#0ea5e9 100%);padding:36px 32px 28px;text-align:center;">
                  <!-- Logo MONITECH (SVG inline) -->
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" width="58" height="67"
                       style="display:block;margin:0 auto 14px;">
                    <path d="M100,18 C72,18 50,40 50,66 C50,86 60,100 74,110 C80,114 82,120 82,126 L118,126 C118,120 120,114 126,110 C140,100 150,86 150,66 C150,40 128,18 100,18Z"
                          fill="none" stroke="white" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
                    <path d="M83,130 C91,127 109,127 117,130" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
                    <path d="M84,138 C92,134 108,134 116,138" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round"/>
                    <path d="M86,146 C93,142 107,142 114,146" fill="none" stroke="white" stroke-width="3"   stroke-linecap="round"/>
                    <path d="M88,154 C91,148 98,148 100,152 C102,155 105,153 108,148 C110,150 114,155 114,158"
                          fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M90,162 C94,158 106,158 110,162" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                    <path d="M94,170 C97,167 103,167 106,170" fill="none" stroke="white" stroke-width="2"   stroke-linecap="round"/>
                    <path d="M78,116 C76,100 80,82 86,72 C90,64 96,66 98,76 C100,84 99,98 99,110"
                          fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M99,110 C99,96 100,82 103,72 C106,62 114,64 116,74 C118,84 116,104 113,118"
                          fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M113,118 C115,122 114,128 110,127 C107,126 107,121 110,119"
                          fill="none" stroke="white" stroke-width="3"   stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div style="font-family:'Syne',Arial,sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:3px;text-transform:uppercase;">MONITECH</div>
                  <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:12px;letter-spacing:0.5px;">Monitoramento de Energia Residencial</p>
                </div>
                <div style="padding:40px 36px;">
                  <h2 style="color:#f0f4ff;font-size:22px;font-weight:700;margin:0 0 14px;">Redefinição de senha</h2>
                  <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 8px;">
                    Olá, <strong style="color:#f0f4ff;">{nome}</strong>!
                  </p>
                  <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">
                    Recebemos uma solicitação para redefinir a senha da sua conta MONITECH.
                    Clique no botão abaixo — o link é válido por <strong style="color:#f0f4ff;">1 hora</strong>.
                  </p>
                  <div style="text-align:center;margin-bottom:32px;">
                    <a href="{linkReset}"
                       style="display:inline-block;background:linear-gradient(135deg,#0057ff,#0ea5e9);color:#fff;
                              text-decoration:none;font-weight:700;font-size:15px;
                              padding:16px 44px;border-radius:10px;letter-spacing:0.02em;">
                      Redefinir minha senha →
                    </a>
                  </div>
                  <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 20px;">
                    Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanecerá a mesma.
                  </p>
                  <div style="padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
                    <p style="color:#475569;font-size:12px;margin:0 0 6px;">Ou cole este link no seu navegador:</p>
                    <p style="color:#60a5fa;font-size:12px;word-break:break-all;margin:0;">{linkReset}</p>
                  </div>
                </div>
                <div style="padding:20px 36px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.05);">
                  <p style="color:#334155;font-size:11px;margin:0;text-align:center;">
                    © 2026 MONITECH — Este é um e-mail automático, não responda.
                  </p>
                </div>
              </div>
            </body>
            </html>
            """
    };

    using var smtp = new SmtpClient();

    Console.WriteLine($"[EMAIL] Conectando em {host}:{porta}...");
    await smtp.ConnectAsync(host, porta, SecureSocketOptions.StartTls);

    Console.WriteLine($"[EMAIL] Autenticando como {usuario}...");
    await smtp.AuthenticateAsync(usuario, senha);

    Console.WriteLine($"[EMAIL] Enviando para {destinatario}...");
    await smtp.SendAsync(mensagem);
    await smtp.DisconnectAsync(true);

    Console.WriteLine($"[EMAIL] Enviado com sucesso para {destinatario}!");
  }

  public async Task EnviarAlertaAsync(string destinatario, string nome, string titulo, string mensagem, string tipo)
  {
    var host      = config["Email:Host"]!;
    var porta     = int.Parse(config["Email:Porta"]!);
    var usuario   = config["Email:Usuario"]!;
    var senha     = config["Email:Senha"]!;
    var remetente = config["Email:Remetente"]!;

    var corBorda  = tipo == "error"   ? "#d93d63" :
                    tipo == "warning" ? "#cc8a00" : "#0057ff";
    var icone     = tipo == "error"   ? "&#9888;" :
                    tipo == "warning" ? "&#9888;" : "&#8505;";
    var label     = tipo == "error"   ? "Alerta Crítico" :
                    tipo == "warning" ? "Aviso de Consumo" : "Informação";

    var email = new MimeMessage();
    email.From.Add(new MailboxAddress("MONITECH", remetente));
    email.To.Add(new MailboxAddress(nome, destinatario));
    email.Subject = $"[MONITECH] {label}: {titulo}";

    email.Body = new TextPart("html")
    {
      Text = $"""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet">
            </head>
            <body style="margin:0;padding:40px 20px;background:#0a0f1e;font-family:'Segoe UI',Arial,sans-serif;">
              <div style="max-width:540px;margin:0 auto;background:#111827;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
                <div style="background:linear-gradient(135deg,#0057ff 0%,#0ea5e9 100%);padding:36px 32px 28px;text-align:center;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 230" width="58" height="67"
                       style="display:block;margin:0 auto 14px;">
                    <path d="M100,18 C72,18 50,40 50,66 C50,86 60,100 74,110 C80,114 82,120 82,126 L118,126 C118,120 120,114 126,110 C140,100 150,86 150,66 C150,40 128,18 100,18Z"
                          fill="none" stroke="white" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
                    <path d="M83,130 C91,127 109,127 117,130" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"/>
                    <path d="M84,138 C92,134 108,134 116,138" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round"/>
                    <path d="M86,146 C93,142 107,142 114,146" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>
                    <path d="M78,116 C76,100 80,82 86,72 C90,64 96,66 98,76 C100,84 99,98 99,110"
                          fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M99,110 C99,96 100,82 103,72 C106,62 114,64 116,74 C118,84 116,104 113,118"
                          fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div style="font-family:'Syne',Arial,sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:3px;text-transform:uppercase;">MONITECH</div>
                  <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:12px;letter-spacing:0.5px;">Monitoramento de Energia Residencial</p>
                </div>
                <div style="padding:40px 36px;">
                  <div style="display:inline-block;background:{corBorda}22;border:1px solid {corBorda};border-radius:8px;padding:6px 14px;margin-bottom:20px;">
                    <span style="color:{corBorda};font-size:13px;font-weight:700;letter-spacing:0.5px;">{icone} {label.ToUpperInvariant()}</span>
                  </div>
                  <h2 style="color:#f0f4ff;font-size:20px;font-weight:700;margin:0 0 14px;border-left:3px solid {corBorda};padding-left:12px;">{titulo}</h2>
                  <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 8px;">
                    Olá, <strong style="color:#f0f4ff;">{nome}</strong>!
                  </p>
                  <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px;">{mensagem}</p>
                  <div style="background:rgba(0,87,255,0.06);border:1px solid rgba(0,87,255,0.15);border-radius:10px;padding:16px 20px;margin-bottom:28px;">
                    <p style="color:#64748b;font-size:13px;margin:0;">
                      Detectado em: <strong style="color:#94a3b8;">{DateTime.Now:dd/MM/yyyy HH:mm}</strong>
                    </p>
                  </div>
                  <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">
                    Para desativar alertas por e-mail, acesse <strong style="color:#94a3b8;">Configurações → Notificações</strong> no painel MONITECH.
                  </p>
                </div>
                <div style="padding:20px 36px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.05);">
                  <p style="color:#334155;font-size:11px;margin:0;text-align:center;">
                    © 2026 MONITECH — Este é um e-mail automático, não responda.
                  </p>
                </div>
              </div>
            </body>
            </html>
            """
    };

    try
    {
      using var smtp = new SmtpClient();
      await smtp.ConnectAsync(host, porta, SecureSocketOptions.StartTls);
      await smtp.AuthenticateAsync(usuario, senha);
      await smtp.SendAsync(email);
      await smtp.DisconnectAsync(true);
      Console.WriteLine($"[EMAIL ALERTA] ✓ Enviado para {destinatario}: {titulo}");
    }
    catch (Exception ex)
    {
      Console.WriteLine($"[EMAIL ALERTA] ✗ Falha ao enviar para {destinatario}: {ex.Message}");
    }
  }
}
