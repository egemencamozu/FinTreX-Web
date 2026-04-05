#!/bin/bash

# FinTreX PAA — API Test Script
# Bu script, PAA servisinin sağlıklı çalışıp çalışmadığını kontrol eder.

BASE_URL="http://localhost:8500"
ECHO_COLOR='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${ECHO_COLOR}=== FinTreX PAA API Tests ===${NC}"
echo ""

# Test 1: Health Check
echo -e "${ECHO_COLOR}[1/2] Health Check${NC}"
curl -s "$BASE_URL/health" | jq '.' || echo "Health check failed"
echo ""

# Test 2: Analyze Endpoint (örnek portföy verisi)
echo -e "${ECHO_COLOR}[2/2] Analyze Endpoint (örnek veri)${NC}"
curl -s -X POST "$BASE_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": 1,
    "task_title": "Test Portföy Analizi",
    "task_description": "Bu bir test görevidir",
    "task_category": "PortfolioAnalysis",
    "user_portfolios": [
      {
        "portfolio_id": 1,
        "name": "Test Portföy",
        "description": "Test için örnek portföy",
        "assets": [
          {
            "symbol": "THYAO",
            "asset_name": "Türk Hava Yolları",
            "asset_type": "BIST",
            "quantity": 500,
            "average_cost": 280.50,
            "currency": "TRY",
            "current_value": 315.20,
            "notes": null
          },
          {
            "symbol": "KCHOL",
            "asset_name": "Koç Holding",
            "asset_type": "BIST",
            "quantity": 100,
            "average_cost": 450.0,
            "currency": "TRY",
            "current_value": 480.0,
            "notes": null
          },
          {
            "symbol": "BTC",
            "asset_name": "Bitcoin",
            "asset_type": "Crypto",
            "quantity": 0.15,
            "average_cost": 45000,
            "currency": "USD",
            "current_value": 68000,
            "notes": null
          }
        ],
        "sub_portfolios": []
      }
    ]
  }' | jq '.' || echo "Analyze request failed"

echo ""
echo -e "${ECHO_COLOR}Tests completed!${NC}"
