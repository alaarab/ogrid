const React = require('react');

function passthroughElement(tag, displayName) {
  const Component = (props) =>
    React.createElement(tag, { 'data-mock': displayName, ...props }, props.children);
  Component.displayName = displayName;
  return Component;
}

function Button(props) {
  const { children, startIcon, endIcon, ...rest } = props || {};
  return React.createElement('button', { type: rest.type || 'button', 'data-mock': 'Button', ...rest }, startIcon, children, endIcon);
}
Button.displayName = 'Button';

function IconButton(props) {
  const { children, ...rest } = props || {};
  return React.createElement('button', { type: 'button', 'data-mock': 'IconButton', ...rest }, children);
}
IconButton.displayName = 'IconButton';

function TextField(props) {
  const { children, onChange, InputProps, inputProps, label, ...rest } = props || {};
  const handleChange = (event) => {
    if (typeof onChange === 'function') onChange(event);
  };
  return React.createElement('div', { 'data-mock': 'TextField' },
    label ? React.createElement('label', null, label) : null,
    InputProps?.startAdornment || null,
    React.createElement('input', { ...rest, ...(inputProps || {}), onChange: handleChange }),
    children
  );
}
TextField.displayName = 'TextField';

function Checkbox(props) {
  const { onChange, checked, ...rest } = props || {};
  const handleChange = (event) => {
    if (typeof onChange === 'function') onChange(event, event.target.checked);
  };
  return React.createElement('input', { type: 'checkbox', checked, onChange: handleChange, 'data-mock': 'Checkbox', ...rest });
}
Checkbox.displayName = 'Checkbox';

function FormControlLabel(props) {
  const { control, label, ...rest } = props || {};
  return React.createElement('label', { 'data-mock': 'FormControlLabel', ...rest }, control, label);
}
FormControlLabel.displayName = 'FormControlLabel';

function Select(props) {
  const { children, onChange, value, ...rest } = props || {};
  const handleChange = (event) => {
    if (typeof onChange === 'function') onChange(event);
  };
  return React.createElement('select', { 'data-mock': 'Select', value, onChange: handleChange, ...rest }, children);
}
Select.displayName = 'Select';

function MenuItem(props) {
  const { children, value, ...rest } = props || {};
  return React.createElement('option', { value, 'data-mock': 'MenuItem', ...rest }, children);
}
MenuItem.displayName = 'MenuItem';

function Avatar(props) {
  const { children, src, alt, ...rest } = props || {};
  return React.createElement('div', { 'data-mock': 'Avatar', ...rest }, children || (alt ? alt.charAt(0) : null));
}
Avatar.displayName = 'Avatar';

function Tooltip(props) {
  const { children, title, ...rest } = props || {};
  return React.createElement('span', { 'data-mock': 'Tooltip', title, ...rest }, children);
}
Tooltip.displayName = 'Tooltip';

function Popover(props) {
  const { children, open, onClose, anchorEl, ...rest } = props || {};
  if (!open) return null;
  return React.createElement('div', { 'data-mock': 'Popover', ...rest }, children);
}
Popover.displayName = 'Popover';

const CircularProgress = passthroughElement('div', 'CircularProgress');
const Box = passthroughElement('div', 'Box');
const Typography = passthroughElement('span', 'Typography');
const Divider = passthroughElement('hr', 'Divider');
const InputAdornment = passthroughElement('span', 'InputAdornment');

function Menu(props) {
  const { children, open, onClose, anchorEl, MenuListProps, ...rest } = props || {};
  if (!open) return null;
  const { dense, ...menuListAttrs } = MenuListProps || {};
  return React.createElement('div', { 'data-mock': 'Menu', role: 'menu', ...rest, ...menuListAttrs }, children);
}
Menu.displayName = 'Menu';

const Table = passthroughElement('table', 'Table');
const TableHead = passthroughElement('thead', 'TableHead');
const TableBody = passthroughElement('tbody', 'TableBody');
const TableRow = passthroughElement('tr', 'TableRow');
function TableCell(props) {
  const { component = 'td', children, padding, ...rest } = props || {};
  return React.createElement(component, { 'data-mock': 'TableCell', ...rest }, children);
}
TableCell.displayName = 'TableCell';
const TableContainer = passthroughElement('div', 'TableContainer');

// Export as named exports
module.exports = {
  Button,
  IconButton,
  TextField,
  Checkbox,
  FormControlLabel,
  Select,
  Menu,
  MenuItem,
  Avatar,
  Tooltip,
  Popover,
  CircularProgress,
  Box,
  Typography,
  Divider,
  InputAdornment,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
};

// Also export each as default for default imports
// This allows both `import { Menu } from '@mui/material'` and `import Menu from '@mui/material/Menu'`
module.exports.default = module.exports;
