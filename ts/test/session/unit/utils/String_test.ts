/* eslint-disable no-unused-expressions */
import ByteBuffer from 'bytebuffer';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

// Can't import type as StringUtils.Encoding
import { StringUtils } from '../../../../session/utils';
import { Encoding } from '../../../../session/utils/String';

chai.use(chaiAsPromised as any);

const { expect } = chai;

describe('String Utils', () => {
  describe('encode', () => {
    it('can encode to base64', () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'base64');

      expect(encoded instanceof ArrayBuffer).to.equal(
        true,
        'a buffer was not returned from `encode`'
      );
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('can encode to hex', () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'hex');

      expect(encoded instanceof ArrayBuffer).to.equal(
        true,
        'a buffer was not returned from `encode`'
      );
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('wont encode invalid hex', () => {
      const testString = 'ZZZZZZZZZZ';
      const encoded = StringUtils.encode(testString, 'hex');

      expect(encoded.byteLength).to.equal(0);
    });

    it('can encode to binary', () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'binary');

      expect(encoded instanceof ArrayBuffer).to.equal(
        true,
        'a buffer was not returned from `encode`'
      );
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('can encode to utf8', () => {
      const testString = 'AAAAAAAAAA';
      const encoded = StringUtils.encode(testString, 'binary');

      expect(encoded instanceof ArrayBuffer).to.equal(
        true,
        'a buffer was not returned from `encode`'
      );
      expect(encoded.byteLength).to.be.greaterThan(0);
    });

    it('can encode empty string', () => {
      const testString = '';
      expect(testString).to.have.length(0);

      const allEncodedings = (['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>).map(e =>
        StringUtils.encode(testString, e)
      );

      allEncodedings.forEach(encoded => {
        expect(encoded instanceof ArrayBuffer).to.equal(
          true,
          'a buffer was not returned from `encode`'
        );
        expect(encoded.byteLength).to.equal(0);
      });
    });

    it('can encode huge string', () => {
      const stringSize = 2 ** 16;
      const testString = Array(stringSize).fill('0').join('');

      const allEncodedings = (['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>).map(e =>
        StringUtils.encode(testString, e)
      );

      allEncodedings.forEach(encoded => {
        expect(encoded instanceof ArrayBuffer).to.equal(
          true,
          'a buffer was not returned from `encode`'
        );
        expect(encoded.byteLength).to.be.greaterThan(0);
      });
    });

    it("won't encode illegal string length in hex", () => {
      const testString = 'A';
      const encode = () => StringUtils.encode(testString, 'hex');

      // Ensure string is odd length
      expect(testString.length % 2).to.equal(1);
      expect(encode).to.throw('Illegal str: Length not a multiple of 2');
    });

    it('can encode obscure string', () => {
      const testString =
        '↓←¶ᶑᵶ⅑⏕→⅓‎ᵹ⅙ᵰᶎ⅔⅗↔‌ᶈ⅞⁯⸜ᶊ⁬ᵴᶉ↉⁭¥ᶖᶋᶃᶓ⏦ᵾᶂᶆ↕⸝ᶔᶐ⏔£⏙⅐⅒ᶌ⁁ᶘᶄᶒ⁪ᶸ⅘‏⁮⅚⅛ᶙᶇᶕᶀ↑ᵿ⏠ᶍᵯ⏖⏗⅜ᶚᶏ⁊‍ᶁᶗᵽ⁫ᵼ⅝⏘⅖⅕⏡';

      // Not valid hex format; try test the others
      const encodings = ['base64', 'binary', 'utf8'] as Array<Encoding>;

      encodings.forEach(encoding => {
        const encoded = StringUtils.encode(testString, encoding);
        expect(encoded instanceof ArrayBuffer).to.equal(
          true,
          `a buffer was not returned using encoding: '${encoding}'`
        );
        expect(encoded.byteLength).to.be.greaterThan(0);
      });
    });
  });

  describe('decode', () => {
    it('can decode empty buffer', () => {
      const buffer = new ByteBuffer(0);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length(0);
      });
    });

    it('can decode huge buffer', () => {
      const bytes = 2 ** 16;
      const bufferString = Array(bytes).fill('A').join('');
      const buffer = ByteBuffer.fromUTF8(bufferString);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });

    it('can decode from ByteBuffer', () => {
      const buffer = ByteBuffer.fromUTF8('AAAAAAAAAA');

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });

    it('can decode from Buffer', () => {
      const arrayBuffer = new ArrayBuffer(10);
      const buffer = Buffer.from(arrayBuffer);
      buffer.writeUInt8(0, 0);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });

    it('can decode from ArrayBuffer', () => {
      const buffer = new ArrayBuffer(10);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });

    it('can decode from Uint8Array', () => {
      const buffer = new Uint8Array(10);

      const encodings = ['base64', 'hex', 'binary', 'utf8'] as Array<Encoding>;

      // Each encoding should be valid
      encodings.forEach(encoding => {
        const decoded = StringUtils.decode(buffer, encoding);

        expect(decoded.length).to.exist;
        expect(typeof decoded === 'string');
        expect(decoded).to.have.length.greaterThan(0);
      });
    });
  });

  // NOTE: these utility functions help printing the unicode chars when a test fails
  function replaceUnicodeWithCode(text: string) {
    // Regular expression to match any character outside the basic Latin ASCII range (printable characters).
    // The 'g' flag ensures all occurrences are replaced.
    // The 'u' flag enables full Unicode support for the regex.
    return text.replace(/[\u0080-\uffff]/gu, char => {
      // Convert the character's Unicode code point to its hexadecimal representation.
      // Pad with leading zeros to ensure a four-digit hex code for \uXXXX.
      const hexCode = char.charCodeAt(0).toString(16).padStart(4, '0');
      return `\\u${hexCode}`;
    });
  }

  function formatError(idx: number, input: string, expected: string) {
    return `(${idx}) Expected: ${replaceUnicodeWithCode(input)} to equal ${replaceUnicodeWithCode(expected)}`;
  }

  describe('trimWhitespace', () => {
    it('should remove invalid outer characters', () => {
      const invalidStrings = ['word ', ' word ', '​word​', '‎‎​word ​​​'];
      const expected = 'word';
      invalidStrings.forEach((inputString, i) => {
        const trimmedString = StringUtils.trimWhitespace(inputString);
        expect(trimmedString, formatError(i, trimmedString, expected)).to.equal(expected);
      });
    });

    it('should not remove whitespace on the inside of the string', () => {
      const invalidStrings = ['wor d ', 'wor​d​', 'wor‎‎​d ​​​'];
      const validStrings = ['wor d', 'wor​d', 'wor‎‎​d'];
      for (let i = 0; i < invalidStrings.length; i++) {
        const input = invalidStrings[i];
        const expected = validStrings[i];
        expect(StringUtils.trimWhitespace(input), formatError(i, input, expected)).to.equal(
          expected
        );
      }
    });

    it('should not modify strings without outer whitespace', () => {
      const invalidStrings = ['wor d', 'wor​d', 'wor‎‎​d'];
      const validStrings = ['wor d', 'wor​d', 'wor‎‎​d'];
      for (let i = 0; i < invalidStrings.length; i++) {
        const input = invalidStrings[i];
        const expected = validStrings[i];
        expect(StringUtils.trimWhitespace(input), formatError(i, input, expected)).to.equal(
          expected
        );
      }
    });
  });
});
