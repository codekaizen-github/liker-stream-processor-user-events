import { Kysely, Transaction } from 'kysely';
import { Database, OrderedStreamEvent, StreamOut, UserEvent } from './types';
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
import { clientsByEmail } from './server';

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
    const upstreamControl = await getMostRecentUpstreamControl(trx);
    const upstreamControlStreamInId = upstreamControl
        ? upstreamControl.streamInId
        : 0;
    poll(trx, url, upstreamControlStreamInId);
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
    const upstreamControl = await getMostRecentUpstreamControl(trx);
    const upstreamControlStreamInId = upstreamControl
        ? upstreamControl.streamInId
        : 0;
    if (orderedStreamEvent.id <= upstreamControlStreamInId) {
        throw new StreamEventIdDuplicateException();
    }
    if (orderedStreamEvent.id > upstreamControlStreamInId + 1) {
        throw new StreamEventOutOfSequenceException();
    }
    await processStreamEvent(trx, orderedStreamEvent);
    await trx.deleteFrom('upstreamControl').execute();
    await createUpstreamControl(trx, { streamInId: orderedStreamEvent.id });
}
