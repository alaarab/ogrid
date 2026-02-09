const React = require('react');

function createIcon(displayName) {
  const Icon = (props) => React.createElement('span', { 'data-mock': displayName, ...props });
  Icon.displayName = displayName;
  Icon.muiName = 'SvgIcon';
  return Icon;
}

module.exports = {
  Search: createIcon('Search'),
  ArrowUpward: createIcon('ArrowUpward'),
  ArrowDownward: createIcon('ArrowDownward'),
  SwapVert: createIcon('SwapVert'),
  FilterList: createIcon('FilterList'),
  ViewColumn: createIcon('ViewColumn'),
  ExpandMore: createIcon('ExpandMore'),
  ExpandLess: createIcon('ExpandLess'),
  FirstPage: createIcon('FirstPage'),
  LastPage: createIcon('LastPage'),
  ChevronLeft: createIcon('ChevronLeft'),
  ChevronRight: createIcon('ChevronRight'),
  Settings: createIcon('Settings'),
  Clear: createIcon('Clear'),
  Close: createIcon('Close'),
};
