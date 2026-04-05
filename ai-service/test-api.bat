@echo off
REM FinTreX PAA — API Test Script (Windows)
REM Bu script, PAA servisinin sağlıklı çalışıp çalışmadığını kontrol eder.

setlocal enabledelayedexpansion
set BASE_URL=http://localhost:8500

echo.
echo === FinTreX PAA API Tests ===
echo.

REM Test 1: Health Check
echo [1/2] Health Check
curl -s %BASE_URL%/health | jq "." || echo Health check failed
echo.

REM Test 2: Analyze Endpoint
echo [2/2] Analyze Endpoint (example data)
curl -s -X POST %BASE_URL%/analyze ^
  -H "Content-Type: application/json" ^
  -d "{\"task_id\": 1, \"task_title\": \"Test Portföy Analizi\", \"task_description\": \"Bu bir test görevidir\", \"task_category\": \"PortfolioAnalysis\", \"user_portfolios\": [{\"portfolio_id\": 1, \"name\": \"Test Portföy\", \"description\": \"Test için örnek portföy\", \"assets\": [{\"symbol\": \"THYAO\", \"asset_name\": \"Türk Hava Yolları\", \"asset_type\": \"BIST\", \"quantity\": 500, \"average_cost\": 280.50, \"currency\": \"TRY\", \"current_value\": 315.20, \"notes\": null}, {\"symbol\": \"KCHOL\", \"asset_name\": \"Koç Holding\", \"asset_type\": \"BIST\", \"quantity\": 100, \"average_cost\": 450.0, \"currency\": \"TRY\", \"current_value\": 480.0, \"notes\": null}, {\"symbol\": \"BTC\", \"asset_name\": \"Bitcoin\", \"asset_type\": \"Crypto\", \"quantity\": 0.15, \"average_cost\": 45000, \"currency\": \"USD\", \"current_value\": 68000, \"notes\": null}], \"sub_portfolios\": []}]}" | jq "." || echo Analyze request failed

echo.
echo Tests completed!
pause
