import { db } from "./database";
import { StreamUpdate, Stream, NewStream } from "./types";

export async function findStreamById(id: number) {
	return await db
		.selectFrom("stream")
		.where("id", "=", id)
		.selectAll()
		.executeTakeFirst();
}

export async function findStreams(criteria: Partial<Stream>) {
	let query = db.selectFrom("stream");

	if (criteria.id) {
		query = query.where("id", "=", criteria.id); // Kysely is immutable, you must re-assign!
	}
	return await query.selectAll().execute();
}

export async function findStreamsGreaterThanStreamId(id: number) {
	let query = db.selectFrom("stream").where("id", ">", id);
	return await query.selectAll().execute();
}

export async function getMostRecentStream() {
	return await db
		.selectFrom("stream")
		.orderBy("id", "desc")
		.limit(1)
		.selectAll()
		.executeTakeFirst();
}

export async function updateStream(id: number, updateWith: StreamUpdate) {
	await db
		.updateTable("stream")
		.set(updateWith)
		.where("id", "=", id)
		.execute();
}

export async function createStream(stream: NewStream) {
	const { insertId } = await db
		.insertInto("stream")
		.values(stream)
		.executeTakeFirstOrThrow();

	return await findStreamById(Number(insertId!));
}

export async function deleteStream(id: number) {
	const stream = await findStreamById(id);

	if (stream) {
		await db.deleteFrom("stream").where("id", "=", id).execute();
	}

	return stream;
}
