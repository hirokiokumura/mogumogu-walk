'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/mogumogu-walk/sw.js', {
        scope: '/mogumogu-walk/',
      });
    }
  }, []);

  return null;
}
