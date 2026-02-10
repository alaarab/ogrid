import React, { useState } from 'react';
import { OGrid } from '@alaarab/ogrid';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, toolbarColumns, btnStyle, type Person } from './demoData';

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 10px',
  background: 'var(--ogrid-border, #e0e0e0)',
  borderRadius: 12,
  fontSize: '0.75rem',
  cursor: 'pointer',
};

export default function ToolbarBelowDemo() {
  const [chips, setChips] = useState(['Engineering', 'Active']);

  const removeChip = (chip: string) =>
    setChips((prev) => prev.filter((c) => c !== chip));

  return (
    <LiveDemo height={420} title="Secondary toolbar row with filter chips">
      <OGrid
        columns={toolbarColumns}
        data={people}
        getRowId={getRowId}
        columnChooser="toolbar"
        pagination
        defaultPageSize={10}
        toolbar={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={btnStyle} onClick={() => setChips(['Engineering', 'Active'])}>
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
                <span key={chip} style={chipStyle} onClick={() => removeChip(chip)}>
                  {chip} &times;
                </span>
              ))}
            </div>
          ) : undefined
        }
      />
    </LiveDemo>
  );
}
