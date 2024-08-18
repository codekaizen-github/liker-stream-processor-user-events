import { Transaction } from "kysely";
import { FencingTokenUpdate, FencingToken, NewFencingToken, Database } from "./types";

export async function findFencingTokenById(
	trx: Transaction<Database>,
	id: number
) {
	return await trx
		.selectFrom("fencingToken")
		.where("id", "=", id)
		.selectAll()
		.executeTakeFirst();
}

export async function findFencingTokens(
	trx: Transaction<Database>,
	criteria: Partial<FencingToken>
) {
	let query = trx.selectFrom("fencingToken");

	if (criteria.id) {
		query = query.where("id", "=", criteria.id); // Kysely is immutable, you must re-assign!
	}
	return await query.selectAll().execute();
}

export async function findFencingTokensGreaterThanFencingTokenId(
	trx: Transaction<Database>,
	id: number
) {
	let query = trx.selectFrom("fencingToken").where("id", ">", id);
	return await query.selectAll().execute();
}

export async function getMostRecentFencingToken(trx: Transaction<Database>) {
	return await trx
		.selectFrom("fencingToken")
		.orderBy("id", "desc")
		.limit(1)
		.selectAll()
		.executeTakeFirst();
}

export async function updateFencingToken(
	trx: Transaction<Database>,
	id: number,
	updateWith: FencingTokenUpdate
) {
	await trx
		.updateTable("fencingToken")
		.set(updateWith)
		.where("id", "=", id)
		.execute();
}

export async function createFencingToken(
	trx: Transaction<Database>,
	fencingToken: NewFencingToken
) {
	const { insertId } = await trx
		.insertInto("fencingToken")
		.values(fencingToken)
		.executeTakeFirstOrThrow();

	return await findFencingTokenById(trx, Number(insertId!));
}

export async function deleteFencingToken(trx: Transaction<Database>, id: number) {
	const fencingToken = await findFencingTokenById(trx, id);

	if (fencingToken) {
		await trx.deleteFrom("fencingToken").where("id", "=", id).execute();
	}

	return fencingToken;
}
