'use client';
export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontFamily: 'Cinzel,serif', fontSize: '20px', color: 'var(--gold)' }}>{title}</div>
      <div style={{ color: 'var(--ink-muted)', fontSize: '14px' }}>Этот раздел будет готов в Этапе 3</div>
    </div>
  );
}
