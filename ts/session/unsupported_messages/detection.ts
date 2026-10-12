import { isEmpty } from 'lodash';
import { SignalService } from '../../protobuf';
import { messageHasVisibleContent } from '../../receiver/dataMessage';

/**
 * The highest top-level `Content` field number that has ever been assigned, retired ones included.
 *
 * A single bound rather than this client's own schema, so that metadata a newer client adds next to a
 * type we do know (2.0 sets `msgId = 18` on every message) is not mistaken for a new type.
 */
export const HIGHEST_KNOWN_CONTENT_FIELD_NUMBER = 18;

// Deliberately looser than protobuf's own 2^29 - 1: this bound is part of what all Session clients must
// agree counts as malformed, so changing it changes which messages get a placeholder on this one only.
const MAX_FIELD_NUMBER = 2 ** 31 - 1;
const MAX_VARINT_BYTES = 10;

// Protobuf wire types: the low 3 bits of a field key, saying how the value is encoded.
const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_FIXED64 = 1;
const WIRE_TYPE_LENGTH_DELIMITED = 2;
// deprecated groups, never used by Session
const WIRE_TYPE_START_GROUP = 3;
const WIRE_TYPE_END_GROUP = 4;
const WIRE_TYPE_FIXED32 = 5;

/**
 * Field numbers of the top-level fields of a serialized protobuf message, or null if it is not
 * well-formed.
 *
 * Hand-written because the protobufjs static build discards unknown fields while decoding, so the
 * decoded `Content` cannot tell us what it dropped.
 */
export function topLevelFieldNumbers(bytes: Uint8Array): Array<number> | null {
  let index = 0;
  const result: Array<number> = [];

  const readVarint = (): number | null => {
    let value = 0;
    for (let i = 0; i < MAX_VARINT_BYTES && index < bytes.length; i++) {
      const byte = bytes[index];
      index++;
      // eslint-disable-next-line no-bitwise
      value += (byte & 0x7f) * 2 ** (7 * i);
      // eslint-disable-next-line no-bitwise
      if ((byte & 0x80) === 0) {
        return value;
      }
    }
    return null;
  };

  while (index < bytes.length) {
    const key = readVarint();
    if (key === null) {
      return null;
    }
    // A key is `fieldNumber << 3 | wireType`. The switch below is on the WIRE TYPE (key % 8), not the
    // field number (floor(key / 8)): eg. its START_GROUP case is not Content field 3.
    const fieldNumber = Math.floor(key / 8);
    if (fieldNumber < 1 || fieldNumber > MAX_FIELD_NUMBER) {
      return null;
    }

    const wireType = key % 8;
    switch (wireType) {
      case WIRE_TYPE_VARINT:
        if (readVarint() === null) {
          return null;
        }
        break;
      case WIRE_TYPE_FIXED64:
        index += 8;
        break;
      case WIRE_TYPE_LENGTH_DELIMITED: {
        const length = readVarint();
        if (length === null || length > bytes.length - index) {
          return null;
        }
        index += length;
        break;
      }
      case WIRE_TYPE_FIXED32:
        index += 4;
        break;
      case WIRE_TYPE_START_GROUP:
      case WIRE_TYPE_END_GROUP:
        // Session has never used groups, so treated as malformed like the unassigned wire types 6 and 7
        return null;
      default:
        return null;
    }

    if (index > bytes.length) {
      return null;
    }
    result.push(fieldNumber);
  }

  return result;
}

export function containsUnknownContentType(contentPlaintext: Uint8Array) {
  return (topLevelFieldNumbers(contentPlaintext) ?? []).some(
    fieldNumber => fieldNumber > HIGHEST_KNOWN_CONTENT_FIELD_NUMBER
  );
}

/**
 * A v1 1o1 message is protobuf-encoded and no protobuf message can start with a zero byte (field 0 is
 * invalid), which is why the newer wire format starts with one.
 *
 * Only meaningful on the 1o1 namespace: group namespaces are encrypted with a symmetric key, so their
 * data can start with any byte.
 */
export function isNewerFormatData(rawData: Uint8Array) {
  return rawData.length > 0 && rawData[0] === 0x00;
}

/**
 * Whether the decoded Content holds something this client would act on, using the same checks the
 * receive path applies.
 *
 * A DataMessage with nothing displayable (eg. only a `syncTarget`) does not count: that is how a sync
 * copy of a newer type arrives, as the sender adds the `syncTarget` to a DataMessage whatever the type.
 */
export function hasValidKnownContent(content: SignalService.Content) {
  if (
    content.receiptMessage ||
    content.typingMessage ||
    content.dataExtractionNotification ||
    content.unsendRequest ||
    content.callMessage ||
    content.messageRequestResponse
  ) {
    return true;
  }
  const dataMessage = content.dataMessage as SignalService.DataMessage | null | undefined;
  if (!dataMessage) {
    return false;
  }
  return messageHasVisibleContent(dataMessage) || !isEmpty(dataMessage.groupUpdateMessage);
}

/**
 * The case-2 rule shared with iOS and Android: the Content parsed, it holds a top-level field newer than
 * anything this client knows, and nothing it does know is usable on its own.
 */
export function isUnknownTypeContent(content: SignalService.Content, contentPlaintext: Uint8Array) {
  return containsUnknownContentType(contentPlaintext) && !hasValidKnownContent(content);
}
