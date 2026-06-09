'use client';

import { Toaster } from 'sonner';

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#f8f3ea',
          color: '#0f172a',
          borderColor: '#ece4d8',
        },
      }}
      closeButton
    />
  );
}
