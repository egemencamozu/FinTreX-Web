# FinTreX PAA — Pre-Analysis Assistant (CrewAI Microservice)

> Python FastAPI + CrewAI tabanlı portföy ön-analiz servisi

## Genel Bakış

Bu servis, .NET backend'den gelen portföy verilerini alıp CrewAI ajanları kullanarak **tarafsız, objektif** bir ön-analiz raporu üretir. Yatırım tavsiyesi vermez — sadece veri özetler.

### Mimari

```
.NET Backend (port 9001)
    ↓ POST /analyze
Python FastAPI (port 8500)
    ↓
CrewAI Crew (Sequential)
    ├── Ajan 1: Data Analyst
    │   └── Sayısal analiz çıkarır
    └── Ajan 2: Report Writer
        └── Tarafsız rapor yazar
    ↓
JSON Response
    ↓
.NET Backend → PreAnalysisReport tablosuna kaydet
```

## Kurulum

### 1. Python Ortamı

```bash
cd ai-service
python -m venv venv
```

**Windows:**
```bash
venv\Scripts\activate
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

### 2. Bağımlılıkları Kur

```bash
pip install -r requirements.txt
```

### 3. Ortam Değişkenleri

`.env` dosyası oluştur (`.env.example`'den kopyala):

```bash
cp .env.example .env
```

`ai-service/.env` dosyasını aç ve doldur:

```env
OPENAI_API_KEY=sk-...          # OpenAI API Key
MODEL_NAME=gpt-4o-mini         # Maliyet-etkin model
FASTAPI_PORT=8500
```

> **Not:** API key almak için [OpenAI Platform](https://platform.openai.com/api-keys) ziyaret et.

## Çalıştırma

```bash
# ai-service klasöründe (venv aktif)
python main.py
```

Şu çıktı görülmeli:
```
INFO:     Uvicorn running on http://0.0.0.0:8500
INFO:     Application startup complete
```

## API Endpoints

### Health Check
```bash
curl http://localhost:8500/health
```

**Response:**
```json
{"status": "healthy", "service": "paa-crew"}
```

### Portföy Analizi
```bash
curl -X POST http://localhost:8500/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": 1,
    "task_title": "Portföy Analizi",
    "task_description": "Mevcut portföyümün durumunu analiz edin",
    "task_category": "PortfolioAnalysis",
    "user_portfolios": [{
      "portfolio_id": 1,
      "name": "Ana Portföy",
      "description": null,
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
    }]
  }'
```

**Response:**
```json
{
  "task_id": 1,
  "summary": "Portföy, bir BIST hissesi ve Bitcoin'i içermektedir. İki farklı varlık tipinde konsantrasyon görülmektedir.",
  "risk_level": "Medium",
  "market_outlook": "Portföy yapısı, iki farklı hisse senedi türü arasında dağılmış durumdadır. Belirli bir sektöre konsantrasyon bulunmamaktadır.",
  "key_findings": ["THYAO hissesi toplam değerin yaklaşık %70'ini oluşturmaktadır", "Portföy 2 farklı varlık türünü içermektedir"],
  "raw_content": "...",
  "is_successful": true,
  "error_message": null,
  "generated_at_utc": "2026-04-05T10:30:00+00:00"
}
```

## CrewAI Ajanları

### Ajan 1: Portfolio Data Analyst
- **Görev:** Portföy verilerinden sayısal metrikleri çıkarır
- **Çıktı:** Varlık dağılımı, toplam değer, konsantrasyon oranları, çeşitlendirme skoru
- **Kısıtlamalar:** Hiç yatırım tavsiyesi YILMAZ

### Ajan 2: Objective Report Writer
- **Görev:** Sayısal veriyi tarafsız bir raporda sunar
- **Çıktı:** Turkish language, Summary + Risk Level + Market Outlook + Key Findings
- **Kısıtlamalar:** Yalnızca gözlemler ve tespitler — "recommend" kelimesi yasak

## Güvenlik Kuralları (System Prompts'ta Gömülü)

```
1. ASLA yatırım tavsiyesi verme (al/sat/tut önerisi YOK)
2. ASLA yönlendirme yapma
3. Sadece VERİYE DAYALI gözlemler
4. Risk seviyesi: Çeşitlendirme ve konsantrasyon oranına YALNIZCA bağlı
5. Professionel Türkçe yazı
```

## Veri Modelleri

### AnalyzeRequest

```python
class AnalyzeRequest(BaseModel):
    task_id: int
    task_title: str
    task_description: str
    task_category: str
    user_portfolios: list[PortfolioInput]
```

### AnalyzeResponse

```python
class AnalyzeResponse(BaseModel):
    task_id: int
    summary: str                           # 2-3 cümle özet
    risk_level: str                        # "Low" | "Medium" | "High"
    market_outlook: str                    # Tarafsız gözlem
    key_findings: str                      # JSON array string
    raw_content: str                       # Full CrewAI output
    is_successful: bool
    error_message: Optional[str] = None
    generated_at_utc: str
```

## Sorun Giderme

### "ModuleNotFoundError: No module named 'crewai'"
Venv aktif mi? `pip install -r requirements.txt` çalıştır.

### "OPENAI_API_KEY is not set"
`.env` dosyasında `OPENAI_API_KEY` tanımlandı mı? Kontrol et ve .env'i yenile.

### FastAPI port 8500 kullanımda
```bash
# Başka bir port kullan
FASTAPI_PORT=8501 python main.py
```

### CrewAI timeout (120 saniye)
LLM yanıt vermiyor. OpenAI API durumunu kontrol et veya timeout'u arttır (`main.py` içinde `timeout` parametresi).

## Dosya Yapısı

```
ai-service/
├── main.py              # FastAPI giriş noktası
├── crew.py              # Crew çalıştırıcısı
├── agents.py            # Ajan tanımları
├── tasks.py             # Task tanımları (prompt'lar)
├── models.py            # Pydantic request/response modelleri
├── config.py            # Konfigürasyon (LLM, port)
├── requirements.txt     # Python bağımlılıkları
├── .env.example         # API key şablonu
└── README.md            # Bu dosya
```

## Next Steps

1. **.NET entegrasyonunu kontrol et**
   - `ConsultancyTaskService.cs`: PAA çağrısı var mı?
   - `appsettings.json`: `PaaService:BaseUrl` tanımlandı mı?

2. **Uçtan uca test et**
   ```bash
   # Terminal 1: Python servisini başlat
   python main.py
   
   # Terminal 2: .NET API'yi başlat
   cd backend/FinTreX/FinTreX.WebApi
   dotnet run
   
   # Terminal 3: Frontend üzerinden veya Swagger'dan task oluştur
   # POST /v1/tasks
   ```

3. **Logs kontrolü**
   - .NET: Serilog Console output
   - Python: Uvicorn + CrewAI verbose logs

## Production Deployment

- Docker container oluştur
- Azure App Service veya AWS Lambda'ya deploy
- Environment variables (Secrets) kur
- Rate limiting ekle (Future)
- Async job processing (Hangfire/RabbitMQ) ekle (Future)

## Kaynaklar

- [CrewAI Documentation](https://docs.crewai.com)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
