import { ElementType, ReactElement, ReactNode } from 'react';
import { AnimatePresence, MotionGlobalConfig } from 'framer-motion';
import { isArray, unset } from 'lodash';
// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from 'chai';
import { type SessionDataTestId } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import TestRenderer from 'react-test-renderer';
import { Provider } from 'react-redux';
import { SessionTheme } from '../../themes/SessionTheme';
import { themeStore } from '../../state/theme/store';

const Providers = ({ children }: { children: ReactNode }) => {
  MotionGlobalConfig.skipAnimations = false;

  return (
    <Provider store={themeStore}>
      <SessionTheme>
        <AnimatePresence>
          <ErrorBoundary
            fallback={<>{`Failed to render a component!\n\t${JSON.stringify(children)}`}</>}
          >
            {children}
          </ErrorBoundary>
        </AnimatePresence>
      </SessionTheme>
    </Provider>
  );
};

function renderComponent(children: ReactElement): TestRenderer.ReactTestRenderer {
  return TestRenderer.create(<Providers>{children}</Providers>);
}

function getComponentTree(
  result: TestRenderer.ReactTestRenderer
): Array<TestRenderer.ReactTestRendererTree> {
  const trees = result.toTree();
  return !trees ? [] : isArray(trees) ? trees : [trees];
}

function findByDataTestId(
  renderResult: TestRenderer.ReactTestRenderer,
  dataTestId: SessionDataTestId
): TestRenderer.ReactTestInstance {
  return renderResult.root.findByProps({ 'data-testid': dataTestId });
}

function findAllByElementType(
  renderResult: TestRenderer.ReactTestRenderer,
  elementType: ElementType
): Array<TestRenderer.ReactTestInstance> {
  return renderResult.root.findAllByType(elementType);
}

function expectResultToBeEqual(
  renderResult: TestRenderer.ReactTestRenderer,
  renderResult2: TestRenderer.ReactTestRenderer
) {
  const obj = renderResult.toJSON();
  const obj2 = renderResult2.toJSON();
  // Note : we ignore data test ids for equality checks
  unset(obj, "props['data-testid']");
  unset(obj2, "props['data-testid']");
  expect(obj).to.be.deep.eq(obj2);
}

export {
  expectResultToBeEqual,
  findAllByElementType,
  findByDataTestId,
  getComponentTree,
  renderComponent,
};
