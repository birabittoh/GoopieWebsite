import type React from 'react';

export function EditorSection({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      className="rounded-lg border p-6 space-y-5"
      style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}
    >
      <h3 className="text-base font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
