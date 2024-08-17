import { db } from "./database";
import { LogRecordUpdate, LogRecord, NewLogRecord } from "./types";

export async function findLogRecordById(id: number) {
	return await db
		.selectFrom("logRecord")
		.where("id", "=", id)
		.selectAll()
		.executeTakeFirst();
}

export async function findLogRecords(criteria: Partial<LogRecord>) {
	let query = db.selectFrom("logRecord");

	if (criteria.id) {
		query = query.where("id", "=", criteria.id); // Kysely is immutable, you must re-assign!
	}
	return await query.selectAll().execute();
}

export async function findLogRecordsGreaterThanLogRecordId(id: number) {
	let query = db.selectFrom("logRecord").where("id", ">", id);
	return await query.selectAll().execute();
}

export async function getMostRecentLogRecord() {
	return await db
		.selectFrom("logRecord")
		.orderBy("id", "desc")
		.limit(1)
		.selectAll()
		.executeTakeFirst();
}

export async function updateLogRecord(id: number, updateWith: LogRecordUpdate) {
	await db
		.updateTable("logRecord")
		.set(updateWith)
		.where("id", "=", id)
		.execute();
}

export async function createLogRecord(logRecord: NewLogRecord) {
	const { insertId } = await db
		.insertInto("logRecord")
		.values(logRecord)
		.executeTakeFirstOrThrow();

	return await findLogRecordById(Number(insertId!));
}

export async function deleteLogRecord(id: number) {
	const logRecord = await findLogRecordById(id);

	if (logRecord) {
		await db.deleteFrom("logRecord").where("id", "=", id).execute();
	}

	return logRecord;
}
