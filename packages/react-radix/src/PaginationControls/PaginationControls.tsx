import * as React from 'react';
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

const VARIANTS = { first: '«', prev: '‹', next: '›', last: '»' } as const;

const NavButton: React.FC<INavButtonSlotProps> = ({ variant, onClick, disabled, 'aria-label': ariaLabel, className }) => (
  <button type="button" className={className} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
    <span aria-hidden>{VARIANTS[variant]}</span>
  </button>
);

const PageButton: React.FC<IPageButtonSlotProps> = ({ onClick, active, 'aria-label': ariaLabel, 'aria-current': ariaCurrent, children, className }) => (
  <button
    type="button"
    className={`${className ?? ''} ${active ? styles.active : ''}`.trim()}
    onClick={onClick}
    aria-label={ariaLabel}
    aria-current={ariaCurrent}
  >
    {children}
  </button>
);

const PageSizeSelect: React.FC<IPageSizeSelectSlotProps> = ({ value, options, onChange, 'aria-label': ariaLabel, className }) => (
  <select className={className} value={String(value)} onChange={(e) => onChange(Number(e.target.value))} aria-label={ariaLabel}>
    {options.map((n) => <option key={n} value={n}>{n}</option>)}
  </select>
);

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
