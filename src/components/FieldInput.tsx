import { useCollection } from '../lib/store';
import type { Customer, FieldDef } from '../lib/types';

export function FieldInput({ f, value, onChange, disabled }: { f: FieldDef; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const customers = useCollection<Customer>(f.type === 'customer' ? 'customers' : null);
  const id = `f-${f.id}`;
  return (
    <div className="field">
      <label htmlFor={id}>{f.label}{f.required ? ' *' : ''}{f.unit ? `（${f.unit}）` : ''}</label>
      {f.type === 'select' ? (
        <select id={id} className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">请选择</option>
          {(f.options || []).map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <>
          <input id={id} className="input" disabled={disabled} list={f.type === 'customer' ? `${id}-list` : undefined}
            type={f.type === 'date' ? 'date' : f.type === 'number' ? 'text' : 'text'} inputMode={f.type === 'number' ? 'numeric' : undefined}
            value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.type === 'customer' ? '输入或从顾客名单选择' : ''} />
          {f.type === 'customer' && <datalist id={`${id}-list`}>{(customers || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>}
        </>
      )}
    </div>
  );
}
