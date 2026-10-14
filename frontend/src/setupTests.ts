import '@testing-library/jest-dom';

// Polyfill window.URL.createObjectURL and revokeObjectURL for jsdom
if (typeof window.URL.createObjectURL === 'undefined') {
  window.URL.createObjectURL = () => 'blob:mock-audio-url';
}
if (typeof window.URL.revokeObjectURL === 'undefined') {
  window.URL.revokeObjectURL = () => {};
}
