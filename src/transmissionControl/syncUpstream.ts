import { db } from '../database';
import {
    StreamEventIdDuplicateException,
    StreamEventOutOfSequenceException,
} from './exceptions';
import { FetchUpstream } from './buildFetchUpstream';
import { notifySubscribers } from './notifySubscribers';
import { onEventProcessSingle } from './onEventProcessSingle';
import { getUpstreamControl } from '../getUpstreamControl';

export async function syncUpstream(
    fetchUpstream: FetchUpstream,
    totalOrderId: number,
    eventIdStart: number,
    eventIdEnd?: number,
    limit?: number,
    offset?: number
) {
    const events = await fetchUpstream(
        totalOrderId,
        eventIdStart,
        eventIdEnd,
        limit,
        offset
    );
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
                    event: event,
                });
                continue;
            }
            throw e;
        }
    }
}

export async function syncUpstreamFromUpstreamControl(
    fetchUpstream: FetchUpstream
) {
    const upstreamControl = await getUpstreamControl();
    syncUpstream(
        fetchUpstream,
        upstreamControl.totalOrderId,
        upstreamControl.streamId
    );
}
