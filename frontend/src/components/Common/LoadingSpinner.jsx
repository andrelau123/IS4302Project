import React from 'react';
import PropTypes from 'prop-types';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'primary-blue', 
  className = '',
  message = 'Loading...' 
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-4 h-4';
      case 'medium':
        return 'w-8 h-8';
      case 'large':
        return 'w-12 h-12';
      default:
        return 'w-8 h-8';
    }
  };

  const getColorClasses = () => {
    switch (color) {
      case 'primary-blue':
        return 'border-primary-blue';
      case 'primary-green':
        return 'border-primary-green';
      case 'white':
        return 'border-white';
      default:
        return 'border-primary-blue';
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`}>
      <div
        className={`${getSizeClasses()} ${getColorClasses()} border-2 border-t-transparent border-solid rounded-full animate-spin`}
      />
      {message && (
        <span className="text-sm text-text-secondary">
          {message}
        </span>
      )}
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  color: PropTypes.string,
  className: PropTypes.string,
  message: PropTypes.string,
};

export default LoadingSpinner;
