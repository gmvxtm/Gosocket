using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RequestHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "core");

            migrationBuilder.CreateTable(
                name: "Requests",
                schema: "core",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Payload = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RecordCreationUser = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    RecordCreationDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RecordEditUser = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    RecordEditDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RecordStatus = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: false, defaultValue: "A")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Requests", x => x.Id);
                    table.CheckConstraint("CK_Requests_RecordStatus", "\"RecordStatus\" IN ('A', 'I')");
                    table.CheckConstraint("CK_Requests_Status", "\"Status\" IN ('Pending', 'Processed', 'Failed')");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Requests_ReceivedAt",
                schema: "core",
                table: "Requests",
                column: "ReceivedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_Type",
                schema: "core",
                table: "Requests",
                column: "Type");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Requests",
                schema: "core");
        }
    }
}
