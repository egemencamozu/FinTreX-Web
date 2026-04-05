using FinTreX.Infrastructure.Models;
using FinTreX.Core.Entities;
using FinTreX.Core.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FinTreX.Infrastructure.Contexts
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        // ── Domain DbSets ────────────────────────────────────────────────────
        public DbSet<Portfolio> Portfolios { get; set; }
        public DbSet<PortfolioAsset> PortfolioAssets { get; set; }
        public DbSet<SubscriptionPlan> SubscriptionPlans { get; set; }
        public DbSet<UserSubscription> UserSubscriptions { get; set; }
        public DbSet<EconomistClient> EconomistClients { get; set; }
        public DbSet<ConsultancyTask> ConsultancyTasks { get; set; }
        public DbSet<PreAnalysisReport> PreAnalysisReports { get; set; }

        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
            ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            // ── Identity Table Mappings ──────────────────────────────────────
            builder.Entity<ApplicationUser>(entity =>
            {
                entity.ToTable(name: "User");
            });

            builder.Entity<IdentityRole>(entity =>
            {
                entity.ToTable(name: "Role");
            });

            builder.Entity<IdentityUserRole<string>>(entity =>
            {
                entity.ToTable("UserRoles");
            });

            builder.Entity<IdentityUserClaim<string>>(entity =>
            {
                entity.ToTable("UserClaims");
            });

            builder.Entity<IdentityUserLogin<string>>(entity =>
            {
                entity.ToTable("UserLogins");
            });

            builder.Entity<IdentityRoleClaim<string>>(entity =>
            {
                entity.ToTable("RoleClaims");
            });

            builder.Entity<IdentityUserToken<string>>(entity =>
            {
                entity.ToTable("UserTokens");
            });

            // ── RefreshToken ─────────────────────────────────────────────────
            builder.Entity<ApplicationUser>()
                .HasMany(u => u.RefreshTokens)
                .WithOne()
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<RefreshToken>(entity =>
            {
                entity.ToTable("RefreshTokens");
                entity.HasKey(t => t.Id);
                entity.Property(t => t.Token).IsRequired().HasMaxLength(256);
                entity.HasIndex(t => t.Token).IsUnique();
            });

            // ── Portfolio ────────────────────────────────────────────────────
            builder.Entity<Portfolio>(entity =>
            {
                entity.ToTable("Portfolios");
                entity.HasKey(x => x.Id);

                entity.Property(x => x.Name).IsRequired().HasMaxLength(100);
                entity.Property(x => x.Description).HasMaxLength(500);
                entity.Property(x => x.ApplicationUserId).IsRequired().HasMaxLength(450);

                // Self-referencing: parent ↔ sub-portfolios
                entity.HasOne(x => x.ParentPortfolio)
                    .WithMany(x => x.SubPortfolios)
                    .HasForeignKey(x => x.ParentPortfolioId)
                    .OnDelete(DeleteBehavior.Restrict); // Prevent cascade loops

                // User → Portfolios
                entity.HasOne<ApplicationUser>()
                    .WithMany(u => u.Portfolios)
                    .HasForeignKey(x => x.ApplicationUserId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Unique: a user can't have two portfolios with the same name under the same parent
                entity.HasIndex(x => new { x.ApplicationUserId, x.Name, x.ParentPortfolioId })
                    .IsUnique()
                    .HasFilter(null); // Allows multiple nulls in SQL Server
            });

            // ── PortfolioAsset ───────────────────────────────────────────────
            builder.Entity<PortfolioAsset>(entity =>
            {
                entity.ToTable("PortfolioAssets");
                entity.HasKey(x => x.Id);

                entity.Property(x => x.Symbol).IsRequired().HasMaxLength(20);
                entity.Property(x => x.AssetName).IsRequired().HasMaxLength(100);
                entity.Property(x => x.Currency).IsRequired().HasMaxLength(8);
                entity.Property(x => x.Notes).HasMaxLength(500);
                entity.Property(x => x.Quantity).HasPrecision(18, 6);
                entity.Property(x => x.AverageCost).HasPrecision(18, 6);
                entity.Property(x => x.CurrentValue).HasPrecision(18, 6);

                // Enum → string conversion for readability in DB
                entity.Property(x => x.AssetType)
                    .HasConversion<string>()
                    .HasMaxLength(40);

                // FK → Portfolio
                entity.HasOne(x => x.Portfolio)
                    .WithMany(p => p.Assets)
                    .HasForeignKey(x => x.PortfolioId)
                    .OnDelete(DeleteBehavior.Cascade);

                // Unique: same symbol+type can't appear twice in the same portfolio
                entity.HasIndex(x => new { x.PortfolioId, x.Symbol, x.AssetType })
                    .IsUnique();
            });

            // ── SubscriptionPlan ─────────────────────────────────────────────
            builder.Entity<SubscriptionPlan>(entity =>
            {
                entity.ToTable("SubscriptionPlans");
                entity.HasKey(x => x.Id);

                entity.Property(x => x.DisplayName).IsRequired().HasMaxLength(50);
                entity.Property(x => x.Description).HasMaxLength(500);
                entity.Property(x => x.MonthlyPriceTRY).HasPrecision(10, 2);
                entity.Property(x => x.YearlyPriceTRY).HasPrecision(10, 2);

                entity.Property(x => x.Tier)
                    .HasConversion<string>()
                    .HasMaxLength(20);

                entity.HasIndex(x => x.Tier).IsUnique();
            });

            // ── UserSubscription ─────────────────────────────────────────────
            builder.Entity<UserSubscription>(entity =>
            {
                entity.ToTable("UserSubscriptions");
                entity.HasKey(x => x.Id);

                entity.Property(x => x.ApplicationUserId).IsRequired().HasMaxLength(450);

                entity.Property(x => x.Status)
                    .HasConversion<string>()
                    .HasMaxLength(20);

                // 1:1 User → Subscription
                entity.HasOne<ApplicationUser>()
                    .WithOne(u => u.Subscription)
                    .HasForeignKey<UserSubscription>(x => x.ApplicationUserId)
                    .OnDelete(DeleteBehavior.Cascade);

                // FK → SubscriptionPlan
                entity.HasOne(x => x.SubscriptionPlan)
                    .WithMany()
                    .HasForeignKey(x => x.SubscriptionPlanId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(x => x.ApplicationUserId).IsUnique();
            });

            // ── EconomistClient ──────────────────────────────────────────────
            builder.Entity<EconomistClient>(entity =>
            {
                entity.ToTable("EconomistClients");
                entity.HasKey(x => x.Id);

                entity.Property(x => x.EconomistId).IsRequired().HasMaxLength(450);
                entity.Property(x => x.ClientId).IsRequired().HasMaxLength(450);
                entity.Property(x => x.Notes).HasMaxLength(500);

                // FK → ApplicationUser (Economist)
                entity.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(x => x.EconomistId)
                    .OnDelete(DeleteBehavior.Restrict);

                // FK → ApplicationUser (Client)
                entity.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(x => x.ClientId)
                    .OnDelete(DeleteBehavior.Restrict);

                // Unique active assignment per economist-client pair
                entity.HasIndex(x => new { x.EconomistId, x.ClientId })
                    .IsUnique();
            });

            // ── ConsultancyTask ──────────────────────────────────────────────
            builder.Entity<ConsultancyTask>(entity =>
            {
                entity.ToTable("ConsultancyTasks");
                entity.HasKey(x => x.Id);

                entity.Property(x => x.UserId).IsRequired().HasMaxLength(450);
                entity.Property(x => x.EconomistId).IsRequired().HasMaxLength(450);
                entity.Property(x => x.Title).IsRequired().HasMaxLength(200);
                entity.Property(x => x.Description).IsRequired().HasMaxLength(2000);

                entity.Property(x => x.Category)
                    .HasConversion<string>()
                    .HasMaxLength(40);

                entity.Property(x => x.Priority)
                    .HasConversion<string>()
                    .HasMaxLength(20);

                entity.Property(x => x.Status)
                    .HasConversion<string>()
                    .HasMaxLength(20);

                // FK → User (creator)
                entity.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Restrict);

                // FK → Economist (assignee)
                entity.HasOne<ApplicationUser>()
                    .WithMany()
                    .HasForeignKey(x => x.EconomistId)
                    .OnDelete(DeleteBehavior.Restrict);

                // Index for query optimization
                entity.HasIndex(x => x.UserId);
                entity.HasIndex(x => x.EconomistId);
                entity.HasIndex(x => x.Status);
            });

            // ── PreAnalysisReport ────────────────────────────────────────────
            builder.Entity<PreAnalysisReport>(entity =>
            {
                entity.ToTable("PreAnalysisReports");
                entity.HasKey(x => x.Id);

                entity.Property(x => x.Summary).HasMaxLength(2000);
                entity.Property(x => x.RiskLevel).HasMaxLength(20);
                entity.Property(x => x.MarketOutlook).HasMaxLength(2000);
                entity.Property(x => x.ErrorMessage).HasMaxLength(1000);
                // KeyFindings and RawContent can be large — no max length (nvarchar(max))

                // 1:1 with ConsultancyTask
                entity.HasOne(x => x.ConsultancyTask)
                    .WithOne(t => t.PreAnalysisReport)
                    .HasForeignKey<PreAnalysisReport>(x => x.ConsultancyTaskId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(x => x.ConsultancyTaskId).IsUnique();
            });

            // ── Seed: Subscription Plans ─────────────────────────────────────
            builder.Entity<SubscriptionPlan>().HasData(
                new SubscriptionPlan
                {
                    Id = 1,
                    Tier = SubscriptionTier.Default,
                    DisplayName = "Ücretsiz",
                    Description = "Temel erişim — 1 ekonomist ataması, değiştirilemez.",
                    MonthlyPriceTRY = 0m,
                    YearlyPriceTRY = 0m,
                    MaxEconomists = 1,
                    CanChangeEconomist = false,
                    HasPrioritySupport = false,
                    IsActive = true
                },
                new SubscriptionPlan
                {
                    Id = 2,
                    Tier = SubscriptionTier.Premium,
                    DisplayName = "Premium",
                    Description = "Gelişmiş erişim — 3 ekonomist, değiştirilebilir, genişletilmiş analiz.",
                    MonthlyPriceTRY = 299m,
                    YearlyPriceTRY = 2870m,
                    MaxEconomists = 3,
                    CanChangeEconomist = true,
                    HasPrioritySupport = false,
                    IsActive = true
                },
                new SubscriptionPlan
                {
                    Id = 3,
                    Tier = SubscriptionTier.Ultra,
                    DisplayName = "Ultra",
                    Description = "Sınırsız erişim — sınırsız ekonomist, öncelikli destek, tam analiz.",
                    MonthlyPriceTRY = 799m,
                    YearlyPriceTRY = 7670m,
                    MaxEconomists = 999,
                    CanChangeEconomist = true,
                    HasPrioritySupport = true,
                    IsActive = true
                }
            );

            base.OnModelCreating(builder);
        }
    }
}
