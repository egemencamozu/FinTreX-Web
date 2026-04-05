using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinTreX.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateSubscriptionPlanFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FeaturesJson",
                table: "SubscriptionPlans",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 1,
                column: "FeaturesJson",
                value: null);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 2,
                column: "FeaturesJson",
                value: null);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 3,
                column: "FeaturesJson",
                value: null);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FeaturesJson",
                table: "SubscriptionPlans");
        }
    }
}
