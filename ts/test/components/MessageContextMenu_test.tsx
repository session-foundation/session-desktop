/* eslint-disable import/no-extraneous-dependencies */
import { expect } from 'chai';
import Sinon from 'sinon';
import { showMessageContextMenu } from '../../components/conversation/message/message-content/MessageContextMenu';
import * as contextMenu from '../../util/contextMenu';

describe('MessageContextMenu', () => {
  afterEach(() => {
    Sinon.restore();
    document.body.innerHTML = '';
  });

  it('uses the nearest attachment index when right-clicking nested elements', () => {
    const showStub = Sinon.stub(contextMenu, 'showContextMenu');

    const attachmentWrapper = document.createElement('div');
    attachmentWrapper.setAttribute('data-attachmentindex', '2');

    const svg = document.createElement('svg');
    const path = document.createElement('path');
    svg.appendChild(path);
    attachmentWrapper.appendChild(svg);
    document.body.appendChild(attachmentWrapper);

    showMessageContextMenu({
      id: 'message-context-menu',
      event: {
        target: path,
        clientX: 40,
        clientY: 60,
      } as any,
    });

    expect(showStub.calledOnce).to.equal(true);
    const params = showStub.firstCall.args[0] as any;
    expect((params.props as any)?.dataAttachmentIndex).to.equal(2);
  });
});
