// Import the 'express' module
import express from "express";
import { env } from "process";
import { db } from "./database";
import {
	createLogRecord,
	findLogRecordsGreaterThanLogRecordId,
	getMostRecentLogRecord,
} from "./logRecordStore";
import {
	createHttpSubscription,
	deleteHttpSubscription,
	findHttpSubscriptions,
} from "./httpSubscriptionStore";
import { notifySubscriptions } from "./notifications";

// Create an Express application
const app = express();

// Set the port number for the server
const port = 80;
console.log(env.LIKER_EVENT_LOG_DB_HOSTNAME);

app.use(express.json());

// Define a route for the root path ('/')
app.get("/", (req, res) => {
	// Send a response to the client
	res.send("Hello, TypeScript + Node.js + Express!");
});

app.get("/fencingToken", async (req, res) => {
	const result = await createLogRecord({
		data: JSON.stringify({ type: "fencing-token-requested" }),
	});
	if (result === undefined) {
		return res.status(500).send();
	}
	return res.json({
		fencingToken: result.id,
	});
});

app.post("/logRecord", async (req, res) => {
	const insertData = {
		data: JSON.stringify(req.body.data),
	};
	const result = await createLogRecord(insertData);
	if (result === undefined) {
		return res.status(500).send();
	}
	// non-blocking
	notifySubscriptions(db, result);
	return res.status(201).send();
});

app.get("/logRecord", async (req, res) => {
	// Get the query parameter 'afterId' from the request
	const afterId = Number(req.query.afterId);
	// Find all log records with an ID greater than 'afterId'
	const records = await findLogRecordsGreaterThanLogRecordId(afterId);
	// Send the records to the client
	return res.json(records);
});

app.post("/httpSubscription/register", async (req, res) => {
	await db.transaction().execute(async (trx) => {
		const existing = await findHttpSubscriptions(trx, {
			url: req.body.url,
		});
		if (existing.length > 0) {
			return res.status(200).send();
		}
		const result = createHttpSubscription(trx, req.body);
		return res.status(201).send();
	});
});

app.post("/httpSubscription/unregister", async (req, res) => {
	await db.transaction().execute(async (trx) => {
		const existing = await findHttpSubscriptions(trx, {
			url: req.body.url,
		});
		if (existing.length > 0) {
			// delete
			for (const subscription of existing) {
				await deleteHttpSubscription(trx, subscription.id);
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

// Get the most recent log record and notify subscribers
(async () => {
	const record = await getMostRecentLogRecord();
	if (record === undefined) {
		return;
	}
	// non-blocking
	notifySubscriptions(db, record);
})();
