/**
 * ESLint rule to enforce $ prefix for transient props in styled-components
 *
 * This rule checks:
 * 1. Props in styled-component interface/type definitions that use non-standard HTML attributes
 * 2. Props passed to styled components in JSX
 * 3. Inline type parameters in styled-components template literals
 *
 * Requires: npm install @emotion/is-prop-valid --save-dev
 */
// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
const isPropValid = require('@emotion/is-prop-valid').default;

// Check if prop is a valid DOM attribute
function isValidDOMAttribute(name) {
  // data-* and aria-* are always valid
  if (name.startsWith('data-') || name.startsWith('aria-')) {
    return true;
  }

  return isPropValid(name);
}

// Check if prop uses transient syntax ($ prefix)
function isTransientProp(name) {
  return name.startsWith('$');
}

// Get the names of styled components declared in the file
function getStyledComponentNames(context) {
  const styledComponents = new Set();
  const sourceCode = context.getSourceCode();
  const ast = sourceCode.ast;

  function traverse(node) {
    if (!node) {
      return;
    }

    if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
      const initText = sourceCode.getText(node.init);
      if (/styled[\s\S]*`|styled\s*\(/.test(initText)) {
        styledComponents.add(node.id.name);
      }
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const key of Object.keys(node)) {
      if (key === 'parent') {
        continue;
      }
      const child = node[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          child.forEach(traverse);
        } else if (child.type) {
          traverse(child);
        }
      }
    }
  }

  traverse(ast);
  return styledComponents;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce $ prefix for transient props in styled-components to prevent passing non-DOM attributes to HTML elements',
      category: 'Best Practices',
      recommended: true,
      url: 'https://styled-components.com/docs/api#transient-props',
    },
    // NOTE: We intentionally do NOT provide auto-fix because:
    // 1. Renaming a prop requires updating ALL usages (interface, component, JSX attributes)
    // 2. ESLint can only fix the single node it reports on
    // 3. Partial fixes break TypeScript compilation
    // Use your IDE's "Rename Symbol" (F2 in VS Code) to properly rename props
    fixable: null,
    messages: {
      missingTransientPrefix:
        // eslint-disable-next-line no-template-curly-in-string
        'Prop "{{prop}}" should use transient prop syntax "${{prop}}" to avoid passing to DOM. See https://styled-components.com/docs/api#transient-props',
      missingTransientPrefixInterface:
        // eslint-disable-next-line no-template-curly-in-string
        'Interface/type prop "{{prop}}" for styled-component should use transient prop syntax "${{prop}}".',
      missingDependency:
        '@emotion/is-prop-valid is not installed. Install it for better DOM prop detection: npm install @emotion/is-prop-valid --save-dev',
    },
    schema: [
      {
        type: 'object',
        properties: {
          // Allow users to specify additional valid props
          additionalValidProps: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
          // Allow users to ignore certain component patterns
          ignoreComponentPatterns: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
          // Whether to check interface/type definitions
          checkInterfaces: {
            type: 'boolean',
            default: true,
          },
          // Whether to check JSX attributes
          checkJSXAttributes: {
            type: 'boolean',
            default: true,
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const additionalValidProps = new Set(options.additionalValidProps || []);
    const ignoreComponentPatterns = (options.ignoreComponentPatterns || []).map(p => new RegExp(p));
    const checkInterfaces = options.checkInterfaces !== false;
    const checkJSXAttributes = options.checkJSXAttributes !== false;

    // Warn once if @emotion/is-prop-valid is not installed
    let hasWarnedAboutMissingDep = false;

    function warnAboutMissingDep(node) {
      if (!isPropValid && !hasWarnedAboutMissingDep) {
        hasWarnedAboutMissingDep = true;
        context.report({
          node,
          messageId: 'missingDependency',
        });
      }
    }

    function shouldIgnoreComponent(name) {
      return ignoreComponentPatterns.some(pattern => pattern.test(name));
    }

    function isValidProp(name) {
      return isTransientProp(name) || isValidDOMAttribute(name) || additionalValidProps.has(name);
    }

    // Cache for styled component names in this file
    let styledComponentNamesCache = null;

    function getStyledComponentNamesLazy() {
      if (styledComponentNamesCache === null) {
        styledComponentNamesCache = getStyledComponentNames(context);
      }
      return styledComponentNamesCache;
    }

    return {
      // Check TypeScript interface/type properties for styled-components
      TSPropertySignature(node) {
        if (!checkInterfaces) {
          return;
        }
        if (!node.key || !node.key.name) {
          return;
        }

        const propName = node.key.name;

        // Skip if it's already a valid prop
        if (isValidProp(propName)) {
          return;
        }

        // Check if this interface/type is used with styled-components
        let parent = node.parent;
        while (parent) {
          if (
            parent.type === 'TSInterfaceDeclaration' ||
            parent.type === 'TSTypeAliasDeclaration'
          ) {
            const typeName = parent.id?.name || '';
            // Common patterns for styled-component prop types
            if (/Props?$|Style|Styled/.test(typeName)) {
              warnAboutMissingDep(node);
              context.report({
                node: node.key,
                messageId: 'missingTransientPrefixInterface',
                data: { prop: propName },
              });
            }
            break;
          }
          parent = parent.parent;
        }
      },

      // Check JSX attributes passed to styled components
      JSXAttribute(node) {
        if (!checkJSXAttributes) {
          return;
        }
        if (!node.name || node.name.type !== 'JSXIdentifier') {
          return;
        }

        const propName = node.name.name;

        // Skip if it's already a valid prop
        if (isValidProp(propName)) {
          return;
        }

        // Get the JSX element name
        const jsxElement = node.parent;
        if (!jsxElement || jsxElement.type !== 'JSXOpeningElement') {
          return;
        }

        const elementName = jsxElement.name;
        if (!elementName) {
          return;
        }

        let componentName = '';
        if (elementName.type === 'JSXIdentifier') {
          componentName = elementName.name;
        } else if (elementName.type === 'JSXMemberExpression') {
          componentName = elementName.property?.name || '';
        }

        // Skip native HTML elements (lowercase)
        if (componentName && componentName[0] === componentName[0].toLowerCase()) {
          return;
        }

        // Skip if component should be ignored
        if (shouldIgnoreComponent(componentName)) {
          return;
        }

        // Check if this is a known styled component
        const styledComponents = getStyledComponentNamesLazy();

        // Only report if it's a known styled component OR if it matches common patterns
        if (styledComponents.has(componentName) || /^(Styled|S[A-Z])/.test(componentName)) {
          warnAboutMissingDep(node);
          context.report({
            node: node.name,
            messageId: 'missingTransientPrefix',
            data: { prop: propName },
          });
        }
      },

      // Check tagged template expressions for inline prop usage in styled-components
      TaggedTemplateExpression(node) {
        // Check for styled.div<{customProp: boolean}>`` pattern
        const tag = node.tag;
        if (!tag) {
          return;
        }

        // Get type parameters if they exist
        let typeParams = null;

        if (tag.typeParameters) {
          typeParams = tag.typeParameters;
        } else if (tag.callee?.typeParameters) {
          typeParams = tag.callee.typeParameters;
        }

        if (!typeParams?.params) {
          return;
        }

        // Check if this is a styled-components call
        const sourceCode = context.getSourceCode();
        const tagText = sourceCode.getText(tag).split('<')[0];

        if (!/styled|css/.test(tagText)) {
          return;
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const param of typeParams.params) {
          // Handle inline type literal: styled.div<{ customProp: boolean }>
          if (param.type === 'TSTypeLiteral' && param.members) {
            // eslint-disable-next-line no-restricted-syntax
            for (const member of param.members) {
              if (member.type === 'TSPropertySignature' && member.key?.name) {
                const propName = member.key.name;
                if (!isValidProp(propName)) {
                  warnAboutMissingDep(member);
                  context.report({
                    node: member.key,
                    messageId: 'missingTransientPrefixInterface',
                    data: { prop: propName },
                  });
                }
              }
            }
          }
        }
      },
    };
  },
};
