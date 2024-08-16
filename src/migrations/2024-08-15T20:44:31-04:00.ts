import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("logRecord")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        // Add an arbitrary JSON column
        .addColumn("data", "json")
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("logRecord").execute();
}
