import os from 'os';
import Sinon from 'sinon';
import { expect } from 'chai';

import * as Settings from '../../types/Settings';

describe('Settings', () => {
  describe('isAudioNotificationSupported', () => {
    context('on macOS', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('darwin');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        expect(Settings.isAudioNotificationSupported()).to.be.eq(true);
      });
    });

    context('on Windows', () => {
      context('version 7', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('7.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return false', () => {
          expect(Settings.isAudioNotificationSupported()).to.be.eq(false);
        });
      });

      context('version 8+', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('8.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return true', () => {
          expect(Settings.isAudioNotificationSupported()).to.be.eq(true);
        });
      });
    });

    context('on Linux', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('linux');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        expect(Settings.isAudioNotificationSupported()).to.be.eq(true);
      });
    });
  });

  describe('isNotificationGroupingSupported', () => {
    context('on macOS', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('darwin');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        expect(Settings.isNotificationGroupingSupported()).to.be.eq(true);
      });
    });

    context('on Windows', () => {
      context('version 7', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('7.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return false', () => {
          expect(Settings.isNotificationGroupingSupported()).to.be.eq(false);
        });
      });

      context('version 8+', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('8.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return true', () => {
          expect(Settings.isNotificationGroupingSupported()).to.be.eq(true);
        });
      });
    });

    context('on Linux', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('linux');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        expect(Settings.isNotificationGroupingSupported()).to.be.eq(true);
      });
    });
  });
  describe('isHideMenuBarSupported', () => {
    context('on macOS', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('darwin');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return false', () => {
        expect(Settings.isHideMenuBarSupported()).to.be.eq(false);
      });
    });

    context('on Windows', () => {
      context('version 7', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('7.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return true', () => {
          expect(Settings.isHideMenuBarSupported()).to.be.eq(true);
        });
      });

      context('version 8+', () => {
        beforeEach(() => {
          Sinon.stub(process, 'platform').value('win32');
          Sinon.stub(os, 'release').returns('8.0.0');
        });

        afterEach(() => {
          Sinon.restore();
        });

        it('should return true', () => {
          expect(Settings.isHideMenuBarSupported()).to.be.eq(true);
        });
      });
    });

    context('on Linux', () => {
      beforeEach(() => {
        Sinon.stub(process, 'platform').value('linux');
      });

      afterEach(() => {
        Sinon.restore();
      });

      it('should return true', () => {
        expect(Settings.isHideMenuBarSupported()).to.be.eq(true);
      });
    });
  });
});
