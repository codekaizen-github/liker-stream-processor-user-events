// StreamEventOutOfSequenceException
export class StreamEventOutOfSequenceException extends Error {
    constructor() {
        super('Stream event out of sequence');
    }
}
// StreamEventIdDuplicateException
export class StreamEventIdDuplicateException extends Error {
    constructor() {
        super('Stream event ID duplicate');
    }
}

export class UserNotFoundException extends Error {
    constructor() {
        super('User not found');
    }
}
