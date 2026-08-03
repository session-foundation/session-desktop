import { expect } from 'chai';
import { ProWrapperNode } from 'libsession_util_nodejs';
import Sinon from 'sinon';
import { getSodiumNode } from '../../../../node/sodiumNode';

const masterPrivKey = '4d3ffd1e98982ee64b86990901a73d3627536b4103ce8d006cb836d45a525c51';
const rotatingPrivKey = '3e6933de326f5647769f7b3e6db2ca6469c768141be9384276a3692ea04cbee7';

describe('libsession_pro', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('proFeaturesForMessage', () => {
    it('no need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          codepointCount: 5,
        })
      ).to.deep.eq({
        proMessageBitset: 0n,
        status: 'SUCCESS',
        error: null,
      });
    });

    it('expects 10K_CHARACTER_LIMIT to be added if need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          codepointCount: 9000,
        })
      ).to.deep.eq({
        proMessageBitset: 1n,
        status: 'SUCCESS',
        error: null,
      });
    });
  });

  describe('proRevocationsRequest', () => {
    it('throws if invalid input', async () => {
      expect(() =>
        ProWrapperNode.proRevocationsRequest({
          ticket: 'randomstr' as any as number,
        })
      ).to.throw();

      expect(() => ProWrapperNode.proRevocationsRequest({} as any)).to.throw();
    });

    it('generates a valid request', async () => {
      expect(ProWrapperNode.proRevocationsRequest({ ticket: 0 })).to.be.deep.eq({
        endpoint: 'get_pro_revocations',
        contentType: 'application/json',
        body: '{"ticket":0}',
      });

      expect(ProWrapperNode.proRevocationsRequest({ ticket: 1234 })).to.be.deep.eq({
        endpoint: 'get_pro_revocations',
        contentType: 'application/json',
        body: '{"ticket":1234}',
      });

      expect(ProWrapperNode.proRevocationsRequest({ ticket: 1265893200 })).to.be.deep.eq({
        endpoint: 'get_pro_revocations',
        contentType: 'application/json',
        body: '{"ticket":1265893200}',
      });
    });
  });

  describe('proProofRequest', () => {
    it('generates a valid request', async () => {
      // NOTE: the wire timestamp is in whole seconds, so the ms we hand in gets floored.
      const validContent = {
        master_pkey: '3ec4ff1928220d599cccbf8d76002e80191c286906bc18987f46fd9688418852',
        master_sig:
          '119672683ad26a1475657749d22242cac855f109457df384d8144b5026630e4ad1f45e60ebabc08edf18d2d12b528482b8943f31c0ad145c2cfc6fade020100e',
        rotating_pkey: '574b0063d782e6b56beac6c1b67766f0f81ecacf66ab7efefd2c9a65d6c8de88',
        rotating_sig:
          '7c9e0bcd6cdad351a6c223412070e3c8da105b7ca44e8de5f4dcac113af093fcd16ec9ce07228b5dcb983bf1e51f14f34c82feeb5e37e6bf10d3380377a55509',
        ts: 1761884113,
      };

      await getSodiumNode();
      const request = ProWrapperNode.proProofRequest({
        masterPrivKeyHex: masterPrivKey,
        rotatingPrivKeyHex: rotatingPrivKey,
        unixTsMs: 1761884113627,
      });

      expect(request.endpoint).to.be.eq('generate_pro_proof');
      expect(request.contentType).to.be.eq('application/json');
      expect(JSON.parse(request.body)).to.deep.eq(validContent);
    });
  });

  describe('proStatusRequest', () => {
    it('generates a valid request', async () => {
      const validContent = {
        master_pkey: '3ec4ff1928220d599cccbf8d76002e80191c286906bc18987f46fd9688418852',
        master_sig:
          '60b4f0b4522be79dcb35798d085cd2bd80ab9047a6578e791de824e1d12690e30153b2feb77b3781f4eb6ae521aa85150a799231e5e5ffd605354551ef50560c',
        ts: 1761884113,
      };

      await getSodiumNode();
      const request = ProWrapperNode.proStatusRequest({
        masterPrivKeyHex: masterPrivKey,
        unixTsMs: 1761884113627,
      });

      expect(request.endpoint).to.be.eq('get_pro_status');
      expect(request.contentType).to.be.eq('application/json');
      expect(JSON.parse(request.body)).to.deep.eq(validContent);
    });
  });
});
