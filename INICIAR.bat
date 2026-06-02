@echo off
title MONITECH — Servidor
color 0A

REM Garante que estamos no diretório correto
cd /d %~dp0

echo.
echo  =============================================
echo   MONITECH Iniciando o Servidor
echo  =============================================
echo.
echo  [1/2] Verificando MySQL...

REM Testa se o MySQL está acessível
C:\xampp\mysql\bin\mysql.exe -u root -proot -e "USE monitech;" 2>nul
if errorlevel 1 (
    echo.
    echo  [AVISO] Banco 'monitech' nao encontrado ou MySQL offline.
    echo  Execute primeiro: C:\xampp\mysql\bin\mysql.exe -u root -proot ^< database\banco.sql
    echo.
    echo  Pressione qualquer tecla para tentar iniciar mesmo assim...
    pause >nul
)

echo  [2/3] Iniciando servico NILM (Python) em janela separada...
start "MONITECH NILM" /min cmd /c "%~dp0INICIAR_NILM.bat"
timeout /t 3 /nobreak >nul

echo  [3/3] Restaurando pacotes e iniciando backend C# na porta 5000...
echo.

REM Restaura os pacotes NuGet
dotnet restore Monitech.API.csproj

echo.
echo  =============================================
echo   Acesse o sistema em: http://localhost:5000
echo   Swagger (API docs):   http://localhost:5000/swagger
echo   NILM Service:         http://localhost:8001
echo  =============================================
echo.
echo  NAO FECHE esta janela enquanto usar o sistema.
echo  Pressione Ctrl+C para parar o servidor.
echo.

dotnet run --project Monitech.API.csproj --urls "http://localhost:5000"

pause
