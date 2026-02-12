import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { PaginationControlsComponent } from '../pagination-controls/pagination-controls.component';

describe('PaginationControlsComponent', () => {
  let component: PaginationControlsComponent;
  let fixture: ComponentFixture<PaginationControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationControlsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationControlsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return null when totalCount is 0', () => {
    fixture.componentRef.setInput('currentPage', 1);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('totalCount', 0);
    fixture.detectChanges();

    const nav = fixture.debugElement.query(By.css('nav'));
    expect(nav).toBeNull();
  });

  it('should render summary text and page buttons', () => {
    fixture.componentRef.setInput('currentPage', 2);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('totalCount', 50);
    fixture.detectChanges();

    const summaryText = fixture.nativeElement.querySelector('.ogrid-pagination__info');
    expect(summaryText.textContent).toContain('Showing 11 to 20 of 50 items');

    const activeButton = fixture.debugElement.query(
      By.css('button[aria-current="page"]')
    );
    expect(activeButton).toBeTruthy();
    expect(activeButton.nativeElement.getAttribute('aria-label')).toBe('Page 2');
  });

  it('should disable first and previous on first page', () => {
    fixture.componentRef.setInput('currentPage', 1);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('totalCount', 50);
    fixture.detectChanges();

    const firstButton = fixture.debugElement.query(
      By.css('button[aria-label="First page"]')
    );
    const prevButton = fixture.debugElement.query(
      By.css('button[aria-label="Previous page"]')
    );

    expect(firstButton.nativeElement.disabled).toBe(true);
    expect(prevButton.nativeElement.disabled).toBe(true);
  });

  it('should disable last and next on last page', () => {
    fixture.componentRef.setInput('currentPage', 5);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('totalCount', 50);
    fixture.detectChanges();

    const lastButton = fixture.debugElement.query(
      By.css('button[aria-label="Last page"]')
    );
    const nextButton = fixture.debugElement.query(
      By.css('button[aria-label="Next page"]')
    );

    expect(lastButton.nativeElement.disabled).toBe(true);
    expect(nextButton.nativeElement.disabled).toBe(true);
  });

  it('should emit pageChange for navigation buttons', () => {
    fixture.componentRef.setInput('currentPage', 2);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('totalCount', 50);
    fixture.detectChanges();

    const pageChangeSpy = jest.fn();
    component.pageChange.subscribe(pageChangeSpy);

    // Click next
    const nextButton = fixture.debugElement.query(
      By.css('button[aria-label="Next page"]')
    );
    nextButton.nativeElement.click();
    expect(pageChangeSpy).toHaveBeenCalledWith(3);

    // Click previous
    const prevButton = fixture.debugElement.query(
      By.css('button[aria-label="Previous page"]')
    );
    prevButton.nativeElement.click();
    expect(pageChangeSpy).toHaveBeenCalledWith(1);
  });

  it('should emit pageChange when clicking page number buttons', () => {
    fixture.componentRef.setInput('currentPage', 2);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('totalCount', 50);
    fixture.detectChanges();

    const pageChangeSpy = jest.fn();
    component.pageChange.subscribe(pageChangeSpy);

    const page3Button = fixture.debugElement.query(
      By.css('button[aria-label="Page 3"]')
    );
    page3Button.nativeElement.click();
    expect(pageChangeSpy).toHaveBeenCalledWith(3);
  });

  it('should emit pageChange for first and last buttons', () => {
    fixture.componentRef.setInput('currentPage', 3);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('totalCount', 50);
    fixture.detectChanges();

    const pageChangeSpy = jest.fn();
    component.pageChange.subscribe(pageChangeSpy);

    // Click first
    const firstButton = fixture.debugElement.query(
      By.css('button[aria-label="First page"]')
    );
    firstButton.nativeElement.click();
    expect(pageChangeSpy).toHaveBeenCalledWith(1);

    // Click last
    const lastButton = fixture.debugElement.query(
      By.css('button[aria-label="Last page"]')
    );
    lastButton.nativeElement.click();
    expect(pageChangeSpy).toHaveBeenCalledWith(5);
  });

  it('should emit pageSizeChange when page size is changed', () => {
    fixture.componentRef.setInput('currentPage', 1);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('totalCount', 50);
    fixture.detectChanges();

    const pageSizeChangeSpy = jest.fn();
    component.pageSizeChange.subscribe(pageSizeChangeSpy);

    const select = fixture.debugElement.query(
      By.css('select[aria-label="Rows per page"]')
    );
    select.nativeElement.value = '25';
    select.nativeElement.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(pageSizeChangeSpy).toHaveBeenCalledWith(25);
  });

  it('should use custom entityLabelPlural when provided', () => {
    fixture.componentRef.setInput('currentPage', 1);
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('totalCount', 50);
    fixture.componentRef.setInput('entityLabelPlural', 'projects');
    fixture.detectChanges();

    const summaryText = fixture.nativeElement.querySelector('.ogrid-pagination__info');
    expect(summaryText.textContent).toContain('projects');
  });

  it('should render custom page size options', () => {
    fixture.componentRef.setInput('currentPage', 1);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.componentRef.setInput('totalCount', 100);
    fixture.componentRef.setInput('pageSizeOptions', [20, 50, 100]);
    fixture.detectChanges();

    const options = fixture.debugElement.queryAll(By.css('select option'));
    expect(options.length).toBe(3);
    expect(options[0].nativeElement.value).toBe('20');
    expect(options[1].nativeElement.value).toBe('50');
    expect(options[2].nativeElement.value).toBe('100');
  });
});
