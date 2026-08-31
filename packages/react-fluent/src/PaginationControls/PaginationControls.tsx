import * as React from 'react';
import { Button, Select } from '@fluentui/react-components';
import type { SelectOnChangeData } from '@fluentui/react-components';
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  ChevronDoubleLeftRegular,
  ChevronDoubleRightRegular,
} from '@fluentui/react-icons';
import type { IPaginationControlsProps } from '@alaarab/ogrid-react';
import {
  PaginationControlsBase,
  type INavButtonSlotProps,
  type IPageButtonSlotProps,
  type IPageSizeSelectSlotProps,
  type IPaginationControlsSlots,
  type PaginationControlsBaseClassNames,
} from '@alaarab/ogrid-react';
import styles from './PaginationControls.module.scss';

export type { IPaginationControlsProps };

const FLUENT_NAV_ICONS = {
  first: <ChevronDoubleLeftRegular />,
  prev: <ChevronLeftRegular />,
  next: <ChevronRightRegular />,
  last: <ChevronDoubleRightRegular />,
} as const;

const NavButton: React.FC<INavButtonSlotProps> = ({ variant, onClick, disabled, 'aria-label': ariaLabel, className }) => (
  <Button
    appearance="outline"
    shape="circular"
    size="small"
    icon={FLUENT_NAV_ICONS[variant]}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={className}
  />
);

const PageButton: React.FC<IPageButtonSlotProps> = ({ onClick, active, 'aria-label': ariaLabel, 'aria-current': ariaCurrent, children, className }) => (
  <Button
    appearance={active ? 'primary' : 'outline'}
    size="small"
    shape="rounded"
    onClick={onClick}
    aria-label={ariaLabel}
    aria-current={ariaCurrent}
    className={className}
  >
    {children}
  </Button>
);

const PageSizeSelect: React.FC<IPageSizeSelectSlotProps> = ({ value, options, onChange, 'aria-label': ariaLabel, className }) => {
  const handleChange = (_e: React.ChangeEvent<HTMLSelectElement>, data: SelectOnChangeData) =>
    onChange(data.value === 'all' ? 'all' : Number(data.value));
  return (
    <Select value={String(value)} onChange={handleChange} size="small" appearance="outline" aria-label={ariaLabel} className={className}>
      {options.map((n) => <option key={n} value={n}>{n === 'all' ? 'All' : n}</option>)}
    </Select>
  );
};

const SLOTS: IPaginationControlsSlots = { NavButton, PageButton, PageSizeSelect };

const CLASS_NAMES: PaginationControlsBaseClassNames = {
  pagination: styles.pagination,
  paginationInfo: styles.paginationInfo,
  paginationControls: styles.paginationControls,
  pageNumbers: styles.pageNumbers,
  ellipsis: styles.ellipsis,
  navBtn: styles.navBtn,
  pageBtn: styles.pageBtn,
  pageSizeSelector: styles.pageSizeSelector,
  pageSizeLabel: styles.pageSizeLabel,
  pageSizeSelect: styles.pageSizeSelect,
};

export const PaginationControls: React.FC<IPaginationControlsProps> = React.memo((props) => (
  <PaginationControlsBase {...props} slots={SLOTS} classNames={CLASS_NAMES} />
));

PaginationControls.displayName = 'PaginationControls';
