interface EmptyStateProps {
  icon?: string;
  title: string;
  desc?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon = '📭', title, desc, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h4>{title}</h4>
      {desc && <p>{desc}</p>}
      {action && (
        <button className="btn btn-primary mt-md" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
