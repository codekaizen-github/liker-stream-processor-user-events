export interface FetchUpstream {
    (afterId: number): Promise<any>;
}

export function buildFetchUpstream(url: string): FetchUpstream {
    const urlParsed = new URL(url);
    return async function fetchUpstream(afterId: number) {
        urlParsed.searchParams.append('afterId', afterId.toString());
        const response = await fetch(urlParsed.toString());
        const streamOuts = await response.json();
        return streamOuts;
    };
}
