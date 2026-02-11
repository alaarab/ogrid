const React = require('react');

/**
 * Minimal Jest mock for @fluentui/react-badge.
 * We only need basic renderable components; styling and
 * real behavior are not important for our tests.
 */

function createSimpleComponent(tag, displayName) {
  const Component = (props) =>
    React.createElement(tag, { 'data-mock': displayName, ...props }, props.children);
  Component.displayName = displayName;
  return Component;
}

const Badge = createSimpleComponent('span', 'Badge');
const CounterBadge = createSimpleComponent('span', 'CounterBadge');

module.exports = {
  Badge,
  CounterBadge,
};

