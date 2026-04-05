using FinTreX.Core.Exceptions;
using FinTreX.Core.Wrappers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Middlewares
{
    public class ErrorHandlerMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ErrorHandlerMiddleware> _logger;
        private readonly IWebHostEnvironment _env;

        public ErrorHandlerMiddleware(RequestDelegate next, ILogger<ErrorHandlerMiddleware> logger, IWebHostEnvironment env)
        {
            _next = next;
            _logger = logger;
            _env = env;
        }

        public async Task Invoke(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception error)
            {
                var response = context.Response;
                response.ContentType = "application/json";
                var errorResponse = new ErrorResponse();

                switch (error)
                {
                    case Core.Exceptions.ApiException e:
                        response.StatusCode = (int)HttpStatusCode.BadRequest;
                        errorResponse.Message = e.Message;
                        break;
                    case Core.Exceptions.ForbiddenException e:
                        response.StatusCode = (int)HttpStatusCode.Forbidden;
                        errorResponse.Message = e.Message;
                        break;
                    case KeyNotFoundException e:
                        response.StatusCode = (int)HttpStatusCode.NotFound;
                        errorResponse.Message = e.Message;
                        break;
                    default:
                        _logger.LogError(error, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);
                        response.StatusCode = (int)HttpStatusCode.InternalServerError;
                        errorResponse.Message = _env.IsDevelopment()
                            ? $"{error.GetType().Name}: {error.Message}"
                            : "Internal server error.";
                        break;
                }

                errorResponse.Errors = new List<string> { errorResponse.Message ?? "An error occurred." };
                var result = JsonSerializer.Serialize(errorResponse);
                await response.WriteAsync(result);
            }
        }
    }
}
