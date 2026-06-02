@echo off
color 0C

echo.
echo  ===== RESETANDO BANCO DE DADOS =====
echo.
echo  ⚠️  Isto vai DELETAR todo o banco 'monitech' e recriar
echo.
pause

C:\xampp\mysql\bin\mysql.exe -u root -proot -e "DROP DATABASE IF EXISTS monitech;"
C:\xampp\mysql\bin\mysql.exe -u root -proot < ..\database\banco.sql

echo.
echo  ✓ Banco resetado com sucesso!
echo.
pause
