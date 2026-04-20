using System;
using System.Collections.Generic;

namespace FinTreX.Core.Settings
{
    public class MarketDataSettings
    {
        public string YahooWebSocketUrl { get; set; } = "wss://streamer.finance.yahoo.com";
        public string BinanceWebSocketUrl { get; set; } = "wss://stream.binance.com:9443/stream";
        public string BinanceRestBaseUrl { get; set; } = "https://api.binance.com";
        public string CoinCapRestBaseUrl { get; set; } = "https://rest.coincap.io/v3";
        public string CoinCapApiKey { get; set; } = string.Empty;
        public string CoinGeckoRestBaseUrl { get; set; } = "https://api.coingecko.com/api/v3";

        public TimeOnly BistSession1Start { get; set; } = new(10, 0);
        public TimeOnly BistSession1End { get; set; } = new(13, 0);
        public TimeOnly BistSession2Start { get; set; } = new(14, 0);
        public TimeOnly BistSession2End { get; set; } = new(18, 10);

        public int SessionTimeoutSeconds { get; set; } = 30;
        public int ReconnectMaxSeconds { get; set; } = 30;

        public decimal ForexFallbackTolerancePercent { get; set; } = 0.03m;
        public int ForexFallbackTimeoutSeconds { get; set; } = 120;

        public int MaxCachedTickers { get; set; } = 500;
        public int YahooSubscribeChunkSize { get; set; } = 200;
        public int CryptoEnrichmentRefreshSeconds { get; set; } = 86400;
        public int CryptoEnrichmentStartupRetrySeconds { get; set; } = 600;
        public int CryptoEnrichmentPlatformRefreshHours { get; set; } = 24;
        public int CryptoEnrichmentMaxSymbols { get; set; } = 500;
        public int CryptoEnrichmentBinanceParallelism { get; set; } = 8;
        public int CoinGeckoMarketsPerPage { get; set; } = 250;
        public int CoinGeckoMarketsPages { get; set; } = 6;

        // Gold type calculation factors (default values based on common local market approximations).
        public decimal GoldPurityFactor { get; set; } = 0.995m;
        public decimal GoldCeyrekGramFactor { get; set; } = 1.75m;
        public decimal GoldYarimGramFactor { get; set; } = 3.50m;
        public decimal GoldTamGramFactor { get; set; } = 7.00m;
        public decimal GoldCumhuriyetGramFactor { get; set; } = 7.216m;
        public decimal GoldAtaGramFactor { get; set; } = 7.216m;

        public List<string> GoldTickers { get; set; } = new() { "GC=F", "XAUUSD=X" };
        public List<string> ForexTickers { get; set; } = new() { "USDTRY=X" };
        public List<string> BistIndexTickers { get; set; } = new() { "XU100.IS", "XU030.IS" };
        public List<string> Bist30Tickers { get; set; } = new();
        public string Bist30ApiUrl { get; set; } = string.Empty;
        public string BistSymbolsFilePath { get; set; } = "Data/MarketData/bist_symbols.json";
        public List<string> BistHolidayDates { get; set; } = new();

        public List<string> CryptoUsdtPairs { get; set; } = new();
        public List<string> CryptoTryPairs { get; set; } = new();
    }
}
