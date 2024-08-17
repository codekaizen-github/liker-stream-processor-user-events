// Import the 'express' module
import express from "express";
import { env } from "process";
import { db } from "./database";
import {
	createStream,
	findStreamsGreaterThanStreamId,
	getMostRecentStream,
} from "./streamStore";
import {
	createHttpSubscriber,
	deleteHttpSubscriber,
	findHttpSubscribers,
} from "./httpSubscriberStore";
import { notifySubscribers, subscribe } from "./subscriptions";

// Create an Express application
const app = express();

// Set the port number for the server
const port = 80;

app.use(express.json());

// Define a route for the root path ('/')
app.get("/", (req, res) => {
	// Send a response to the client
	res.send("Hello, TypeScript + Node.js + Express!");
});

app.get("/fencingToken", async (req, res) => {
	const result = await createStream({
		data: JSON.stringify({ type: "fencing-token-requested" }),
	});
	if (result === undefined) {
		return res.status(500).send();
	}
	return res.json({
		fencingToken: result.id,
	});
});

app.post("/stream", async (req, res) => {
	const insertData = {
		data: JSON.stringify(req.body.data),
	};
	const result = await createStream(insertData);
	if (result === undefined) {
		return res.status(500).send();
	}
	// non-blocking
	notifySubscribers(db, result);
	return res.status(201).send();
});

app.get("/stream", async (req, res) => {
	// Get the query parameter 'afterId' from the request
	const afterId = Number(req.query.afterId);
	// Find all log records with an ID greater than 'afterId'
	const records = await findStreamsGreaterThanStreamId(afterId);
	// Send the records to the client
	return res.json(records);
});

app.post("/httpSubscriber/register", async (req, res) => {
	await db.transaction().execute(async (trx) => {
		const existing = await findHttpSubscribers(trx, {
			url: req.body.url,
		});
		if (existing.length > 0) {
			return res.status(200).send();
		}
		const result = createHttpSubscriber(trx, req.body);
		return res.status(201).send();
	});
});

app.post("/httpSubscriber/unregister", async (req, res) => {
	await db.transaction().execute(async (trx) => {
		const existing = await findHttpSubscribers(trx, {
			url: req.body.url,
		});
		if (existing.length > 0) {
			// delete
			for (const subscription of existing) {
				await deleteHttpSubscriber(trx, subscription.id);
			}
			return res.status(200).send();
		}
		return res.status(404).send();
	});
});

// Start the server and listen on the specified port
app.listen(port, () => {
	// Log a message when the server is successfully running
	console.log(`Server is running on http://localhost:${port}`);
});

// Subscribe
(async () => {
	if (
		process.env
			.LIKER_STREAM_PROCESSOR_DEDUPLICATOR_UPSTREAM_URL_REGISTER ===
		undefined
	) {
		return;
	}
	if (
		process.env
			.LIKER_STREAM_PROCESSOR_DEDUPLICATOR_SELF_CALLBACK_URL_STREAM ===
		undefined
	) {
		return;
	}
	subscribe(
		process.env.LIKER_STREAM_PROCESSOR_DEDUPLICATOR_UPSTREAM_URL_REGISTER,
		process.env.LIKER_STREAM_PROCESSOR_DEDUPLICATOR_SELF_CALLBACK_URL_STREAM
	);
})();

// Get the most recent log record and notify subscribers
(async () => {
	const record = await getMostRecentStream();
	if (record === undefined) {
		return;
	}
	// non-blocking
	notifySubscribers(db, record);
})();
