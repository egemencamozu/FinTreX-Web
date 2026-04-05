using FinTreX.Core;
using FinTreX.Infrastructure;
using FinTreX.Infrastructure.Models;
using FinTreX.WebApi.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using System;
using System.Linq;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddPersistenceInfrastructure(builder.Configuration);
builder.Services.AddApplicationLayer();
builder.Services.AddIdentityServiceExtension();
builder.Services.AddSwaggerExtension();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddHealthChecks();
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new Asp.Versioning.ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
}).AddMvc().AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

// CORS — restrict to known frontend origins
const string corsPolicyName = "FinTreXCorsPolicy";
builder.Services.AddCors(options =>
{
    options.AddPolicy(corsPolicyName, policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
                             ?? new[] { "http://localhost:4200" };

        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

//Build the application
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}
app.UseHttpsRedirection();

app.UseRouting();
app.UseCors(corsPolicyName);
app.UseAuthentication();
app.UseAuthorization();
app.UseSwaggerExtension();
app.UseErrorHandlingMiddleware();
app.UseHealthChecks("/health");
app.MapControllers();


//Initialize Logger

Log.Logger = new LoggerConfiguration()
                .ReadFrom.Configuration(app.Configuration)
                .CreateLogger();

//Seed Default Data
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();

        await FinTreX.Infrastructure.Seeds.DefaultRoles.SeedAsync(userManager, roleManager);
        var adminEmail = builder.Configuration["AdminSeed:Email"];
        var adminPassword = builder.Configuration["AdminSeed:Password"];
        var adminFirstName = builder.Configuration["AdminSeed:FirstName"] ?? "FinTreX";
        var adminLastName = builder.Configuration["AdminSeed:LastName"] ?? "Admin";

        if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPassword))
        {
            var adminUser = await userManager.FindByEmailAsync(adminEmail);

            if (adminUser == null)
            {
                adminUser = new ApplicationUser
                {
                    Email = adminEmail,
                    UserName = adminEmail.Split('@')[0],
                    FirstName = adminFirstName,
                    LastName = adminLastName,
                    EmailConfirmed = true
                };

                var createAdminResult = await userManager.CreateAsync(adminUser, adminPassword);
                if (!createAdminResult.Succeeded)
                {
                    throw new InvalidOperationException(string.Join(" ", createAdminResult.Errors.Select(error => error.Description)));
                }
            }

            if (!await userManager.IsInRoleAsync(adminUser, "Admin"))
            {
                await userManager.AddToRoleAsync(adminUser, "Admin");
            }
        }

        Log.Information("Finished seeding auth roles");
        Log.Information("Application Starting");
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "An error occurred seeding the DB");
    }
    finally
    {
        Log.CloseAndFlush();
    }
}

//Start the application
app.Run();
