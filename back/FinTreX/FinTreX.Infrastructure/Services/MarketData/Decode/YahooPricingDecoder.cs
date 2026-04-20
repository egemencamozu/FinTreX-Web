using FinTreX.Infrastructure.Proto;
using Google.Protobuf;
using Microsoft.Extensions.Logging;
using System;
using System.Text.Json;

namespace FinTreX.Infrastructure.Services.MarketData.Decode
{
    /// <summary>
    /// Decodes Yahoo stream payloads into PricingData.
    /// Supports both raw base64 messages and JSON envelopes with a base64 field.
    /// </summary>
    public class YahooPricingDecoder : IYahooPricingDecoder
    {
        private readonly ILogger<YahooPricingDecoder> _logger;

        public YahooPricingDecoder(ILogger<YahooPricingDecoder> logger)
        {
            _logger = logger;
        }

        public bool TryDecode(string rawMessage, out PricingData data)
        {
            data = null!;

            if (string.IsNullOrWhiteSpace(rawMessage))
            {
                _logger.LogWarning("Yahoo message was empty.");
                return false;
            }

            if (!TryExtractBase64Payload(rawMessage, out var base64Payload))
            {
                return false;
            }

            return TryDecodeBase64(base64Payload, out data);
        }

        private bool TryExtractBase64Payload(string rawMessage, out string base64Payload)
        {
            if (!TryGetTrimBounds(rawMessage, out var start, out var end))
            {
                base64Payload = string.Empty;
                return false;
            }

            // Some clients can wrap Yahoo payloads in an envelope object.
            if (rawMessage[start] == '{' && rawMessage[end] == '}')
            {
                var jsonPayload = start == 0 && end == rawMessage.Length - 1
                    ? rawMessage
                    : rawMessage.Substring(start, end - start + 1);

                try
                {
                    using var doc = JsonDocument.Parse(jsonPayload);
                    var root = doc.RootElement;

                    if (TryGetString(root, "message", out base64Payload) ||
                        TryGetString(root, "data", out base64Payload))
                    {
                        return true;
                    }

                    _logger.LogWarning("Yahoo JSON message did not contain base64 field. Payload: {Payload}", jsonPayload);
                    base64Payload = string.Empty;
                    return false;
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Yahoo payload looked like JSON but parsing failed. Payload: {Payload}", jsonPayload);
                    base64Payload = string.Empty;
                    return false;
                }
            }

            // Convert.FromBase64String handles whitespace; keep original string to avoid extra allocation.
            base64Payload = rawMessage;
            return true;
        }

        private bool TryDecodeBase64(string base64Payload, out PricingData data)
        {
            data = null!;

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(base64Payload);
            }
            catch (FormatException ex)
            {
                _logger.LogWarning(ex, "Yahoo message was not valid base64.");
                return false;
            }

            try
            {
                data = PricingData.Parser.ParseFrom(bytes);
                return true;
            }
            catch (InvalidProtocolBufferException ex)
            {
                _logger.LogWarning(ex, "Yahoo protobuf decode failed.");
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while decoding Yahoo payload.");
                return false;
            }
        }

        private static bool TryGetString(JsonElement root, string propertyName, out string value)
        {
            value = string.Empty;

            if (!root.TryGetProperty(propertyName, out var prop) || prop.ValueKind != JsonValueKind.String)
            {
                return false;
            }

            var str = prop.GetString();
            if (string.IsNullOrWhiteSpace(str))
            {
                return false;
            }

            value = str;
            return true;
        }

        private static bool TryGetTrimBounds(string rawMessage, out int start, out int end)
        {
            start = 0;
            end = rawMessage.Length - 1;

            while (start <= end && char.IsWhiteSpace(rawMessage[start]))
            {
                start++;
            }

            while (end >= start && char.IsWhiteSpace(rawMessage[end]))
            {
                end--;
            }

            return start <= end;
        }
    }
}
