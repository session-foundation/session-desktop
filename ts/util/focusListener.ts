let windowFocused = false;

if (typeof window !== 'undefined') {
  window.addEventListener('blur', () => {
    windowFocused = false;
  });
  window.addEventListener('focus', () => {
    windowFocused = true;
  });
}

export const isWindowFocused = () => windowFocused;
