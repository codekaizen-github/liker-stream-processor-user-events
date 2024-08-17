import { Kysely } from "kysely";
import { Database, Stream } from "./types";
import { findHttpSubscribers } from "./httpSubscriberStore";

export async function notifySubscribers(
	db: Kysely<Database>,
	stream: Stream
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const subscriptions = await findHttpSubscribers(trx, {});
		for (const subscription of subscriptions) {
			// non-blocking
			notifySubscriberUrl(subscription.url, stream);
		}
	});
}

export async function notifySubscriberUrl(
	url: string,
	stream: Stream
): Promise<void> {
	try {
		await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				stream,
			}),
		});
	} catch (e) {
		console.error(e);
	}
}

export async function subscribe(
	url: string,
	callbackUrl: string
): Promise<void> {
	try {
		await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url: callbackUrl,
			}),
		});
	} catch (e) {
		console.error(e);
	}
}
