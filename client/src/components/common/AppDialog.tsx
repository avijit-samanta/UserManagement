import type { ReactNode } from 'react';
import { DialogOverlay, DialogContent } from '@reach/dialog';

// A thin wrapper around Reach UI's Dialog that every modal in the app uses,
// so the visible close button (✕, top-right) only has to be built once.
// Clicking outside or pressing Escape still dismisses it too (that's
// Reach's default behavior via onDismiss) — this just adds an explicit,
// discoverable way to do the same thing.
export function AppDialog({
  isOpen,
  onDismiss,
  ariaLabel,
  children,
}: {
  isOpen: boolean;
  onDismiss: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <DialogOverlay isOpen={isOpen} onDismiss={onDismiss} className="app-dialog-overlay">
      <DialogContent className="app-dialog-content" aria-label={ariaLabel}>
        <button
          type="button"
          className="app-dialog-close"
          onClick={onDismiss}
          aria-label="Close dialog"
          data-testid="dialog-close-button"
        >
          ✕
        </button>
        {children}
      </DialogContent>
    </DialogOverlay>
  );
}
