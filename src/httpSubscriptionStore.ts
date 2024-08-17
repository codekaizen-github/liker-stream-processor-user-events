import { Transaction } from "kysely";
import { db } from "./database";
import {
	HttpSubscriptionUpdate,
	HttpSubscription,
	NewHttpSubscription,
	Database,
} from "./types";

export async function findHttpSubscriptionById(
	trx: Transaction<Database>,
	id: number
) {
	return await trx
		.selectFrom("httpSubscription")
		.where("id", "=", id)
		.selectAll()
		.executeTakeFirst();
}

export async function findHttpSubscriptions(
	trx: Transaction<Database>,
	criteria: Partial<HttpSubscription>
) {
	let query = trx.selectFrom("httpSubscription");

	if (criteria.id) {
		query = query.where("id", "=", criteria.id); // Kysely is immutable, you must re-assign!
	}

	if (criteria.url) {
		query = query.where("url", "=", criteria.url); // Kysely is immutable, you must re-assign!
	}

	return await query.selectAll().execute();
}

export async function updateHttpSubscription(
	trx: Transaction<Database>,
	id: number,
	updateWith: HttpSubscriptionUpdate
) {
	await db
		.updateTable("httpSubscription")
		.set(updateWith)
		.where("id", "=", id)
		.execute();
}

export async function createHttpSubscription(
	trx: Transaction<Database>,
	httpSubscription: NewHttpSubscription
) {
	const { insertId } = await db
		.insertInto("httpSubscription")
		.values(httpSubscription)
		.executeTakeFirstOrThrow();

	return await findHttpSubscriptionById(trx, Number(insertId!));
}

export async function deleteHttpSubscription(
	trx: Transaction<Database>,
	id: number
) {
	const httpSubscription = await findHttpSubscriptionById(trx, id);

	if (httpSubscription) {
		await db.deleteFrom("httpSubscription").where("id", "=", id).execute();
	}

	return httpSubscription;
}
