export interface TotallyOrderedStreamEvent {
    id: number;
    streamId: number;
    totalOrderId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
}

export interface NewTotallyOrderedStreamEvent {
    streamId: number;
    totalOrderId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
}
