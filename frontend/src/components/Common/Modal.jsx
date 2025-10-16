import React from 'react';
import { AiOutlineClose } from 'react-icons/ai';
import { ModalPropTypes, ModalSizes } from '../../types';

const Modal = ({ 
  open, 
  title, 
  children, 
  onClose, 
  maxWidth = ModalSizes.MEDIUM 
}) => {
  if (!open) return null;

  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case ModalSizes.SMALL:
        return 'max-w-sm';
      case ModalSizes.MEDIUM:
        return 'max-w-md';
      case ModalSizes.LARGE:
        return 'max-w-lg';
      case ModalSizes.EXTRA_LARGE:
        return 'max-w-xl';
      default:
        return 'max-w-md';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={`relative w-full ${getMaxWidthClass()} mx-auto my-6 pointer-events-none`}>
        <div className="border-0 rounded-lg shadow-lg relative flex flex-col w-full bg-white outline-none focus:outline-none pointer-events-auto">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-solid border-gray-200 rounded-t">
            <h3 className="text-xl font-semibold text-gray-900">
              {title}
            </h3>
            <button
              className="p-1 ml-auto bg-transparent border-0 text-gray-400 hover:text-gray-600 float-right text-3xl leading-none font-semibold outline-none focus:outline-none"
              onClick={onClose}
              type="button"
            >
              <AiOutlineClose size={24} />
            </button>
          </div>
          
          {/* Body */}
          <div className="relative p-6 flex-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

Modal.propTypes = ModalPropTypes;

export default Modal;
