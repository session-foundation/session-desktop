import { expect } from 'chai';
import { describe } from 'mocha';
import type { UserGroupsGet } from 'libsession_util_nodejs';
import { isErasedGroupStub } from '../../../../receiver/erasedGroupStub';

const stub: UserGroupsGet = {
  pubkeyHex: `03${'ab'.repeat(32)}`,
  secretKey: null,
  authData: null,
  name: null,
  invitePending: false,
  kicked: false,
  destroyed: true,
  priority: 0,
  joinedAtSeconds: 0,
  disappearingTimerSeconds: 0,
};

describe('isErasedGroupStub', () => {
  it('is true for a removed entry with no name and no keys', () => {
    expect(isErasedGroupStub(stub)).to.eq(true);
    expect(isErasedGroupStub({ ...stub, destroyed: false, kicked: true })).to.eq(true);
    expect(isErasedGroupStub({ ...stub, name: '' })).to.eq(true);
  });

  it('treats empty key arrays, as the wrapper returns them, as no key', () => {
    expect(
      isErasedGroupStub({
        ...stub,
        secretKey: new Uint8Array(0) as any,
        authData: new Uint8Array(0) as any,
      })
    ).to.eq(true);
  });

  it('is false for a destroyed group we were in, which keeps its name', () => {
    expect(isErasedGroupStub({ ...stub, name: 'Book club' })).to.eq(false);
  });

  it('is false for an entry with an admin key or auth data', () => {
    expect(isErasedGroupStub({ ...stub, secretKey: new Uint8Array(64).fill(1) as any })).to.eq(
      false
    );
    expect(isErasedGroupStub({ ...stub, authData: new Uint8Array(100).fill(7) as any })).to.eq(
      false
    );
  });

  it('is false for a group still in use, even without a name', () => {
    expect(isErasedGroupStub({ ...stub, destroyed: false })).to.eq(false);
  });
});
