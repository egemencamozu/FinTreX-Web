using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinTreX.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEconomistApplicationNewFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CurrentTitle",
                table: "EconomistApplications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Institution",
                table: "EconomistApplications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LicensesAndCertificates",
                table: "EconomistApplications",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CurrentTitle",
                table: "EconomistApplications");

            migrationBuilder.DropColumn(
                name: "Institution",
                table: "EconomistApplications");

            migrationBuilder.DropColumn(
                name: "LicensesAndCertificates",
                table: "EconomistApplications");
        }
    }
}
