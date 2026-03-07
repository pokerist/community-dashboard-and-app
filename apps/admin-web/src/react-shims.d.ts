declare module 'react';
declare module 'react/jsx-runtime';
declare module 'react/jsx-dev-runtime';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
