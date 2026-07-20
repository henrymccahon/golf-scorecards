interface AbandonRoundConfirmationProps {
  courseName: string;
  onCancel(): void;
  onConfirm(): void;
}

export function AbandonRoundConfirmation({ courseName, onCancel, onConfirm }: AbandonRoundConfirmationProps) {
  return (
    <div className="abandon-confirmation" role="status">
      <p><strong>Abandon {courseName}?</strong></p>
      <p>Score progress for this unfinished round will be discarded.</p>
      <div className="confirmation-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>Keep round</button>
        <button className="danger-button" type="button" onClick={onConfirm}>
          Abandon {courseName} permanently
        </button>
      </div>
    </div>
  );
}
