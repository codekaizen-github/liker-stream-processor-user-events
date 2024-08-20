// Import the 'express' module
import express from 'express';
import { db } from './database';
import {
    findStreamOutsGreaterThanStreamOutId,
    getMostRecentStreamOut,
} from './streamOutStore';
import {
    createHttpSubscriber,
    deleteHttpSubscriber,
    findHttpSubscribers,
} from './httpSubscriberStore';
import {
    notifySubscribers,
    pollForLatest,
    processStreamEventInTotalOrder,
    subscribe,
} from './subscriptions';
import {
    StreamEventIdDuplicateException,
    StreamEventOutOfSequenceException,
} from './exceptions';
import { url } from 'inspector';

// Create an Express application
const app = express();

// Set the port number for the server
const port = 80;

app.use(express.json());

// Define a route for the root path ('/')
app.get('/', (req, res) => {
    // Send a response to the client
    res.send('Hello, TypeScript + Node.js + Express!');
});

app.post('/streamIn', async (req, res) => {
    /*
	    {
        "id": 1,
        "data": {
            "type": "test",
            "payload": {
                "key": "value"
            }
        }
    }
	*/
    const newStreamEvent = req.body;
    await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            try {
                await processStreamEventInTotalOrder(newStreamEvent, db, trx);
            } catch (e) {
                console.log('error caught at streamIn function', e);
                // Handle StreamEventIdDuplicateException and StreamEventOutOfSequenceException differently than other exceptions
                if (e instanceof StreamEventIdDuplicateException) {
                    // If the event ID is a duplicate, we can safely ignore it
                    return res.status(200).send();
                }
                if (e instanceof StreamEventOutOfSequenceException) {
                    console.log(
                        'handling StreamEventOutOfSequenceException gracefully'
                    );
                    // If the event ID is out of sequence, there is an issue with the upstream service
                    // We should stop polling and wait for the upstream service to catch up
                    if (
                        process.env
                            .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT ===
                        undefined
                    ) {
                        return;
                    }
                    pollForLatest(
                        process.env
                            .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT,
                        db,
                        trx
                    );
                    return res.status(200).send();
                }
                throw e;
            }
            return res.status(201).send();
        });
});

app.get('/streamOut', async (req, res) => {
    // Get the query parameter 'afterId' from the request
    const afterId = Number(req.query.afterId);
    await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            const records = await findStreamOutsGreaterThanStreamOutId(
                trx,
                afterId
            );
            return res.json(records);
        });
    // Find all log records with an ID greater than 'afterId'
    // Send the records to the client
});

app.post('/httpSubscriber/register', async (req, res) => {
    await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
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

app.post('/httpSubscriber/unregister', async (req, res) => {
    await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
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
        process.env.LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_REGISTER ===
        undefined
    ) {
        return;
    }
    if (
        process.env
            .LIKER_STREAM_PROCESSOR_USER_EVENTS_CALLBACK_URL_STREAM_IN ===
        undefined
    ) {
        return;
    }
    subscribe(
        process.env.LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_REGISTER,
        process.env.LIKER_STREAM_PROCESSOR_USER_EVENTS_CALLBACK_URL_STREAM_IN
    );
})();

// Poll for the latest log records
(async () => {
    await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            if (
                process.env
                    .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT ===
                undefined
            ) {
                return;
            }
            await pollForLatest(
                process.env
                    .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT,
                db,
                trx
            );
        });
})();

// Get the most recent log record and notify subscribers
(async () => {
    await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            const record = await getMostRecentStreamOut(trx);
            if (record === undefined) {
                return;
            }
            // non-blocking
            notifySubscribers(db, record);
        });
})();
