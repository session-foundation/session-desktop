// That named-tuple syntax breaks prettier linting and formatting on the whole file it is used currently, so we keep it separately.

import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';
import { ConversationTypeEnum } from '../../../models/types';

export type PollForUs = [pubkey: PubkeyType, type: ConversationTypeEnum.PRIVATE];
export type PollForLegacy = [pubkey: PubkeyType, type: ConversationTypeEnum.GROUP];
export type PollForGroup = [pubkey: GroupPubkeyType, type: ConversationTypeEnum.GROUPV2];
