using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinTreX.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRatingToConsultancyTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "EconomistReport",
                table: "ConsultancyTasks",
                type: "character varying(8000)",
                maxLength: 8000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RatedAtUtc",
                table: "ConsultancyTasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Rating",
                table: "ConsultancyTasks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RatingFeedback",
                table: "ConsultancyTasks",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "Description", "MaxEconomists" },
                values: new object[] { "Gelişmiş erişim — 5 portfolyo, 2 ekonomist, değiştirilebilir.", 2 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RatedAtUtc",
                table: "ConsultancyTasks");

            migrationBuilder.DropColumn(
                name: "Rating",
                table: "ConsultancyTasks");

            migrationBuilder.DropColumn(
                name: "RatingFeedback",
                table: "ConsultancyTasks");

            migrationBuilder.AlterColumn<string>(
                name: "EconomistReport",
                table: "ConsultancyTasks",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(8000)",
                oldMaxLength: 8000,
                oldNullable: true);

            migrationBuilder.UpdateData(
                table: "SubscriptionPlans",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "Description", "MaxEconomists" },
                values: new object[] { "Gelişmiş erişim — 5 portfolyo, 3 ekonomist, değiştirilebilir.", 3 });
        }
    }
}
