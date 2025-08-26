export type WithRoomId = { roomId: string };
export type WithImageId = { imageId: number }; // imageId has to be a number to be understood by sogs

export type WithSessionId = { sessionId: string };
export type WithSessionIds = { sessionIds: Array<string> };
export type WithMessageId = { messageId: number };
export type WithServerPubkey = { serverPublicKey: string };
export type WithServerUrl = { serverUrl: string };
export type WithRoomName = { roomName: string };
export type WithRoomDescription = { roomDescription: string };
