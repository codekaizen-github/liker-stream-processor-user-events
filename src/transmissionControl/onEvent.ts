import { notifySubscribers } from './notifySubscribers';
import { onEventProcess } from './onEventProcess';
import { TotallyOrderedStreamEvent } from './types';

export default async function onEvent(
    event: TotallyOrderedStreamEvent[],
    totalOrderId: number
) {
    // Random delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
    const results = await onEventProcess(event, totalOrderId);
    if (results.length) {
        notifySubscribers(results);
    }
}
