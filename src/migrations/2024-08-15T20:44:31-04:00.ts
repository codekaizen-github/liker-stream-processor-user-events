import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("stream")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		// Add an arbitrary JSON column
		.addColumn("data", "json", (col) => col.notNull())
		.execute();
	await db.schema
		.createTable("httpSubscriber")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("url", "text", (col) => col.notNull())
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("stream").execute();
	await db.schema.dropTable("httpSubscriber").execute();
}
