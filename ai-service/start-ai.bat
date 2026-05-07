@echo off
echo FinTreX AI Servisi Baslatiliyor...
cd /d "%~dp0"
if exist .venv\Scripts\activate (
    call .venv\Scripts\activate
) else if exist venv\Scripts\activate (
    call venv\Scripts\activate
) else if exist venv312\Scripts\activate (
    call venv312\Scripts\activate
) else (
    echo Hata: Sanal ortam (.venv, venv veya venv312) bulunamadi!
    pause
    exit /b
)

echo Paketler kontrol ediliyor...
python -m pip install -r requirements.txt --quiet

echo Servis baslatiliyor (Port: 8500)...
python -m uvicorn main:app --reload --port 8500
pause
