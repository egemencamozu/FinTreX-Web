# FinTreX PAA — Hızlı Başlangıç

## 5 Dakikada Kurulum

### 1. Python Venv Oluştur ve Aktif Et

```bash
cd ai-service
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 2. Paketleri Kur

```bash
pip install -r requirements.txt
```

Kurulum sırasında uzun sürebilir (CrewAI tüm bağımlılıklarını indirir). Çay-kahve mı koy :)

### 3. .env Dosyası Oluştur

```bash
cp .env.example .env
```

**Windows Notepad'de açıp `OPENAI_API_KEY` alanını doldur:**

```env
OPENAI_API_KEY=sk-proj-...   ← OpenAI API key'ini buraya yapıştır
MODEL_NAME=gpt-4o-mini
FASTAPI_PORT=8500
```

> API key almak için: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 4. Servisi Başlat

```bash
python main.py
```

Çıktı şöyle görülmeli:

```
INFO:     Uvicorn running on http://0.0.0.0:8500
INFO:     Application startup complete
```

### 5. Hızlı Test

Yeni bir terminal açıp (venv'i deaktif et veya yeni terminal aç):

```bash
curl http://localhost:8500/health
```

Response:
```json
{"status": "healthy", "service": "paa-crew"}
```

---

## .NET Backend'i Çalıştır

Yeni terminal (3. terminal):

```bash
cd backend/FinTreX/FinTreX.WebApi
dotnet run
```

Backend port 9001'de çalışmalı.

---

## İlk Task'ı Oluştur

Swagger UI veya curl ile:

```bash
curl -X POST http://localhost:9001/v1/tasks \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "economistId": "economist-user-id",
    "title": "Portföy Analizi",
    "description": "Mevcut varlıklarımın durumunu değerlendirin",
    "category": 1,
    "priority": 1,
    "deadline": null
  }'
```

> JWT token elde etmek için: `POST /auth/login` çalıştır.

---

## Logs Kontrol Et

### Python Logs
- Konsol output direkt görsün
- CrewAI agent mesajları real-time görünüyor

### .NET Logs
- Serilog → Console output
- `/var/log/` veya file-based logging ise kontrol et

---

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| `ModuleNotFoundError: No module named 'crewai'` | `pip install -r requirements.txt` tekrar çalıştır |
| `OPENAI_API_KEY is not set` | `.env` dosyasında tanımlandı mı kontrol et |
| Connection refused (port 8500) | Python servisi çalışıyor mu? |
| Backend 504 Gateway Timeout | Python servisi timeout'a uğradı. LLM yanıt vermiyor mu? |

---

## Sonraki Adımlar

1. **End-to-end test:** Task oluştur → Rapor otomatik generate olsun
2. **Frontend'den test:** Angular dashboard'dan task form doldur
3. **Logs analiz et:** Hata varsa `.error_message` kontrol et
4. **Production setup:** Docker, environment variables, secrets management

---

## Kaynaklar

- [README.md](README.md) — Detaylı dokümantasyon
- [implementation_plan.md](../implementation_plan.md) — Mimari detaylar
- [CrewAI Docs](https://docs.crewai.com)
