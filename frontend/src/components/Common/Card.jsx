import React from 'react';
import { CardPropTypes } from '../../types';

const Card = ({ children, className = '', hover = false }) => {
  const baseClasses = 'card-container';
  const hoverClasses = hover ? 'transition-shadow duration-200 cursor-pointer' : '';
  
  return (
    <div className={`${baseClasses} ${hoverClasses} ${className}`}>
      {children}
    </div>
  );
};

Card.propTypes = CardPropTypes;

export default Card;
