import { expect } from 'chai';

import { isEditableEventTarget, isEditableTarget } from '../../util/isEditableTarget';

describe('isEditableTarget', () => {
  it('rejects missing targets', () => {
    expect(isEditableTarget(null)).to.equal(false);
  });

  it('rejects regular elements', () => {
    expect(isEditableTarget(document.createElement('div'))).to.equal(false);
  });

  it('recognizes editable form controls', () => {
    expect(isEditableTarget(document.createElement('input'))).to.equal(true);
    expect(isEditableTarget(document.createElement('textarea'))).to.equal(true);
    expect(isEditableTarget(document.createElement('select'))).to.equal(true);
  });

  it('rejects buttons', () => {
    expect(isEditableTarget(document.createElement('button'))).to.equal(false);
  });

  it('recognizes contenteditable elements', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'plaintext-only');

    expect(isEditableTarget(editor)).to.equal(true);
  });

  it('recognizes children of contenteditable elements', () => {
    const editor = document.createElement('div');
    const child = document.createElement('span');
    editor.setAttribute('contenteditable', 'true');
    editor.appendChild(child);

    expect(isEditableTarget(child)).to.equal(true);
  });

  it('recognizes non-editable children inside contenteditable elements', () => {
    const editor = document.createElement('div');
    const child = document.createElement('span');
    editor.setAttribute('contenteditable', 'plaintext-only');
    child.setAttribute('contenteditable', 'false');
    editor.appendChild(child);

    expect(isEditableTarget(child)).to.equal(true);
  });

  it('rejects disabled contenteditable elements', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'false');

    expect(isEditableTarget(editor)).to.equal(false);
  });

  it('rejects invalid contenteditable values', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'inherit');

    expect(isEditableTarget(editor)).to.equal(false);
  });
});

describe('isEditableEventTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // composedPath() is empty once dispatch ends, so it is inspected from inside the listener.
  function keydownSeenByDocument(origin: HTMLElement) {
    let seen: { target: EventTarget | null; editable: boolean } | undefined;
    const listener = (e: KeyboardEvent) => {
      seen = { target: e.target, editable: isEditableEventTarget(e) };
    };
    document.addEventListener('keydown', listener, true);
    origin.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
    document.removeEventListener('keydown', listener, true);
    if (!seen) {
      throw new Error('keydown never reached the document');
    }
    return seen;
  }

  it('recognizes an input inside a shadow root', () => {
    const host = document.createElement('div');
    const input = document.createElement('input');
    host.attachShadow({ mode: 'open' }).appendChild(input);
    document.body.appendChild(host);

    const seen = keydownSeenByDocument(input);

    expect(seen.target).to.equal(host);
    expect(seen.editable).to.equal(true);
  });

  it('rejects a non-editable element inside a shadow root', () => {
    const host = document.createElement('div');
    const button = document.createElement('button');
    host.attachShadow({ mode: 'open' }).appendChild(button);
    document.body.appendChild(host);

    expect(keydownSeenByDocument(button).editable).to.equal(false);
  });
});
