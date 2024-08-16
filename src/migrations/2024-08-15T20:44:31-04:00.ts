import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("fencingToken")
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("used", "boolean", (col) => col.notNull())
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("fencingToken").execute();
}
