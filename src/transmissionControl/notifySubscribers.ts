import {
    TotallyOrderedStreamEvent,
    TotallyOrderedUserStreamEvent,
} from './types';
import { handleNotifyingSubscribers } from '../handleNotifyingSubscribers';
export async function notifySubscribers(
    streamOut: TotallyOrderedStreamEvent
): Promise<void> {
    await handleNotifyingSubscribers(streamOut);
}
