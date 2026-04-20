using FinTreX.Core.DTOs.Payment;
using FinTreX.Core.DTOs.Subscription;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using FinTreX.Core.Interfaces;
using FinTreX.Core.Interfaces.Repositories;
using FinTreX.Core.Interfaces.Services;
using FinTreX.Core.Settings;
using FinTreX.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace FinTreX.Infrastructure.Services
{
    public class StripePaymentService : IStripePaymentService
    {
        private readonly StripeSettings _stripeSettings;
        private readonly IUserSubscriptionRepository _subRepository;
        private readonly IGenericRepository<SubscriptionPlan> _planRepository;
        private readonly ICurrentUserService _currentUserService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<StripePaymentService> _logger;

        public StripePaymentService(
            IOptions<StripeSettings> stripeSettings,
            IUserSubscriptionRepository subRepository,
            IGenericRepository<SubscriptionPlan> planRepository,
            ICurrentUserService currentUserService,
            UserManager<ApplicationUser> userManager,
            ILogger<StripePaymentService> logger)
        {
            _stripeSettings = stripeSettings.Value;
            _subRepository = subRepository;
            _planRepository = planRepository;
            _currentUserService = currentUserService;
            _userManager = userManager;
            _logger = logger;

            StripeConfiguration.ApiKey = _stripeSettings.SecretKey;
        }

        public async Task<CheckoutSessionResponse> CreateCheckoutSessionAsync(int planId, string billingPeriod)
        {
            var plan = await _planRepository.GetByIdAsync(planId);
            if (plan == null) throw new KeyNotFoundException("Plan not found.");

            var priceId = string.Equals(billingPeriod, "yearly", StringComparison.OrdinalIgnoreCase)
                ? plan.StripeYearlyPriceId
                : plan.StripeMonthlyPriceId;

            if (string.IsNullOrEmpty(priceId))
            {
                throw new InvalidOperationException("This plan does not have a configured Stripe price.");
            }

            var userId = _currentUserService.UserId;
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) throw new UnauthorizedAccessException("User not found.");

            var sub = await _subRepository.GetWithPlanAsync(userId);

            // Prevent downgrade; allow same-tier only for yearly billing switch
            if (sub?.SubscriptionPlan != null && sub.Status == SubscriptionStatus.Active)
            {
                var isDowngrade = plan.Tier < sub.SubscriptionPlan.Tier;
                var isSameTier = plan.Tier == sub.SubscriptionPlan.Tier;
                var isYearly = string.Equals(billingPeriod, "yearly", StringComparison.OrdinalIgnoreCase);

                if (isDowngrade)
                {
                    throw new InvalidOperationException("Alt seviye bir plana geçiş yapılamaz.");
                }

                if (isSameTier && !isYearly)
                {
                    throw new InvalidOperationException("Aynı seviye plana geçiş yapılamaz. Yıllık ödeme seçeneğini tercih edebilirsiniz.");
                }
            }

            // VALIDATION: Prevent downgrade and redundant same-plan purchases
            if (sub != null && sub.SubscriptionPlanId > 0 && sub.Status == SubscriptionStatus.Active)
            {
                var currentPlan = await _planRepository.GetByIdAsync(sub.SubscriptionPlanId);
                if (currentPlan != null)
                {
                    if (plan.Tier < currentPlan.Tier)
                    {
                        throw new InvalidOperationException("Daha düşük bir pakete geçiş yapamazsınız.");
                    }

                    // Same tier: allow only if billing period is actually changing
                    if (plan.Tier == currentPlan.Tier)
                    {
                        var isSameBillingPeriod = string.Equals(sub.BillingPeriod, billingPeriod, StringComparison.OrdinalIgnoreCase);
                        if (isSameBillingPeriod)
                        {
                            throw new InvalidOperationException("Zaten bu plana ve ödeme dönemine abonesiniz.");
                        }
                    }
                }
            }

            // UPGRADE FLOW: If user already has an active Stripe subscription, transition by paying the difference
            if (sub != null && !string.IsNullOrEmpty(sub.StripeSubscriptionId) && sub.Status == SubscriptionStatus.Active)
            {
                var subscriptionService = new Stripe.SubscriptionService();
                var stripeSub = await subscriptionService.GetAsync(sub.StripeSubscriptionId);
                
                var subscriptionItem = stripeSub.Items?.Data?.FirstOrDefault();
                if (subscriptionItem != null)
                {
                    var updateOptions = new SubscriptionUpdateOptions
                    {
                        Items = new List<SubscriptionItemOptions>
                        {
                            new SubscriptionItemOptions
                            {
                                Id = subscriptionItem.Id,
                                Price = priceId,
                            }
                        },
                        ProrationBehavior = "always_invoice",
                        Metadata = new Dictionary<string, string>
                        {
                            { "ApplicationUserId", userId },
                            { "PlanId", planId.ToString() }
                        }
                    };
                    await subscriptionService.UpdateAsync(sub.StripeSubscriptionId, updateOptions);

                    // Immediately update DB to reflect the new plan on the frontend
                    sub.SubscriptionPlanId = planId;
                    sub.BillingPeriod = billingPeriod;
                    await _subRepository.UpdateAsync(sub);

                    // Verify the upgrade persisted
                    var verified = await _subRepository.GetByUserIdAsync(userId);
                    if (verified == null || verified.SubscriptionPlanId != planId)
                    {
                        _logger.LogError(
                            "In-place upgrade verification failed. Expected PlanId={ExpectedPlanId}, Got={ActualPlanId} for user {UserId}",
                            planId, verified?.SubscriptionPlanId, userId);
                        throw new InvalidOperationException("Plan yükseltmesi veritabanına kaydedilemedi. Lütfen tekrar deneyiniz.");
                    }

                    return new CheckoutSessionResponse
                    {
                        SessionId = "upgrade_" + Guid.NewGuid().ToString("N"),
                        CheckoutUrl = _stripeSettings.SuccessUrl + "?session_id=upgrade_success"
                    };
                }
            }

            // Ensure user has a Stripe customer + a UserSubscription row
            var needsNewCustomer = sub == null || string.IsNullOrEmpty(sub.StripeCustomerId);

            // Validate existing Stripe customer still exists
            if (!needsNewCustomer)
            {
                try
                {
                    var customerService = new CustomerService();
                    await customerService.GetAsync(sub.StripeCustomerId);
                }
                catch (StripeException ex) when (ex.StripeError?.Code == "resource_missing")
                {
                    _logger.LogWarning("Stripe customer {CustomerId} no longer exists, will create a new one.", sub.StripeCustomerId);
                    needsNewCustomer = true;
                }
            }

            if (needsNewCustomer)
            {
                var customerOptions = new CustomerCreateOptions
                {
                    Email = user.Email,
                    Name = $"{user.FirstName} {user.LastName}".Trim(),
                    Metadata = new Dictionary<string, string> { { "ApplicationUserId", userId } }
                };
                var customerService = new CustomerService();
                var customer = await customerService.CreateAsync(customerOptions);

                if (sub == null)
                {
                    var defaultPlan = (await _planRepository.GetAllAsync())
                        .FirstOrDefault(p => p.Tier == SubscriptionTier.Default);

                    if (defaultPlan == null)
                    {
                        throw new InvalidOperationException("Default subscription plan is missing in the database. Seed plans first.");
                    }

                    sub = new UserSubscription
                    {
                        ApplicationUserId = userId,
                        SubscriptionPlanId = defaultPlan.Id,
                        Status = SubscriptionStatus.Active,
                    };
                    await _subRepository.AddAsync(sub);
                }

                sub.StripeCustomerId = customer.Id;
                sub.StripeSubscriptionId = null; // old subscription is invalid too
                await _subRepository.UpdateAsync(sub);
            }

            var options = new SessionCreateOptions
            {
                Customer = sub.StripeCustomerId,
                PaymentMethodTypes = new List<string> { "card" },
                LineItems = new List<SessionLineItemOptions>
                {
                    new SessionLineItemOptions
                    {
                        Price = priceId,
                        Quantity = 1,
                    },
                },
                Mode = "subscription",
                SuccessUrl = _stripeSettings.SuccessUrl + "?session_id={CHECKOUT_SESSION_ID}",
                CancelUrl = _stripeSettings.CancelUrl,
                ClientReferenceId = userId,
                SubscriptionData = new SessionSubscriptionDataOptions
                {
                    Metadata = new Dictionary<string, string>
                    {
                        { "ApplicationUserId", userId },
                        { "PlanId", planId.ToString() },
                        { "BillingPeriod", billingPeriod }
                    }
                }
            };

            var service = new SessionService();
            var session = await service.CreateAsync(options);

            return new CheckoutSessionResponse
            {
                SessionId = session.Id,
                CheckoutUrl = session.Url
            };
        }

        public async Task<string> CreateCustomerPortalSessionAsync()
        {
            var userId = _currentUserService.UserId;
            var sub = await _subRepository.GetByUserIdAsync(userId);

            if (sub == null || string.IsNullOrEmpty(sub.StripeCustomerId))
            {
                throw new InvalidOperationException("User does not have an active Stripe customer account.");
            }

            // Create a portal configuration that disables plan switching.
            // Users must change plans through our app (which enforces upgrade-only logic).
            var configService = new Stripe.BillingPortal.ConfigurationService();
            var portalConfig = await configService.CreateAsync(new Stripe.BillingPortal.ConfigurationCreateOptions
            {
                BusinessProfile = new Stripe.BillingPortal.ConfigurationBusinessProfileOptions
                {
                    Headline = "FinTreX Abonelik Yönetimi"
                },
                Features = new Stripe.BillingPortal.ConfigurationFeaturesOptions
                {
                    SubscriptionUpdate = new Stripe.BillingPortal.ConfigurationFeaturesSubscriptionUpdateOptions
                    {
                        Enabled = false,
                    },
                    SubscriptionCancel = new Stripe.BillingPortal.ConfigurationFeaturesSubscriptionCancelOptions
                    {
                        Enabled = true,
                        Mode = "at_period_end",
                    },
                    PaymentMethodUpdate = new Stripe.BillingPortal.ConfigurationFeaturesPaymentMethodUpdateOptions
                    {
                        Enabled = true,
                    },
                    InvoiceHistory = new Stripe.BillingPortal.ConfigurationFeaturesInvoiceHistoryOptions
                    {
                        Enabled = true,
                    },
                }
            });

            var options = new Stripe.BillingPortal.SessionCreateOptions
            {
                Customer = sub.StripeCustomerId,
                ReturnUrl = _stripeSettings.SuccessUrl.Replace("/success", ""),
                Configuration = portalConfig.Id,
            };
            var service = new Stripe.BillingPortal.SessionService();
            var session = await service.CreateAsync(options);

            return session.Url;
        }

        public async Task CancelStripeSubscriptionAsync(bool atPeriodEnd = true)
        {
            var userId = _currentUserService.UserId;
            var sub = await _subRepository.GetByUserIdAsync(userId);

            if (sub == null || string.IsNullOrEmpty(sub.StripeSubscriptionId))
            {
                throw new InvalidOperationException("Active Stripe subscription not found for the current user.");
            }

            var subscriptionService = new Stripe.SubscriptionService();

            if (atPeriodEnd)
            {
                // Soft cancel — keep access until period end. DB will be synced via webhook.
                var updateOptions = new SubscriptionUpdateOptions { CancelAtPeriodEnd = true };
                await subscriptionService.UpdateAsync(sub.StripeSubscriptionId, updateOptions);
            }
            else
            {
                // Hard cancel — immediate. DB will be synced via webhook (subscription.deleted).
                await subscriptionService.CancelAsync(sub.StripeSubscriptionId);
            }
        }

        public async Task HandleWebhookEventAsync(string json, string stripeSignature)
        {
            // Signature verification — failures here MUST propagate so caller can return 400.
            Event stripeEvent;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(json, stripeSignature, _stripeSettings.WebhookSecret);
            }
            catch (StripeException ex)
            {
                _logger.LogWarning(ex, "Stripe webhook signature verification failed.");
                throw;
            }

            // Event handling — failures are logged but swallowed so Stripe doesn't retry forever.
            try
            {
                switch (stripeEvent.Type)
                {
                    case "checkout.session.completed":
                        if (stripeEvent.Data.Object is Stripe.Checkout.Session session)
                        {
                            await HandleCheckoutSessionCompleted(session);
                        }
                        break;

                    case "invoice.paid":
                        if (stripeEvent.Data.Object is Stripe.Invoice invoice)
                        {
                            await HandleInvoicePaid(invoice);
                        }
                        break;

                    case "customer.subscription.updated":
                        if (stripeEvent.Data.Object is Stripe.Subscription updatedSub)
                        {
                            await HandleSubscriptionUpdated(updatedSub);
                        }
                        break;

                    case "customer.subscription.deleted":
                        if (stripeEvent.Data.Object is Stripe.Subscription deletedSub)
                        {
                            await HandleSubscriptionDeleted(deletedSub);
                        }
                        break;

                    default:
                        _logger.LogInformation("Unhandled Stripe event type {EventType}", stripeEvent.Type);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while handling Stripe event {EventType} ({EventId})", stripeEvent.Type, stripeEvent.Id);
                // Swallow — return 200 to Stripe so it doesn't retry on persistent app bugs.
            }
        }

        public async Task<UserSubscriptionDto> VerifyCheckoutSessionAsync(string sessionId)
        {
            var service = new SessionService();
            var session = await service.GetAsync(sessionId);

            if (session == null)
                throw new KeyNotFoundException("Checkout session not found.");

            var userId = _currentUserService.UserId;

            if (session.ClientReferenceId != userId)
                throw new UnauthorizedAccessException("Session does not belong to the current user.");

            if (session.PaymentStatus != "paid" && session.PaymentStatus != "no_payment_required")
                throw new InvalidOperationException("Payment has not been completed.");

            // Fallback: in local dev (and if the webhook is delayed/missing), the
            // checkout.session.completed handler may not have run yet — meaning the
            // user would land on /success still seeing their old plan. Run the same
            // upgrade logic here. HandleCheckoutSessionCompleted is idempotent, so
            // re-running it after the webhook has already fired is safe.
            try
            {
                await HandleCheckoutSessionCompleted(session);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "verify-session fallback upgrade failed for session {SessionId}", sessionId);
                throw new InvalidOperationException("Failed to finalize subscription upgrade.", ex);
            }

            var userSub = await _subRepository.GetWithPlanAsync(userId);
            if (userSub == null)
                throw new KeyNotFoundException("Subscription not found.");

            return MapToDto(userSub);
        }

        // ── Webhook event handlers ──────────────────────────────────────────────

        private async Task HandleCheckoutSessionCompleted(Stripe.Checkout.Session session)
        {
            if (string.IsNullOrEmpty(session.SubscriptionId)) return;

            var userId = session.ClientReferenceId;
            if (string.IsNullOrEmpty(userId)) return;

            var stripeSub = await new Stripe.SubscriptionService().GetAsync(session.SubscriptionId);

            if (!TryGetMetadata(stripeSub.Metadata, "PlanId", out var planIdStr) ||
                !int.TryParse(planIdStr, out var planId))
            {
                _logger.LogWarning("checkout.session.completed without PlanId metadata. SubscriptionId={SubscriptionId}", stripeSub.Id);
                return;
            }

            var userSub = await _subRepository.GetByUserIdAsync(userId);
            if (userSub == null)
            {
                _logger.LogWarning("UserSubscription row missing for user {UserId} in checkout.session.completed", userId);
                return;
            }

            var (periodStart, periodEnd) = GetCurrentPeriod(stripeSub);

            userSub.StripeSubscriptionId = stripeSub.Id;
            userSub.SubscriptionPlanId = planId;
            userSub.Status = SubscriptionStatus.Active;
            userSub.StartedAtUtc = periodStart;
            userSub.CurrentPeriodEndUtc = periodEnd;
            userSub.CancelAtPeriodEnd = stripeSub.CancelAtPeriodEnd;
            userSub.CancelledAtUtc = null;
            userSub.BillingPeriod = GetBillingPeriodFromSubscription(stripeSub);

            await _subRepository.UpdateAsync(userSub);
        }

        private async Task HandleInvoicePaid(Stripe.Invoice invoice)
        {
            // Locate subscription id from invoice. In Stripe.NET v51 this can come from
            // the invoice line items (Parent.SubscriptionItemDetails.Subscription).
            var subscriptionId = ExtractSubscriptionIdFromInvoice(invoice);
            if (string.IsNullOrEmpty(subscriptionId)) return;

            var stripeSub = await new Stripe.SubscriptionService().GetAsync(subscriptionId);

            if (!TryGetMetadata(stripeSub.Metadata, "ApplicationUserId", out var userId)) return;

            var userSub = await _subRepository.GetByUserIdAsync(userId);
            if (userSub == null || userSub.StripeSubscriptionId != subscriptionId) return;

            var (_, periodEnd) = GetCurrentPeriod(stripeSub);
            userSub.CurrentPeriodEndUtc = periodEnd;
            userSub.Status = SubscriptionStatus.Active;

            await _subRepository.UpdateAsync(userSub);
        }

        private async Task HandleSubscriptionUpdated(Stripe.Subscription stripeSub)
        {
            if (!TryGetMetadata(stripeSub.Metadata, "ApplicationUserId", out var userId)) return;

            var userSub = await _subRepository.GetByUserIdAsync(userId);
            if (userSub == null || userSub.StripeSubscriptionId != stripeSub.Id) return;

            var (_, periodEnd) = GetCurrentPeriod(stripeSub);
            userSub.CancelAtPeriodEnd = stripeSub.CancelAtPeriodEnd;
            userSub.CurrentPeriodEndUtc = periodEnd;
            userSub.BillingPeriod = GetBillingPeriodFromSubscription(stripeSub);

            // Sync PlanId from Stripe metadata when available
            if (TryGetMetadata(stripeSub.Metadata, "PlanId", out var planIdStr) &&
                int.TryParse(planIdStr, out var planId) && planId > 0)
            {
                userSub.SubscriptionPlanId = planId;
            }

            if (stripeSub.Status == "active" || stripeSub.Status == "trialing")
            {
                userSub.Status = SubscriptionStatus.Active;
            }
            else if (stripeSub.Status == "canceled")
            {
                userSub.Status = SubscriptionStatus.Cancelled;
                userSub.CancelledAtUtc = DateTime.UtcNow;
            }
            else
            {
                userSub.Status = SubscriptionStatus.Expired;
            }

            await _subRepository.UpdateAsync(userSub);
        }

        private async Task HandleSubscriptionDeleted(Stripe.Subscription stripeSub)
        {
            if (!TryGetMetadata(stripeSub.Metadata, "ApplicationUserId", out var userId)) return;

            var userSub = await _subRepository.GetByUserIdAsync(userId);
            if (userSub == null || userSub.StripeSubscriptionId != stripeSub.Id) return;

            userSub.Status = SubscriptionStatus.Cancelled;
            userSub.CancelledAtUtc = DateTime.UtcNow;
            await _subRepository.UpdateAsync(userSub);
        }

        // ── Helpers ─────────────────────────────────────────────────────────────

        /// <summary>
        /// Retrieves the current billing period start and end dates from the Stripe Subscription.
        /// </summary>
        private static (DateTime start, DateTime end) GetCurrentPeriod(Stripe.Subscription stripeSub)
        {
            var item = stripeSub.Items?.Data?.FirstOrDefault();
            if (item == null)
            {
                var now = DateTime.UtcNow;
                return (now, now);
            }
            return (item.CurrentPeriodStart, item.CurrentPeriodEnd);
        }

        /// <summary>
        /// Derives "monthly" or "yearly" from the first subscription item's price interval.
        /// </summary>
        private static string GetBillingPeriodFromSubscription(Stripe.Subscription stripeSub)
        {
            var interval = stripeSub.Items?.Data?.FirstOrDefault()?.Price?.Recurring?.Interval;
            return string.Equals(interval, "year", StringComparison.OrdinalIgnoreCase) ? "yearly" : "monthly";
        }

        private static bool TryGetMetadata(IDictionary<string, string> metadata, string key, out string value)
        {
            value = null;
            if (metadata == null) return false;
            return metadata.TryGetValue(key, out value) && !string.IsNullOrEmpty(value);
        }

        private static string ExtractSubscriptionIdFromInvoice(Stripe.Invoice invoice)
        {
            // Try line items first — most reliable in v51.
            var line = invoice.Lines?.Data?.FirstOrDefault();
            var subId = line?.Parent?.SubscriptionItemDetails?.Subscription;
            if (!string.IsNullOrEmpty(subId)) return subId;

            // Fall back to invoice.Parent.SubscriptionDetails if present.
            return invoice.Parent?.SubscriptionDetails?.SubscriptionId;
        }

        private static UserSubscriptionDto MapToDto(UserSubscription s)
        {
            List<PlanFeatureDto> features = new();
            if (s.SubscriptionPlan != null && !string.IsNullOrEmpty(s.SubscriptionPlan.FeaturesJson))
            {
                try { features = JsonSerializer.Deserialize<List<PlanFeatureDto>>(s.SubscriptionPlan.FeaturesJson) ?? new(); } catch { }
            }

            return new UserSubscriptionDto
            {
                Id = s.Id,
                BillingPeriod = s.BillingPeriod ?? "monthly",
                Plan = s.SubscriptionPlan != null ? new SubscriptionPlanDto
                {
                    Id = s.SubscriptionPlan.Id,
                    Tier = s.SubscriptionPlan.Tier,
                    DisplayName = s.SubscriptionPlan.DisplayName,
                    Description = s.SubscriptionPlan.Description,
                    MonthlyPriceTRY = s.SubscriptionPlan.MonthlyPriceTRY,
                    YearlyPriceTRY = s.SubscriptionPlan.YearlyPriceTRY,
                    MaxEconomists = s.SubscriptionPlan.MaxEconomists,
                    CanChangeEconomist = s.SubscriptionPlan.CanChangeEconomist,
                    HasPrioritySupport = s.SubscriptionPlan.HasPrioritySupport,
                    IsActive = s.SubscriptionPlan.IsActive,
                    Features = features
                } : null,
                Status = s.Status,
                StartedAtUtc = s.StartedAtUtc,
                CurrentPeriodEndUtc = s.CurrentPeriodEndUtc,
                CancelledAtUtc = s.CancelledAtUtc,
                CancelAtPeriodEnd = s.CancelAtPeriodEnd
            };
        }
    }
}
