import { Kysely, Transaction } from 'kysely';
import { Database, StreamOut } from './types';
import { findHttpSubscribers } from './httpSubscriberStore';
import { processStreamEvent } from './streamProcessor';
import {
    createUpstreamControl,
    getMostRecentUpstreamControl,
} from './upstreamControlStore';
import {
    StreamEventIdDuplicateException,
    StreamEventOutOfSequenceException,
} from './exceptions';

export async function notifySubscribers(
    db: Kysely<Database>,
    streamOut: StreamOut
): Promise<void> {
    await db.transaction().execute(async (trx) => {
        const subscriptions = await findHttpSubscribers(trx, {});
        for (const subscription of subscriptions) {
            // non-blocking
            notifySubscriberUrl(subscription.url, streamOut);
        }
    });
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
    url: string,
    db: Kysely<Database>,
    trx: Transaction<Database>
): Promise<void> {
    const upstreamControl = await getMostRecentUpstreamControl(trx);
    const upstreamControlStreamInId = upstreamControl
        ? upstreamControl.streamInId
        : 0;
    poll(url, upstreamControlStreamInId, db, trx);
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
    url: string,
    afterId: number,
    db: Kysely<Database>,
    trx: Transaction<Database>
): Promise<void> {
    // Gets any stream events between last recorded event and this neweset event (if there are any). Hypothetically, there could be gaps in the streamIn IDs.
    const pollResults = await makePollRequest(url, afterId);
    if (undefined === pollResults?.length || pollResults.length === 0) {
        return;
    }
    // Assumes that the upstream service will return the events in order
    for (const pollResult of pollResults) {
        try {
            await processStreamEventInTotalOrder(pollResult, db, trx);
        } catch (e) {
            // Handle StreamEventIdDuplicateException and StreamEventOutOfSequenceException differently than other exceptions
            if (e instanceof StreamEventIdDuplicateException) {
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
    newStreamEvent: { id: number; data: string },
    db: Kysely<Database>,
    trx: Transaction<Database>
): Promise<void> {
    const upstreamControl = await getMostRecentUpstreamControl(trx);
    const upstreamControlStreamInId = upstreamControl
        ? upstreamControl.streamInId
        : 0;
    console.log({ upstreamControlStreamInId });
    console.log({ newStreamEvent });
    if (newStreamEvent.id <= upstreamControlStreamInId) {
        throw new StreamEventIdDuplicateException();
    }
    if (newStreamEvent.id > upstreamControlStreamInId + 1) {
        throw new StreamEventOutOfSequenceException();
    }
    await processStreamEvent(
        {
            data: JSON.stringify(newStreamEvent.data),
        },
        db,
        trx
    );
    await trx.deleteFrom('upstreamControl').execute();
    await createUpstreamControl(trx, { streamInId: newStreamEvent.id });
}
