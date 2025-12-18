/**
 * ESLint rule to enforce $ prefix for transient props in styled-components
 * Requires: @emotion/is-prop-valid
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const isPropValid = require('@emotion/is-prop-valid').default;

// Pre-compiled regexes
const PROPS_TYPE_PATTERN = /Props?$|Style|Styled/;
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

  // Check data-* and aria-* prefixes (check length and hyphen position before expensive startsWith)
  if (firstChar === CHAR_d && name.length > 5 && name.charCodeAt(4) === CHAR_HYPHEN && name.startsWith('data-')) {
    return true;
  }
  if (firstChar === CHAR_a && name.length > 5 && name.charCodeAt(4) === CHAR_HYPHEN && name.startsWith('aria-')) {
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

// Check if a node is the 'styled' or 'css' identifier
function isStyledIdentifier(node) {
  if (node?.type !== 'Identifier') {
    return false;
  }
  const name = node.name;
  return name === 'styled' || name === 'css';
}

/**
 * Get the root identifier from a potentially chained expression
 * styled.div.attrs({}) -> styled
 * styled(Comp) -> styled
 */
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

// Reusable message data factory (avoid object allocation in hot path)
const createMessageData = (prop) => ({ prop });

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
      missingTransientPrefixInterface:
        'Interface/type prop "{{prop}}" for styled-component should use transient prop syntax "${{prop}}".',
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
          checkInterfaces: {
            type: 'boolean',
            default: true,
          },
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
    const additionalValidProps =
      options.additionalValidProps?.length > 0 ? new Set(options.additionalValidProps) : null;
    const ignorePatterns = options.ignoreComponentPatterns;
    const ignoreComponentPatterns =
      ignorePatterns?.length > 0 ? ignorePatterns.map(p => new RegExp(p)) : null;
    const checkInterfaces = options.checkInterfaces !== false;
    const checkJSXAttributes = options.checkJSXAttributes !== false;

    if (!checkInterfaces && !checkJSXAttributes) {
      return {};
    }

    const styledComponentNames = new Set();

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

    function reportInvalidProp(node, propName, isInterface) {
      context.report({
        node,
        messageId: isInterface ? 'missingTransientPrefixInterface' : 'missingTransientPrefix',
        data: createMessageData(propName),
      });
    }

    function checkTypeMembers(members) {
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const key = member.key;
        if (member.type === 'TSPropertySignature' && key?.type === 'Identifier') {
          const propName = key.name;
          if (!isValidProp(propName)) {
            reportInvalidProp(key, propName, true);
          }
        }
      }
    }

    function isStyledDeclaration(init) {
      // styled.div`...` or styled(Comp)`...`
      return init?.type === 'TaggedTemplateExpression' && isStyledTag(init.tag);
    }

    const visitors = {
      // Collect styled component names
      VariableDeclarator(node) {
        const id = node.id;
        if (id?.type === 'Identifier' && isStyledDeclaration(node.init)) {
          styledComponentNames.add(id.name);
        }
      },

      // Check inline type parameters in styled-components
      TaggedTemplateExpression(node) {
        if (!checkInterfaces) {
          return;
        }

        const tag = node.tag;
        if (!isStyledTag(tag)) {
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
    };

    // Only add interface checker if enabled
    if (checkInterfaces) {
      visitors.TSPropertySignature = function(node) {
        const key = node.key;
        if (!key || key.type !== 'Identifier') {
          return;
        }

        const propName = key.name;
        if (isValidProp(propName)) {
          return;
        }

        // Walk up to find containing interface/type
        let parent = node.parent;
        while (parent) {
          const parentType = parent.type;
          if (parentType === 'TSInterfaceDeclaration' || parentType === 'TSTypeAliasDeclaration') {
            const typeName = parent.id?.name;
            if (typeName && PROPS_TYPE_PATTERN.test(typeName)) {
              reportInvalidProp(key, propName, true);
            }
            return;
          }
          parent = parent.parent;
        }
      };
    }

    // Only add JSX checker if enabled
    if (checkJSXAttributes) {
      visitors.JSXAttribute = function(node) {
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

        if (styledComponentNames.has(componentName) || STYLED_COMPONENT_PATTERN.test(componentName)) {
          reportInvalidProp(nodeName, propName, false);
        }
      };
    }

    return visitors;
  },
};
