/**
 * Shared base component for PaginationControls across all React UI packages.
 * Handles hook call, null guard, vm destructure, and renders the full layout structure.
 * Each UI package provides slots for framework-specific interactive elements.
 */

import * as React from 'react';
import type { IPaginationControlsProps } from './PaginationControlsProps';
import { usePaginationControls } from '../hooks/usePaginationControls';

// ---- Slot prop types ----

export interface INavButtonSlotProps {
  variant: 'first' | 'prev' | 'next' | 'last';
  onClick: () => void;
  disabled: boolean;
  'aria-label': string;
  className?: string;
}

export interface IPageButtonSlotProps {
  onClick: () => void;
  active: boolean;
  'aria-label': string;
  'aria-current'?: 'page';
  children: React.ReactNode;
  className?: string;
}

export interface IPageSizeSelectSlotProps {
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
  'aria-label': string;
  className?: string;
}

export interface IOuterContainerSlotProps {
  children: React.ReactNode;
  className?: string;
  role: string;
  'aria-label': string;
}

// ---- Slots interface ----

export interface IPaginationControlsSlots {
  NavButton: React.ComponentType<INavButtonSlotProps>;
  PageButton: React.ComponentType<IPageButtonSlotProps>;
  PageSizeSelect: React.ComponentType<IPageSizeSelectSlotProps>;
  // Optional container overrides  -  used by frameworks with Box/sx layout (e.g. Material)
  OuterContainer?: React.ComponentType<IOuterContainerSlotProps>;
  InfoText?: React.ComponentType<{ children: React.ReactNode }>;
  NavButtonsContainer?: React.ComponentType<{ children: React.ReactNode; className?: string }>;
  PageSizeContainer?: React.ComponentType<{ children: React.ReactNode; className?: string }>;
  PageSizeLabel?: React.ComponentType<Record<string, never>>;
  Ellipsis?: React.ComponentType<Record<string, never>>;
}

export interface PaginationControlsBaseClassNames {
  pagination?: string;
  paginationInfo?: string;
  paginationControls?: string;
  pageNumbers?: string;
  ellipsis?: string;
  navBtn?: string;
  pageBtn?: string;
  pageSizeSelector?: string;
  pageSizeLabel?: string;
  pageSizeSelect?: string;
}

export interface PaginationControlsBaseProps extends IPaginationControlsProps {
  slots: IPaginationControlsSlots;
  classNames?: PaginationControlsBaseClassNames;
}

export const PaginationControlsBase: React.FC<PaginationControlsBaseProps> = React.memo((props) => {
  const {
    currentPage, pageSize, totalCount, onPageChange, onPageSizeChange,
    pageSizeOptions, entityLabelPlural, className, slots, classNames: cn = {},
  } = props;

  const { labelPlural, vm, handlePageSizeChange } = usePaginationControls({
    currentPage, pageSize, totalCount, onPageChange, onPageSizeChange,
    pageSizeOptions, entityLabelPlural,
  });

  if (!vm) return null;

  const { pageNumbers, showStartEllipsis, showEndEllipsis, totalPages, startItem, endItem } = vm;
  const {
    NavButton, PageButton, PageSizeSelect,
    OuterContainer, InfoText, NavButtonsContainer, PageSizeContainer, PageSizeLabel, Ellipsis,
  } = slots;

  const infoContent = `Showing ${startItem} to ${endItem} of ${totalCount.toLocaleString()} ${labelPlural}`;

  const infoNode = InfoText
    ? <InfoText>{infoContent}</InfoText>
    : <div className={cn.paginationInfo}>{infoContent}</div>;

  const ellipsisNode = Ellipsis
    ? <Ellipsis />
    : <span className={cn.ellipsis} aria-hidden>…</span>;

  const pageSizeLabelNode = PageSizeLabel
    ? <PageSizeLabel />
    : <span className={cn.pageSizeLabel}>Rows</span>;

  const pageNumbersNode = (
    <div className={cn.pageNumbers}>
      {showStartEllipsis && (
        <>
          <PageButton onClick={() => onPageChange(1)} active={false} aria-label="Page 1" className={cn.pageBtn}>1</PageButton>
          {ellipsisNode}
        </>
      )}
      {pageNumbers.map((pageNum) => (
        <PageButton
          key={pageNum}
          onClick={() => onPageChange(pageNum)}
          active={currentPage === pageNum}
          aria-label={`Page ${pageNum}`}
          aria-current={currentPage === pageNum ? 'page' : undefined}
          className={cn.pageBtn}
        >
          {pageNum}
        </PageButton>
      ))}
      {showEndEllipsis && (
        <>
          {ellipsisNode}
          <PageButton onClick={() => onPageChange(totalPages)} active={false} aria-label={`Page ${totalPages}`} className={cn.pageBtn}>{totalPages}</PageButton>
        </>
      )}
    </div>
  );

  const navContent = (
    <>
      <NavButton variant="first" onClick={() => onPageChange(1)} disabled={currentPage === 1} aria-label="First page" className={cn.navBtn} />
      <NavButton variant="prev" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page" className={cn.navBtn} />
      {pageNumbersNode}
      <NavButton variant="next" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Next page" className={cn.navBtn} />
      <NavButton variant="last" onClick={() => onPageChange(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page" className={cn.navBtn} />
    </>
  );

  const navNode = NavButtonsContainer
    ? <NavButtonsContainer className={cn.paginationControls}>{navContent}</NavButtonsContainer>
    : <div className={cn.paginationControls}>{navContent}</div>;

  const pageSizeContent = (
    <>
      {pageSizeLabelNode}
      <PageSizeSelect
        value={pageSize}
        options={vm.pageSizeOptions}
        onChange={handlePageSizeChange}
        aria-label="Rows per page"
        className={cn.pageSizeSelect}
      />
    </>
  );

  const pageSizeNode = PageSizeContainer
    ? <PageSizeContainer className={cn.pageSizeSelector}>{pageSizeContent}</PageSizeContainer>
    : <div className={cn.pageSizeSelector}>{pageSizeContent}</div>;

  const outerClass = `${cn.pagination ?? ''} ${className || ''}`.trim();
  const outerRole = 'navigation';
  const outerLabel = 'Pagination';

  if (OuterContainer) {
    return (
      <OuterContainer className={outerClass} role={outerRole} aria-label={outerLabel}>
        {infoNode}
        {navNode}
        {pageSizeNode}
      </OuterContainer>
    );
  }

  return (
    <div className={outerClass} role={outerRole} aria-label={outerLabel}>
      {infoNode}
      {navNode}
      {pageSizeNode}
    </div>
  );
});

PaginationControlsBase.displayName = 'PaginationControlsBase';
