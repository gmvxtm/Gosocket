using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RequestHub.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSecuritySchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "sgr");

            migrationBuilder.CreateTable(
                name: "Users",
                schema: "sgr",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Username = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RecordCreationUser = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    RecordCreationDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RecordEditUser = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    RecordEditDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RecordStatus = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: false, defaultValue: "A")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.CheckConstraint("CK_Users_RecordStatus", "\"RecordStatus\" IN ('A', 'I')");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                schema: "sgr",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Users",
                schema: "sgr");
        }
    }
}
