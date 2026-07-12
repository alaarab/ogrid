import React, { useState } from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns, btnStyle } from './demoData';

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 10px',
  background: 'var(--ogrid-border, #e0e0e0)',
  border: 'none',
  borderRadius: 12,
  fontSize: '0.75rem',
  fontFamily: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
};

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');

  const [chips, setChips] = useState(['Engineering', 'Active']);
  const removeChip = (chip: string) => setChips((prev) => prev.filter((c) => c !== chip));

  return (
    <OGrid
      columns={toolbarColumns}
      data={people}
      getRowId={getRowId}
      columnChooser="toolbar"
      pagination
      defaultPageSize={10}
      toolbar={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" style={btnStyle} onClick={() => setChips(['Engineering', 'Active'])}>
            Reset Filters
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--ogrid-muted)' }}>
            {people.length} rows
          </span>
        </div>
      }
      toolbarBelow={
        chips.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '6px 12px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--ogrid-muted)', marginRight: 4 }}>
              Filters:
            </span>
            {chips.map((chip) => (
              <button key={chip} type="button" style={chipStyle} onClick={() => removeChip(chip)}>
                {chip} &times;
              </button>
            ))}
          </div>
        ) : undefined
      }
    />
  );
}

export default function ToolbarBelowDemo() {
  return (
    <LiveDemo height={420} title="Secondary toolbar row with filter chips">
      {() => <Inner />}
    </LiveDemo>
  );
}
