import React from 'react';
import Button from './Button';
import Modal from './Modal';
import { ConfirmationDialogPropTypes, ButtonVariants } from '../../types';

const ConfirmationDialog = ({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal open={open} title={title} onClose={onClose} maxWidth="sm">
      <div className="space-y-4">
        <p className="text-gray-700 text-base">
          {message}
        </p>
        
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            variant={ButtonVariants.SECONDARY}
            onClick={onClose}
          >
            {cancelText}
          </Button>
          <Button
            variant={ButtonVariants.DANGER}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

ConfirmationDialog.propTypes = ConfirmationDialogPropTypes;

export default ConfirmationDialog;
