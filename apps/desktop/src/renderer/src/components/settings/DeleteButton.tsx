import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface DeleteButtonProps {
  title: string;
  /** Resolved right before the dialog opens, so the warning reflects the current Records. */
  describe: () => Promise<string>;
  onConfirm: () => void;
  disabled?: boolean;
}

export function DeleteButton({ title, describe, onConfirm, disabled }: DeleteButtonProps) {
  const [description, setDescription] = useState<string | null>(null);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => void describe().then(setDescription)}
      >
        Delete
      </Button>
      <AlertDialog
        open={description !== null}
        onOpenChange={(open) => !open && setDescription(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
