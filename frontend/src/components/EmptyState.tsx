interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: string;
}

export default function EmptyState({ title, message, icon = '—' }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {message && <div className="empty-state-message">{message}</div>}
    </div>
  );
}
