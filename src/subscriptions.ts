import { Kysely } from "kysely";
import { Database, StreamOut } from "./types";
import { findHttpSubscribers } from "./httpSubscriberStore";

export async function notifySubscribers(
	db: Kysely<Database>,
	streamOut: StreamOut
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const subscriptions = await findHttpSubscribers(trx, {});
		for (const subscription of subscriptions) {
			// non-blocking
			notifySubscriberUrl(subscription.url, streamOut);
		}
	});
}

export async function notifySubscriberUrl(
	url: string,
	streamOut: StreamOut
): Promise<void> {
	try {
		await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(streamOut),
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
		const response = await fetch(url, {
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
