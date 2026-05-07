using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FinTreX.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEconomistApplications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EconomistStatus",
                table: "AspNetUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "EconomistApplications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ApplicantUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Biography = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    YearsOfExperience = table.Column<int>(type: "integer", nullable: false),
                    Education = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ExpertiseAreas = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AdminDecisionNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ReviewedByAdminId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    SubmittedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EconomistApplications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EconomistApplications_AspNetUsers_ApplicantUserId",
                        column: x => x.ApplicantUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EconomistApplicationDocuments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EconomistApplicationId = table.Column<int>(type: "integer", nullable: false),
                    DocumentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    UploadedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EconomistApplicationDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EconomistApplicationDocuments_EconomistApplications_Economi~",
                        column: x => x.EconomistApplicationId,
                        principalTable: "EconomistApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EconomistApplicationLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EconomistApplicationId = table.Column<int>(type: "integer", nullable: false),
                    Platform = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EconomistApplicationLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EconomistApplicationLinks_EconomistApplications_EconomistAp~",
                        column: x => x.EconomistApplicationId,
                        principalTable: "EconomistApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EconomistApplicationDocuments_EconomistApplicationId",
                table: "EconomistApplicationDocuments",
                column: "EconomistApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_EconomistApplicationLinks_EconomistApplicationId",
                table: "EconomistApplicationLinks",
                column: "EconomistApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_EconomistApplications_ApplicantUserId",
                table: "EconomistApplications",
                column: "ApplicantUserId");

            migrationBuilder.CreateIndex(
                name: "IX_EconomistApplications_Status",
                table: "EconomistApplications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_EconomistApplications_SubmittedAtUtc",
                table: "EconomistApplications",
                column: "SubmittedAtUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EconomistApplicationDocuments");

            migrationBuilder.DropTable(
                name: "EconomistApplicationLinks");

            migrationBuilder.DropTable(
                name: "EconomistApplications");

            migrationBuilder.DropColumn(
                name: "EconomistStatus",
                table: "AspNetUsers");
        }
    }
}
