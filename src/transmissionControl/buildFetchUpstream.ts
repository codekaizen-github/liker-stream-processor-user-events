export interface FetchUpstream {
    (
        totalOrderId: number,
        eventIdStart: number,
        eventIdEnd?: number,
        limit?: number,
        offset?: number
    ): Promise<any>;
}

export function buildFetchUpstream(url: string): FetchUpstream {
    const urlParsed = new URL(url);
    return async function fetchUpstream(
        totalOrderId: number,
        eventIdStart: number,
        eventIdEnd?: number,
        limit?: number,
        offset?: number
    ) {
        urlParsed.searchParams.append('totalOrderId', totalOrderId.toString());
        urlParsed.searchParams.append('eventIdStart', eventIdStart.toString());
        if (eventIdEnd !== undefined) {
            urlParsed.searchParams.append('eventIdEnd', eventIdEnd.toString());
        }
        if (limit !== undefined) {
            urlParsed.searchParams.append('limit', limit.toString());
        }
        if (offset !== undefined) {
            urlParsed.searchParams.append('offset', offset.toString());
        }
        const response = await fetch(urlParsed.toString());
        const streamOuts = await response.json();
        return streamOuts;
    };
}
