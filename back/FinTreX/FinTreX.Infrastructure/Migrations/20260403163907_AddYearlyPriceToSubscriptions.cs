using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinTreX.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddYearlyPriceToSubscriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "YearlyPriceTRY",
                table: "SubscriptionPlans",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 1,
                column: "YearlyPriceTRY",
                value: 0m);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "MonthlyPriceTRY", "YearlyPriceTRY" },
                values: new object[] { 299m, 2870m });

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "MonthlyPriceTRY", "YearlyPriceTRY" },
                values: new object[] { 799m, 7670m });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "YearlyPriceTRY",
                table: "SubscriptionPlans");

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 2,
                column: "MonthlyPriceTRY",
                value: 49.99m);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 3,
                column: "MonthlyPriceTRY",
                value: 149.99m);
        }
    }
}
