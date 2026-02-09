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

// DataGrid and friends – minimal implementation that renders headers & cells
function createTableColumn(config) {
  // In this mock we just pass the config through as the column object
  return config;
}

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
    ...rest
  } = props || {};
  const tableProps = { 'data-mock': 'DataGrid', className, style, ...rest };

  return React.createElement(
    'table',
    tableProps,
    React.createElement(
      'thead',
      null,
      React.createElement(
        'tr',
        null,
        columns.map((col, idx) =>
          React.createElement(
            'th',
            { key: col.columnId || idx },
            typeof col.renderHeaderCell === 'function' ? col.renderHeaderCell() : null
          )
        )
      )
    ),
    React.createElement(
      'tbody',
      null,
      items.map((item, rowIndex) => {
        const rowId = getRowId ? getRowId(item) : rowIndex;
        return React.createElement(
          'tr',
          { key: rowId },
          columns.map((col, idx) =>
            React.createElement(
              'td',
              { key: col.columnId || idx },
              typeof col.renderCell === 'function' ? col.renderCell(item) : null
            )
          )
        );
      })
    )
  );
}
DataGrid.displayName = 'DataGrid';

// Child helpers – no-op components, since our DataGrid ignores children
function DataGridHeader() {
  return null;
}
function DataGridRow() {
  return null;
}
function DataGridHeaderCell(props) {
  return React.createElement('th', { 'data-mock': 'DataGridHeaderCell' }, props.children);
}
function DataGridBody() {
  return null;
}
function DataGridCell(props) {
  return React.createElement('td', { 'data-mock': 'DataGridCell' }, props.children);
}

module.exports = {
  // Core form / input components used in this project
  Button,
  Select,
  Input,
  Checkbox,
  Spinner,
  Avatar,
  Tooltip,

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

