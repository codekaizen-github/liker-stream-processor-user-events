// Import the 'express' module
import express from 'express';
import { createServer, IncomingMessage } from 'http';
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
import ws from 'ws';
import { findUserByEmail } from './userStore';
import { User } from './types';
export const clientsByEmail = new Map<string, ws[]>();
// Create a WebSocket server
const wsPort = 8080;
const server = createServer();
const wss = new ws.WebSocketServer({ noServer: true });
wss.on('connection', function connection(ws) {
    ws.on('message', function message(data) {
        ws.send(`received: ${data}`);
    });
    ws.send('something');
});
function onSocketError(err: Error) {
    console.error('WebSocket error:', err);
}
function authenticate(
    request: IncomingMessage,
    callback: (err: Error | null, client: User | null) => void
) {
    console.log(JSON.stringify(request));
    // Parse the url search params in request.url
    // Extract the email search param from a URL like /?email=...
    console.log({ url: request.url });
    // Dummy base URL
    const url = new URL(request.url || '', 'http://localhost');
    const searchParams = new URLSearchParams(url.search);
    console.log({ searchParams });
    const email = searchParams.get('email');
    console.log({ email });
    if (email === undefined) {
        callback(new Error('Email header not found'), null);
        return;
    }
    if (typeof email !== 'string') {
        callback(new Error('Email header is not a string'), null);
        return;
    }
    // Check to see if email is in the database
    db.transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            findUserByEmail(trx, email).then((user) => {
                if (!user) {
                    callback(new Error('User not found'), null);
                    return;
                }
                callback(null, user);
            });
        });
}
server.on('upgrade', function upgrade(request, socket, head) {
    console.log('upgrade');
    socket.on('error', onSocketError);
    // This function is not defined on purpose. Implement it with your own logic.
    authenticate(request, function next(err, client) {
        if (err || !client) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
        socket.removeListener('error', onSocketError);
        wss.handleUpgrade(request, socket, head, function done(ws) {
            clientsByEmail.set(client.email, [
                ...(clientsByEmail.get(client.email) || []),
                ws,
            ]);
            ws.on('close', () => {
                const clients = clientsByEmail.get(client.email);
                if (clients === undefined) {
                    return;
                }
                clientsByEmail.set(
                    client.email,
                    clients.filter((c) => c !== ws)
                );
            });
            wss.emit('connection', ws, request, client);
            // console.log({
            //     clientsByEmail: JSON.stringify(
            //         Array.from(clientsByEmail.entries())
            //     ),
            // });
        });
    });
});
server.listen(wsPort, () => {
    console.log(`WebSocket server is running on ws://localhost:${wsPort}`);
});
// Create an Express application
const port = 80;
const app = express();

app.use(express.json());

// Define a route for the root path ('/')
app.get('/', (req, res) => {
    // Send a response to the client
    res.send('Hello, TypeScript + Node.js + Express!');
});

app.post('/streamIn', async (req, res) => {
    console.log('Received streamIn', req.body);
    // Random delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
    try {
        await db
            .transaction()
            .setIsolationLevel('serializable')
            .execute(async (trx) => {
                try {
                    await processStreamEventInTotalOrder(trx, req.body);
                } catch (e) {
                    // Handle StreamEventIdDuplicateException and StreamEventOutOfSequenceException differently than other exceptions
                    if (e instanceof StreamEventIdDuplicateException) {
                        console.log('Duplicate event ID', req.body);
                        // If the event ID is a duplicate, we can safely ignore it
                        return res.status(200).send();
                    }
                    if (e instanceof StreamEventOutOfSequenceException) {
                        console.log('Out of sequence event ID', req.body);
                        // If the event ID is out of sequence, there is an issue with the upstream service
                        // We should stop polling and wait for the upstream service to catch up
                        if (
                            process.env
                                .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT ===
                            undefined
                        ) {
                            return;
                        }
                        // TODO - is the lock still on?
                        pollForLatest(
                            trx,
                            process.env
                                .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT
                        );
                        return res.status(201).send();
                    }
                    throw e;
                }
                return res.status(201).send();
            });
    } catch (e) {
        console.error(e, req.body);
        return res.status(500).send();
    }
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
                trx,
                process.env
                    .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT
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
            notifySubscribers(trx, record);
        });
})();
