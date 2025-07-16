import { assert, expect } from 'chai';
import * as PasswordUtil from '../../../../util/passwordUtils';

describe('Password Util', () => {
  describe('hash generation', () => {
    it('generates the same hash for the same phrase', () => {
      const first = PasswordUtil.generateHash('phrase');
      const second = PasswordUtil.generateHash('phrase');
      assert.strictEqual(first, second);
    });
    it('generates different hashes for different phrases', () => {
      const first = PasswordUtil.generateHash('0');
      const second = PasswordUtil.generateHash('1');
      assert.notStrictEqual(first, second);
    });
  });

  describe('hash matching', () => {
    it('returns true for the same hash', () => {
      const phrase = 'phrase';
      const hash = PasswordUtil.generateHash(phrase);
      expect(PasswordUtil.matchesHash(phrase, hash)).to.be.eq(true);
    });
    it('returns false for different hashes', () => {
      const hash = PasswordUtil.generateHash('phrase');
      expect(PasswordUtil.matchesHash('phrase2', hash)).to.be.eq(false);
    });
  });

  describe('password validation', () => {
    it('should return nothing if password is valid', () => {
      const valid = [
        '123456',
        '1a5b3C6g',
        ')CZcy@ccHa',
        'C$D--M;Xv+',
        'X8-;!47IW|',
        'Oi74ZpoSx,p',
        '>]K1*g^swHW0]F6}{',
        'TiJf@lk^jsO^z8MUn%)[Sd~UPQ)ci9CGS@jb<^',
        '$u&%{r]apg#G@3dQdCkB_p8)gxhNFr=K&yfM_M8O&2Z.vQyvx',
        'bf^OMnYku*iX;{Piw_0zvz',
        '@@@@/???\\4545',
        '#'.repeat(50),
      ];
      valid.forEach(pass => {
        assert.isNull(PasswordUtil.validatePassword(pass));
      });
    });

    it('should return an error if password is not a string', () => {
      const invalid = [0, 123456, [], {}, null, undefined] as any;
      invalid.forEach((pass: any) => {
        assert.strictEqual(
          PasswordUtil.validatePassword(pass),
          'Password must only contain letters, numbers and symbols'
        );
      });
    });

    it('should return an error if password is not between 6 and 256 characters', () => {
      const invalid = ['a', 'abcde', '#'.repeat(257), '#'.repeat(300)];
      invalid.forEach(pass => {
        assert.strictEqual(
          PasswordUtil.validatePassword(pass),
          'Password must be between 6 and 256 characters long'
        );
      });
    });

    it('should return an error if password has invalid characters', () => {
      const invalid = [
        'ʍʪց3Wͪ݌bΉf',
        ')É{b)͎ÔȩҜ٣',
        'ߓܑ˿G֖=3¤)P',
        'ݴ`ԚfĬ8ӝrH(',
        'e̹ωͻܺȬۺ#dӄ',
        '谀뤼筎笟ꅅ栗塕카ꭴ',
        '俈꛷࿩迭䰡钑럭䛩銛뤙',
        '봟㉟ⓓ༭꽫㊡䶷쒨⻯颰',
        '<@ȦƘΉوۉaҋ<',
      ];
      invalid.forEach(pass => {
        assert.strictEqual(
          PasswordUtil.validatePassword(pass),
          'Password must only contain letters, numbers and symbols'
        );
      });
    });
  });
});
