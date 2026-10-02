import { scrollCellIntoView } from '../scrollCellIntoView';

function rect(top: number, bottom: number, left = 0, right = 100): DOMRect {
  return { top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function setup(cellTop: number) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = '<table><thead><tr><th></th></tr></thead><tbody><tr><td><div data-row-index="40" data-col-index="1"></div></td></tr></tbody></table>';
  document.body.appendChild(wrapper);
  wrapper.getBoundingClientRect = () => rect(0, 300);
  (wrapper.querySelector('thead') as HTMLElement).getBoundingClientRect = () => rect(0, 40);
  (wrapper.querySelector('[data-row-index]') as HTMLElement).getBoundingClientRect = () => rect(cellTop, cellTop + 36);
  wrapper.scrollTop = 1000;
  return wrapper;
}

describe('scrollCellIntoView', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('scrolls a rendered cell below the bottom edge into view through the DOM', () => {
    const wrapper = setup(400);
    scrollCellIntoView(wrapper, 40, 1);
    expect(wrapper.scrollTop).toBe(1000 + (436 - 300));
  });

  it('keeps a cell clear of the sticky header', () => {
    const wrapper = setup(20);
    scrollCellIntoView(wrapper, 40, 1);
    expect(wrapper.scrollTop).toBe(1000 - (40 - 20));
  });

  it('scrolls a virtual grid by row index and leaves its (possibly scaled) scrollTop to the scroller', () => {
    const wrapper = setup(400);
    const scrollToIndex = jest.fn();
    scrollCellIntoView(wrapper, 40, 1, scrollToIndex);
    expect(scrollToIndex).toHaveBeenCalledWith(40, 'auto');
    expect(wrapper.scrollTop).toBe(1000);
  });

  it('scrolls an unrendered row of a virtual grid by index', () => {
    const wrapper = setup(400);
    const scrollToIndex = jest.fn();
    scrollCellIntoView(wrapper, 900_000, 1, scrollToIndex);
    expect(scrollToIndex).toHaveBeenCalledWith(900_000, 'auto');
  });
});
