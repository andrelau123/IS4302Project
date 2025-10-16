import React from 'react';
import { ButtonPropTypes, ButtonVariants } from '../../types';

const Button = ({ 
  onClick, 
  children, 
  className = '', 
  variant = ButtonVariants.PRIMARY,
  disabled = false,
  type = 'button'
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case ButtonVariants.PRIMARY:
        return 'button-primary';
      case ButtonVariants.SECONDARY:
        return 'button-secondary';
      case ButtonVariants.SUCCESS:
        return 'button-success';
      case ButtonVariants.DANGER:
        return 'button-danger';
      case ButtonVariants.WARNING:
        return 'button-warning';
      case ButtonVariants.OUTLINE:
        return 'button-outline';
      default:
        return 'button-primary';
    }
  };

  const baseClasses = `${getVariantClasses()} ${className}`;
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

  return (
    <button
      type={type}
      className={`${baseClasses} ${disabledClasses}`}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

Button.propTypes = ButtonPropTypes;

export default Button;
