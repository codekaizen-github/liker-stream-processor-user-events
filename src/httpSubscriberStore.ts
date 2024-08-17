import { Transaction } from "kysely";
import { db } from "./database";
import {
	HttpSubscriptionUpdate,
	HttpSubscription,
	NewHttpSubscription,
	Database,
} from "./types";

export async function findHttpSubscriberById(
	trx: Transaction<Database>,
	id: number
) {
	return await trx
		.selectFrom("httpSubscriber")
		.where("id", "=", id)
		.selectAll()
		.executeTakeFirst();
}

export async function findHttpSubscribers(
	trx: Transaction<Database>,
	criteria: Partial<HttpSubscription>
) {
	let query = trx.selectFrom("httpSubscriber");

	if (criteria.id) {
		query = query.where("id", "=", criteria.id); // Kysely is immutable, you must re-assign!
	}

	if (criteria.url) {
		query = query.where("url", "=", criteria.url); // Kysely is immutable, you must re-assign!
	}

	return await query.selectAll().execute();
}

export async function updateHttpSubscribers(
	trx: Transaction<Database>,
	id: number,
	updateWith: HttpSubscriptionUpdate
) {
	await db
		.updateTable("httpSubscriber")
		.set(updateWith)
		.where("id", "=", id)
		.execute();
}

export async function createHttpSubscriber(
	trx: Transaction<Database>,
	httpSubscriber: NewHttpSubscription
) {
	const { insertId } = await db
		.insertInto("httpSubscriber")
		.values(httpSubscriber)
		.executeTakeFirstOrThrow();

	return await findHttpSubscriberById(trx, Number(insertId!));
}

export async function deleteHttpSubscriber(
	trx: Transaction<Database>,
	id: number
) {
	const httpSubscriber = await findHttpSubscriberById(trx, id);

	if (httpSubscriber) {
		await db.deleteFrom("httpSubscriber").where("id", "=", id).execute();
	}

	return httpSubscriber;
}
