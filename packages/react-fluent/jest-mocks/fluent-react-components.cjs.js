const React = require('react');

/**
 * Jest mock for @fluentui/react-components.
 *
 * This provides lightweight stand-ins for the specific components
 * used in this project so that tests can run without pulling in
 * the real Fluent UI implementation (which has packaging issues
 * under Jest in this environment).
 */

// Helpers
function passthroughElement(tag, displayName) {
  const Component = (props) =>
    React.createElement(tag, { 'data-mock': displayName, ...props }, props.children);
  Component.displayName = displayName;
  return Component;
}

// Button -> native <button>
function Button(props) {
  const { children, icon, ...rest } = props || {};
  return React.createElement(
    'button',
    {
      type: rest.type || 'button',
      'data-mock': 'Button',
      ...rest,
    },
    icon,
    children
  );
}
Button.displayName = 'Button';

// Select -> native <select> that maps to (event, data) shape
function Select(props) {
  const { children, onChange, ...rest } = props || {};

  const handleChange = (event) => {
    if (typeof onChange === 'function') {
      onChange(event, { value: event.target.value });
    }
  };

  return React.createElement(
    'select',
    {
      'data-mock': 'Select',
      ...rest,
      onChange: handleChange,
    },
    children
  );
}
Select.displayName = 'Select';

// Input -> native <input> that maps to (event, data) shape
function Input(props) {
  const { children, onChange, contentBefore, ...rest } = props || {};

  const handleChange = (event) => {
    if (typeof onChange === 'function') {
      onChange(event, { value: event.target.value });
    }
  };

  return React.createElement(
    'div',
    { 'data-mock': 'InputWrapper' },
    contentBefore,
    React.createElement('input', {
      ...rest,
      onChange: handleChange,
    }),
    children
  );
}
Input.displayName = 'Input';

// Checkbox -> native <input type="checkbox"> with { checked } data
function Checkbox(props) {
  const { onChange, label, ...rest } = props || {};

  const handleChange = (event) => {
    if (typeof onChange === 'function') {
      onChange(event, { checked: event.target.checked });
    }
  };

  return React.createElement(
    'label',
    { 'data-mock': 'Checkbox' },
    React.createElement('input', {
      type: 'checkbox',
      ...rest,
      onChange: handleChange,
    }),
    label
  );
}
Checkbox.displayName = 'Checkbox';

// Spinner -> simple div
const Spinner = passthroughElement('div', 'Spinner');

// Avatar -> simple div that shows name
function Avatar(props) {
  const { children, ...rest } = props || {};
  // Do not render the name directly to avoid duplicate
  // text matches in tests that search by display name.
  const content = children || null;
  return React.createElement(
    'div',
    {
      'data-mock': 'Avatar',
      ...rest,
    },
    content
  );
}
Avatar.displayName = 'Avatar';

// Tooltip -> passthrough (ColumnHeaderFilter); omit Fluent-only props so they don't reach DOM
function Tooltip(props) {
  const { children, content, relationship, withArrow, ...rest } = props || {};
  return React.createElement('span', { 'data-mock': 'Tooltip', title: content, ...rest }, children);
}
Tooltip.displayName = 'Tooltip';

// Layout / styling utilities used by ColumnChooser
function makeStyles(styleDef) {
  return function useStyles() {
    const classes = {};
    Object.keys(styleDef || {}).forEach((key) => {
      classes[key] = `mock-${key}`;
    });
    return classes;
  };
}

// Very loose token proxy – just return empty strings
const tokens = new Proxy(
  {},
  {
    get: () => '',
  }
);

function mergeClasses(...args) {
  return args.filter(Boolean).join(' ');
}

// Table primitives – pure visual wrappers around native HTML table elements.
// No state management, no items/columns props — just render children.

function Table(props) {
  const { children, className, style, role, noNativeElements, size, sortable, ...rest } = props || {};
  return React.createElement('table', { className, style, role, ...rest }, children);
}
Table.displayName = 'Table';

function TableHeader(props) {
  const { children, className, ...rest } = props || {};
  return React.createElement('thead', { className, ...rest }, children);
}
TableHeader.displayName = 'TableHeader';

function TableRow(props) {
  const { children, className, onClick, ...rest } = props || {};
  return React.createElement('tr', { className, onClick, ...rest }, children);
}
TableRow.displayName = 'TableRow';

function TableHeaderCell(props) {
  const { children, className, style, ...rest } = props || {};
  return React.createElement('th', { className, style, ...rest }, children);
}
TableHeaderCell.displayName = 'TableHeaderCell';

function TableBody(props) {
  const { children, ...rest } = props || {};
  return React.createElement('tbody', rest, children);
}
TableBody.displayName = 'TableBody';

function TableCell(props) {
  const { children, className, style, ...rest } = props || {};
  return React.createElement('td', { className, style, ...rest }, children);
}
TableCell.displayName = 'TableCell';

// Popover -> renders children only when open
function Popover(props) {
  const { open, children } = props || {};
  if (!open) return null;
  return React.createElement(React.Fragment, null, children);
}
Popover.displayName = 'Popover';

// PopoverSurface -> simple div
function PopoverSurface(props) {
  const { children, ...rest } = props || {};
  return React.createElement('div', { 'data-mock': 'PopoverSurface', ...rest }, children);
}
PopoverSurface.displayName = 'PopoverSurface';

module.exports = {
  // Core form / input components used in this project
  Button,
  Select,
  Input,
  Checkbox,
  Spinner,
  Avatar,
  Tooltip,

  // Popover components
  Popover,
  PopoverSurface,

  // Styling helpers
  makeStyles,
  tokens,
  mergeClasses,

  // Table primitives (pure visual, no behavior)
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
};
