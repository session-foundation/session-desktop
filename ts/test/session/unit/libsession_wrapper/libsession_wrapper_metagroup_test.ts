import { expect } from 'chai';
import {
  GroupMemberGet,
  MetaGroupWrapperNode,
  PubkeyType,
  UserGroupsWrapperNode,
} from 'libsession_util_nodejs';
import { range } from 'lodash';
import Sinon from 'sinon';
import { HexString } from '../../../../node/hexStrings';
import { toFixedUint8ArrayOfLength } from '../../../../types/sqlSharedTypes';
import { TestUtils } from '../../../test-utils';
import { TestUserKeyPairs } from '../../../test-utils/utils';

function profilePicture() {
  return { key: new Uint8Array(range(0, 32)), url: `${Math.random()}` };
}

function emptyMember(pubkeyHex: PubkeyType): GroupMemberGet {
  return {
    memberStatus: 'INVITE_NOT_SENT',
    name: '',
    profilePicture: {
      key: null,
      url: null,
    },
    nominatedAdmin: false,
    pubkeyHex,
    supplement: false,
  };
}

describe('libsession_metagroup', () => {
  let us: TestUserKeyPairs;
  let groupCreated: ReturnType<UserGroupsWrapperNode['createGroup']>;
  let metaGroupWrapper: MetaGroupWrapperNode;
  let member: PubkeyType;
  let member2: PubkeyType;

  beforeEach(async () => {
    us = await TestUtils.generateUserKeyPairs();
    const groupWrapper = new UserGroupsWrapperNode(us.ed25519KeyPair.privateKey, null);
    groupCreated = groupWrapper.createGroup();

    metaGroupWrapper = new MetaGroupWrapperNode({
      groupEd25519Pubkey: toFixedUint8ArrayOfLength(
        HexString.fromHexString(groupCreated.pubkeyHex.slice(2)),
        32
      ).buffer,
      groupEd25519Secretkey: groupCreated.secretKey,
      metaDumped: null,
      userEd25519Secretkey: toFixedUint8ArrayOfLength(us.ed25519KeyPair.privateKey, 64).buffer,
    });
    metaGroupWrapper.keyRekey();
    member = TestUtils.generateFakePubKeyStr();
    member2 = TestUtils.generateFakePubKeyStr();
  });
  afterEach(() => {
    Sinon.restore();
  });

  describe("encrypt/decrypt group's message", () => {
    it('can encrypt/decrypt message for group with us as author', async () => {
      const plaintext = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const toEncrypt = new Uint8Array(plaintext);
      const [encrypted] = metaGroupWrapper.encryptMessages([toEncrypt]);
      const decrypted = metaGroupWrapper.decryptMessage(encrypted);

      expect(decrypted.plaintext).to.be.deep.eq(toEncrypt);
      expect(decrypted.pubkeyHex).to.be.deep.eq(us.x25519KeyPair.pubkeyHex);
    });

    it('throws when encrypt/decrypt message when content is messed up', async () => {
      const plaintext = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const toEncrypt = new Uint8Array(plaintext);
      const [encrypted] = metaGroupWrapper.encryptMessages([toEncrypt]);

      encrypted[1] -= 1;
      const func = () => metaGroupWrapper.decryptMessage(encrypted);
      expect(func).to.throw('unable to decrypt ciphertext with any current group keys');
    });
  });

  describe('info', () => {
    it('all fields are accounted for', () => {
      const info = metaGroupWrapper.infoGet();
      expect(Object.keys(info).length).to.be.eq(
        8, // if you change this value, also make sure you add a test, testing that field, below
        'this test is designed to fail if you need to add tests to test a new field of libsession'
      );
    });

    it('can set and recover group name', () => {
      expect(metaGroupWrapper.infoGet().name).to.be.deep.eq(null);
      const info = metaGroupWrapper.infoGet();
      info.name = 'fake name';
      metaGroupWrapper.infoSet(info);
      expect(metaGroupWrapper.infoGet().name).to.be.deep.eq('fake name');
    });

    it('can set and recover group createdAt', () => {
      const expected = 1234;
      expect(metaGroupWrapper.infoGet().createdAtSeconds).to.be.deep.eq(null);
      const info = metaGroupWrapper.infoGet();
      info.createdAtSeconds = expected;
      metaGroupWrapper.infoSet(info);
      expect(metaGroupWrapper.infoGet().createdAtSeconds).to.be.deep.eq(expected);
    });

    it('can set and recover group deleteAttachBeforeSeconds', () => {
      const expected = 1234;
      expect(metaGroupWrapper.infoGet().deleteAttachBeforeSeconds).to.be.deep.eq(null);
      const info = metaGroupWrapper.infoGet();
      info.deleteAttachBeforeSeconds = expected;
      metaGroupWrapper.infoSet(info);
      expect(metaGroupWrapper.infoGet().deleteAttachBeforeSeconds).to.be.deep.eq(expected);
    });

    it('can set and recover group deleteBeforeSeconds', () => {
      const expected = 1234;
      expect(metaGroupWrapper.infoGet().deleteBeforeSeconds).to.be.deep.eq(null);
      const info = metaGroupWrapper.infoGet();
      info.deleteBeforeSeconds = expected;
      metaGroupWrapper.infoSet(info);
      expect(metaGroupWrapper.infoGet().deleteBeforeSeconds).to.be.deep.eq(expected);
    });

    it('can set and recover group expirySeconds', () => {
      const expected = 1234;
      expect(metaGroupWrapper.infoGet().expirySeconds).to.be.deep.eq(null);
      const info = metaGroupWrapper.infoGet();
      info.expirySeconds = expected;
      metaGroupWrapper.infoSet(info);
      expect(metaGroupWrapper.infoGet().expirySeconds).to.be.deep.eq(expected);
    });

    it('can set and recover group isDestroyed', () => {
      expect(metaGroupWrapper.infoGet().isDestroyed).to.be.deep.eq(false);
      metaGroupWrapper.infoDestroy();
      expect(metaGroupWrapper.infoGet().isDestroyed).to.be.deep.eq(true);
    });

    it('can set and recover group profilePicture', () => {
      const expected = { key: new Uint8Array(range(0, 32)), url: '1234' };
      expect(metaGroupWrapper.infoGet().profilePicture).to.be.deep.eq({ url: null, key: null });
      const info = metaGroupWrapper.infoGet();

      info.profilePicture = expected;
      metaGroupWrapper.infoSet(info);
      expect(metaGroupWrapper.infoGet().profilePicture).to.be.deep.eq(expected);
    });

    it('can set and recover group description', () => {
      const expected = 'group description <set>';
      expect(metaGroupWrapper.infoGet().description).to.be.deep.eq('');
      const info = metaGroupWrapper.infoGet();
      info.description = expected;
      metaGroupWrapper.infoSet(info);
      expect(metaGroupWrapper.infoGet().description).to.be.deep.eq(expected);
    });

    it('can set and clear group description', () => {
      const expected = 'group description <set>';
      expect(metaGroupWrapper.infoGet().description).to.be.deep.eq('');
      const info = metaGroupWrapper.infoGet();
      info.description = expected;
      metaGroupWrapper.infoSet(info);
      expect(metaGroupWrapper.infoGet().description).to.be.deep.eq(expected);
      const info2 = metaGroupWrapper.infoGet();
      info2.description = '';
      metaGroupWrapper.infoSet(info2);
      expect(metaGroupWrapper.infoGet().description).to.be.deep.eq('');
    });
  });

  describe('members', () => {
    it('all fields are accounted for', () => {
      const memberCreated = metaGroupWrapper.memberGetOrConstruct(member);
      expect(Object.keys(memberCreated).sort()).to.be.deep.eq(
        [
          'pubkeyHex',
          'name',
          'profilePicture',
          'memberStatus',
          'nominatedAdmin',
          'supplement',
        ].sort(), // if you change this value, also make sure you add a test, testing that new field, below
        'this test is designed to fail if you need to add tests to test a new field of libsession'
      );
    });

    it('can add member by setting its promoted state, both ok and nok', () => {
      metaGroupWrapper.memberConstructAndSet(member);
      metaGroupWrapper.memberSetPromotionSent(member);
      expect(metaGroupWrapper.memberGetAll()).to.be.deep.eq([
        {
          ...emptyMember(member),
          nominatedAdmin: true,
          memberStatus: 'PROMOTION_SENT',
        },
      ]);

      metaGroupWrapper.memberConstructAndSet(member2);
      metaGroupWrapper.memberSetPromotionFailed(member2);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(2);
      // the list is sorted by member pk, which means that index based test do not work
      expect(metaGroupWrapper.memberGet(member2)).to.be.deep.eq({
        ...emptyMember(member2),
        nominatedAdmin: true,
        memberStatus: 'PROMOTION_FAILED',
      });

      // we test the admin: true case below
    });

    it('can add member by setting its invited state, both ok and nok', () => {
      metaGroupWrapper.memberConstructAndSet(member);

      metaGroupWrapper.memberSetInviteSent(member); // with invite success
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      expect(metaGroupWrapper.memberGetAll()).to.be.deep.eq([
        {
          ...emptyMember(member),
          memberStatus: 'INVITE_SENT',
        },
      ]);

      metaGroupWrapper.memberConstructAndSet(member2);

      metaGroupWrapper.memberSetInviteFailed(member2); // with invite failed
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(2);
      expect(metaGroupWrapper.memberGet(member2)).to.be.deep.eq({
        ...emptyMember(member2),
        memberStatus: 'INVITE_FAILED',
      });
    });

    it('can add member by setting its accepted state', () => {
      metaGroupWrapper.memberConstructAndSet(member);

      metaGroupWrapper.memberSetInviteAccepted(member);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      expect(metaGroupWrapper.memberGetAll()[0]).to.be.deep.eq({
        ...emptyMember(member),
        memberStatus: 'INVITE_ACCEPTED',
      });

      metaGroupWrapper.memberConstructAndSet(member2);

      metaGroupWrapper.memberSetInviteAccepted(member2);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(2);
      expect(metaGroupWrapper.memberGet(member2)).to.be.deep.eq({
        ...emptyMember(member2),
        memberStatus: 'INVITE_ACCEPTED',
      });
    });

    it('can erase member', () => {
      metaGroupWrapper.memberConstructAndSet(member);
      metaGroupWrapper.memberConstructAndSet(member2);

      metaGroupWrapper.memberSetInviteAccepted(member);
      metaGroupWrapper.memberSetPromotionSent(member2);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(2);

      expect(metaGroupWrapper.memberGet(member)).to.be.deep.eq({
        ...emptyMember(member),
        memberStatus: 'INVITE_ACCEPTED',
      });
      expect(metaGroupWrapper.memberGet(member2)).to.be.deep.eq({
        ...emptyMember(member2),
        memberStatus: 'PROMOTION_SENT',
        nominatedAdmin: true,
      });

      const rekeyed = metaGroupWrapper.memberEraseAndRekey([member2]);
      expect(rekeyed).to.be.eq(true);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      expect(metaGroupWrapper.memberGetAll()[0]).to.be.deep.eq({
        ...emptyMember(member),
        memberStatus: 'INVITE_ACCEPTED',
      });
    });

    it('can add via name set', () => {
      metaGroupWrapper.memberConstructAndSet(member);
      metaGroupWrapper.memberSetNameTruncated(member, 'member name');
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      expect(metaGroupWrapper.memberGetAll()[0]).to.be.deep.eq({
        ...emptyMember(member),
        name: 'member name',
        memberStatus: 'INVITE_SENDING',
      });
    });

    it('can add via profile picture set', () => {
      const pic = profilePicture();
      metaGroupWrapper.memberConstructAndSet(member);
      metaGroupWrapper.memberSetProfilePicture(member, pic);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      const expected = {
        ...emptyMember(member),
        profilePicture: pic,
        memberStatus: 'INVITE_SENDING',
      };

      expect(metaGroupWrapper.memberGetAll()[0]).to.be.deep.eq(expected);
    });

    it('can add via supplement set', () => {
      metaGroupWrapper.memberConstructAndSet(member);
      metaGroupWrapper.memberSetSupplement(member);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      const expected = {
        ...emptyMember(member),
        memberStatus: 'INVITE_SENDING', // invite_sending is the default state
        supplement: true,
      };

      expect(metaGroupWrapper.memberGetAll()[0]).to.be.deep.eq(expected);
    });

    it('can add via admin set', () => {
      metaGroupWrapper.memberConstructAndSet(member);
      metaGroupWrapper.memberSetPromotionAccepted(member);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      const expected: GroupMemberGet = {
        ...emptyMember(member),
        nominatedAdmin: true,
        memberStatus: 'PROMOTION_ACCEPTED',
      };

      expect(metaGroupWrapper.memberGetAll()[0]).to.be.deep.eq(expected);
    });

    it('can simply add, and has the correct default', () => {
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(0);
      metaGroupWrapper.memberConstructAndSet(member);
      // locally, when adding a member it is shown as INVITE_SENDING
      expect(metaGroupWrapper.memberGetAll()).to.be.deep.eq([
        { ...emptyMember(member), memberStatus: 'INVITE_SENDING' },
      ]);
    });

    it('can mark as removed with messages', () => {
      metaGroupWrapper.memberConstructAndSet(member);
      metaGroupWrapper.membersMarkPendingRemoval([member], true);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      const expected: GroupMemberGet = {
        ...emptyMember(member),
        memberStatus: 'REMOVED_MEMBER_AND_MESSAGES',
      };
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      expect(metaGroupWrapper.memberGetAll()[0]).to.be.deep.eq(expected);
    });

    it('can mark as removed without messages', () => {
      metaGroupWrapper.memberConstructAndSet(member);
      metaGroupWrapper.membersMarkPendingRemoval([member], false);
      expect(metaGroupWrapper.memberGetAll().length).to.be.deep.eq(1);
      const expected: GroupMemberGet = {
        ...emptyMember(member),
        memberStatus: 'REMOVED_MEMBER',
      };
      expect(metaGroupWrapper.memberGetAll()).to.be.deep.eq([expected]);
    });
  });

  describe('keys', () => {
    it('fresh group does not need rekey', () => {
      expect(metaGroupWrapper.keysNeedsRekey()).to.be.eq(
        false,
        'rekey should be false on fresh group'
      );
    });

    it.skip('merging a key conflict marks needsRekey to true', () => {
      const metaGroupWrapper2 = new MetaGroupWrapperNode({
        groupEd25519Pubkey: toFixedUint8ArrayOfLength(
          HexString.fromHexString(groupCreated.pubkeyHex.slice(2)),
          32
        ).buffer,
        groupEd25519Secretkey: groupCreated.secretKey,
        metaDumped: null,
        userEd25519Secretkey: toFixedUint8ArrayOfLength(us.ed25519KeyPair.privateKey, 64).buffer,
      });

      // mark current user as admin
      metaGroupWrapper.memberSetPromotionAccepted(us.x25519KeyPair.pubkeyHex);
      metaGroupWrapper2.memberSetPromotionAccepted(us.x25519KeyPair.pubkeyHex);

      // add 2 normal members to each of those wrappers
      const m1 = TestUtils.generateFakePubKeyStr();
      const m2 = TestUtils.generateFakePubKeyStr();
      metaGroupWrapper.memberSetInviteAccepted(m1);
      metaGroupWrapper.memberSetInviteAccepted(m2);
      metaGroupWrapper2.memberSetInviteAccepted(m1);
      metaGroupWrapper2.memberSetInviteAccepted(m2);

      expect(metaGroupWrapper.keysNeedsRekey()).to.be.eq(false);
      expect(metaGroupWrapper2.keysNeedsRekey()).to.be.eq(false);

      // remove m2 from wrapper2, and m1 from wrapper1
      const rekeyed1 = metaGroupWrapper2.memberEraseAndRekey([m2]);
      const rekeyed2 = metaGroupWrapper.memberEraseAndRekey([m1]);
      expect(rekeyed1).to.be.eq(true);
      expect(rekeyed2).to.be.eq(true);

      // const push1 = metaGroupWrapper.push();
      // metaGroupWrapper2.metaMerge([push1]);

      // const wrapper2Rekeyed = metaGroupWrapper2.keyRekey();
      // metaGroupWrapper.keyRekey();

      // const loadedKey = metaGroupWrapper.loadKeyMessage('fakehash1', wrapper2Rekeyed, Date.now());
      // expect(loadedKey).to.be.eq(true, 'key should have been loaded');
      expect(metaGroupWrapper.keysNeedsRekey()).to.be.eq(
        true,
        'rekey should be true for after add'
      );
    });
  });
});
