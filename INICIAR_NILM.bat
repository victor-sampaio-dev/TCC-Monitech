@echo off
title MONITECH - NILM Python Service
color 0B
cd /d %~dp0\nilm_service

echo.
echo  =============================================
echo   MONITECH - Servico NILM (Python/FastAPI)
echo   Porta: 8001
echo  =============================================
echo.

REM Verifica se Python esta instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] Python nao encontrado no PATH.
    echo  Instale Python 3.8+ em https://www.python.org/downloads/
    echo  e marque "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

echo  [1/2] Instalando/verificando dependencias Python...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo  [ERRO] Falha ao instalar dependencias.
    echo  Tente manualmente: pip install fastapi uvicorn pydantic numpy
    pause
    exit /b 1
)

echo  [2/2] Iniciando servidor NILM na porta 8001...
echo.
echo  =============================================
echo   NILM disponivel em: http://localhost:8001
echo   Status:             http://localhost:8001/status
echo   Docs:               http://localhost:8001/docs
echo  =============================================
echo.
echo  NAO FECHE esta janela enquanto usar o sistema.
echo.

python main.py

pause
