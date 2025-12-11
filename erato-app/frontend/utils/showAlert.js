import { showAlert } from '../components/StyledAlert';

/**
 * Helper function to show styled alerts
 * Usage: showStyledAlert({ title: 'Error', message: 'Something went wrong', type: 'error' })
 */
export const showStyledAlert = ({ title, message, type = 'info' }) => {
  showAlert({ title, message, type });
};

export default showStyledAlert;
