import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface NewStreamEvent {
    data: any;
}

export interface OrderedStreamEvent {
    id: number;
    data: any;
}

// export interface NewUserStreamEvent {
//     userId: number;
//     userEventId: number;
//     data: any;
// }

// export interface OrderedUserStreamEvent {
//     id: number;
//     userId: number;
//     userEventId: number;
//     data: any;
// }

export interface Database {
    upstreamControl: UpstreamControlTable;
    user: UserTable;
    userEvent: UserEventTable;
    streamOut: StreamOutTable;
}

export interface StreamOutTable {
    id: Generated<number>;
    totalOrderId: number;
    data: any;
}

export interface StreamOutTableSerialized extends StreamOutTable {
    data: string;
}

export type StreamOut = Selectable<StreamOutTable>;
export type NewStreamOut = Insertable<StreamOutTableSerialized>;
export type StreamOutUpdate = Updateable<StreamOutTableSerialized>;

export interface UpstreamControlTable {
    id: number; // Will always be 0
    streamId: number;
    totalOrderId: number;
}

export type UpstreamControl = Selectable<UpstreamControlTable>;
export type NewUpstreamControl = Insertable<UpstreamControlTable>;
export type UpstreamControlUpdate = Updateable<UpstreamControlTable>;

export interface UserTable {
    id: Generated<number>;
    email: string;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface UserEventTable {
    id: Generated<number>;
    totalOrderId: number;
    userId: number;
    userEventId: number;
    data: any;
}

export interface UserEventTableSerialized extends UserEventTable {
    data: string;
}

export type UserEvent = Selectable<UserEventTable>;
export type NewUserEvent = Insertable<UserEventTableSerialized>;
export type UserEventUpdate = Updateable<UserEventTableSerialized>;
