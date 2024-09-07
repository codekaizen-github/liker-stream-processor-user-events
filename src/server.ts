// Import the 'express' module
import express from 'express';
import { createServer, IncomingMessage } from 'http';
import { db } from './database';
import ws from 'ws';
import { findUserByEmail } from './userStore';
import { User } from './types';
export const clientsByEmail = new Map<string, ws[]>();
import cors from 'cors';
import { findUserEventsGreaterThanUserEventId } from './userEventStore';
import { buildFetchUpstream } from './transmissionControl/buildFetchUpstream';
import { subscribe } from './subscribe';
import { syncUpstream } from './transmissionControl/syncUpstream';
import { getMostRecentTotallyOrderedStreamEvent } from './getMostRecentTotallyOrderedStreamEvent';
import { notifySubscribers } from './transmissionControl/notifySubscribers';
import onEvent from './transmissionControl/onEvent';

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

app.post('/streamOut', async (req, res) => {
    try {
        if (
            process.env
                .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT ===
            undefined
        ) {
            throw new Error('Upstream URL is not defined');
        }
        await onEvent(
            req.body,
            buildFetchUpstream(
                process.env
                    .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT
            )
        );
    } catch (e) {
        console.error(e);
        return res.status(500).send();
    }
    return res.status(201).send();
});

app.get('/userEvent', async (req, res) => {
    // Get the user email from the query parameters
    const email = req.query.email;
    if (email === undefined) {
        return res.status(400).send();
    }
    // Get the query parameter 'afterId' from the request
    const afterId = Number(req.query.afterId);
    if (isNaN(afterId)) {
        return res.status(400).send();
    }
    // Get the user with the specified email
    await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            const user = await findUserByEmail(trx, email.toString());
            if (user === undefined) {
                return res.status(404).send();
            }
            // Get the events for the user
            const records = await findUserEventsGreaterThanUserEventId(
                trx,
                user.id,
                afterId
            );
            return res.json(records);
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
    try {
        if (
            process.env
                .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT ===
            undefined
        ) {
            return;
        }
        const fetchUpstream = buildFetchUpstream(
            process.env
                .LIKER_STREAM_PROCESSOR_USER_EVENTS_UPSTREAM_URL_STREAM_OUT
        );
        await syncUpstream(fetchUpstream);
    } catch (e) {
        console.error(e);
    }
})();

// Get the most recent log record and notify subscribers
// TODO Fix so that we push most recent events for each unique websocket/client
// (async () => {
//     const result = await getMostRecentTotallyOrderedStreamEvent();
//     if (result === undefined) {
//         return;
//     }
//     // non-blocking
//     notifySubscribers(result);
// })();
