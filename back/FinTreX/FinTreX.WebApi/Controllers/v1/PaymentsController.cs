using FinTreX.Core.DTOs.Payment;
using FinTreX.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace FinTreX.WebApi.Controllers.v1
{
    [Authorize]
    public class PaymentsController : BaseApiController
    {
        private readonly IStripePaymentService _stripePaymentService;
        private readonly IPaymentHistoryService _paymentHistoryService;
        private readonly IAdminRevenueDashboardService _dashboardService;
        private readonly IConfiguration _configuration;

        public PaymentsController(
            IStripePaymentService stripePaymentService,
            IPaymentHistoryService paymentHistoryService,
            IAdminRevenueDashboardService dashboardService,
            IConfiguration configuration)
        {
            _stripePaymentService = stripePaymentService;
            _paymentHistoryService = paymentHistoryService;
            _dashboardService = dashboardService;
            _configuration = configuration;
        }

        [HttpPost("create-checkout-session")]
        public async Task<IActionResult> CreateCheckoutSession([FromBody] CreateCheckoutSessionRequest request)
        {
            try
            {
                var response = await _stripePaymentService.CreateCheckoutSessionAsync(request.PlanId, request.BillingPeriod);
                return Ok(response);
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { error = ex.Message, details = ex.InnerException?.Message });
            }
        }

        [HttpPost("create-portal-session")]
        public async Task<IActionResult> CreatePortalSession()
        {
            var url = await _stripePaymentService.CreateCustomerPortalSessionAsync();
            return Ok(new { url });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("seed-stripe")]
        public async Task<IActionResult> SeedStripeProducts([FromServices] FinTreX.Infrastructure.Contexts.ApplicationDbContext dbContext)
        {
            Stripe.StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];

            // ApplicationDbContext sets QueryTrackingBehavior.NoTracking globally,
            // so we MUST opt back into tracking here — otherwise SaveChangesAsync()
            // persists nothing and every seed call leaks new Stripe products.
            var plans = Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions
                .AsTracking(dbContext.SubscriptionPlans)
                .ToList();
            var productService = new Stripe.ProductService();
            var priceService = new Stripe.PriceService();

            foreach (var plan in plans)
            {
                if (plan.MonthlyPriceTRY > 0)
                {
                    Stripe.Product product;
                    if (string.IsNullOrEmpty(plan.StripeProductId))
                    {
                        product = await productService.CreateAsync(new Stripe.ProductCreateOptions
                        {
                            Name = $"FinTreX {plan.DisplayName} Planı",
                            Description = plan.Description
                        });
                        plan.StripeProductId = product.Id;
                    }
                    else
                    {
                        try { product = await productService.GetAsync(plan.StripeProductId); }
                        catch { 
                            product = await productService.CreateAsync(new Stripe.ProductCreateOptions {
                                Name = $"FinTreX {plan.DisplayName} Planı",
                                Description = plan.Description
                            });
                            plan.StripeProductId = product.Id;
                        }
                    }

                    // Create Monthly Price if missing
                    if (string.IsNullOrEmpty(plan.StripeMonthlyPriceId))
                    {
                        var price = await priceService.CreateAsync(new Stripe.PriceCreateOptions
                        {
                            Product = product.Id,
                            UnitAmountDecimal = plan.MonthlyPriceTRY * 100, // in kuruş
                            Currency = "try",
                            Recurring = new Stripe.PriceRecurringOptions { Interval = "month" }
                        });
                        plan.StripeMonthlyPriceId = price.Id;
                    }

                    // Create Yearly Price if missing
                    if (plan.YearlyPriceTRY > 0 && string.IsNullOrEmpty(plan.StripeYearlyPriceId))
                    {
                        var price = await priceService.CreateAsync(new Stripe.PriceCreateOptions
                        {
                            Product = product.Id,
                            UnitAmountDecimal = plan.YearlyPriceTRY * 100, // in kuruş
                            Currency = "try",
                            Recurring = new Stripe.PriceRecurringOptions { Interval = "year" }
                        });
                        plan.StripeYearlyPriceId = price.Id;
                    }
                }
            }

            await dbContext.SaveChangesAsync();
            return Ok(new { 
                Message = "Stripe senkronizasyonu tamamlandı.", 
                Plans = plans.Select(p => new { p.Id, p.DisplayName, p.StripeProductId, p.StripeMonthlyPriceId, p.StripeYearlyPriceId }) 
            });
        }

        [HttpGet("publishable-key")]
        [AllowAnonymous]
        public IActionResult GetPublishableKey()
        {
            var publishableKey = _configuration["Stripe:PublishableKey"];
            return Ok(new { publishableKey });
        }

        [HttpGet("verify-session/{sessionId}")]
        public async Task<IActionResult> VerifySession(string sessionId)
        {
            var subscription = await _stripePaymentService.VerifyCheckoutSessionAsync(sessionId);
            return Ok(subscription);
        }

        // ── Payment history ──────────────────────────────────────────────────

        /// <summary>USER: paged payment history for the authenticated user.</summary>
        [HttpGet("history")]
        public async Task<IActionResult> GetMyHistory([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _paymentHistoryService.GetMyPaymentsAsync(pageNumber, pageSize);
            return Ok(result);
        }

        /// <summary>USER: single payment detail. Must belong to the authenticated user.</summary>
        [HttpGet("history/{id:int}")]
        public async Task<IActionResult> GetMyPayment(int id)
        {
            try
            {
                var dto = await _paymentHistoryService.GetMyPaymentByIdAsync(id);
                return Ok(dto);
            }
            catch (System.Collections.Generic.KeyNotFoundException)
            {
                return NotFound();
            }
        }

        /// <summary>ADMIN: paged payment history across all users. Card details excluded.</summary>
        [Authorize(Roles = "Admin")]
        [HttpGet("admin/history")]
        public async Task<IActionResult> GetAllHistoryForAdmin([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _paymentHistoryService.GetAllPaymentsAsync(pageNumber, pageSize);
            return Ok(result);
        }

        /// <summary>ADMIN: single payment detail. Card details excluded.</summary>
        [Authorize(Roles = "Admin")]
        [HttpGet("admin/history/{id:int}")]
        public async Task<IActionResult> GetPaymentForAdmin(int id)
        {
            try
            {
                var dto = await _paymentHistoryService.GetPaymentByIdForAdminAsync(id);
                return Ok(dto);
            }
            catch (System.Collections.Generic.KeyNotFoundException)
            {
                return NotFound();
            }
        }

        /// <summary>ADMIN: import historical Stripe invoices into the local PaymentTransactions table.</summary>
        [Authorize(Roles = "Admin")]
        [HttpPost("admin/backfill")]
        public async Task<IActionResult> BackfillFromStripe([FromQuery] string? userId = null)
        {
            var summary = await _paymentHistoryService.BackfillFromStripeAsync(userId);
            return Ok(summary);
        }

        // ── Revenue Dashboard ────────────────────────────────────────────────

        /// <summary>ADMIN: KPI cards, plan breakdown, status distribution (DB-sourced, fast).</summary>
        [Authorize(Roles = "Admin")]
        [HttpGet("admin/dashboard/summary")]
        public async Task<IActionResult> GetDashboardSummary()
        {
            var result = await _dashboardService.GetSummaryAsync();
            return Ok(result);
        }

        /// <summary>ADMIN: monthly revenue trends (12 months) and subscription analytics (DB-sourced, fast).</summary>
        [Authorize(Roles = "Admin")]
        [HttpGet("admin/dashboard/trends")]
        public async Task<IActionResult> GetDashboardTrends()
        {
            var result = await _dashboardService.GetTrendsAsync();
            return Ok(result);
        }

        /// <summary>ADMIN: live Stripe balance, payouts, fees, disputes + card/failure analytics.</summary>
        [Authorize(Roles = "Admin")]
        [HttpGet("admin/dashboard/stripe-live")]
        public async Task<IActionResult> GetDashboardStripeLive()
        {
            var result = await _dashboardService.GetStripeLiveAsync();
            return Ok(result);
        }

        [HttpPost("webhook")]
        [AllowAnonymous]
        public async Task<IActionResult> Webhook()
        {
            var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
            var signatureHeader = Request.Headers["Stripe-Signature"];

            try
            {
                await _stripePaymentService.HandleWebhookEventAsync(json, signatureHeader);
                return Ok();
            }
            catch (Stripe.StripeException ex)
            {
                // Signature verification failed — let Stripe know so it retries / flags.
                return BadRequest($"Webhook signature error: {ex.Message}");
            }
        }
    }
}
