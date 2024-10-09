// Import the 'express' module
import express from 'express';
import expressWs from 'express-ws';
import { IncomingMessage } from 'http';
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

const port = 80;
const { app, getWss, applyTo } = expressWs(express());

app.use(
    cors({
        // origin: '*',
        origin: [/(.+)?codekaizen\.net(:[0-9]+)?$/],
        credentials: true,
        optionsSuccessStatus: 200,
    })
);
app.use(express.json());

// https://stackoverflow.com/questions/46531934/express-ws-alternative-in-typescript
const router = express.Router() as expressWs.Router;

function authenticate(
    email: string,
    callback: (err: Error | null, client: User | null) => void
) {
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

router.ws('/', function (ws, req) {
    console.log('receiving a ws!');
    const email = req.headers['x-email'];
    console.log({ email });
    if (email === undefined || typeof email !== 'string') {
        console.log('error authenticating, closing socket');
        ws.close();
        return;
    }
    authenticate(email, (err, client) => {
        if (err || null === client) {
            console.log('error authenticating, closing socket');
            ws.close();
            return;
        }
        const clients = clientsByEmail.get(client.email);
        if (clients === undefined) {
            return;
        }
        clientsByEmail.set(client.email, [
            ...(clientsByEmail.get(client.email) || []),
            ws,
        ]);
    });
    ws.on('upgrade', function (request: IncomingMessage) {
        console.log('upgrading');
    });
    ws.on('open', function (request: IncomingMessage) {
        console.log('opening');
    });
    ws.on('error', function (request: IncomingMessage) {
        console.log('erroring');
    });
    ws.on('close', function (request: IncomingMessage) {
        console.log('closing');
        const clients = clientsByEmail.get(email);
        if (clients === undefined) {
            return;
        }
        clientsByEmail.set(
            email,
            clients.filter((c) => c !== ws)
        );
    });
    ws.on('message', function message(data) {
        console.log(`received: ${data}`);
    });
    console.log('something');
});
app.use('/ws', router);

// Define a route for the root path ('/')
app.get('/', (req, res) => {
    // Send a response to the client
    res.send('Hello, TypeScript + Node.js + Express!');
});

app.get('/userFencingToken', async (req, res) => {
    const email = req.query?.email;
    if (email === undefined) {
        return res.status(400).send();
    }
    const fencingTokens: number[] =
        req.query?.fencingTokens === undefined
            ? []
            : req.query?.fencingTokens
                  ?.toString()
                  .split(',')
                  .map(Number)
                  .filter((t) => !isNaN(t));
    const totalOrderId = !isNaN(Number(req.query.totalOrderId))
        ? Number(req.query.totalOrderId)
        : undefined;
    const results = await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            const user = await findUserByEmail(trx, email.toString());
            if (user === undefined) {
                return res.status(404).send();
            }
            let query = trx
                .selectFrom('userFencingToken')
                .where('userId', '=', user.id);
            if (totalOrderId !== undefined) {
                query = query.where('totalOrderId', '<=', totalOrderId);
            }
            if (fencingTokens.length > 0) {
                query = query.where('fencingToken', 'in', fencingTokens);
            }
            const userFencingTokensUpToTotalOrder = await query
                .selectAll()
                .execute();
            return userFencingTokensUpToTotalOrder;
        });
    return res.json(results);
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

app.get('/userView', async (req, res) => {
    console.log({referer: req.headers.referer })
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
            return res.json(materializedView);
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

// // Get the most recent log record and notify subscribers
(async () => {
    // non-blocking
    notifySubscribers();
})();
