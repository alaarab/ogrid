const React = require('react');

/**
 * Minimal Jest mock for @fluentui/react-accordion.
 * It only needs to provide basic renderable components
 * so that our tests can run without pulling in the real
 * implementation (which currently fails to resolve).
 */

function createSimpleComponent(tag, displayName) {
  const Component = (props) =>
    React.createElement(tag, { 'data-mock': displayName, ...props }, props.children);
  Component.displayName = displayName;
  return Component;
}

const Accordion = createSimpleComponent('div', 'Accordion');
const AccordionItem = createSimpleComponent('div', 'AccordionItem');
const AccordionHeader = createSimpleComponent('div', 'AccordionHeader');
const AccordionPanel = createSimpleComponent('div', 'AccordionPanel');

module.exports = {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
};

