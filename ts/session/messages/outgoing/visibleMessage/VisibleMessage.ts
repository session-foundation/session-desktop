import Long from 'long';
import { SignalService } from '../../../../protobuf';
import { Reaction } from '../../../../types/Reaction';
import { DataMessage } from '../DataMessage';
import { type OutgoingUserProfile } from '../../../../types/message';
import { ExpirableMessageParams } from '../ExpirableMessage';
import { attachmentIdAsLongFromUrl } from '../../../utils';
import type { WithOutgoingUserProfile } from '../Message';

interface AttachmentPointerCommon {
  contentType?: string;
  key?: Uint8Array;
  size?: number;
  thumbnail?: Uint8Array;
  digest?: Uint8Array;
  fileName?: string;
  flags?: number;
  width?: number;
  height?: number;
  caption?: string;
}

export interface AttachmentPointer extends AttachmentPointerCommon {
  url?: string;
}

export interface AttachmentPointerWithUrl extends AttachmentPointerCommon {
  url: string;
}

export interface Preview {
  url: string;
  title?: string;
  image?: AttachmentPointer;
}

export interface PreviewWithAttachmentUrl {
  url: string;
  title?: string;
  image?: AttachmentPointerWithUrl;
}

interface QuotedAttachmentCommon {
  contentType?: string;
  fileName?: string;
}

export interface QuotedAttachment extends QuotedAttachmentCommon {
  thumbnail?: AttachmentPointer;
}

export interface QuotedAttachmentWithUrl extends QuotedAttachmentCommon {
  thumbnail?: AttachmentPointerWithUrl | QuotedAttachment;
}

export interface Quote {
  id: number;
  author: string;
}

export type VisibleMessageParams = ExpirableMessageParams &
  WithOutgoingUserProfile & {
    attachments?: Array<AttachmentPointerWithUrl>;
    body?: string;
    quote?: Quote;
    preview?: Array<PreviewWithAttachmentUrl>;
    reaction?: Reaction;
    syncTarget?: string; // undefined means it is not a synced message
  };

export class VisibleMessage extends DataMessage {
  public readonly reaction?: Reaction;

  private readonly attachments?: Array<AttachmentPointerWithUrl & { deprecatedId: Long }>;
  private readonly body?: string;
  private readonly quote?: Quote;
  private readonly userProfile: OutgoingUserProfile | null;

  private readonly preview?: Array<PreviewWithAttachmentUrl & { deprecatedId?: Long }>;

  /// In the case of a sync message, the public key of the person the message was targeted at.
  /// - Note: `null or undefined` if this isn't a sync message.
  private readonly syncTarget?: string;

  constructor(params: VisibleMessageParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      identifier: params.identifier,
      expirationType: params.expirationType,
      expireTimer: params.expireTimer,
    });
    this.attachments = params.attachments?.map(attachment => ({
      ...attachment,
      deprecatedId: attachmentIdAsLongFromUrl(attachment.url),
    }));
    this.body = params.body;
    this.quote = params.quote;

    this.userProfile = params.userProfile;

    this.preview = params.preview?.map(attachment => ({
      ...attachment,
      deprecatedId: attachment.image?.url
        ? attachmentIdAsLongFromUrl(attachment.image.url)
        : undefined,
    }));
    this.reaction = params.reaction;
    this.syncTarget = params.syncTarget;
  }

  public contentProto(): SignalService.Content {
    // Note: we do not want this one to call `makeContentProto` because super.contentProto() does it and deals
    // with the expirable field for us
    const content = super.contentProto();
    content.dataMessage = this.dataProto();
    return content;
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage({});

    if (this.body) {
      dataMessage.body = this.body;
    }

    dataMessage.attachments = this.attachments ?? [];

    if (this.reaction) {
      dataMessage.reaction = this.reaction;
    }
    if (this.syncTarget) {
      dataMessage.syncTarget = this.syncTarget;
    }

    const protobufDetails = this.userProfile?.toProtobufDetails() ?? {};
    dataMessage.profile = protobufDetails.profile;
    if (protobufDetails.profileKey) {
      dataMessage.profileKey = protobufDetails.profileKey;
    }

    if (this.quote) {
      dataMessage.quote = new SignalService.DataMessage.Quote();

      dataMessage.quote.id = this.quote.id;
      dataMessage.quote.author = this.quote.author;
    }

    if (Array.isArray(this.preview)) {
      dataMessage.preview = this.preview.map(preview => {
        const item = new SignalService.DataMessage.Preview();
        if (preview.title) {
          item.title = preview.title;
        }
        if (preview.url) {
          item.url = preview.url;
        }
        item.image = preview.image
          ? { ...preview.image, deprecatedId: attachmentIdAsLongFromUrl(preview.image.url) }
          : null;

        return item;
      });
    }

    return dataMessage;
  }

  public isEqual(comparator: VisibleMessage): boolean {
    return (
      this.identifier === comparator.identifier &&
      this.createAtNetworkTimestamp === comparator.createAtNetworkTimestamp
    );
  }
}
