import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface NewStreamEvent {
    data: any;
}

export interface OrderedStreamEvent {
    id: number;
    data: any;
}

export interface Database {
    upstreamControl: UpstreamControlTable;
    user: UserTable;
    userFencingToken: UserFencingTokenTable;
    userMaterializedView: UserMaterializedViewTable;
    game: GameTable;
    gameUser: GameUserTable;
}

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

export interface UserFencingTokenTable {
    id: Generated<number>;
    totalOrderId: number;
    userId: number;
    fencingToken: number;
}

export type UserFencingToken = Selectable<UserFencingTokenTable>;
export type NewUserFencingToken = Insertable<UserFencingTokenTable>;
export type UserFencingTokenUpdate = Updateable<UserFencingTokenTable>;

export interface UserMaterializedViewTable {
    id: Generated<number>;
    userId: number;
    data: any;
}

export type UserMaterializedView = Selectable<UserMaterializedViewTable>;
export type NewUserMaterializedView = Insertable<UserMaterializedViewTable>;
export type UserMaterializedViewUpdate = Updateable<UserMaterializedViewTable>;

export interface GameTable {
    id: Generated<number>;
    gameId: number;
    likeCount: number;
    status: number;
}

export type Game = Selectable<GameTable>;
export type NewGame = Insertable<GameTable>;
export type GameUpdate = Updateable<GameTable>;

export interface GameUserTable {
    id: Generated<number>;
    gameId: number;
    userId: number;
    successfulLikes: number;
    failedLikes: number;
}

export type GameUser = Selectable<GameUserTable>;
export type NewGameUser = Insertable<GameUserTable>;
export type GameUserUpdate = Updateable<GameUserTable>;
