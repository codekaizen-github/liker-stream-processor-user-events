// Import the 'express' module
import express from 'express';
import { db } from './database';
import {
    createStreamOut,
    findStreamOutsGreaterThanStreamOutId,
    getMostRecentStreamOut,
} from './streamOutStore';
import {
    createHttpSubscriber,
    deleteHttpSubscriber,
    findHttpSubscribers,
} from './httpSubscriberStore';
import { notifySubscribers, poll, subscribe } from './subscriptions';
import { getMostRecentUpstreamControl } from './upstreamControlStore';
import { NewStreamOut } from './types';
import { createFencingToken, findFencingTokens } from './fencingTokenStore';

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
    const input = req.body;
    await db.transaction().execute(async (trx) => {
        async function createStreamOutAndNotifySubscribers(
            newStreamOut: NewStreamOut
        ) {
            // Check to see if fencingToken was provided
            const newStreamOutData = JSON.parse(newStreamOut.data);
            if (newStreamOutData.fencingToken !== undefined) {
                const incomingFencingToken = parseInt(
                    newStreamOutData.fencingToken
                );
                // If a valid fencingToken is provided, check if it exists in the database before creating a new streamOut
                if (!isNaN(incomingFencingToken)) {
                    const fencingToken = await findFencingTokens(trx, {
                        token: incomingFencingToken,
                    });
                    if (fencingToken.length > 0) {
                        // Fencing token was used already - do nothing
                        return;
                    }
                    // If the fencing token is not found, create a new fencing token
                    const token = await createFencingToken(trx, {
                        token: incomingFencingToken,
                    });
                    if (token === undefined) {
                        return res.status(500).send();
                    }
                }
            }
            const streamOut = await createStreamOut(trx, newStreamOut);
            if (streamOut === undefined) {
                return res.status(500).send();
            }
            // non-blocking
            notifySubscribers(db, streamOut);
        }
        const upstreamControl = await getMostRecentUpstreamControl(trx);
        const upstreamControlStreamInId = upstreamControl
            ? upstreamControl.streamInId
            : 0;
        if (input.id <= upstreamControlStreamInId) {
            return res.status(200).send();
        }
        if (input.id > upstreamControlStreamInId + 1) {
            if (
                process.env
                    .LIKER_STREAM_PROCESSOR_TRUTH_SAYER_UPSTREAM_URL_STREAM_OUT ===
                undefined
            ) {
                throw new Error('Upstream URL is not defined');
            }
            // Gets any stream events between last recorded event and this neweset event (if there are any). Hypothetically, there could be gaps in the streamIn IDs.
            const pollResults = await poll(
                process.env
                    .LIKER_STREAM_PROCESSOR_TRUTH_SAYER_UPSTREAM_URL_STREAM_OUT,
                upstreamControlStreamInId
            );
            if (pollResults.length === 0) {
                return res.status(404).send();
            }
            // Assumes that the upstream service will return the events in order
            for (const pollResult of pollResults) {
                await createStreamOutAndNotifySubscribers({
                    data: JSON.stringify(pollResult.data),
                });
            }
        } else {
            await createStreamOutAndNotifySubscribers({
                data: JSON.stringify(input.data),
            });
        }
        await trx.deleteFrom('upstreamControl').execute();
        await trx
            .insertInto('upstreamControl')
            .values({
                streamInId: input.id,
            })
            .execute();
    });
    return res.status(201).send();
});

app.get('/streamOut', async (req, res) => {
    // Get the query parameter 'afterId' from the request
    const afterId = Number(req.query.afterId);
    await db.transaction().execute(async (trx) => {
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

app.post('/httpSubscriber/unregister', async (req, res) => {
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
        process.env.LIKER_STREAM_PROCESSOR_TRUTH_SAYER_UPSTREAM_URL_REGISTER ===
        undefined
    ) {
        return;
    }
    if (
        process.env
            .LIKER_STREAM_PROCESSOR_TRUTH_SAYER_CALLBACK_URL_STREAM_IN ===
        undefined
    ) {
        return;
    }
    subscribe(
        process.env.LIKER_STREAM_PROCESSOR_TRUTH_SAYER_UPSTREAM_URL_REGISTER,
        process.env.LIKER_STREAM_PROCESSOR_TRUTH_SAYER_CALLBACK_URL_STREAM_IN
    );
})();

// Get the most recent log record and notify subscribers
(async () => {
    await db.transaction().execute(async (trx) => {
        const record = await getMostRecentStreamOut(trx);
        if (record === undefined) {
            return;
        }
        // non-blocking
        notifySubscribers(db, record);
    });
})();
