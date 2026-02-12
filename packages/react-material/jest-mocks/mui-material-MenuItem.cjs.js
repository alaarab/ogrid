const React = require('react');

function MenuItem(props) {
  const { children, value, ...rest } = props || {};
  return React.createElement('div', { value, 'data-mock': 'MenuItem', role: 'menuitem', ...rest }, children);
}
MenuItem.displayName = 'MenuItem';

module.exports = MenuItem;
