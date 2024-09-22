import { handleNotifyingSubscribers } from '../handleNotifyingSubscribers';
export async function notifySubscribers(userIds?: number[]): Promise<void> {
    await handleNotifyingSubscribers(userIds);
}
