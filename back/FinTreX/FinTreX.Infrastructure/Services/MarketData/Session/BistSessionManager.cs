using FinTreX.Core.Settings;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Globalization;
using System.Collections.Generic;

namespace FinTreX.Infrastructure.Services.MarketData.Session
{
#nullable enable
    public enum BistSessionState
    {
        Session1Active, // 10:00-13:00
        LunchBreak,     // 13:00-14:00
        Session2Active, // 14:00-18:10
        Closed          // other times + weekends + optional holidays
    }

    public class BistSessionManager
    {
        private readonly IOptionsMonitor<MarketDataSettings> _settingsMonitor;
        private readonly ILogger<BistSessionManager> _logger;
        private readonly TimeZoneInfo _istanbulTz;
        private readonly object _holidaySync = new();
        private HashSet<DateOnly> _holidaySet = new();
        private string _holidaySignature = string.Empty;

        public BistSessionManager(
            IOptionsMonitor<MarketDataSettings> settingsMonitor,
            ILogger<BistSessionManager> logger)
        {
            _settingsMonitor = settingsMonitor;
            _logger = logger;
            _istanbulTz = ResolveIstanbulTimeZone();
            var settings = GetCurrentSettings();
            _holidaySet = BuildHolidaySet(settings);
            _holidaySignature = BuildHolidaySignature(settings.BistHolidayDates);
        }

        public BistSessionState GetCurrentState() => GetCurrentState(DateTime.UtcNow);

        public BistSessionState GetCurrentState(DateTime utcNow) =>
            GetCurrentState(utcNow, GetCurrentSettings());

        private BistSessionState GetCurrentState(DateTime utcNow, MarketDataSettings settings)
        {
            var normalizedUtc = NormalizeToUtc(utcNow);
            var localNow = TimeZoneInfo.ConvertTimeFromUtc(normalizedUtc, _istanbulTz);
            var localDate = DateOnly.FromDateTime(localNow);
            var localTime = TimeOnly.FromDateTime(localNow);

            if (!IsTradingDay(localDate, settings))
            {
                return BistSessionState.Closed;
            }

            if (localTime >= settings.BistSession1Start && localTime < settings.BistSession1End)
            {
                return BistSessionState.Session1Active;
            }

            if (localTime >= settings.BistSession1End && localTime < settings.BistSession2Start)
            {
                return BistSessionState.LunchBreak;
            }

            if (localTime >= settings.BistSession2Start && localTime < settings.BistSession2End)
            {
                return BistSessionState.Session2Active;
            }

            return BistSessionState.Closed;
        }

        public TimeSpan GetTimeUntilNextSession() => GetTimeUntilNextSession(DateTime.UtcNow);

        public TimeSpan GetTimeUntilNextSession(DateTime utcNow)
        {
            var normalizedUtc = NormalizeToUtc(utcNow);
            var settings = GetCurrentSettings();
            var localNow = TimeZoneInfo.ConvertTime(
                new DateTimeOffset(normalizedUtc, TimeSpan.Zero),
                _istanbulTz);

            var state = GetCurrentState(normalizedUtc, settings);

            if (state == BistSessionState.Session1Active || state == BistSessionState.Session2Active)
            {
                return TimeSpan.Zero;
            }

            if (state == BistSessionState.LunchBreak)
            {
                var todaySession2Start = ToIstanbulOffset(DateOnly.FromDateTime(localNow.DateTime), settings.BistSession2Start);
                var remaining = todaySession2Start - localNow;
                return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
            }

            var today = DateOnly.FromDateTime(localNow.DateTime);
            if (IsTradingDay(today, settings))
            {
                var todaySession1Start = ToIstanbulOffset(today, settings.BistSession1Start);
                var remaining = todaySession1Start - localNow;
                if (remaining > TimeSpan.Zero)
                {
                    return remaining;
                }
            }

            var nextTradingDay = FindNextTradingDay(today.AddDays(1), settings);
            var nextSessionStart = ToIstanbulOffset(nextTradingDay, settings.BistSession1Start);
            var wait = nextSessionStart - localNow;

            return wait > TimeSpan.Zero ? wait : TimeSpan.Zero;
        }

        public int GetTimeoutSeconds() => GetTimeoutSeconds(DateTime.UtcNow);

        public int GetTimeoutSeconds(DateTime utcNow)
        {
            var settings = GetCurrentSettings();
            var state = GetCurrentState(utcNow, settings);
            return state switch
            {
                BistSessionState.Session1Active => Math.Max(1, settings.SessionTimeoutSeconds),
                BistSessionState.Session2Active => Math.Max(1, settings.SessionTimeoutSeconds),
                BistSessionState.LunchBreak => int.MaxValue,
                _ => 0
            };
        }

        public DateOnly GetLocalDate() => GetLocalDate(DateTime.UtcNow);

        public DateOnly GetLocalDate(DateTime utcNow)
        {
            var normalizedUtc = NormalizeToUtc(utcNow);
            var localNow = TimeZoneInfo.ConvertTimeFromUtc(normalizedUtc, _istanbulTz);
            return DateOnly.FromDateTime(localNow);
        }

        private DateOnly FindNextTradingDay(DateOnly startDate, MarketDataSettings settings)
        {
            var date = startDate;
            while (!IsTradingDay(date, settings))
            {
                date = date.AddDays(1);
            }

            return date;
        }

        private bool IsTradingDay(DateOnly date, MarketDataSettings settings)
        {
            var dayOfWeek = date.DayOfWeek;
            if (dayOfWeek == DayOfWeek.Saturday || dayOfWeek == DayOfWeek.Sunday)
            {
                return false;
            }

            return !GetHolidaySet(settings).Contains(date);
        }

        private HashSet<DateOnly> GetHolidaySet(MarketDataSettings settings)
        {
            var signature = BuildHolidaySignature(settings.BistHolidayDates);
            if (string.Equals(signature, _holidaySignature, StringComparison.Ordinal))
            {
                return _holidaySet;
            }

            lock (_holidaySync)
            {
                if (string.Equals(signature, _holidaySignature, StringComparison.Ordinal))
                {
                    return _holidaySet;
                }

                _holidaySet = BuildHolidaySet(settings);
                _holidaySignature = signature;
                return _holidaySet;
            }
        }

        private HashSet<DateOnly> BuildHolidaySet(MarketDataSettings settings)
        {
            // Optional holiday support: "yyyy-MM-dd" list from configuration
            // e.g. "BistHolidayDates": ["2026-01-01", "2026-04-23"]
            var set = new HashSet<DateOnly>();
            if (settings.BistHolidayDates is null || settings.BistHolidayDates.Count == 0)
            {
                return set;
            }

            foreach (var rawDate in settings.BistHolidayDates)
            {
                if (DateOnly.TryParseExact(rawDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                {
                    set.Add(parsed);
                }
                else
                {
                    _logger.LogWarning("Invalid BIST holiday date format in settings: {RawDate}", rawDate);
                }
            }

            return set;
        }

        private DateTimeOffset ToIstanbulOffset(DateOnly date, TimeOnly time)
        {
            var localDateTime = date.ToDateTime(time, DateTimeKind.Unspecified);
            var offset = _istanbulTz.GetUtcOffset(localDateTime);

            return new DateTimeOffset(localDateTime, offset);
        }

        private static DateTime NormalizeToUtc(DateTime value)
        {
            if (value.Kind == DateTimeKind.Utc)
            {
                return value;
            }

            if (value.Kind == DateTimeKind.Local)
            {
                return value.ToUniversalTime();
            }

            return DateTime.SpecifyKind(value, DateTimeKind.Utc);
        }

        private MarketDataSettings GetCurrentSettings() =>
            _settingsMonitor.CurrentValue ?? new MarketDataSettings();

        private static string BuildHolidaySignature(IReadOnlyList<string>? holidayDates)
        {
            if (holidayDates is null || holidayDates.Count == 0)
            {
                return string.Empty;
            }

            return string.Join("|", holidayDates);
        }

        private TimeZoneInfo ResolveIstanbulTimeZone()
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
            }
            catch
            {
                try
                {
                    // Windows timezone id fallback
                    return TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time");
                }
                catch
                {
                    _logger.LogWarning("Could not resolve Istanbul timezone. Falling back to UTC.");
                    return TimeZoneInfo.Utc;
                }
            }
        }
    }
#nullable restore
}
