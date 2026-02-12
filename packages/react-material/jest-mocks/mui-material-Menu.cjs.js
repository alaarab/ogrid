const React = require('react');

function Menu(props) {
  const { children, open, onClose, anchorEl, MenuListProps, ...rest } = props || {};
  if (!open) return null;
  const { dense, ...menuListAttrs } = MenuListProps || {};
  return React.createElement('div', { 'data-mock': 'Menu', role: 'menu', ...rest, ...menuListAttrs }, children);
}
Menu.displayName = 'Menu';

module.exports = Menu;
