import { expect } from 'chai';

import { isEditableTarget } from '../../util/isEditableTarget';

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
