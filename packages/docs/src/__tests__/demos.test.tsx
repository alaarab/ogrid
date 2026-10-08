import { beforeAll, afterAll, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { compile } from 'sass';

// Docusaurus supplies this browser-only boundary in the docs application.
mock.module('@docusaurus/BrowserOnly', () => ({ default: ({ children }: { children: () => React.ReactNode }) => children() }));
const { default: XlsxImportDemo } = await import('../components/demos/XlsxImportDemo');
const { default: DragAndDropDemo } = await import('../components/demos/DragAndDropDemo');
const { default: DataValidationDemo } = await import('../components/demos/DataValidationDemo');
const { default: FormulasDemo } = await import('../components/demos/FormulasDemo');
let stylesheet: HTMLStyleElement;
beforeAll(() => {
  stylesheet = document.createElement('style');
  stylesheet.textContent = compile(new URL('../css/custom.scss', import.meta.url).pathname).css;
  document.head.append(stylesheet);
  document.body.style.fontFamily = 'sans-serif';
});
afterAll(() => { stylesheet.remove(); document.body.style.fontFamily = ''; });

test('the formulas demo sorts Revenue by its computed total', async () => {
  const { container } = render(<FormulasDemo />);
  const revenues = () => Array.from(container.querySelectorAll('tbody td[data-column-id="revenue"]')).map(cell => cell.textContent);
  await waitFor(() => expect(revenues()).toEqual(['1200', '2100', '3400', '6700']));
  expect(container.querySelector('th[data-column-id="revenue"]')).toHaveAttribute('aria-sort', 'ascending');
});

test('XLSX demo actions use the shared controls and still insert an order row', async () => {
  render(<XlsxImportDemo />);
  const insert = await screen.findByRole('button', { name: 'Insert order row' });
  await waitFor(() => expect(insert).not.toBeDisabled());
  expect(insert.closest('.live-demo__controls')).not.toBeNull();
  for (const button of insert.parentElement!.querySelectorAll('button')) expect(button.closest('.live-demo__controls')).not.toBeNull();
  const count = Number(screen.getByRole('grid').getAttribute('aria-rowcount'));
  fireEvent.click(insert);
  await waitFor(() => expect(Number(screen.getByRole('grid').getAttribute('aria-rowcount'))).toBe(count + 1));
});

test('drag instructions inherit the plain controls font and color', async () => {
  render(<DragAndDropDemo />);
  const instructions = await screen.findByText(/Drag the row handle to reorder/);
  const controls = instructions.closest('.live-demo__controls')!;
  expect(getComputedStyle(instructions).fontFamily).toBe(getComputedStyle(controls).fontFamily);
  expect(getComputedStyle(instructions).color).toBe(getComputedStyle(controls).color);
});

test('validation demo controls use the shared styling and toggle invalid circles', async () => {
  const { container } = render(<DataValidationDemo />);
  const checkbox = await screen.findByRole('checkbox', { name: 'Circle invalid data' });
  expect(!!checkbox.closest('.live-demo__controls')).toBe(true);
  expect(container.querySelectorAll('[data-validation-invalid]').length).toBeGreaterThan(0);
  fireEvent.click(checkbox);
  expect(container.querySelectorAll('[data-validation-invalid]').length).toBe(0);
});
