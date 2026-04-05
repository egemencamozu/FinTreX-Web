using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi.Models;
using System;
using System.Collections.Generic;
using System.IO;

namespace FinTreX.WebApi.Extensions
{
    public static class ServiceExtensions
    {
        public static void AddSwaggerExtension(this IServiceCollection services)
        {
            services.AddSwaggerGen(c =>
            {
                var xmlFile = "FinTreX.WebApi.xml";
                var xmlPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, xmlFile);
                c.IncludeXmlComments(xmlPath);

                c.SwaggerDoc("v1", new OpenApiInfo
                {
                    Version = "v1",
                    Title = "FinTreX API",
                    Description = "Authentication and authorization endpoints for the FinTreX platform.",
                    Contact = new OpenApiContact
                    {
                        Name = "FinTreX",
                    }
                });

                // Add predefined server URLs
                c.AddServer(new OpenApiServer
                {
                    Url = "https://localhost:9001",
                    Description = "Local Development Server"
                });
                
                c.AddServer(new OpenApiServer
                {
                    Url = "https://fintrex-api.azurewebsites.net", // Default Placeholder for Azure App Service if not available
                    Description = "Production Server"
                });

                c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.ApiKey,
                    Scheme = "Bearer",
                    BearerFormat = "JWT",
                    Description = "Input your Bearer token in this format - Bearer {your token here} to access this API",
                });
                c.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer",
                            },
                            Scheme = "Bearer",
                            Name = "Bearer",
                            In = ParameterLocation.Header,
                        }, new List<string>()
                    },
                });
            });
        }

        public static void AddIdentityServiceExtension(this IServiceCollection services)
        {
            services.AddHttpContextAccessor();
            services.AddScoped<Core.Interfaces.ICurrentUserService, Services.CurrentUserService>();
        }
    }
}
