import { expect } from 'chai';
import { omit } from 'lodash';
import Long from 'long';
import Sinon from 'sinon';
import { getSodiumNode } from '../../../../../../node/sodiumNode';
import { NotEmptyArrayOfBatchResults } from '../../../../../../session/apis/snode_api/BatchResultEntry';
import { SnodeNamespaces } from '../../../../../../session/apis/snode_api/namespaces';
import { ConvoHub } from '../../../../../../session/conversations';
import { LibSodiumWrappers } from '../../../../../../session/crypto';
import { MessageSender } from '../../../../../../session/sending';
import { UserUtils } from '../../../../../../session/utils';
import { RunJobResult } from '../../../../../../session/utils/job_runners/PersistedJob';
import { UserSync } from '../../../../../../session/utils/job_runners/jobs/UserSyncJob';
import {
  LibSessionUtil,
  PendingChangesForUs,
  UserDestinationChanges,
  UserSuccessfulChange,
} from '../../../../../../session/utils/libsession/libsession_utils';
import { UserGenericWrapperActions } from '../../../../../../webworker/workers/browser/libsession_worker_interface';
import { TestUtils } from '../../../../../test-utils';
import { TypedStub, stubConfigDumpData } from '../../../../../test-utils/utils';
import { NetworkTime } from '../../../../../../util/NetworkTime';

function profileChange(
  sodium: LibSodiumWrappers,
  seqno: number,
  count: number
): PendingChangesForUs {
  return {
    ciphertexts: Array.from({ length: count }, (_v, i) => sodium.randombytes_buf((i + 1) * 4)),
    namespace: SnodeNamespaces.UserProfile,
    seqno: Long.fromNumber(seqno),
  };
}

function contactChange(
  sodium: LibSodiumWrappers,
  seqno: number,
  count: number
): PendingChangesForUs {
  return {
    ciphertexts: Array.from({ length: count }, (_v, i) => sodium.randombytes_buf((i + 1) * 5)),
    namespace: SnodeNamespaces.UserContacts,
    seqno: Long.fromNumber(seqno),
  };
}

function groupChange(sodium: LibSodiumWrappers, seqno: number, count: number): PendingChangesForUs {
  return {
    ciphertexts: Array.from({ length: count }, (_v, i) => sodium.randombytes_buf((i + 1) * 6)),
    namespace: SnodeNamespaces.UserGroups,
    seqno: Long.fromNumber(seqno),
  };
}

describe('UserSyncJob run()', () => {
  afterEach(() => {
    Sinon.restore();
  });
  it('throws if no user keys', async () => {
    const job = new UserSync.UserSyncJob({});
    // Note: the run() function should never throw, at most it should return "permanent failure"
    const func = async () => job.run();
    await expect(func()).to.be.eventually.rejected;
  });

  it('throws if our pubkey is set but not valid', async () => {
    const job = new UserSync.UserSyncJob({});
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns({ something: false } as any);
    Sinon.stub(UserUtils, 'getUserED25519KeyPairBytes').resolves({ something: true } as any);
    Sinon.stub(ConvoHub.use(), 'get').resolves({}); // anything not falsy
    // Note: the run() function should never throw, at most it should return "permanent failure"
    const func = async () => job.run();
    await expect(func()).to.be.eventually.rejected;
  });

  it('permanent failure if user has no ed keypair', async () => {
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(TestUtils.generateFakePubKeyStr());
    Sinon.stub(UserUtils, 'getUserED25519KeyPairBytes').resolves(undefined);
    Sinon.stub(ConvoHub.use(), 'get').resolves({}); // anything not falsy
    const job = new UserSync.UserSyncJob({});
    const result = await job.run();
    expect(result).to.be.eq(RunJobResult.PermanentFailure);
  });

  it('permanent failure if user has no own conversation', async () => {
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(TestUtils.generateFakePubKeyStr());
    Sinon.stub(UserUtils, 'getUserED25519KeyPairBytes').resolves({} as any); // anything not falsy
    Sinon.stub(ConvoHub.use(), 'get').returns(undefined as any);
    const job = new UserSync.UserSyncJob({});
    const result = await job.run();
    expect(result).to.be.eq(RunJobResult.PermanentFailure);
  });

  it('calls pushChangesToUserSwarmIfNeeded if preconditions are fine', async () => {
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(TestUtils.generateFakePubKeyStr());
    Sinon.stub(UserUtils, 'getUserED25519KeyPairBytes').resolves({} as any); // anything not falsy
    const taskedRun = Sinon.stub(UserSync, 'pushChangesToUserSwarmIfNeeded').resolves(
      RunJobResult.Success
    );
    Sinon.stub(ConvoHub.use(), 'get').returns({} as any); // anything not falsy
    const job = new UserSync.UserSyncJob({});
    const result = await job.run();
    expect(result).to.be.eq(RunJobResult.Success);
    expect(taskedRun.callCount).to.be.eq(1);
  });
});

describe('UserSyncJob batchResultsToUserSuccessfulChange', () => {
  let sodium: LibSodiumWrappers;
  beforeEach(async () => {
    sodium = await getSodiumNode();
  });
  it('no or empty results return empty array', () => {
    expect(
      LibSessionUtil.batchResultsToUserSuccessfulChange(null, {
        allOldHashes: new Set(),
        messages: [],
      })
    ).to.be.deep.eq([]);

    expect(
      LibSessionUtil.batchResultsToUserSuccessfulChange(
        [] as unknown as NotEmptyArrayOfBatchResults,
        {
          allOldHashes: new Set(),
          messages: [],
        }
      )
    ).to.be.deep.eq([]);
  });

  it('extract one result with 200 and messagehash', () => {
    const profile = profileChange(sodium, 321, 1);
    const contact = contactChange(sodium, 123, 1);
    const batchResults: NotEmptyArrayOfBatchResults = [{ code: 200, body: { hash: 'hash1' } }];
    const request: UserDestinationChanges = {
      allOldHashes: new Set(),
      messages: [profile, contact],
    };
    const results = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    expect(results).to.be.deep.eq([
      {
        messageHash: 'hash1',
        pushed: omit(profile, 'ciphertexts'),
      },
    ]);
  });

  it('extract two results with 200 and messagehash', () => {
    const profile = profileChange(sodium, 321, 1);
    const contact = contactChange(sodium, 123, 1);
    const batchResults: NotEmptyArrayOfBatchResults = [
      { code: 200, body: { hash: 'hash1' } },
      { code: 200, body: { hash: 'hash2' } },
    ];
    const request: UserDestinationChanges = {
      allOldHashes: new Set(),
      messages: [profile, contact],
    };
    const results = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    expect(results).to.be.deep.eq([
      {
        messageHash: 'hash1',
        pushed: omit(profile, 'ciphertexts'),
      },
      {
        messageHash: 'hash2',
        pushed: omit(contact, 'ciphertexts'),
      },
    ]);
  });

  it('extract one multipart results with 200 and message hash', () => {
    const profile = profileChange(sodium, 321, 2); // two of those
    const contact = contactChange(sodium, 123, 2); // two of those
    // only batch send of the first one was a success
    const batchResults: NotEmptyArrayOfBatchResults = [
      { code: 200, body: { hash: 'hash1' } },
      { code: 200, body: { hash: 'hash2' } },
    ];
    const request: UserDestinationChanges = {
      allOldHashes: new Set(),
      messages: [profile, contact],
    };
    const results = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    expect(results).to.be.deep.eq([
      {
        messageHash: 'hash1',
        pushed: omit(profile, 'ciphertexts'),
      },
      {
        messageHash: 'hash2',
        pushed: omit(profile, 'ciphertexts'),
      },
    ]);
  });

  it('skip message hashes not a string', () => {
    const profile = profileChange(sodium, 321, 1);
    const contact = contactChange(sodium, 123, 1);
    const batchResults: NotEmptyArrayOfBatchResults = [
      { code: 200, body: { hash: 123 as any as string } },
      { code: 200, body: { hash: 'hash2' } },
    ];
    const request: UserDestinationChanges = {
      allOldHashes: new Set(),
      messages: [profile, contact],
    };
    const results = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    expect(results).to.be.deep.eq([
      {
        messageHash: 'hash2',
        pushed: omit(contact, 'ciphertexts'),
      },
    ]);
  });

  it('skip message hashes not a string multipart', () => {
    const profile = profileChange(sodium, 321, 2);
    const contact = contactChange(sodium, 123, 1);
    const batchResults: NotEmptyArrayOfBatchResults = [
      { code: 200, body: { hash: 123 as any as string } },
      { code: 200, body: { hash: 'hash2' } },
    ];
    const request: UserDestinationChanges = {
      allOldHashes: new Set(),
      messages: [profile, contact],
    };
    const results = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    expect(results).to.be.deep.eq([
      // profile first result is not a string, so even if we have a result for both parts
      // of profile, it is not to be confirmedPushed
    ]);
  });

  it('skip request item without data', () => {
    const profile = profileChange(sodium, 321, 1);
    const contact = contactChange(sodium, 123, 1);
    profile.ciphertexts = profile.ciphertexts.map(_m => {
      return new Uint8Array();
    }); // no data, but still 2 ciphertexts
    const batchResults: NotEmptyArrayOfBatchResults = [
      { code: 200, body: { hash: 'hash1' } },
      { code: 200, body: { hash: 'hash2' } },
    ];
    const request: UserDestinationChanges = {
      allOldHashes: new Set(),
      messages: [profile as any as PendingChangesForUs, contact],
    };
    const results = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    // profile had no content at all (ciphertexts empty), so it was entirely skipped.
    // contact was sent, but hash1 should have been used for profile, so we should hash2 here only
    // (profile was of length 1 so it was not a multi part message)
    expect(results).to.be.deep.eq([
      {
        messageHash: 'hash2',
        pushed: omit(contact, 'ciphertexts'),
      },
    ]);
  });

  it('skip request item without data (multi-part)', () => {
    const profile = profileChange(sodium, 321, 2);
    const contact = contactChange(sodium, 123, 1);
    profile.ciphertexts = profile.ciphertexts.map(_m => {
      return new Uint8Array();
    }); // no data, but still 2 ciphertexts
    const batchResults: NotEmptyArrayOfBatchResults = [
      { code: 200, body: { hash: 'hash1' } },
      { code: 200, body: { hash: 'hash2' } },
    ];
    const request: UserDestinationChanges = {
      allOldHashes: new Set(),
      messages: [profile as any as PendingChangesForUs, contact],
    };
    const results = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    // profile had no content at all (ciphertexts empty), so it was entirely skipped.
    // contact was sent, but hash1 and hash2 should have been used for profile, so we have nothing here
    // (profile was of length 2 so it was a multi part message)
    expect(results).to.be.deep.eq([]);
  });

  it('skip request item without 200 code', () => {
    const profile = profileChange(sodium, 321, 1);
    const contact = contactChange(sodium, 123, 1);
    const batchResults: NotEmptyArrayOfBatchResults = [
      { code: 200, body: { hash: 'hash1' } },
      { code: 401, body: { hash: 'hash2' } },
    ];
    const request: UserDestinationChanges = {
      allOldHashes: new Set(),
      messages: [profile, contact],
    };
    const results = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    expect(results).to.be.deep.eq([
      {
        messageHash: 'hash1',
        pushed: omit(profile, 'ciphertexts'),
      },
    ]);

    // another test swapping the results
    batchResults[0].code = 401;
    batchResults[1].code = 200;
    const results2 = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    expect(results2).to.be.deep.eq([
      {
        messageHash: 'hash2',
        pushed: omit(contact, 'ciphertexts'),
      },
    ]);
  });

  it('skip request item without 200 code, but one multipart message was fully sent', () => {
    const profile = profileChange(sodium, 321, 2);
    const contact = contactChange(sodium, 123, 2);
    const batchResults: NotEmptyArrayOfBatchResults = [
      { code: 200, body: { hash: 'hash1' } },
      { code: 200, body: { hash: 'hash2' } },
      { code: 401, body: { hash: 'hash3' } },
      { code: 401, body: { hash: 'hash4' } },
    ];
    const request: UserDestinationChanges = {
      allOldHashes: new Set(),
      messages: [profile, contact],
    };
    const results = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    expect(results).to.be.deep.eq([
      {
        messageHash: 'hash1',
        pushed: omit(profile, 'ciphertexts'),
      },
      {
        messageHash: 'hash2',
        pushed: omit(profile, 'ciphertexts'),
      },
    ]);

    // another test swapping the results
    batchResults[0].code = 401;
    batchResults[1].code = 401;
    batchResults[2].code = 200;
    batchResults[3].code = 200;
    const results2 = LibSessionUtil.batchResultsToUserSuccessfulChange(batchResults, request);
    expect(results2).to.be.deep.eq([
      {
        messageHash: 'hash3',
        pushed: omit(contact, 'ciphertexts'),
      },
      {
        messageHash: 'hash4',
        pushed: omit(contact, 'ciphertexts'),
      },
    ]);
  });
});

describe('UserSyncJob pushChangesToUserSwarmIfNeeded', () => {
  let userkeys: TestUtils.TestUserKeyPairs;
  let sodium: LibSodiumWrappers;

  let sendStub: TypedStub<typeof MessageSender, 'sendEncryptedDataToSnode'>;
  let pendingChangesForUsStub: TypedStub<typeof LibSessionUtil, 'pendingChangesForUs'>;
  let dump: TypedStub<typeof UserGenericWrapperActions, 'dump'>;

  beforeEach(async () => {
    sodium = await getSodiumNode();
    userkeys = await TestUtils.generateUserKeyPairs();

    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(userkeys.x25519KeyPair.pubkeyHex);
    Sinon.stub(UserUtils, 'getUserED25519KeyPairBytes').resolves(userkeys.ed25519KeyPair);

    window.Whisper = { events: {} };
    window.Whisper.events.trigger = Sinon.mock();
    stubConfigDumpData('saveConfigDump').resolves();

    pendingChangesForUsStub = Sinon.stub(LibSessionUtil, 'pendingChangesForUs');
    dump = Sinon.stub(UserGenericWrapperActions, 'dump').resolves(new Uint8Array());
    sendStub = Sinon.stub(MessageSender, 'sendEncryptedDataToSnode');
  });
  afterEach(() => {
    Sinon.restore();
  });

  it('call savesDumpToDb even if no changes are required on the serverside', async () => {
    Sinon.stub(UserGenericWrapperActions, 'needsDump').resolves(true);
    const result = await UserSync.pushChangesToUserSwarmIfNeeded();

    pendingChangesForUsStub.resolves(undefined);
    expect(result).to.be.eq(RunJobResult.Success);
    expect(sendStub.callCount).to.be.eq(0);
    expect(pendingChangesForUsStub.callCount).to.be.eq(1);
    expect(dump.callCount).to.be.eq(4);
    expect(dump.getCalls().map(m => m.args)).to.be.deep.eq([
      ['UserConfig'],
      ['ContactsConfig'],
      ['UserGroupsConfig'],
      ['ConvoInfoVolatileConfig'],
    ]);
  });

  it('calls sendEncryptedDataToSnode and retry if network returned nothing', async () => {
    Sinon.stub(UserGenericWrapperActions, 'needsDump')
      .resolves(false)
      .onSecondCall()
      .resolves(true);

    const profile = profileChange(sodium, 321, 1);
    const contact = contactChange(sodium, 123, 1);
    const networkTimestamp = 4444;
    Sinon.stub(NetworkTime, 'now').returns(networkTimestamp);

    pendingChangesForUsStub.resolves({
      messages: [profile, contact],
      allOldHashes: new Set('123'),
    });
    const result = await UserSync.pushChangesToUserSwarmIfNeeded();

    sendStub.resolves(undefined);
    expect(result).to.be.eq(RunJobResult.RetryJobIfPossible); // not returning anything in the sendstub so network issue happened
    expect(sendStub.callCount).to.be.eq(1);
    expect(pendingChangesForUsStub.callCount).to.be.eq(1);
    expect(dump.callCount).to.be.eq(1);
    expect(dump.firstCall.args).to.be.deep.eq(['ContactsConfig']);
  });

  it('calls sendEncryptedDataToSnode with the right data x2 and retry if network returned nothing then success', async () => {
    const profile = profileChange(sodium, 321, 1);
    const contact = contactChange(sodium, 123, 1);
    const groups = groupChange(sodium, 111, 1);

    pendingChangesForUsStub.resolves({
      messages: [profile, contact, groups],
      allOldHashes: new Set('123'),
    });
    const changes: Array<UserSuccessfulChange> = [
      {
        pushed: omit(profile, 'ciphertexts'),
        messageHash: 'hashprofile',
      },
      {
        pushed: omit(contact, 'ciphertexts'),
        messageHash: 'hashcontact',
      },
      {
        pushed: omit(groups, 'ciphertexts'),
        messageHash: 'hashgroup',
      },
    ];
    Sinon.stub(LibSessionUtil, 'batchResultsToUserSuccessfulChange').returns(changes);
    const confirmPushed = Sinon.stub(UserGenericWrapperActions, 'confirmPushed').resolves();

    // all 4 need to be dumped
    const needsDump = Sinon.stub(UserGenericWrapperActions, 'needsDump').resolves(true);

    // ============ 1st try, let's say we didn't get as much entries in the result as expected. This should be a fail
    sendStub.resolves([
      { code: 200, body: { hash: 'hashprofile' } },
      { code: 200, body: { hash: 'hashcontact' } },
      { code: 200, body: { hash: 'hashgroup' } },
    ]);
    let result = await UserSync.pushChangesToUserSwarmIfNeeded();

    expect(sendStub.callCount).to.be.eq(1);
    expect(pendingChangesForUsStub.callCount).to.be.eq(1);
    expect(dump.getCalls().map(m => m.args)).to.be.deep.eq([
      ['UserConfig'],
      ['ContactsConfig'],
      ['UserGroupsConfig'],
      ['ConvoInfoVolatileConfig'],
    ]);
    expect(dump.callCount).to.be.eq(4);

    expect(needsDump.getCalls().map(m => m.args)).to.be.deep.eq([
      ['UserConfig'],
      ['ContactsConfig'],
      ['UserGroupsConfig'],
      ['ConvoInfoVolatileConfig'],
    ]);
    expect(needsDump.callCount).to.be.eq(4);

    expect(confirmPushed.callCount).to.be.eq(0); // first send failed, shouldn't confirm pushed
    expect(result).to.be.eq(RunJobResult.RetryJobIfPossible);

    // ============= second try: we now should get a success
    sendStub.resetHistory();
    sendStub.resolves([
      { code: 200, body: { hash: 'hashprofile2' } },
      { code: 200, body: { hash: 'hashcontact2' } },
      { code: 200, body: { hash: 'hashgroup2' } },
      { code: 200, body: {} }, // because we are giving a set of allOldHashes
    ]);
    changes.forEach(change => {
      // eslint-disable-next-line no-param-reassign
      change.messageHash += '2';
    });

    pendingChangesForUsStub.resetHistory();
    dump.resetHistory();
    needsDump.resetHistory();
    confirmPushed.resetHistory();
    result = await UserSync.pushChangesToUserSwarmIfNeeded();

    expect(sendStub.callCount).to.be.eq(1);
    expect(pendingChangesForUsStub.callCount).to.be.eq(1);
    expect(dump.getCalls().map(m => m.args)).to.be.deep.eq([
      ['UserConfig'],
      ['ContactsConfig'],
      ['UserGroupsConfig'],
      ['ConvoInfoVolatileConfig'],
      ['UserConfig'],
      ['ContactsConfig'],
      ['UserGroupsConfig'],
      ['ConvoInfoVolatileConfig'],
    ]);

    expect(needsDump.getCalls().map(m => m.args)).to.be.deep.eq([
      ['UserConfig'],
      ['ContactsConfig'],
      ['UserGroupsConfig'],
      ['ConvoInfoVolatileConfig'],
      ['UserConfig'],
      ['ContactsConfig'],
      ['UserGroupsConfig'],
      ['ConvoInfoVolatileConfig'],
    ]);

    expect(confirmPushed.getCalls().map(m => m.args)).to.be.deep.eq([
      ['UserConfig', { seqno: 321, hashes: ['hashprofile2'] }],
      ['ContactsConfig', { seqno: 123, hashes: ['hashcontact2'] }],
      ['UserGroupsConfig', { seqno: 111, hashes: ['hashgroup2'] }],
    ]);
    expect(confirmPushed.callCount).to.be.eq(3); // second send success, we should confirm the pushes of the 3 pushed messages

    expect(result).to.be.eq(RunJobResult.Success);
  });
});
