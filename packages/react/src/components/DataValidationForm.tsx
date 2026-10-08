'use client';
import { adjustFormulaReferences } from '@alaarab/ogrid-core/formula';
import * as React from 'react';
import type { IDataValidationRule, DataValidationOperator, DataValidationAlertStyle } from '@alaarab/ogrid-core';
export type { DataValidationDialogProps } from './BaseDataGridTable.types';
export type ValidationTab = 'settings' | 'input' | 'error';
export interface DataValidationFormProps {
  rule?: IDataValidationRule;
  formulaOffset?: { col: number; row: number };
  onApply: (rule: IDataValidationRule | undefined) => void;
  onClose: () => void;
  renderTabs: (tab: ValidationTab, change: (tab: ValidationTab) => void) => React.ReactNode;
  renderActions: (clear: () => void) => React.ReactNode;
}
const TYPES = ['any', 'list', 'whole', 'decimal', 'date', 'time', 'textLength', 'custom'] as const;
const OPERATORS: DataValidationOperator[] = ['between', 'notBetween', 'equal', 'notEqual', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual'];
const LABELS: Record<string, string> = { any: 'Any value', whole: 'Whole number', decimal: 'Decimal', date: 'Date', time: 'Time', textLength: 'Text length', list: 'List', custom: 'Custom formula', between: 'Between', notBetween: 'Not between', equal: 'Equal to', notEqual: 'Not equal to', greaterThan: 'Greater than', lessThan: 'Less than', greaterThanOrEqual: 'Greater than or equal to', lessThanOrEqual: 'Less than or equal to' };
const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBlock: 12 };
const controlStyle: React.CSSProperties = { font: 'inherit', padding: 6, color: 'inherit', background: 'var(--ogrid-bg, white)', border: '1px solid var(--ogrid-border, #aaa)', borderRadius: 3 };
/** Loaded only when an adapter opens its editor. */
export function DataValidationForm({ rule, formulaOffset, onApply, renderTabs, renderActions }: DataValidationFormProps) {
  const shift = (value: string) => value.startsWith('=') && formulaOffset ? adjustFormulaReferences(value, formulaOffset.col, formulaOffset.row) : value;
  const [tab, setTab] = React.useState<ValidationTab>('settings');
  const [type, setType] = React.useState<typeof TYPES[number]>(rule?.type ?? 'any');
  const [operator, setOperator] = React.useState<DataValidationOperator>(rule && 'operator' in rule ? rule.operator : 'between');
  const [value, setValue] = React.useState(rule && 'value' in rule ? shift(String(rule.value)) : '');
  const [value2, setValue2] = React.useState(rule && 'value2' in rule ? shift(String(rule.value2 ?? '')) : '');
  const [sourceKind, setSourceKind] = React.useState(rule?.type === 'list' && rule.source ? 'formula' : 'values');
  const [source, setSource] = React.useState(rule?.type === 'list' ? (rule.source ? shift(rule.source.startsWith('=') ? rule.source : `=${rule.source}`) : rule.values?.join(',') ?? '') : rule?.type === 'custom' ? shift(rule.formula) : '');
  const [allowBlank, setAllowBlank] = React.useState(rule?.allowBlank ?? true);
  const [dropdown, setDropdown] = React.useState(rule?.type !== 'list' || rule.inCellDropdown !== false);
  const [inputShow, setInputShow] = React.useState(rule?.inputMessage?.show !== false);
  const [inputTitle, setInputTitle] = React.useState(rule?.inputMessage?.title ?? '');
  const [inputText, setInputText] = React.useState(rule?.inputMessage?.text ?? '');
  const [errorShow, setErrorShow] = React.useState(rule?.errorAlert?.show !== false);
  const [errorStyle, setErrorStyle] = React.useState<DataValidationAlertStyle>(rule?.errorAlert?.style ?? 'stop');
  const [errorTitle, setErrorTitle] = React.useState(rule?.errorAlert?.title ?? '');
  const [errorMessage, setErrorMessage] = React.useState(rule?.errorAlert?.message ?? '');
  const [error, setError] = React.useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'any') { onApply(undefined); return; }
    if ((type === 'list' || type === 'custom') ? !source.trim() : !value.trim() || ((operator === 'between' || operator === 'notBetween') && !value2.trim())) {
      setError('Enter the source, formula, or comparison bounds in Settings.'); setTab('settings'); return;
    }
    const base = { columnIds: rule?.columnIds ?? [], allowBlank, inputMessage: { show: inputShow, title: inputTitle, text: inputText }, errorAlert: { show: errorShow, style: errorStyle, title: errorTitle, message: errorMessage } };
    const bound = (text: string) => text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : text;
    const result: IDataValidationRule = type === 'list' ? { ...base, type, inCellDropdown: dropdown, ...(sourceKind === 'values' ? { values: source.split(',').map((s) => s.trim()) } : { source }) }
      : type === 'custom' ? { ...base, type, formula: source.startsWith('=') ? source : `=${source}` }
      : { ...base, type, operator, value: bound(value), value2: operator === 'between' || operator === 'notBetween' ? bound(value2) : undefined };
    onApply(result);
  };
  return (
    <form onSubmit={submit} style={{ width: 'min(420px, 80vw)' }}>
      {renderTabs(tab, setTab)}
      <div hidden={tab !== 'settings'}>
        <label style={fieldStyle}>Allow<select aria-label="Allow" style={controlStyle} value={type} onChange={(e) => setType(e.target.value as typeof type)}>{TYPES.map((t) => <option key={t} value={t}>{LABELS[t]}</option>)}</select></label>
        <label><input type="checkbox" checked={allowBlank} onChange={(e) => setAllowBlank(e.target.checked)} /> Ignore blank</label>
        {type === 'list' && <>
          <label style={fieldStyle}>Source type<select style={controlStyle} value={sourceKind} onChange={(e) => setSourceKind(e.target.value)}><option value="values">Values separated by commas</option><option value="formula">Range, formula, or named range</option></select></label>
          <label><input type="checkbox" checked={dropdown} onChange={(e) => setDropdown(e.target.checked)} /> In-cell dropdown</label>
        </>}
        {(type === 'list' || type === 'custom') && <label style={fieldStyle}>{type === 'custom' ? 'Formula' : 'Source'}<input style={controlStyle} value={source} onChange={(e) => setSource(e.target.value)} /></label>}
        {type !== 'any' && type !== 'list' && type !== 'custom' && <>
          <label style={fieldStyle}>Data<select style={controlStyle} value={operator} onChange={(e) => setOperator(e.target.value as DataValidationOperator)}>{OPERATORS.map((op) => <option key={op} value={op}>{LABELS[op]}</option>)}</select></label>
          <label style={fieldStyle}>{operator === 'between' || operator === 'notBetween' ? 'Minimum' : 'Value'}<input style={controlStyle} value={value} onChange={(e) => setValue(e.target.value)} /></label>
          {(operator === 'between' || operator === 'notBetween') && <label style={fieldStyle}>Maximum<input style={controlStyle} value={value2} onChange={(e) => setValue2(e.target.value)} /></label>}
        </>}
      </div>
      <div hidden={tab !== 'input'}>
        <label><input type="checkbox" checked={inputShow} onChange={(e) => setInputShow(e.target.checked)} /> Show input message when cell is selected</label>
        <label style={fieldStyle}>Title<input style={controlStyle} value={inputTitle} onChange={(e) => setInputTitle(e.target.value)} /></label>
        <label style={fieldStyle}>Input message<textarea style={controlStyle} rows={4} value={inputText} onChange={(e) => setInputText(e.target.value)} /></label>
      </div>
      <div hidden={tab !== 'error'}>
        <label><input type="checkbox" checked={errorShow} onChange={(e) => setErrorShow(e.target.checked)} /> Show error alert after invalid data is entered</label>
        <label style={fieldStyle}>Style<select style={controlStyle} value={errorStyle} onChange={(e) => setErrorStyle(e.target.value as DataValidationAlertStyle)}><option value="stop">Stop</option><option value="warning">Warning</option><option value="information">Information</option></select></label>
        <label style={fieldStyle}>Title<input style={controlStyle} value={errorTitle} onChange={(e) => setErrorTitle(e.target.value)} /></label>
        <label style={fieldStyle}>Error message<textarea style={controlStyle} rows={4} value={errorMessage} onChange={(e) => setErrorMessage(e.target.value)} /></label>
      </div>
      {error && <p role="alert">{error}</p>}
      {renderActions(() => onApply(undefined))}
    </form>
  );
}
