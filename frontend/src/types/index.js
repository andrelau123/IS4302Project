// Common constants and PropTypes for IS4302Project frontend
import PropTypes from 'prop-types';

// Transaction Status Constants
export const TransactionStatus = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
};

// Button Variants
export const ButtonVariants = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  SUCCESS: 'success',
  DANGER: 'danger',
  WARNING: 'warning',
  OUTLINE: 'outline',
};

// Modal Sizes
export const ModalSizes = {
  SMALL: 'sm',
  MEDIUM: 'md',
  LARGE: 'lg',
  EXTRA_LARGE: 'xl',
};

// Product Status Constants
export const PRODUCT_STATUS = {
  REGISTERED: 0,
  IN_TRANSIT: 1,
  AT_RETAILER: 2,
  SOLD: 3,
  DISPUTED: 4,
};

// Product Status Labels
export const PRODUCT_STATUS_LABELS = {
  [PRODUCT_STATUS.REGISTERED]: 'Registered',
  [PRODUCT_STATUS.IN_TRANSIT]: 'In Transit',
  [PRODUCT_STATUS.AT_RETAILER]: 'At Retailer',
  [PRODUCT_STATUS.SOLD]: 'Sold',
  [PRODUCT_STATUS.DISPUTED]: 'Disputed',
};

// PropTypes for components
export const ButtonPropTypes = {
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  variant: PropTypes.oneOf(Object.values(ButtonVariants)),
  disabled: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

export const CardPropTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  hover: PropTypes.bool,
};

export const ModalPropTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func.isRequired,
  maxWidth: PropTypes.oneOf(Object.values(ModalSizes)),
};

export const ConfirmationDialogPropTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
};

export const ProductPropTypes = {
  productId: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  ipfsHash: PropTypes.string,
  price: PropTypes.string,
  quantity: PropTypes.number,
  origin: PropTypes.string,
  category: PropTypes.string,
  isVerified: PropTypes.bool,
  retailerId: PropTypes.string,
  timestamp: PropTypes.number,
};

export const ProductNFTPropTypes = {
  tokenId: PropTypes.number.isRequired,
  productId: PropTypes.number.isRequired,
  owner: PropTypes.string.isRequired,
  isAuthentic: PropTypes.bool.isRequired,
  metadata: PropTypes.string.isRequired,
  mintedAt: PropTypes.number,
};

export const RetailerPropTypes = {
  retailerId: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  contactInfo: PropTypes.string.isRequired,
  isVerified: PropTypes.bool.isRequired,
  isActive: PropTypes.bool.isRequired,
  reputationScore: PropTypes.number,
};
