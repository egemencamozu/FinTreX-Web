using FinTreX.Core.DTOs.MarketData;
using FinTreX.Core.Settings;
using Microsoft.Extensions.Options;
using System;

namespace FinTreX.Infrastructure.Services.MarketData.Handlers
{
    public sealed class GoldCalculator
    {
        private readonly IOptionsMonitor<MarketDataSettings> _settingsMonitor;

        public GoldCalculator(IOptionsMonitor<MarketDataSettings> settingsMonitor)
        {
            _settingsMonitor = settingsMonitor;
        }

        public GoldTypesDto CalculateTypes(decimal gramTry, DateTime updatedAt)
        {
            var settings = _settingsMonitor.CurrentValue ?? new MarketDataSettings();
            var purity = Sanitize(settings.GoldPurityFactor, fallback: 0.995m);
            var ceyrek = Sanitize(settings.GoldCeyrekGramFactor, fallback: 1.75m);
            var yarim = Sanitize(settings.GoldYarimGramFactor, fallback: 3.50m);
            var tam = Sanitize(settings.GoldTamGramFactor, fallback: 7.00m);
            var cumhuriyet = Sanitize(settings.GoldCumhuriyetGramFactor, fallback: 7.216m);
            var ata = Sanitize(settings.GoldAtaGramFactor, fallback: 7.216m);

            return new GoldTypesDto
            {
                GramTry = gramTry,
                CeyrekTry = gramTry * ceyrek * purity,
                YarimTry = gramTry * yarim * purity,
                TamTry = gramTry * tam * purity,
                CumhuriyetTry = gramTry * cumhuriyet * purity,
                AtaTry = gramTry * ata * purity,
                UpdatedAt = updatedAt
            };
        }

        private static decimal Sanitize(decimal candidate, decimal fallback) =>
            candidate > 0m ? candidate : fallback;
    }
}
