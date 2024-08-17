import { db } from "./database";
import { StreamOutUpdate, StreamOut, NewStreamOut } from "./types";

export async function findStreamOutById(id: number) {
	return await db
		.selectFrom("streamOut")
		.where("id", "=", id)
		.selectAll()
		.executeTakeFirst();
}

export async function findStreamOuts(criteria: Partial<StreamOut>) {
	let query = db.selectFrom("streamOut");

	if (criteria.id) {
		query = query.where("id", "=", criteria.id); // Kysely is immutable, you must re-assign!
	}
	return await query.selectAll().execute();
}

export async function findStreamOutsGreaterThanStreamOutId(id: number) {
	let query = db.selectFrom("streamOut").where("id", ">", id);
	return await query.selectAll().execute();
}

export async function getMostRecentStreamOut() {
	return await db
		.selectFrom("streamOut")
		.orderBy("id", "desc")
		.limit(1)
		.selectAll()
		.executeTakeFirst();
}

export async function updateStreamOut(id: number, updateWith: StreamOutUpdate) {
	await db
		.updateTable("streamOut")
		.set(updateWith)
		.where("id", "=", id)
		.execute();
}

export async function createStreamOut(streamOut: NewStreamOut) {
	const { insertId } = await db
		.insertInto("streamOut")
		.values(streamOut)
		.executeTakeFirstOrThrow();

	return await findStreamOutById(Number(insertId!));
}

export async function deleteStreamOut(id: number) {
	const streamOut = await findStreamOutById(id);

	if (streamOut) {
		await db.deleteFrom("streamOut").where("id", "=", id).execute();
	}

	return streamOut;
}
