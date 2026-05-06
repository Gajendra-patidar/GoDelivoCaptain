import { Toast } from 'toastify-react-native';

const show = (type, text1, text2) => {
  if (!text1) {
    return;
  }

  const hasTypeMethod = typeof Toast[type] === 'function';

  if (text2) {
    Toast.show({
      type,
      text1,
      text2,
      duration: 3000,
    });
    return;
  }

  if (hasTypeMethod) {
    Toast[type](text1);
    return;
  }

  Toast.show({
    type,
    text1,
    duration: 3000,
  });
};

export default {
  success: (message, detail) => show('success', message, detail),
  error: (message, detail) => show('error', message, detail),
  warn: (message, detail) => show('warn', message, detail),
  info: (message, detail) => show('info', message, detail),
};
