using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RequestHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReferenceAndLogSchemas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "cnfg");

            migrationBuilder.EnsureSchema(
                name: "log");

            migrationBuilder.CreateTable(
                name: "RequestTypes",
                schema: "cnfg",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    RecordCreationUser = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    RecordCreationDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RecordEditUser = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    RecordEditDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RecordStatus = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: false, defaultValue: "A")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestTypes", x => x.Id);
                    table.UniqueConstraint("AK_RequestTypes_Code", x => x.Code);
                    table.CheckConstraint("CK_RequestTypes_RecordStatus", "\"RecordStatus\" IN ('A', 'I')");
                });

            migrationBuilder.CreateTable(
                name: "SyncIssues",
                schema: "log",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: true),
                    IssueType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SyncIssues", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RequestTypes_Code",
                schema: "cnfg",
                table: "RequestTypes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SyncIssues_CreatedAt",
                schema: "log",
                table: "SyncIssues",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_SyncIssues_IssueType",
                schema: "log",
                table: "SyncIssues",
                column: "IssueType");

            migrationBuilder.CreateIndex(
                name: "IX_SyncIssues_RequestId",
                schema: "log",
                table: "SyncIssues",
                column: "RequestId");

            migrationBuilder.Sql("""
                INSERT INTO cnfg."RequestTypes"
                    ("Id", "Code", "Name", "RecordCreationUser", "RecordCreationDate", "RecordStatus")
                SELECT gen_random_uuid(), source."Type", source."Type", 'MIGRATION', NOW(), 'A'
                FROM (
                    SELECT DISTINCT "Type"
                    FROM core."Requests"
                    WHERE "Type" IS NOT NULL AND LENGTH(TRIM("Type")) > 0
                ) AS source
                ON CONFLICT ("Code") DO NOTHING;
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_RequestTypes_Type",
                schema: "core",
                table: "Requests",
                column: "Type",
                principalSchema: "cnfg",
                principalTable: "RequestTypes",
                principalColumn: "Code",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Requests_RequestTypes_Type",
                schema: "core",
                table: "Requests");

            migrationBuilder.DropTable(
                name: "RequestTypes",
                schema: "cnfg");

            migrationBuilder.DropTable(
                name: "SyncIssues",
                schema: "log");
        }
    }
}
