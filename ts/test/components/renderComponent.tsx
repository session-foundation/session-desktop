/* eslint-disable import/no-extraneous-dependencies */
import type { ReactElement, ReactNode, SessionDataTestId } from 'react';
import { AnimatePresence, MotionGlobalConfig } from 'framer-motion';
import { render, RenderResult, screen, within } from '@testing-library/react';
import { ErrorBoundary } from 'react-error-boundary';
import { Provider } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import { SessionTheme } from '../../themes/SessionTheme';
import { themeStore } from '../../state/theme/store';

const Providers = ({ children }: { children: ReactNode }) => {
  useMount(() => {
    MotionGlobalConfig.skipAnimations = false;
  });

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

/**
 * Renders a component wrapped with all necessary providers.
 * Returns the render result from @testing-library/react.
 */
function renderComponent(children: ReactElement<any>): RenderResult {
  return render(<Providers>{children}</Providers>);
}

/**
 * Finds an element by its data-testid attribute.
 * Throws if not found.
 */
function findByDataTestId(renderResult: RenderResult, dataTestId: SessionDataTestId): HTMLElement {
  return within(renderResult.container).getByTestId(dataTestId);
}

/**
 * Finds all elements matching a given role.
 * Use this as a replacement for findAllByElementType.
 * Common roles: 'button', 'textbox', 'img', 'link', 'checkbox', etc.
 * For SVGs, use queryAllByRole or container.querySelectorAll.
 */
function findAllByRole(renderResult: RenderResult, role: string): Array<HTMLElement> {
  return within(renderResult.container).queryAllByRole(role);
}

/**
 * Finds all elements by tag name (useful for elements like 'input', 'svg', etc.)
 * This is a direct replacement for findAllByElementType when you need to query by tag.
 */
function findAllByTagName<T extends Element = HTMLElement>(
  renderResult: RenderResult,
  tagName: string
): Array<T> {
  return Array.from(renderResult.container.querySelectorAll<T>(tagName));
}

/**
 * Compares two render results for equality.
 * Note: This is a simplified comparison using container innerHTML.
 * For more robust comparisons, consider snapshot testing with Jest.
 */
function expectContainersToBeEqual(renderResult: RenderResult, renderResult2: RenderResult) {
  // Remove data-testid attributes for comparison
  const cleanHtml = (container: HTMLElement): string => {
    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-testid]').forEach(el => {
      el.removeAttribute('data-testid');
    });
    return clone.innerHTML;
  };

  const html1 = cleanHtml(renderResult.container);
  const html2 = cleanHtml(renderResult2.container);

  if (html1 !== html2) {
    throw new Error('Rendered outputs are not equal');
  }
}

export {
  expectContainersToBeEqual,
  findAllByRole,
  findAllByTagName,
  findByDataTestId,
  renderComponent,
  screen,
  within,
};
