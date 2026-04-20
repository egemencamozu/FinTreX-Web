using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using System;
using System.IO;
using FinTreX.Infrastructure.Configuration;

namespace FinTreX.Infrastructure.Contexts
{
    public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";
            var currentDirectory = Directory.GetCurrentDirectory();
            var webApiProjectPath = Path.GetFullPath(Path.Combine(currentDirectory, "..", "FinTreX.WebApi"));

            var configuration = new ConfigurationBuilder()
                .SetBasePath(webApiProjectPath)
                .AddJsonFile("appsettings.json", optional: false)
                .AddJsonFile($"appsettings.{environment}.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            var connectionString = PostgresConnectionStringGuard.Validate(
                configuration.GetConnectionString("DefaultConnection"),
                "ConnectionStrings:DefaultConnection");

            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
            optionsBuilder.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
            });

            return new ApplicationDbContext(optionsBuilder.Options);
        }
    }
}
