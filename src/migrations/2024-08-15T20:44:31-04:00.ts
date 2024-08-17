import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("streamOut")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		// Add an arbitrary JSON column
		.addColumn("data", "json", (col) => col.notNull())
		.execute();
	await db.schema
		.createTable("httpSubscriber")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("url", "text", (col) => col.notNull())
		.execute();
	await db.schema
		.createTable("upstreamControl")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("streamInId", "integer", (col) => col.notNull())
		.execute();
	// await db.schema
	// 	.createTable("fencingToken")
	// 	.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
	// 	.addColumn("token", "text", (col) => col.notNull())
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("streamOut").execute();
	await db.schema.dropTable("httpSubscriber").execute();
	await db.schema.dropTable("upstreamControl").execute();
}
