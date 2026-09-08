"use client";
const roster = ["Brendan", "Emily", "Derek"];
export function OwnerSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <select value={value} onChange={e => onChange(e.target.value)}><option value="">Unassigned</option>{value && !roster.includes(value) && <option value={value}>{value} (existing assignment)</option>}{roster.map(name => <option key={name}>{name}</option>)}</select>;
}
