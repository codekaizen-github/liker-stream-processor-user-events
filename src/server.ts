// Import the 'express' module
import express from 'express';
import { createServer, IncomingMessage } from 'http';
import { db } from './database';
import ws from 'ws';
import { findUserByEmail } from './userStore';
import { User } from './types';
export const clientsByEmail = new Map<string, ws[]>();
import cors from 'cors';
import onEvent from './transmissionControl/onEvent';
import { buildFetchUpstream } from './transmissionControl/buildFetchUpstream';
import { subscribe } from './subscribe';
import { notifySubscribers } from './transmissionControl/notifySubscribers';
import { getUpstreamControl } from './getUpstreamControl';
import { StreamEventOutOfSequenceException } from './transmissionControl/exceptions';
import { TotallyOrderedStreamEvent } from './transmissionControl/types';
import { getMaterializedViewForUser } from './getMaterializedViewForUser';

if (
    undefined ==
    process.env.LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT
) {
    throw new Error('Undefined upstream URL');
}
const fetchUpstreamFunc = buildFetchUpstream(
    process.env.LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT
);
// Create a WebSocket server
const wsPort = 8080;
const server = createServer();
const wss = new ws.WebSocketServer({ noServer: true });
wss.on('connection', function connection(ws) {
    ws.on('message', function message(data) {
        // ws.send(`received: ${data}`);
    });
    // ws.send('something');
});
function onSocketError(err: Error) {
    console.error('WebSocket error:', err);
}
function authenticate(
    request: IncomingMessage,
    callback: (err: Error | null, client: User | null) => void
) {
    // console.log(JSON.stringify(request));
    // Parse the url search params in request.url
    // Extract the email search param from a URL like /?email=...
    // console.log({ url: request.url });
    // Dummy base URL
    const url = new URL(request.url || '', 'http://localhost');
    const searchParams = new URLSearchParams(url.search);
    // console.log({ searchParams });
    const email = searchParams.get('email');
    // console.log({ email });
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
// Create an Express application
const app = express();

app.use(
    cors({
        origin: '*',
    })
);
app.use(express.json());

// Define a route for the root path ('/')
app.get('/', (req, res) => {
    // Send a response to the client
    res.send('Hello, TypeScript + Node.js + Express!');
});

app.post('/streamIn', async (req, res) => {
    if (!Array.isArray(req.body.events)) {
        return res.status(400).send();
    }
    if (isNaN(Number(req.body.totalOrderId))) {
        return res.status(400).send();
    }
    const totalOrderId: number = req.body.totalOrderId;
    const events: TotallyOrderedStreamEvent[] = req.body.events;
    try {
        await onEvent(events, totalOrderId);
    } catch (e) {
        if (e instanceof StreamEventOutOfSequenceException) {
            try {
                const upstreamControl = await getUpstreamControl();
                const responseBody = await fetchUpstreamFunc(
                    totalOrderId,
                    upstreamControl?.streamId ?? 0
                );
                await onEvent(responseBody.events, responseBody.totalOrderId);
            } catch (e) {
                return res.status(500).send();
            }
        }
        return res.status(500).send();
    }
    return res.status(201).send();
});

app.get('/streamOut', async (req, res) => {
    // Get the user email from the query parameters
    const email = req.query.email;
    if (email === undefined) {
        return res.status(400).send();
    }
    // Ignore
    let totalOrderId = !isNaN(Number(req.query.totalOrderId))
        ? Number(req.query.totalOrderId)
        : undefined;
    let eventIdStart = !isNaN(Number(req.query.eventIdStart))
        ? Number(req.query.eventIdStart)
        : undefined;
    let eventIdEnd = !isNaN(Number(req.query.eventIdEnd))
        ? Number(req.query.eventIdEnd)
        : undefined;
    let limit = !isNaN(Number(req.query.limit))
        ? Number(req.query.limit)
        : undefined;
    let offset = !isNaN(Number(req.query.offset))
        ? Number(req.query.offset)
        : undefined;
    // Get the upstreamControl
    const upstreamControl = await getUpstreamControl();
    // Make sure that our replica is up to date
    if (
        totalOrderId !== undefined &&
        (upstreamControl?.totalOrderId ?? 0) < totalOrderId
    ) {
        const responseBody = await fetchUpstreamFunc(
            totalOrderId,
            upstreamControl?.streamId ?? 0
        );
        totalOrderId = responseBody.totalOrderId;
        await onEvent(responseBody.events, responseBody.totalOrderId);
    }
    await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            const user = await findUserByEmail(trx, email.toString());
            if (user === undefined) {
                return res.status(404).send();
            }
            // Get our materialized view
            // const materializedView = await findUserMaterializedViewByUserId(
            //     trx,
            //     user.id
            // );
            const materializedView = await getMaterializedViewForUser(
                trx,
                user.id
            );
            if (undefined === materializedView) {
                return res.status(404).send();
            }
            return res.json({
                totalOrderId: upstreamControl?.totalOrderId ?? 0,
                materializedView: materializedView,
            });
        });
    // Find all log records with an ID greater than 'afterId'
    // Send the records to the client
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
    try {
        const upstreamControl = await getUpstreamControl();
        const responseBody = await fetchUpstreamFunc(
            upstreamControl?.totalOrderId ?? 0,
            upstreamControl?.streamId ?? 0
        );
        await onEvent(responseBody.events, responseBody.totalOrderId);
    } catch (e) {
        console.error(e);
    }
})();

// Get the most recent log record and notify subscribers
(async () => {
    // non-blocking
    notifySubscribers();
})();
