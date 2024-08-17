import { Kysely } from "kysely";
import { Database, LogRecord } from "./types";
import { findHttpSubscriptions } from "./httpSubscriptionStore";

export async function notifySubscriptions(
	db: Kysely<Database>,
	logRecord: LogRecord
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const subscriptions = await findHttpSubscriptions(trx, {});
		console.log(subscriptions);
		for (const subscription of subscriptions) {
			// non-blocking
			notifySubscriptionUrl(subscription.url, logRecord);
		}
	});
}

export async function notifySubscriptionUrl(
	url: string,
	logRecord: LogRecord
): Promise<void> {
	try {
		await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				logRecord,
			}),
		});
	} catch (e) {
		console.error(e);
	}
}
