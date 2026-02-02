/**
 * ESLint rule to enforce $ prefix for transient props in styled-components
 * Requires: @emotion/is-prop-valid
 */

const isPropValid = require('@emotion/is-prop-valid').default;

// Pre-compiled regex
const STYLED_COMPONENT_PATTERN = /^Styled[A-Z]/;

// Character codes for fast comparison
const CHAR_$ = 36;
const CHAR_a = 97;
const CHAR_d = 100;
const CHAR_z = 122;
const CHAR_HYPHEN = 45;

const propValidCache = new Map();

function isValidDOMAttributeCached(name) {
  let result = propValidCache.get(name);
  if (result === undefined) {
    result = isPropValid(name);
    propValidCache.set(name, result);
  }
  return result;
}

function isValidDOMAttribute(name) {
  const firstChar = name.charCodeAt(0);

  if (
    firstChar === CHAR_d &&
    name.length > 5 &&
    name.charCodeAt(4) === CHAR_HYPHEN &&
    name.startsWith('data-')
  ) {
    return true;
  }
  if (
    firstChar === CHAR_a &&
    name.length > 5 &&
    name.charCodeAt(4) === CHAR_HYPHEN &&
    name.startsWith('aria-')
  ) {
    return true;
  }

  return isValidDOMAttributeCached(name);
}

function isTransientProp(name) {
  return name.charCodeAt(0) === CHAR_$;
}

function isNativeElement(name) {
  const firstChar = name.charCodeAt(0);
  return firstChar >= CHAR_a && firstChar <= CHAR_z;
}

function isStyledIdentifier(node) {
  if (node?.type !== 'Identifier') {
    return false;
  }
  const name = node.name;
  return name === 'styled' || name === 'css';
}

function getRootIdentifier(node) {
  if (!node) {
    return null;
  }

  switch (node.type) {
    case 'Identifier':
      return node;

    case 'MemberExpression':
      return getRootIdentifier(node.object);

    case 'CallExpression':
      return getRootIdentifier(node.callee);

    default:
      return null;
  }
}

function isStyledTag(tag) {
  const root = getRootIdentifier(tag);
  return isStyledIdentifier(root);
}

/**
 * Determines if a styled-components tag targets a DOM element directly.
 *
 * Returns:
 *   - true: styled.div, styled.span, styled('div'), etc. (props go to DOM)
 *   - false: styled(Component), styled(OtherStyledComponent) (props go to component)
 */
function isStyledDOMElement(tag) {
  if (!tag) {
    return false;
  }

  // styled.div`` or styled.div.attrs({})``
  if (tag.type === 'MemberExpression') {
    let current = tag;

    while (current?.type === 'MemberExpression') {
      const obj = current.object;

      if (obj?.type === 'Identifier' && (obj.name === 'styled' || obj.name === 'css')) {
        const prop = current.property;
        if (prop?.type === 'Identifier') {
          return isNativeElement(prop.name);
        }
      }

      if (obj?.type === 'MemberExpression') {
        current = obj;
        continue;
      }

      if (obj?.type === 'CallExpression') {
        return isStyledDOMElement(obj);
      }

      break;
    }

    return false;
  }

  // styled(Component)`` or styled('div')``
  if (tag.type === 'CallExpression') {
    const callee = tag.callee;

    if (callee?.type === 'Identifier' && callee.name === 'styled') {
      const args = tag.arguments;
      if (args && args.length > 0) {
        const firstArg = args[0];

        if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          return isNativeElement(firstArg.value);
        }

        if (firstArg.type === 'Identifier') {
          return false;
        }
      }
    }

    if (callee?.type === 'MemberExpression') {
      if (callee.property?.name === 'attrs') {
        return isStyledDOMElement(callee.object);
      }
      return isStyledDOMElement(callee);
    }
  }

  return false;
}

const createMessageData = prop => ({ prop });

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
    fixable: null,
    messages: {
      missingTransientPrefix:
        'Prop "{{prop}}" should use transient prop syntax "${{prop}}" to avoid passing to DOM. See https://styled-components.com/docs/api#transient-props',
      missingTransientPrefixInline:
        'Inline type prop "{{prop}}" should use transient prop syntax "${{prop}}".',
    },
    schema: [
      {
        type: 'object',
        properties: {
          additionalValidProps: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
          ignoreComponentPatterns: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const additionalValidProps =
      options.additionalValidProps?.length > 0 ? new Set(options.additionalValidProps) : null;
    const ignorePatterns = options.ignoreComponentPatterns;
    const ignoreComponentPatterns =
      ignorePatterns?.length > 0 ? ignorePatterns.map(p => new RegExp(p)) : null;

    // Track styled components that wrap DOM elements vs other components
    const styledDOMComponents = new Set();
    const styledNonDOMComponents = new Set();

    function shouldIgnoreComponent(name) {
      if (!ignoreComponentPatterns) {
        return false;
      }
      for (let i = 0; i < ignoreComponentPatterns.length; i++) {
        if (ignoreComponentPatterns[i].test(name)) {
          return true;
        }
      }
      return false;
    }

    function isValidProp(name) {
      if (isTransientProp(name)) {
        return true;
      }
      if (additionalValidProps?.has(name)) {
        return true;
      }
      return isValidDOMAttribute(name);
    }

    function checkTypeMembers(members) {
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const key = member.key;
        if (member.type === 'TSPropertySignature' && key?.type === 'Identifier') {
          const propName = key.name;
          if (!isValidProp(propName)) {
            context.report({
              node: key,
              messageId: 'missingTransientPrefixInline',
              data: createMessageData(propName),
            });
          }
        }
      }
    }

    function isStyledDeclaration(init) {
      return init?.type === 'TaggedTemplateExpression' && isStyledTag(init.tag);
    }

    return {
      // Collect styled component names and categorize them
      VariableDeclarator(node) {
        const id = node.id;
        if (id?.type === 'Identifier' && isStyledDeclaration(node.init)) {
          const name = id.name;
          const tag = node.init.tag;

          if (isStyledDOMElement(tag)) {
            styledDOMComponents.add(name);
          } else {
            styledNonDOMComponents.add(name);
          }
        }
      },

      // Check inline type parameters in styled-components (e.g., styled.div<{ customProp: boolean }>)
      TaggedTemplateExpression(node) {
        const tag = node.tag;
        if (!isStyledTag(tag)) {
          return;
        }

        // Only check if this is a styled DOM element
        if (!isStyledDOMElement(tag)) {
          return;
        }

        const typeParams = tag.typeParameters || tag.callee?.typeParameters;
        const params = typeParams?.params;
        if (!params) {
          return;
        }

        for (let i = 0; i < params.length; i++) {
          const param = params[i];
          if (param.type === 'TSTypeLiteral' && param.members) {
            checkTypeMembers(param.members);
          }
        }
      },

      // Check JSX attributes passed to styled components
      JSXAttribute(node) {
        const nodeName = node.name;
        if (!nodeName || nodeName.type !== 'JSXIdentifier') {
          return;
        }

        const propName = nodeName.name;
        if (isValidProp(propName)) {
          return;
        }

        const jsxElement = node.parent;
        if (jsxElement?.type !== 'JSXOpeningElement') {
          return;
        }

        const elementName = jsxElement.name;
        if (!elementName) {
          return;
        }

        let componentName;
        const elementType = elementName.type;

        if (elementType === 'JSXIdentifier') {
          componentName = elementName.name;
        } else if (elementType === 'JSXMemberExpression') {
          componentName = elementName.property?.name;
        }

        if (!componentName || isNativeElement(componentName)) {
          return;
        }

        if (shouldIgnoreComponent(componentName)) {
          return;
        }

        // Skip if this is a styled component that wraps a non-DOM component
        if (styledNonDOMComponents.has(componentName)) {
          return;
        }

        // Check if it's a known styled DOM component or matches naming pattern
        if (
          styledDOMComponents.has(componentName) ||
          STYLED_COMPONENT_PATTERN.test(componentName)
        ) {
          context.report({
            node: nodeName,
            messageId: 'missingTransientPrefix',
            data: createMessageData(propName),
          });
        }
      },
    };
  },
};
