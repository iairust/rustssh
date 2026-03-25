import { useEffect, useRef } from 'react';

export function useToast() {
  // simple singleton toast
}

let _toastFn = null;

export function setToastFn(fn) {
  _toastFn = fn;
}

export function toast(message, type = 'info') {
  if (_toastFn) _toastFn(message, type);
}
