/* eslint-disable import/no-extraneous-dependencies */
import { expect } from 'chai';
import Sinon from 'sinon';

import { TestUtils } from '../test-utils';
import { findAllByElementType, renderComponent } from './renderComponent';
import { SimpleSessionInput } from '../../components/inputs/SessionInput';

describe('SessionInput', () => {
  beforeEach(() => {
    TestUtils.stubSVGElement();
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('should render an input', async () => {
    const result = renderComponent(
      <SimpleSessionInput
        type="text"
        errorDataTestId={null as any}
        onEnterPressed={null as any}
        onValueChanged={null as any}
        providedError={null as any}
      />
    );
    const inputElements = findAllByElementType(result, 'input');
    expect(inputElements.length, 'should have an input element').to.equal(1);
    result.unmount();
  });
});
