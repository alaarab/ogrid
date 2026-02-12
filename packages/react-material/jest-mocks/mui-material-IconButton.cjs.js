const React = require('react');

function IconButton(props) {
  const { children, ...rest } = props || {};
  return React.createElement('button', { type: 'button', 'data-mock': 'IconButton', ...rest }, children);
}
IconButton.displayName = 'IconButton';

module.exports = IconButton;
