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

// DataGrid and friends – children-based mock that mirrors real Fluent structure
function createTableColumn(config) {
  return config;
}

const DataGridContext = React.createContext({ columns: [], items: [], getRowId: null });

function DataGrid(props) {
  const {
    items = [],
    columns = [],
    getRowId,
    children,
    className,
    style,
    resizableColumns,
    resizableColumnsOptions,
    columnSizingOptions,
    focusMode,
    onColumnResize,
    ...rest
  } = props || {};
  return React.createElement(
    DataGridContext.Provider,
    { value: { columns, items, getRowId } },
    React.createElement('table', { 'data-mock': 'DataGrid', className, style, ...rest }, children)
  );
}
DataGrid.displayName = 'DataGrid';

function DataGridHeader(props) {
  const { children, ...rest } = props || {};
  return React.createElement('thead', { ...rest }, children);
}
DataGridHeader.displayName = 'DataGridHeader';

function DataGridRow(props) {
  const { children, className, onClick, ...rest } = props || {};
  const { columns } = React.useContext(DataGridContext);
  if (typeof children === 'function') {
    const cells = columns.map((col, idx) => {
      const el = children({
        renderHeaderCell: col.renderHeaderCell || (() => null),
        renderCell: col.renderCell || (() => null),
        columnId: col.columnId || String(idx),
      });
      return React.cloneElement(el, { key: col.columnId || idx });
    });
    return React.createElement('tr', { className, onClick }, cells);
  }
  return React.createElement('tr', { className, onClick }, children);
}
DataGridRow.displayName = 'DataGridRow';

function DataGridHeaderCell(props) {
  const { children, className, ...rest } = props || {};
  return React.createElement('th', { className }, children);
}
DataGridHeaderCell.displayName = 'DataGridHeaderCell';

function DataGridBody(props) {
  const { children, ...rest } = props || {};
  const { items, getRowId } = React.useContext(DataGridContext);
  if (typeof children === 'function') {
    return React.createElement(
      'tbody',
      null,
      items.map((item, idx) => {
        const rowId = getRowId ? getRowId(item) : idx;
        const el = children({ item, rowId });
        return React.cloneElement(el, { key: rowId });
      })
    );
  }
  return React.createElement('tbody', null, children);
}
DataGridBody.displayName = 'DataGridBody';

function DataGridCell(props) {
  const { children, className, ...rest } = props || {};
  return React.createElement('td', { className }, children);
}
DataGridCell.displayName = 'DataGridCell';

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

  // DataGrid-related exports used by the table wrapper
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridBody,
  DataGridCell,
  createTableColumn,
};

