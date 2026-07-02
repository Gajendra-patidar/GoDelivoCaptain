import { showToast } from '../components/PremiumToast';

export default {
  success: (message, title = 'Success') => showToast('success', title, message),
  error: (message, title = 'Error') => showToast('error', title, message),
  warn: (message, title = 'Warning') => showToast('warn', title, message),
  info: (message, title = 'Info') => showToast('info', title, message),
};
