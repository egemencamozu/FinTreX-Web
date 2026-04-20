using FinTreX.Core.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;

namespace FinTreX.Infrastructure.Services.MarketData.Symbols
{
#nullable enable
    /// <summary>
    /// Loads BIST symbol universe from a local JSON file.
    /// Supports both legacy string arrays and metadata object arrays.
    /// Fallback: MarketDataSettings.Bist30Tickers when file is unavailable.
    /// </summary>
    public sealed class BistSymbolProvider : IBistSymbolProvider
    {
        private readonly MarketDataSettings _settings;
        private readonly ILogger<BistSymbolProvider> _logger;
        private readonly Lazy<BistSymbolCatalog> _catalog;

        public BistSymbolProvider(
            IOptions<MarketDataSettings> settings,
            ILogger<BistSymbolProvider> logger)
        {
            _settings = settings.Value;
            _logger = logger;
            _catalog = new Lazy<BistSymbolCatalog>(LoadCatalog, isThreadSafe: true);
        }

        public IReadOnlyCollection<string> GetSymbols() => _catalog.Value.Symbols;

        public BistSymbolInfo? GetSymbolInfo(string ticker)
        {
            var normalizedTicker = NormalizeTicker(ticker);
            if (string.IsNullOrWhiteSpace(normalizedTicker))
            {
                return null;
            }

            return _catalog.Value.Lookup.TryGetValue(normalizedTicker, out var info)
                ? info
                : null;
        }

        private BistSymbolCatalog LoadCatalog()
        {
            var candidates = GetCandidatePaths();

            foreach (var path in candidates)
            {
                try
                {
                    if (!File.Exists(path))
                    {
                        continue;
                    }

                    var json = File.ReadAllText(path);
                    var catalog = ParseCatalog(json);

                    if (catalog.Symbols.Count > 0)
                    {
                        _logger.LogInformation(
                            "BIST symbol provider loaded {Count} symbols from {Path}. metadataEntries={MetadataCount}",
                            catalog.Symbols.Count,
                            path,
                            catalog.Lookup.Count);

                        return catalog;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to load BIST symbols from {Path}", path);
                }
            }

            var fallbackSymbols = NormalizeSymbols(_settings.Bist30Tickers);
            _logger.LogWarning(
                "BIST symbol file not found/empty. Falling back to Bist30Tickers with {Count} symbols.",
                fallbackSymbols.Count);

            return new BistSymbolCatalog(
                fallbackSymbols,
                fallbackSymbols.ToDictionary(
                    symbol => symbol,
                    symbol => new BistSymbolInfo { Ticker = symbol },
                    StringComparer.OrdinalIgnoreCase));
        }

        private BistSymbolCatalog ParseCatalog(string json)
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return BistSymbolCatalog.Empty;
            }

            var symbols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var lookup = new Dictionary<string, BistSymbolInfo>(StringComparer.OrdinalIgnoreCase);

            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var normalizedTicker = NormalizeTicker(item.GetString());
                    if (string.IsNullOrWhiteSpace(normalizedTicker))
                    {
                        continue;
                    }

                    symbols.Add(normalizedTicker);
                    lookup.TryAdd(normalizedTicker, new BistSymbolInfo { Ticker = normalizedTicker });
                    continue;
                }

                if (item.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var ticker = NormalizeTicker(
                    ReadString(item, "ticker", "symbol", "code", "Ticker", "Symbol", "Code"));

                if (string.IsNullOrWhiteSpace(ticker))
                {
                    continue;
                }

                var companyName = ReadString(
                    item,
                    "companyName",
                    "name",
                    "shortName",
                    "company",
                    "CompanyName",
                    "Name",
                    "ShortName",
                    "Company");

                var sector = ReadString(item, "sector", "industry", "Sector", "Industry");

                symbols.Add(ticker);
                lookup[ticker] = new BistSymbolInfo
                {
                    Ticker = ticker,
                    CompanyName = companyName,
                    Sector = sector
                };
            }

            var orderedSymbols = symbols
                .OrderBy(symbol => symbol, StringComparer.OrdinalIgnoreCase)
                .ToArray();

            return orderedSymbols.Length == 0
                ? BistSymbolCatalog.Empty
                : new BistSymbolCatalog(orderedSymbols, lookup);
        }

        private static string ReadString(JsonElement element, params string[] propertyNames)
        {
            foreach (var propertyName in propertyNames)
            {
                if (!element.TryGetProperty(propertyName, out var propertyValue))
                {
                    continue;
                }

                if (propertyValue.ValueKind != JsonValueKind.String)
                {
                    continue;
                }

                var value = propertyValue.GetString()?.Trim() ?? string.Empty;
                if (value.Length > 0)
                {
                    return value;
                }
            }

            return string.Empty;
        }

        private IReadOnlyCollection<string> NormalizeSymbols(IEnumerable<string> symbols)
        {
            return symbols
                .Select(NormalizeTicker)
                .Where(symbol => !string.IsNullOrWhiteSpace(symbol))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(symbol => symbol, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private static string NormalizeTicker(string? rawTicker)
        {
            if (string.IsNullOrWhiteSpace(rawTicker))
            {
                return string.Empty;
            }

            var normalized = rawTicker.Trim().ToUpperInvariant();
            if (!normalized.EndsWith(".IS", StringComparison.Ordinal))
            {
                return string.Empty;
            }

            return normalized;
        }

        private IReadOnlyCollection<string> GetCandidatePaths()
        {
            var candidates = new List<string>();
            var configuredPath = _settings.BistSymbolsFilePath?.Trim() ?? string.Empty;

            if (!string.IsNullOrWhiteSpace(configuredPath))
            {
                if (Path.IsPathRooted(configuredPath))
                {
                    candidates.Add(configuredPath);
                }
                else
                {
                    candidates.Add(Path.Combine(AppContext.BaseDirectory, configuredPath));
                    candidates.Add(Path.Combine(Directory.GetCurrentDirectory(), configuredPath));
                }
            }

            candidates.Add(Path.Combine(AppContext.BaseDirectory, "Data", "MarketData", "bist_symbols.json"));
            candidates.Add(Path.Combine(Directory.GetCurrentDirectory(), "Data", "MarketData", "bist_symbols.json"));

            return candidates
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private sealed class BistSymbolCatalog
        {
            public static readonly BistSymbolCatalog Empty =
                new(Array.Empty<string>(), new Dictionary<string, BistSymbolInfo>(StringComparer.OrdinalIgnoreCase));

            public BistSymbolCatalog(
                IReadOnlyCollection<string> symbols,
                Dictionary<string, BistSymbolInfo> lookup)
            {
                Symbols = symbols;
                Lookup = lookup;
            }

            public IReadOnlyCollection<string> Symbols { get; }
            public Dictionary<string, BistSymbolInfo> Lookup { get; }
        }
    }
#nullable restore
}
