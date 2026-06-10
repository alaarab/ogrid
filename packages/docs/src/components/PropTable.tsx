

export interface PropDef {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
  description: string;
}

export function PropTable({ props }: { props: PropDef[] }) {
  return (
    <table className="prop-table">
      <thead>
        <tr>
          <th>Prop</th>
          <th>Type</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {props.map((p) => (
          <tr key={p.name}>
            <td>
              <code className="prop-name">{p.name}</code>
              {p.required && <span className="prop-required">*</span>}
            </td>
            <td><code className="prop-type">{p.type}</code></td>
            <td>{p.default ? <code className="prop-default">{p.default}</code> : '\u2014'}</td>
            <td>{p.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
