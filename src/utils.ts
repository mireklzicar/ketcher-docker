import {
  type StructServiceProvider,
  RemoteStructServiceProvider,
} from 'ketcher-core';

export const getStructServiceProvider = async (): Promise<StructServiceProvider> => {
  try {
    // Use the real ketcher-standalone service
    const ketcherStandalone = await import('ketcher-standalone');
    return new ketcherStandalone.StandaloneStructServiceProvider();
  } catch {
    // Fallback to remote service if standalone fails
    return new RemoteStructServiceProvider(
      import.meta.env.VITE_API_PATH || import.meta.env.REACT_APP_API_PATH || ''
    );
  }
};