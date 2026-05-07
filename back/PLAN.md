# 🏗️ FinTreX – Market Data Integration Plan v2.2 (Revize)

> **Bu sürüm, v2 planının detay seviyesini korur ve review’da çıkan kritik noktaları kalıcı olarak kapatır.**  
> Kapatılan başlıklar: Yahoo servis yaşam döngüsü ayrımı, USDTTRY fallback doğruluğu, cache büyüme kontrolü, dinamik endeks routing, `DailyClose` tarih çakışması, SignalR paket politikası, mock ayar uyumu, test stratejisi netliği.

---

## Mevcut Proje Yapısı (Referans)

```text
backend/FinTreX/
├── FinTreX.Application/     ← Core katmanı (FinTreX.Core.csproj)
│   ├── Entities/
│   ├── Interfaces/
│   ├── DTOs/
│   ├── Enums, Exceptions, Settings, Wrappers
│
├── FinTreX.Infrastructure/
│   ├── Contexts/
│   ├── Models/
│   ├── Services/
│   ├── Seeds/
│   ├── Migrations/
│   └── ServiceRegistration.cs
│
└── FinTreX.WebApi/
    ├── Controllers/v1/
    ├── Extensions/
    ├── Middlewares/
    └── Program.cs
```

---

## Eklenecek / Güncellenecek NuGet Paketleri

### FinTreX.Infrastructure
```bash
dotnet add package Google.Protobuf
dotnet add package Microsoft.Extensions.Caching.Memory
```

### FinTreX.WebApi
```text
Ek paket YOK.
Microsoft.NET.Sdk.Web ile SignalR runtime zaten gelir.
```

### Test Projeleri (Opsiyonel)
```text
SignalR client entegrasyon testi gerekirse:
- Microsoft.AspNetCore.SignalR.Client (yalnızca test projesine)
```

---

## Mimari Genel Bakış (v2.2)

```text
Yahoo bağlantıları (2 adet, farklı yaşam döngüsü)

1) YahooGlobalStreamService (7/24)
   wss://streamer.finance.yahoo.com
   ├── GC=F
   ├── XAUUSD=X
   └── USDTRY=X
   → GoldHandler + ForexHandler

2) YahooBistStreamService (seans bazlı)
   wss://streamer.finance.yahoo.com
   ├── BIST30 hisseler (.IS)
   ├── Portföy hisseleri (.IS, dinamik)
   └── BIST endeksler (.IS)
   → BistStockHandler + BistIndexHandler
   → 18:10 DailyClose upsert + bağlantı kapanış

Binance bağlantısı (1 adet, 7/24)
wss://stream.binance.com:9443/stream?streams=...
├── USDT çiftleri
├── TRY çiftleri
└── USDTTRY
→ CryptoHandler + ForexHandler (fallback input)

Ortak katman
IMarketDataCache (MemoryCache + key metadata)
↓
IMarketDataBroadcaster (IHubContext wrapper)
↓
SignalR Hub (/hubs/market) + REST snapshot endpoint’leri
```

---

## 📁 KATMAN 1 — Core (FinTreX.Application)

### Enums

**`Enums/ForexQuality.cs`**
```csharp
public enum ForexQuality
{
    Primary,      // Yahoo USDTRY=X
    Approximate   // Binance USDTTRY
}
```

### Models (Cache Modelleri — DB’ye yazılmaz)

**`Models/MarketData/GoldPrice.cs`**
```csharp
public class GoldPrice
{
    public string Symbol { get; set; } = default!;
    public decimal OunceUsd { get; set; }
    public decimal OunceTry { get; set; }
    public decimal GramUsd { get; set; }
    public decimal GramTry { get; set; }
    public string PriceQuality { get; set; } = "EXACT"; // EXACT | APPROXIMATE
    public DateTime UpdatedAt { get; set; }
}
```

**`Models/MarketData/StockPrice.cs`**
```csharp
public class StockPrice
{
    public string Ticker { get; set; } = default!;
    public string CompanyName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal Change { get; set; }
    public decimal ChangePercent { get; set; }
    public long Volume { get; set; }
    public decimal DayHigh { get; set; }
    public decimal DayLow { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**`Models/MarketData/IndexPrice.cs`**
```csharp
public class IndexPrice
{
    public string Ticker { get; set; } = default!;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal Change { get; set; }
    public decimal ChangePercent { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**`Models/MarketData/CryptoCurrency.cs`**
```csharp
public class CryptoCurrency
{
    public string Symbol { get; set; } = default!;
    public string BaseAsset { get; set; } = default!;
    public decimal PriceUsdt { get; set; }
    public decimal PriceTry { get; set; }
    public decimal Change24h { get; set; }
    public decimal ChangePercent24h { get; set; }
    public decimal Volume24h { get; set; }
    public decimal High24h { get; set; }
    public decimal Low24h { get; set; }
    public string TrySource { get; set; } = "CALCULATED"; // DIRECT | CALCULATED
    public DateTime UpdatedAt { get; set; }
}
```

**`Models/MarketData/ForexRate.cs`**
```csharp
public class ForexRate
{
    public string Pair { get; set; } = "USDTRY";
    public decimal Rate { get; set; }
    public string Source { get; set; } = "YAHOO"; // YAHOO | BINANCE
    public ForexQuality Quality { get; set; } = ForexQuality.Primary;
    public DateTime UpdatedAt { get; set; }
}
```

### Entity (Tek gerçek DB entity’si)

**`Entities/DailyClose.cs`**
```csharp
public class DailyClose
{
    public int Id { get; set; }
    public string Ticker { get; set; } = default!;
    public string AssetType { get; set; } = default!; // STOCK | INDEX
    public decimal ClosePrice { get; set; }
    public decimal Change { get; set; }
    public decimal ChangePercent { get; set; }
    public long? Volume { get; set; } // index için null
    public DateOnly Date { get; set; } // işlem günü
    public DateTime WrittenAt { get; set; } // audit
}
```

### Interfaces

**`Interfaces/IMarketDataCache.cs`**
```csharp
public interface IMarketDataCache
{
    GoldPrice? GetGold(string symbol);
    void SetGold(string symbol, GoldPrice price);
    IReadOnlyList<GoldPrice> GetAllGold();

    StockPrice? GetStock(string ticker);
    void SetStock(string ticker, StockPrice price);
    IReadOnlyList<StockPrice> GetAllStocks();

    IndexPrice? GetIndex(string ticker);
    void SetIndex(string ticker, IndexPrice price);
    IReadOnlyList<IndexPrice> GetAllIndices();

    CryptoCurrency? GetCrypto(string symbol);
    void SetCrypto(string symbol, CryptoCurrency price);
    IReadOnlyList<CryptoCurrency> GetAllCrypto();

    ForexRate? GetForex(string pair);
    void SetForex(string pair, ForexRate rate);
    decimal GetUsdTry();

    void MarkActive(string cacheKey);
    void MarkInactive(string cacheKey);
}
```

**`Interfaces/IMarketDataBroadcaster.cs`**
```csharp
public interface IMarketDataBroadcaster
{
    Task BroadcastGoldUpdate(GoldPriceDto dto);
    Task BroadcastStockUpdate(StockPriceDto dto);
    Task BroadcastIndexUpdate(IndexPriceDto dto);
    Task BroadcastCryptoUpdate(CryptoPriceDto dto);
    Task BroadcastForexUpdate(ForexRateDto dto);
    Task BroadcastToGroup(string groupName, string method, object data);
}
```

### DTOs

**`DTOs/MarketData/GoldPriceDto.cs`**
```csharp
public class GoldPriceDto
{
    public decimal OunceUsd { get; set; }
    public decimal OunceTry { get; set; }
    public decimal GramUsd { get; set; }
    public decimal GramTry { get; set; }
    public string PriceQuality { get; set; } = "EXACT"; // EXACT | APPROXIMATE
    public DateTime UpdatedAt { get; set; }
}
```

**`DTOs/MarketData/GoldTypesDto.cs`**
```csharp
public class GoldTypesDto
{
    public decimal GramTry { get; set; }
    public decimal CeyrekTry { get; set; }
    public decimal YarimTry { get; set; }
    public decimal TamTry { get; set; }
    public decimal CumhuriyetTry { get; set; }
    public decimal AtaTry { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**`DTOs/MarketData/StockPriceDto.cs`**
```csharp
public class StockPriceDto
{
    public string Ticker { get; set; } = default!;
    public string CompanyName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal Change { get; set; }
    public decimal ChangePercent { get; set; }
    public long Volume { get; set; }
    public decimal DayHigh { get; set; }
    public decimal DayLow { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**`DTOs/MarketData/IndexPriceDto.cs`**
```csharp
public class IndexPriceDto
{
    public string Ticker { get; set; } = default!;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal Change { get; set; }
    public decimal ChangePercent { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**`DTOs/MarketData/CryptoPriceDto.cs`**
```csharp
public class CryptoPriceDto
{
    public string Symbol { get; set; } = default!;
    public string BaseAsset { get; set; } = default!;
    public decimal PriceUsdt { get; set; }
    public decimal PriceTry { get; set; }
    public decimal ChangePercent24h { get; set; }
    public decimal Volume24h { get; set; }
    public string TrySource { get; set; } = "CALCULATED";
    public DateTime UpdatedAt { get; set; }
}
```

**`DTOs/MarketData/ForexRateDto.cs`**
```csharp
public class ForexRateDto
{
    public string Pair { get; set; } = "USDTRY";
    public decimal Rate { get; set; }
    public string Source { get; set; } = "YAHOO";
    public string Quality { get; set; } = "PRIMARY"; // PRIMARY | APPROXIMATE
    public DateTime UpdatedAt { get; set; }
}
```

### Settings

**`Settings/MarketDataSettings.cs`**
```csharp
public class MarketDataSettings
{
    public string YahooWebSocketUrl { get; set; } = "wss://streamer.finance.yahoo.com";
    public string BinanceWebSocketUrl { get; set; } = "wss://stream.binance.com:9443/stream";

    public TimeOnly BistSession1Start { get; set; } = new(10, 0);
    public TimeOnly BistSession1End { get; set; } = new(13, 0);
    public TimeOnly BistSession2Start { get; set; } = new(14, 0);
    public TimeOnly BistSession2End { get; set; } = new(18, 10);

    public int SessionTimeoutSeconds { get; set; } = 30;
    public int ReconnectMaxSeconds { get; set; } = 30;

    public decimal ForexFallbackTolerancePercent { get; set; } = 0.03m;
    public int ForexFallbackTimeoutSeconds { get; set; } = 120;

    public int MaxCachedTickers { get; set; } = 500;

    public List<string> GoldTickers { get; set; } = new() { "GC=F", "XAUUSD=X" };
    public List<string> ForexTickers { get; set; } = new() { "USDTRY=X" };
    public List<string> BistIndexTickers { get; set; } = new() { "XU100.IS", "XU030.IS" };
    public List<string> Bist30Tickers { get; set; } = new();
    public string Bist30ApiUrl { get; set; } = string.Empty;

    public List<string> CryptoUsdtPairs { get; set; } = new();
    public List<string> CryptoTryPairs { get; set; } = new();
}
```

---

## 📁 KATMAN 2 — Infrastructure (FinTreX.Infrastructure)

### Proto Dosyası

**`Proto/yahoo_finance.proto`**
```proto
syntax = "proto3";
option csharp_namespace = "FinTreX.Infrastructure.Proto";

message PricingData {
  string id = 1;
  float price = 2;
  float change = 3;
  float changePercent = 4;
  int64 time = 5;
  float dayHigh = 9;
  float dayLow = 10;
  float openPrice = 13;
  float prevClose = 14;
  int64 volume = 15;
  string currency = 20;
  string shortName = 25;
}
```

### Servis Yapısı (v2.2)

```text
FinTreX.Infrastructure/
├── Proto/
│   └── yahoo_finance.proto
├── Services/MarketData/
│   ├── Cache/
│   │   ├── MarketDataCache.cs
│   │   └── MarketDataCacheEvictionService.cs
│   ├── Broadcast/
│   │   └── MarketDataBroadcaster.cs
│   ├── Handlers/
│   │   ├── ForexHandler.cs
│   │   ├── GoldHandler.cs
│   │   ├── GoldCalculator.cs
│   │   ├── BistStockHandler.cs
│   │   ├── BistIndexHandler.cs
│   │   └── CryptoHandler.cs
│   ├── Routing/
│   │   └── YahooStreamRouter.cs
│   ├── Session/
│   │   └── BistSessionManager.cs
│   └── WebSocket/
│       ├── YahooWebSocketBase.cs
│       ├── YahooGlobalStreamService.cs
│       ├── YahooBistStreamService.cs
│       └── BinanceWebSocketService.cs
└── ServiceRegistration.cs
```

---

### Handler Detayları

**`Handlers/ForexHandler.cs`**
```text
Görev:
- USDTRY primary (Yahoo), fallback (Binance USDTTRY)
- ForexQuality üretimi
- Gold/Crypto TRY recalculation tetikleme

Kesin fallback kuralı:
1) Yahoo son update yaşı < timeout (120s) ise yalnız Yahoo kullan
2) Yahoo stale ise Binance değerlendir
3) Son Yahoo referansı varsa spread kontrol:
   spread = abs(binance - yahoo) / yahoo
4) spread <= tolerance (%3) ise Binance kabul (Approximate)
5) spread > tolerance ise fallback reddi, cache overwrite YOK, warning log
6) Yahoo geri gelirse hemen Primary’ye dön
```

**`Handlers/GoldHandler.cs`**
```text
Görev:
- XAUUSD=X/GC=F üzerinden gram/ons hesaplama
- TRY tarafında güncel USDTRY kullanımı
- PriceQuality üretimi:
  ForexQuality.Primary => EXACT
  ForexQuality.Approximate => APPROXIMATE
```

**`Handlers/GoldCalculator.cs`**
```text
Has altın katsayısı: 0.995
Çeyrek  = GramTry × 1.75 × 0.995
Yarım   = GramTry × 3.50 × 0.995
Tam     = GramTry × 7.00 × 0.995
Cumhuriyet = GramTry × 7.216 × 0.995
Ata     = GramTry × 7.216 × 0.995
```

**`Handlers/BistStockHandler.cs`**
```text
Görev:
- .IS ve endeks listesinde olmayan ticker'ları hisse olarak maplemek
- cache + stock group broadcast
```

**`Handlers/BistIndexHandler.cs`**
```text
Görev:
- Config'deki endeks ticker'larını index modeline maplemek
- Volume alanını yok saymak
```

**`Handlers/CryptoHandler.cs`**
```text
Görev:
- Binance miniTicker parse
- TRY fiyat önceliği:
  1) DIRECT (TRY pair varsa)
  2) CALCULATED (USDT × USDTRY)
- TRY hesaplarına ForexQuality etkisini log/telemetry ile izlemek
```

---

### Session Yönetimi

**`Session/BistSessionManager.cs`**
```csharp
public enum BistSessionState
{
    Session1Active,  // 10:00-13:00
    LunchBreak,      // 13:00-14:00
    Session2Active,  // 14:00-18:10
    Closed           // kalan saatler + hafta sonu + resmi tatil
}
```

```text
Davranış:
- Session active: timeout 30s
- Lunch break: bağlantı açık, timeout kapalı
- Closed: bağlantı kapalı, bir sonraki açılışa kadar sleep
- Timezone: Europe/Istanbul
- Resmi tatil listesi config'den alınır (opsiyonel)
```

---

### WebSocket Servisleri

**`WebSocket/YahooWebSocketBase.cs`**
```text
Ortak:
- connect
- subscribe json gönderimi
- base64 + protobuf decode
- reconnect backoff: 1s→2s→4s→8s→16s→30s
```

**`WebSocket/YahooGlobalStreamService.cs`**
```text
Yaşam döngüsü:
1) Başlat
2) Yahoo bağlan
3) Subscribe: GC=F, XAUUSD=X, USDTRY=X
4) Her mesajı decode et
5) Gold/Forex handler'a route et
6) Disconnect olursa backoff ile yeniden bağlan
7) 7/24 devam
```

**`WebSocket/YahooBistStreamService.cs`**
```text
Yaşam döngüsü:
1) Seans durumunu kontrol et
2) Closed ise next session'a kadar uyur
3) Active/Lunch ise Yahoo bağlan
4) Subscribe: BIST30 + portföy + endeks
5) .IS mesajlarını BistStock/BistIndex handler'a route et
6) Active sırasında timeout 30s, Lunch sırasında timeout disabled
7) 18:10 geçişinde DailyClose upsert
8) BIST bağlantısını kapat ve sonraki seansı bekle
```

**`WebSocket/BinanceWebSocketService.cs`**
```text
Yaşam döngüsü:
1) 7/24 bağlan
2) miniTicker streamlerini dinle
3) usdttry => ForexHandler
4) diğer pair'ler => CryptoHandler
5) reconnect backoff
```

---

### Routing

**`Routing/YahooStreamRouter.cs`**
```csharp
public class YahooStreamRouter
{
    private readonly HashSet<string> _indexTickers;

    public YahooStreamRouter(IOptions<MarketDataSettings> settings /* ... */)
    {
        _indexTickers = settings.Value.BistIndexTickers.ToHashSet();
    }
}
```

```text
Kural:
- USDTRY=X => ForexHandler
- GC=F / XAUUSD=X => GoldHandler
- .IS ve _indexTickers içinde => BistIndexHandler
- .IS ve _indexTickers dışında => BistStockHandler
- Diğer ticker => warning log
```

---

### Cache + Eviction

**`Cache/MarketDataCache.cs`**
```text
Key formatları:
gold:{symbol}
stock:{ticker}
index:{ticker}
crypto:{symbol}
forex:{pair}

Ek metadata:
- CreatedAt
- LastAccessedAt
- IsActive
```

**`Cache/MarketDataCacheEvictionService.cs`**
```text
Eviction katmanları:
1) MarkInactive sonrası 30dk TTL
2) Saatlik sweep: inactive + stale kayıtları sil
3) MaxCachedTickers (stock) üst sınırı aşılırsa en eski pasif stock sil
```

---

### Broadcaster

**`Broadcast/MarketDataBroadcaster.cs`**
```text
Gold/Index/Crypto/Forex => Clients.All
Stock => Clients.Group(ticker)
```

---

### DB Değişiklikleri

**`Contexts/ApplicationDbContext.cs`**
```csharp
public DbSet<DailyClose> DailyCloses { get; set; }

modelBuilder.Entity<DailyClose>(entity =>
{
    entity.HasIndex(e => new { e.Ticker, e.Date }).IsUnique();
    entity.Property(e => e.Date).HasColumnType("date");
    entity.Property(e => e.WrittenAt).HasColumnType("datetime2");
    entity.Property(e => e.ClosePrice).HasColumnType("decimal(18,4)");
    entity.Property(e => e.Ticker).HasMaxLength(20);
    entity.Property(e => e.AssetType).HasMaxLength(10);
});
```

**DailyClose upsert (NoTracking uyumlu)**
```csharp
var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, istTz));

var existing = await db.DailyCloses
    .AsTracking()
    .FirstOrDefaultAsync(x => x.Ticker == ticker && x.Date == today, ct);

if (existing is null)
{
    db.DailyCloses.Add(new DailyClose { /* ... */ });
}
else
{
    existing.ClosePrice = close;
    existing.Change = change;
    existing.ChangePercent = changePct;
    existing.Volume = volume;
    existing.WrittenAt = DateTime.UtcNow;
}

await db.SaveChangesAsync(ct);
```

---

### ServiceRegistration.cs Güncellemesi

```csharp
public static IServiceCollection AddMarketDataServices(
    this IServiceCollection services, IConfiguration configuration)
{
    services.Configure<MarketDataSettings>(configuration.GetSection("MarketData"));

    services.AddMemoryCache();
    services.AddSingleton<IMarketDataCache, MarketDataCache>();
    services.AddHostedService<MarketDataCacheEvictionService>();

    services.AddSingleton<IMarketDataBroadcaster, MarketDataBroadcaster>();
    services.AddSingleton<BistSessionManager>();

    services.AddSingleton<ForexHandler>();
    services.AddSingleton<GoldHandler>();
    services.AddSingleton<GoldCalculator>();
    services.AddSingleton<BistStockHandler>();
    services.AddSingleton<BistIndexHandler>();
    services.AddSingleton<CryptoHandler>();
    services.AddSingleton<YahooStreamRouter>();
    services.AddHostedService<YahooGlobalStreamService>();
    services.AddHostedService<YahooBistStreamService>();
    services.AddHostedService<BinanceWebSocketService>();

    return services;
}
```

---

## 📁 KATMAN 3 — WebApi (FinTreX.WebApi)

### SignalR Hub

**`Hubs/MarketDataHub.cs`**
```csharp
public class MarketDataHub : Hub
{
    public Task SubscribeToStock(string ticker) =>
        Groups.AddToGroupAsync(Context.ConnectionId, ticker.ToUpperInvariant());

    public Task UnsubscribeFromStock(string ticker) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, ticker.ToUpperInvariant());

    public async Task SubscribeToStocks(IEnumerable<string> tickers)
    {
        foreach (var t in tickers)
            await Groups.AddToGroupAsync(Context.ConnectionId, t.ToUpperInvariant());
    }
}
```

### REST Controllers

**`Controllers/v1/GoldController.cs`**
```text
GET /api/v1/gold/spot
GET /api/v1/gold/futures
GET /api/v1/gold/types
```

**`Controllers/v1/StocksController.cs`**
```text
GET /api/v1/stocks/bist30
GET /api/v1/stocks/{ticker}
GET /api/v1/stocks/{ticker}/history
GET /api/v1/stocks/indices
GET /api/v1/stocks/search?q=GAR
```

**`Controllers/v1/CryptoController.cs`**
```text
GET /api/v1/crypto
GET /api/v1/crypto/{symbol}
GET /api/v1/crypto/top10
```

**`Controllers/v1/ForexController.cs`**
```text
GET /api/v1/forex/usdtry
```

### Program.cs Güncellemesi

```csharp
builder.Services.AddSignalR();
builder.Services.AddMarketDataServices(builder.Configuration);

app.MapHub<MarketDataHub>("/hubs/market");
app.MapControllers();
```

---

## appsettings.json Eklentisi (v2.2)

```json
{
  "MarketData": {
    "YahooWebSocketUrl": "wss://streamer.finance.yahoo.com",
    "BinanceWebSocketUrl": "wss://stream.binance.com:9443/stream",

    "BistSession1Start": "10:00",
    "BistSession1End": "13:00",
    "BistSession2Start": "14:00",
    "BistSession2End": "18:10",

    "SessionTimeoutSeconds": 30,
    "ReconnectMaxSeconds": 30,

    "ForexFallbackTolerancePercent": 0.03,
    "ForexFallbackTimeoutSeconds": 120,

    "MaxCachedTickers": 500,

    "GoldTickers": ["GC=F", "XAUUSD=X"],
    "ForexTickers": ["USDTRY=X"],

    "BistIndexTickers": ["XU100.IS", "XU030.IS", "XBANK.IS", "XUSIN.IS", "XHOLD.IS", "XUTEK.IS"],
    "Bist30Tickers": ["THYAO.IS", "GARAN.IS", "TUPRS.IS"],
    "Bist30ApiUrl": "",

    "CryptoUsdtPairs": ["btcusdt", "ethusdt", "bnbusdt", "solusdt", "xrpusdt", "adausdt", "avaxusdt", "dotusdt", "linkusdt"],
    "CryptoTryPairs": ["btctry", "ethtry", "bnbtry", "usdttry"]
  }
}
```

---

---

## Tam Dosya Yapısı (v2.2)

```text
FinTreX.Application/
├── Models/MarketData/
│   ├── GoldPrice.cs
│   ├── StockPrice.cs
│   ├── IndexPrice.cs
│   ├── CryptoCurrency.cs
│   └── ForexRate.cs
├── Entities/
│   ├── PortfolioAsset.cs (mevcut)
│   └── DailyClose.cs
├── Enums/
│   └── ForexQuality.cs
├── Interfaces/
│   ├── IMarketDataCache.cs
│   └── IMarketDataBroadcaster.cs
├── DTOs/MarketData/
│   ├── GoldPriceDto.cs
│   ├── GoldTypesDto.cs
│   ├── StockPriceDto.cs
│   ├── IndexPriceDto.cs
│   ├── CryptoPriceDto.cs
│   └── ForexRateDto.cs
└── Settings/
    └── MarketDataSettings.cs

FinTreX.Infrastructure/
├── Proto/
│   └── yahoo_finance.proto
├── Services/MarketData/
│   ├── Cache/
│   │   ├── MarketDataCache.cs
│   │   └── MarketDataCacheEvictionService.cs
│   ├── Broadcast/
│   │   └── MarketDataBroadcaster.cs
│   ├── Handlers/
│   │   ├── ForexHandler.cs
│   │   ├── GoldHandler.cs
│   │   ├── GoldCalculator.cs
│   │   ├── BistStockHandler.cs
│   │   ├── BistIndexHandler.cs
│   │   └── CryptoHandler.cs
│   ├── Routing/
│   │   └── YahooStreamRouter.cs
│   ├── Session/
│   │   └── BistSessionManager.cs
│   └── WebSocket/
│       ├── YahooWebSocketBase.cs
│       ├── YahooGlobalStreamService.cs
│       ├── YahooBistStreamService.cs
│       └── BinanceWebSocketService.cs
├── Contexts/ApplicationDbContext.cs (güncelle)
└── ServiceRegistration.cs (güncelle)

FinTreX.WebApi/
├── Hubs/
│   └── MarketDataHub.cs
├── Controllers/v1/
│   ├── GoldController.cs
│   ├── StocksController.cs
│   ├── CryptoController.cs
│   └── ForexController.cs
└── Program.cs (güncelle)

Tests/
├── FinTreX.UnitTests/ (genişlet)
└── FinTreX.Infrastructure.Tests/ (genişlet)
```

---

## 📋 Uygulama Sırası (Sprint Planı)

```text
HAFTA 1 — Domain + Settings + DB
- MarketData modelleri, DTO'lar, enumlar
- DailyClose entity + DbContext mapping + migration
- MarketDataSettings alanlarının tamamlanması

HAFTA 2 — Streaming Temeli
- YahooWebSocketBase
- YahooGlobalStreamService
- YahooBistStreamService
- BinanceWebSocketService
- YahooStreamRouter (config tabanlı)

HAFTA 3 — Handler + Cache + Broadcast
- Forex/Gold/Bist/Crypto handler implementasyonları
- MarketDataCache + metadata
- MarketDataCacheEvictionService
- MarketDataBroadcaster + MarketDataHub

HAFTA 4 — API ve Entegrasyon
- Gold/Stocks/Crypto/Forex controller'ları
- Program.cs + ServiceRegistration tamamlanması

HAFTA 5 — Test ve Sertleştirme
- Unit testler (FinTreX.UnitTests)
- Integration testler (FinTreX.Infrastructure.Tests)
- Dotnet test, log tuning, health check iyileştirme
```

---

## Test Planı (Net)

### Test Projesi Stratejisi
```text
Yeni test projesi açılmayacak.
Var olan iki test projesi genişletilecek.
```

### FinTreX.UnitTests
```text
- GoldHandler hesap testleri
- GoldCalculator çarpan testleri
- CryptoHandler DIRECT/CALCULATED testleri
- ForexHandler fallback karar tablosu testleri
- BistSessionManager state machine testleri
- YahooStreamRouter config bazlı routing testleri
- MarketDataCache thread-safety testleri
```

### FinTreX.Infrastructure.Tests
```text
- DailyClose upsert aynı gün tek kayıt testi
- DailyClose DateOnly uniqueness testi
- Index DailyClose Volume null testi
- Cache eviction sweep testleri
- Reconnect backoff davranış testleri
```

### Minimum Acceptance Kriterleri
```text
1) Global Yahoo stream 7/24 açık kalır.
2) BIST Yahoo stream yalnız seans kuralına uyar.
3) Fallback yalnız tanımlı koşullarda devreye girer.
4) Spread > tolerance durumda fallback cache overwrite yapmaz.
5) Yahoo geri geldiğinde Primary'ye anında dönüş olur.
6) Cache boyutu uzun koşuda sınırsız büyümez.
7) Forex/Gold payload'larında quality alanları doğru akar.
8) DailyClose aynı ticker+gün için tek satır kalır.
```

---

## Riskler ve Dikkat Edilecekler

### Yahoo/Stream Riskleri
- Resmi API değil; şema/field değişebilir.
- Unknown field logging ve decode fail-safe zorunlu.
- Geçici kesintide exponential backoff kullanılacak.

### Finansal Doğruluk
- USDTTRY gerçek USDTRY’den sapabilir.
- Quality flag zorunlu yayınlanacak.
- Tolerans dışı spread’de fallback reddedilecek.

### Operasyonel Risk
- Yoğun push trafiği frontend’de render baskısı yaratır.
- Client tarafında throttling/debounce önerilir.
- Health check’e stream durum metrikleri eklenir.

### Mimari Risk
- Singleton servis içinde scoped DbContext doğrudan inject edilmeyecek.
- DB yazımları `IServiceScopeFactory` ile scoped açılarak yapılacak.

---

## DoD (Definition of Done)

```text
- Tüm yeni sınıflar compile ediyor.
- EF migration uygulanıyor.
- Dotnet test başarılı.
- WebSocket bağlantıları beklenen yaşam döngüsünde.
- REST endpoint’leri cache snapshot döndürüyor.
- SignalR event’leri doğru payload ile yayınlanıyor.
- Loglar fallback kararlarını izlenebilir şekilde yazıyor.
```

---

## Varsayımlar

```text
- Hedef runtime: .NET 8 + EF Core 8.x
- Zaman dilimi: Europe/Istanbul
- Yahoo/Binance public market stream erişimi mevcut
- Development ortamında gerçek Yahoo/Binance stream kullanılır
```

---

## ⚠️ Bekleyen Eksikler (Mevcut Sprint Tamamlanmadan Geçilmeyecek)

```text
1) BinanceWebSocketService.cs — YOK. Kripto verisi hiç akmıyor.
2) ForexHandler → RecalculateTryFromForex() — Çağrılmıyor.
   ForexHandler, Gold ve Crypto TRY fiyatlarını USDTRY değiştiğinde güncellemiyor.
   GoldHandler.RecalculateTryFromForex() ve CryptoHandler.RecalculateTryFromForex()
   ForexHandler içinden inject edilerek çağrılmalı.
```

---

## 🗓️ EPIC — MKK API Entegrasyonu (Sonraki Faz)

> Market data streaming tamamlandıktan sonra başlanacak.

### Kapsam
```text
- Tüm BIST hisse listesi (ticker, şirket adı, sektör, pazar, endeks üyeliği)
- Yatırım fonları (ISIN, fon adı, fon türü, yönetici şirket)
- Halka arz bilgileri (IPO tarihi, fiyat aralığı, talep toplama)
- Şirket bilgileri (sermaye, ortak yapısı)
- Pazar geçişleri (Yıldız↔Ana↔GİP)
- Endeks üyelik değişiklikleri (BIST30/50/100 revizyonları)
```

### Planlanan Yapı
```text
FinTreX.Infrastructure/
└── Services/
    └── Mkk/
        ├── IMkkApiClient.cs
        ├── MkkApiClient.cs
        ├── Settings/
        │   └── MkkApiSettings.cs
        ├── Models/
        │   ├── MkkSymbolResponse.cs
        │   ├── MkkFundResponse.cs
        │   └── MkkIpoResponse.cs
        └── SyncServices/
            ├── MkkSymbolSyncService.cs    ← BIST sembol/pazar/endeks sync
            ├── MkkFundSyncService.cs      ← Fon listesi sync
            └── MkkIpoSyncService.cs       ← Halka arz sync
```

### bist_symbols.json Hedef Format
```json
{
  "ticker": "AKBNK.IS",
  "name": "Akbank T.A.Ş.",
  "market": "Yıldız Pazar",
  "sector": "Bankacılık",
  "indices": ["BIST30", "BIST50", "BIST100"]
}
```

### API Referansı
```text
https://apiportal.mkk.com.tr/
- Sembol listesi + pazar bilgisi
- Fon listesi + ISIN
- Halka arz takvimi
```

### Önkoşullar
```text
- MKK API key alınması
- Rate limit politikasının belirlenmesi
- Sync frekansının belirlenmesi (günlük? saatlik?)
- bist_symbols.json formatının string[] → object[] olarak güncellenmesi
- BistSymbolProvider'ın yeni formata göre güncellenmesi
```
