import { Kysely, sql, Transaction } from 'kysely';
import { Database, OrderedStreamEvent, StreamOut } from './types';
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
    const upstreamControlLock = await getUpstreamControlForUpdate(trx, 0); // Prevents duplicate entry keys and insertions in other tables
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
    const upstreamForUpdateLock = getUpstreamControlForUpdate(trx, 0); // Prevents duplicate entry keys and insertions in other tables
    const upstreamControlIgnore = await insertIntoIgnoreUpstreamControl(trx, {
        id: 0,
        streamInId: 0,
    });
    const upstreamControl = await getUpstreamControlForUpdate(trx, 0);
    if (upstreamControl === undefined) {
        throw new Error('Unable to find or create upstreamControl');
    }
    if (orderedStreamEvent.id <= upstreamControl.streamInId) {
        throw new StreamEventIdDuplicateException();
    }
    if (orderedStreamEvent.id > upstreamControl.streamInId + 1) {
        throw new StreamEventOutOfSequenceException();
    }
    await processStreamEvent(trx, orderedStreamEvent);
    await updateUpstreamControl(
        trx,
        upstreamControl.id,
        { streamInId: upstreamControl.streamInId + 1}
    );
}
