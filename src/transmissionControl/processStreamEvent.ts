import { Transaction } from 'kysely';
import {
    NewTotallyOrderedStreamEvent,
    TotallyOrderedStreamEvent,
} from './types';
import { Database } from '../types';
import { createTotallyOrderedStreamEvents } from '../createTotallyOrderedStreamEvents';

export async function processStreamEvent(
    trx: Transaction<Database>,
    event: NewTotallyOrderedStreamEvent
): Promise<number[]> {
    return await createTotallyOrderedStreamEvents(trx, event);
}
