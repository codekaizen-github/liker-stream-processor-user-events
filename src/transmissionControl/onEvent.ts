import {
    StreamEventIdDuplicateException,
    StreamEventOutOfSequenceException,
} from '../exceptions';
import { FetchUpstream } from './buildFetchUpstream';
import { notifySubscribers } from './notifySubscribers';
import { onEventProcessSingle } from './onEventProcessSingle';
import { syncUpstream } from './syncUpstream';
import { TotallyOrderedStreamEvent } from './types';

export default async function onEvent(
    event: TotallyOrderedStreamEvent,
    fetchUpstream: FetchUpstream
) {
    // Random delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
    console.log({ event: JSON.stringify(event) });
    console.log({ eventTotalORderId: event.totalOrderId });
    // Get the upstream control lock
    try {
        const results = await onEventProcessSingle(event);
        if (results.length) {
            for (const result of results) {
                notifySubscribers(result);
            }
        }
    } catch (e) {
        if (e instanceof StreamEventIdDuplicateException) {
            console.log('Duplicate event ID', event);
            return;
        }
        if (e instanceof StreamEventOutOfSequenceException) {
            console.log('Out of sequence event ID', event);
            await syncUpstream(fetchUpstream);
        }
    }
}
