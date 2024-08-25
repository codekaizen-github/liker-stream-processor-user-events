import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface NewStreamEvent {
    data: any;
}

export interface OrderedStreamEvent {
    id: number;
    data: any;
}

export interface NewUserStreamEvent {
    userId: number;
    userEventId: number;
    data: any;
}

export interface OrderedUserStreamEvent {
    id: number;
    userId: number;
    userEventId: number;
    data: any;
}

export interface Database {
    streamIn: StreamInTable;
    streamOut: StreamOutTable;
    httpSubscriber: HttpSubscriberTable;
    upstreamControl: UpstreamControlTable;
    user: UserTable;
    userEvent: UserEventTable;
}

export interface StreamInTable {
    id: Generated<number>;
    data: any;
}

export interface StreamInTableSerialized extends StreamInTable {
    data: string;
}

export type StreamIn = Selectable<StreamInTable>;
export type NewStreamIn = Insertable<StreamInTableSerialized>;
export type StreamInUpdate = Updateable<StreamInTableSerialized>;

// This interface describes the `person` table to Kysely. Table
// interfaces should only be used in the `Database` type above
// and never as a result type of a query!. See the `Person`,
// `NewPerson` and `PersonUpdate` types below.
export interface StreamOutTable {
    id: Generated<number>;
    data: any;
}

export interface StreamOutTableSerialized extends StreamOutTable {
    data: string;
}

export type StreamOut = Selectable<StreamOutTable>;
export type NewStreamOut = Insertable<StreamOutTableSerialized>;
export type StreamOutUpdate = Updateable<StreamOutTableSerialized>;

export interface HttpSubscriberTable {
    id: Generated<number>;
    url: string;
}

export type HttpSubscription = Selectable<HttpSubscriberTable>;
export type NewHttpSubscription = Insertable<HttpSubscriberTable>;
export type HttpSubscriptionUpdate = Updateable<HttpSubscriberTable>;

export interface UpstreamControlTable {
    id: number; // Will always be 0
    streamInId: number;
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
