// NOTE this must match Content.ExpirationType in the protobuf
export type DisappearingMessageType = (typeof DisappearingMessageMode)[number];
export const DisappearingMessageMode = ['unknown', 'deleteAfterRead', 'deleteAfterSend'] as const;
export type DisappearAfterSendOnly = Exclude<DisappearingMessageType, 'deleteAfterRead'>;

// TODO NOTE legacy is strictly used in the UI and is not a valid disappearing message mode
export const DisappearingMessageConversationModes = [
  'off',
  DisappearingMessageMode[1], // deleteAfterRead
  DisappearingMessageMode[2], // deleteAfterSend
] as const;
export type DisappearingMessageConversationModeType =
  (typeof DisappearingMessageConversationModes)[number];

/** Used for setting disappearing messages in conversations */
export type ExpirationTimerUpdate = {
  expirationType: DisappearingMessageType;
  expireTimer: number;
};

export type DisappearingMessageUpdate = {
  expirationType: DisappearingMessageType;
  expirationTimer: number;
  messageExpirationFromRetrieve: number | null;
};

export type WithDisappearingMessageUpdate = { expireUpdate: DisappearingMessageUpdate | null };

export type ReadyToDisappearMsgUpdate = Pick<
  DisappearingMessageUpdate,
  'expirationType' | 'expirationTimer' | 'messageExpirationFromRetrieve'
>;
