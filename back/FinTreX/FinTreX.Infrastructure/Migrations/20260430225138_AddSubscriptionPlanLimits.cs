using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinTreX.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionPlanLimits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaxDailyChatMessages",
                table: "SubscriptionPlans",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxPortfolios",
                table: "SubscriptionPlans",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "Description", "MaxDailyChatMessages", "MaxPortfolios" },
                values: new object[] { "Temel erişim — 1 portfolyo, 1 ekonomist ataması, değiştirilemez.", 10, 1 });

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "Description", "MaxDailyChatMessages", "MaxPortfolios" },
                values: new object[] { "Gelişmiş erişim — 5 portfolyo, 3 ekonomist, değiştirilebilir.", 50, 5 });

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "Description", "MaxDailyChatMessages", "MaxPortfolios" },
                values: new object[] { "Sınırsız erişim — sınırsız portfolyo, ekonomist, öncelikli destek.", 999, 999 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxDailyChatMessages",
                table: "SubscriptionPlans");

            migrationBuilder.DropColumn(
                name: "MaxPortfolios",
                table: "SubscriptionPlans");

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 1,
                column: "Description",
                value: "Temel erişim — 1 ekonomist ataması, değiştirilemez.");

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 2,
                column: "Description",
                value: "Gelişmiş erişim — 3 ekonomist, değiştirilebilir, genişletilmiş analiz.");

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 3,
                column: "Description",
                value: "Sınırsız erişim — sınırsız ekonomist, öncelikli destek, tam analiz.");
        }
    }
}
