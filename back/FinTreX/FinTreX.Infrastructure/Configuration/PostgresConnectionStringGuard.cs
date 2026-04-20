using System;
using Npgsql;

namespace FinTreX.Infrastructure.Configuration
{
    internal static class PostgresConnectionStringGuard
    {
        private static readonly string[] SqlServerKeywords =
        {
            "Initial Catalog",
            "Integrated Security",
            "Trusted_Connection",
            "Data Source"
        };

        public static string Validate(string? connectionString, string settingName)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    $"{settingName} is missing. Configure a PostgreSQL/Npgsql connection string.");
            }

            foreach (var keyword in SqlServerKeywords)
            {
                if (connectionString.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException(
                        $"{settingName} contains the SQL Server keyword '{keyword}'. " +
                        "FinTreX is configured for PostgreSQL via Npgsql. " +
                        "Remove the overriding environment variable or user secret and use keys like " +
                        "'Host', 'Port', 'Database', 'Username', and 'Password'.");
                }
            }

            try
            {
                _ = new NpgsqlConnectionStringBuilder(connectionString);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    $"{settingName} is not a valid PostgreSQL/Npgsql connection string. " +
                    "Example: Host=localhost;Port=5432;Database=appdb;Username=postgres;Password=secret;",
                    ex);
            }

            return connectionString;
        }
    }
}
