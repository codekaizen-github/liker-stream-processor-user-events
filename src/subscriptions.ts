import { Kysely, sql, Transaction } from 'kysely';
import { Database, OrderedStreamEvent, StreamOut, UserEvent } from './types';
import { findHttpSubscribers } from './httpSubscriberStore';
import { processStreamEvent } from './streamProcessor';
import {
    createUpstreamControl,
    getMostRecentUpstreamControl,
    getUpstreamControlForUpdate,
    insertIntoIgnoreUpstreamControl,
    updateUpstreamControl,
} from './upstreamControlStore';
import {
    StreamEventIdDuplicateException,
    StreamEventOutOfSequenceException,
} from './exceptions';
import { clientsByEmail } from './server';
import { Console } from 'console';

/*
- [ ] Define a function which will add an event to a user stream
    - [ ] Function should
        - [ ] Query existing userEvents for that user to find the one with max userEventId
        - [ ] Calculate the next userEventId (+1)
        - [ ] Insert
        - [ ] Notify related streams (sockets)
*/

export async function notifyUserSockets(
    userEmail: string,
    userEvent: UserEvent
): Promise<void> {
    // Notify user sockets
    // const clients = clientsByEmail.get(userEmail)?.write(JSON.stringify(userEvent));
}

export async function notifySubscribers(
    trx: Transaction<Database>,
    streamOut: StreamOut
): Promise<void> {
    const subscriptions = await findHttpSubscribers(trx, {});
    for (const subscription of subscriptions) {
        // non-blocking
        notifySubscriberUrl(subscription.url, streamOut);
    }
}

export async function notifySubscriberUrl(
    url: string,
    streamOut: StreamOut
): Promise<void> {
    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: callbackUrl,
            }),
        });
    } catch (e) {
        console.error(e);
    }
}

export async function pollForLatest(
    trx: Transaction<Database>,
    url: string
): Promise<void> {
    console.log('Polling for latest');
    console.log(`Poll about to get upstream control for update`);
    await insertIntoIgnoreUpstreamControl(trx, { id: 0, streamInId: 0 });
    const upstreamControl = await getUpstreamControlForUpdate(trx, 0); // Prevents duplicate entry keys and insertions in other tables
    if (!upstreamControl) {
        throw new Error('Failed to get upstream control for update');
    }
    poll(trx, url, upstreamControl.id);
}

export async function makePollRequest(
    url: string,
    afterId: number
): Promise<any> {
    try {
        const response = await fetch(`${url}?afterId=${afterId}`);
        const streamOuts = await response.json();
        return streamOuts;
    } catch (e) {
        console.error(e);
    }
}

export async function poll(
    trx: Transaction<Database>,
    url: string,
    afterId: number
): Promise<void> {
    console.log('Polling');
    // Gets any stream events between last recorded event and this neweset event (if there are any). Hypothetically, there could be gaps in the streamIn IDs.
    const pollResults = await makePollRequest(url, afterId);
    if (undefined === pollResults?.length || pollResults.length === 0) {
        return;
    }
    // Assumes that the upstream service will return the events in order
    for (const pollResult of pollResults) {
        try {
            await processStreamEventInTotalOrder(trx, pollResult);
        } catch (e) {
            // Handle StreamEventIdDuplicateException and StreamEventOutOfSequenceException differently than other exceptions
            if (e instanceof StreamEventIdDuplicateException) {
                console.warn('Stream event ID duplicate');
                // If the event ID is a duplicate, we can safely ignore it
                continue;
            }
            if (e instanceof StreamEventOutOfSequenceException) {
                // If the event ID is out of sequence, there is an issue with the upstream service
                // We should stop polling and wait for the upstream service to catch up
                console.error('Stream event out of sequence');
                return;
            }
            throw e;
        }
    }
}

export async function processStreamEventInTotalOrder(
    trx: Transaction<Database>,
    orderedStreamEvent: OrderedStreamEvent
): Promise<void> {
    /*
    START TRANSACTION;

    -- Step 1: Lock the row for updates
    SELECT config_value FROM config_table WHERE config_id = 1 FOR UPDATE;

    -- Step 2: Try to insert the row with counter = 0
    -- If the row already exists, the insert will be ignored
    INSERT IGNORE INTO config_table (config_id, config_value, version)
    VALUES (1, 0, 1);

    -- Step 3: Select the most recent value for the row
    SELECT config_value FROM config_table WHERE config_id = 1 FOR UPDATE;

    -- Step 4: Perform your operations on config_value
    UPDATE config_table SET config_value = config_value + 1 WHERE config_id = 1;

    -- Step 5: Commit the transaction
    COMMIT;
    */

    // await insertIntoIgnoreUpstreamControl(trx, { id: 0, streamInId: 0 });
    console.log(
        `${orderedStreamEvent.id}: ${JSON.stringify(orderedStreamEvent)}`
    );
    console.log(
        `${orderedStreamEvent.id}: SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;`
    );
    console.log(`${orderedStreamEvent.id}: START TRANSACTION;`);
    console.log(
        `${orderedStreamEvent.id}: SELECT streamInId FROM upstreamControl WHERE id = 0 FOR UPDATE;`
    );
    const upstreamForUpdateLock =
        await sql`SELECT streamInId FROM upstreamControl WHERE id = 0 FOR UPDATE`.execute(
            trx
        );
    console.log(
        `${
            orderedStreamEvent.id
        }: RESULTS INITIAL: SELECT streamInId FROM upstreamControl WHERE id = 0 FOR UPDATE: ${JSON.stringify(
            upstreamForUpdateLock
        )}`
    );
    console.log(
        `${orderedStreamEvent.id}: INSERT IGNORE INTO upstreamControl (id, streamInId) VALUES (0, 0);`
    );
    await sql`INSERT IGNORE INTO upstreamControl (id, streamInId) VALUES (0, 0)`.execute(
        trx
    );
    console.log(
        `${orderedStreamEvent.id}: SELECT streamInId FROM upstreamControl WHERE id = 0 FOR UPDATE;`
    );
    // const upstreamControl =
    //     await sql`SELECT streamInId FROM upstreamControl WHERE id = 0 FOR UPDATE`.execute(
    //         trx
    //     );
    const upstreamControl = await getUpstreamControlForUpdate(trx, 0); // Prevents duplicate entry keys and insertions in other tables
    console.log(
        `${
            orderedStreamEvent.id
        }: RESULT LATER: SELECT streamInId FROM upstreamControl WHERE id = 0 FOR UPDATE: ${JSON.stringify(
            upstreamControl
        )}`
    );
    if (!upstreamControl) {
        console.log(
            `${orderedStreamEvent.id}: about to throw error because no upstream control`
        );
        throw new Error('Failed to get upstream control for update');
    }
    if (orderedStreamEvent.id <= upstreamControl.streamInId) {
        console.log(
            `${orderedStreamEvent.id}: about to throw error because id is less than or equal to streamInId`
        );
        throw new StreamEventIdDuplicateException();
    }
    if (orderedStreamEvent.id > upstreamControl.streamInId + 1) {
        console.log(
            `${orderedStreamEvent.id}: about to throw error because id is greater than streamInId + 1`
        );
        throw new StreamEventOutOfSequenceException();
    }
    console.log(`${orderedStreamEvent.id}: about to process stream event`);
    await processStreamEvent(trx, orderedStreamEvent);
    console.log(`${orderedStreamEvent.id}: processed stream event`);
    console.log(
        `${orderedStreamEvent.id}: UPDATE upstreamControl SET streamInId = streamInId + 1 WHERE id = 0;`
    );
    await sql`UPDATE upstreamControl SET streamInId = streamInId + 1 WHERE id = 0`.execute(
        trx
    );
    console.log(`${orderedStreamEvent.id}: COMMIT;`);
    // This line is failing - something is holding on to the lock
    // console.log(`${orderedStreamEvent.id} about to get upstream control for update`);
    // const upstreamControl = await getUpstreamControlForUpdate(trx, 0); // Prevents duplicate entry keys and insertions in other tables
    // if (!upstreamControl) {
    //     throw new Error('Failed to get upstream control for update');
    // }
    // // const upstreamControl = await getMostRecentUpstreamControl(trx); // Results in duplicate entry keys and insertions in other tables due to async
    // console.log(
    //     `${
    //         orderedStreamEvent.id
    //     } got most recent upstream control: ${JSON.stringify(upstreamControl)}`
    // );
    // if (orderedStreamEvent.id <= upstreamControl.streamInId) {
    //     throw new StreamEventIdDuplicateException();
    // }
    // if (orderedStreamEvent.id > upstreamControl.streamInId + 1) {
    //     throw new StreamEventOutOfSequenceException();
    // }
    // console.log(`${orderedStreamEvent.id} about to process stream event`);
    // await processStreamEvent(trx, orderedStreamEvent);
    // console.log(`${orderedStreamEvent.id} processed stream event`);
    // await updateUpstreamControl(trx, upstreamControl.id, {
    //     streamInId: orderedStreamEvent.id,
    // });
    // console.log(`${orderedStreamEvent.id} updated upstream control`);
}
