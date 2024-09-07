import { db } from '../database';
import {
    StreamEventIdDuplicateException,
    StreamEventOutOfSequenceException,
} from './exceptions';
import { FetchUpstream } from './buildFetchUpstream';
import { notifySubscribers } from './notifySubscribers';
import {
    getUpstreamControlForUpdate,
    insertIntoIgnoreUpstreamControl,
} from '../upstreamControlStore';
import { onEventProcessSingle } from './onEventProcessSingle';

export async function syncUpstream(fetchUpstream: FetchUpstream) {
    const upstreamControl = await db
        .transaction()
        .setIsolationLevel('serializable')
        .execute(async (trx) => {
            // const upstreamForUpdateLock =
            //     await getUpstreamControlForUpdate(trx, 0); // Prevents duplicate entry keys and insertions in other tables
            const upstreamControlIgnore = await insertIntoIgnoreUpstreamControl(
                trx,
                {
                    id: 0,
                    streamId: 0,
                    totalOrderId: 0,
                }
            );
            const upstreamControl = await getUpstreamControlForUpdate(trx, 0);
            return upstreamControl;
        });
    if (upstreamControl === undefined) {
        throw new Error('Failed to get upstream control lock');
    }
    const events = await fetchUpstream(upstreamControl.streamId);
    console.log({ events: events });
    for (const event of events) {
        console.log('...next interation!');
        try {
            const results = await onEventProcessSingle(event);
            if (results.length) {
                for (const result of results) {
                    notifySubscribers(result);
                }
            }
        } catch (e) {
            if (e instanceof StreamEventIdDuplicateException) {
                console.log('Duplicate event ID on 2nd pass', event);
                continue;
            }
            if (e instanceof StreamEventOutOfSequenceException) {
                console.log('Out of sequence event ID on 2nd pass', {
                    upstreamControl,
                    event: event,
                });
                continue;
            }
            throw e;
        }
    }
}
