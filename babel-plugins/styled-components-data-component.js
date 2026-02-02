/**
 * Babel plugin to automatically add data-component attribute to styled-components.
 *
 * Transforms:
 *   const StyledButton = styled.div`...`
 * Into:
 *   const StyledButton = styled.div.attrs({ 'data-component': 'StyledButton' })`...`
 *
 * Also handles:
 *   - styled(Component)`...`
 *   - styled.div.attrs({ existing: 'attrs' })`...` (merges with existing attrs)
 *   - Skips if data-component already exists
 */

module.exports = function styledComponentsDataComponent({ types: t }) {
  /**
   * Check if a node represents the styled-components default export
   * Handles both source and compiled forms:
   * - styled (source)
   * - styled_components_1.default (compiled CommonJS)
   */
  function isStyledDefault(node) {
    // Source form: styled
    if (t.isIdentifier(node) && node.name === 'styled') {
      return true;
    }

    // Compiled form: styled_components_1.default or similar_xxx.default
    if (t.isMemberExpression(node)) {
      const obj = node.object;
      const prop = node.property;
      if (
        t.isIdentifier(obj) &&
        obj.name.startsWith('styled_components') &&
        t.isIdentifier(prop) &&
        prop.name === 'default'
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a node is a styled-components tagged template expression
   * Handles compiled patterns like:
   * - styled_components_1.default.div`...`
   * - (0, styled_components_1.default)(Component)`...`
   */
  function isStyledTaggedTemplate(tag) {
    if (!tag) {
      return false;
    }

    // styled.div, styled_components_1.default.div, etc.
    if (t.isMemberExpression(tag)) {
      const obj = tag.object;

      // Direct: styled.div or styled_components_1.default.div
      if (isStyledDefault(obj)) {
        return true;
      }

      // Chained: styled.div.attrs(...) or styled_components_1.default.div.attrs(...)
      if (t.isMemberExpression(obj) || t.isCallExpression(obj)) {
        return isStyledTaggedTemplate(obj);
      }
    }

    // styled(Component) or (0, styled_components_1.default)(Component)
    if (t.isCallExpression(tag)) {
      const callee = tag.callee;

      // Direct call: styled(Component)
      if (isStyledDefault(callee)) {
        return true;
      }

      // Compiled call: (0, styled_components_1.default)(Component)
      if (t.isSequenceExpression(callee)) {
        const expressions = callee.expressions;
        if (expressions.length >= 2 && isStyledDefault(expressions[expressions.length - 1])) {
          return true;
        }
      }

      // Chained: styled(Component).attrs(...)
      if (t.isMemberExpression(callee)) {
        return isStyledTaggedTemplate(callee.object);
      }
    }

    return false;
  }

  /**
   * Check if the tag already has .attrs() with data-component
   */
  function hasDataComponent(tag) {
    if (!t.isCallExpression(tag)) {
      return false;
    }

    const callee = tag.callee;
    if (!t.isMemberExpression(callee)) {
      return false;
    }
    if (!t.isIdentifier(callee.property) || callee.property.name !== 'attrs') {
      return false;
    }

    const args = tag.arguments;
    if (!args || args.length === 0) {
      return false;
    }

    const firstArg = args[0];

    // Check object literal: .attrs({ 'data-component': '...' })
    if (t.isObjectExpression(firstArg)) {
      return firstArg.properties.some(prop => {
        if (!t.isObjectProperty(prop)) {
          return false;
        }
        const key = prop.key;
        if (t.isStringLiteral(key) && key.value === 'data-component') {
          return true;
        }
        if (t.isIdentifier(key) && key.name === 'data-component') {
          return true;
        }
        return false;
      });
    }

    // Check arrow function: .attrs(() => ({ 'data-component': '...' }))
    if (t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg)) {
      const body = firstArg.body;
      if (t.isObjectExpression(body)) {
        return body.properties.some(prop => {
          if (!t.isObjectProperty(prop)) {
            return false;
          }
          const key = prop.key;
          if (t.isStringLiteral(key) && key.value === 'data-component') {
            return true;
          }
          if (t.isIdentifier(key) && key.name === 'data-component') {
            return true;
          }
          return false;
        });
      }
    }

    return false;
  }

  /**
   * Find existing .attrs() call in the tag chain
   */
  function findAttrsCall(tag) {
    if (!tag) {
      return null;
    }

    if (t.isCallExpression(tag)) {
      const callee = tag.callee;
      if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.property) &&
        callee.property.name === 'attrs'
      ) {
        return tag;
      }
    }

    return null;
  }

  /**
   * Create data-component property
   */
  function createDataComponentProperty(componentName) {
    return t.objectProperty(t.stringLiteral('data-component'), t.stringLiteral(componentName));
  }

  /**
   * Create .attrs({ 'data-component': 'Name' }) call
   */
  function createAttrsCall(baseTag, componentName) {
    return t.callExpression(t.memberExpression(baseTag, t.identifier('attrs')), [
      t.objectExpression([createDataComponentProperty(componentName)]),
    ]);
  }

  /**
   * Add data-component to existing attrs object
   */
  function addToExistingAttrs(attrsCall, componentName) {
    const args = attrsCall.arguments;
    if (!args || args.length === 0) {
      // Empty attrs() - add the object
      args.push(t.objectExpression([createDataComponentProperty(componentName)]));
      return;
    }

    const firstArg = args[0];

    // Object literal
    if (t.isObjectExpression(firstArg)) {
      firstArg.properties.unshift(createDataComponentProperty(componentName));
      return;
    }

    // Arrow function with object return
    if (t.isArrowFunctionExpression(firstArg) && t.isObjectExpression(firstArg.body)) {
      firstArg.body.properties.unshift(createDataComponentProperty(componentName));
    }

    // For other cases (function with block body, etc.), we can't easily modify
    // So we wrap: .attrs(existing).attrs({ 'data-component': 'Name' })
    // This is handled by returning false and letting the caller chain a new .attrs()
  }

  return {
    name: 'styled-components-data-component',
    visitor: {
      TaggedTemplateExpression(path) {
        const tag = path.node.tag;

        if (!isStyledTaggedTemplate(tag)) {
          return;
        }

        // Get component name from variable declaration
        const parent = path.parent;
        if (!t.isVariableDeclarator(parent)) {
          return;
        }

        const id = parent.id;
        if (!t.isIdentifier(id)) {
          return;
        }

        const componentName = id.name;

        // Check if data-component already exists
        if (hasDataComponent(tag)) {
          return;
        }

        // Check for existing .attrs() call
        const existingAttrs = findAttrsCall(tag);

        if (existingAttrs) {
          // Add to existing attrs
          addToExistingAttrs(existingAttrs, componentName);
        } else {
          // Create new .attrs() call
          const newTag = createAttrsCall(tag, componentName);
          // eslint-disable-next-line no-param-reassign
          path.node.tag = newTag;
        }
      },
    },
  };
};
