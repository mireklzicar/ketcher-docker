import { useEffect, useState } from 'react';
import { Editor, InfoModal } from 'ketcher-react';
import type { ButtonsConfig } from 'ketcher-react';
import type { Ketcher, StructServiceProvider } from 'ketcher-core';

import 'ketcher-react/dist/index.css';

import { getStructServiceProvider } from './utils';

const getHiddenButtonsConfig = (): ButtonsConfig => {
  const searchParams = new URLSearchParams(window.location.search);
  const hiddenButtons = searchParams.get('hiddenControls');

  if (!hiddenButtons) return {};

  return hiddenButtons.split(',').reduce((acc: Record<string, { hidden: boolean }>, button) => {
    if (button) acc[button] = { hidden: true };

    return acc;
  }, {} as Record<string, { hidden: boolean }>);
};

const App = () => {
  const hiddenButtonsConfig = getHiddenButtonsConfig();
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [ketcherInstance, setKetcherInstance] = useState<Ketcher | null>(null);

  const [structServiceProvider, setStructServiceProvider] =
    useState<StructServiceProvider | null>(null);
    
  useEffect(() => {
    getStructServiceProvider().then(setStructServiceProvider);
  }, []);

  // Set up message handling outside of onInit to avoid timing issues
  useEffect(() => {
    if (!ketcherInstance) return;

    let lastSmiles = '';
    let isGettingSmiles = false;

    const handleMessage = async (event: MessageEvent) => {
      // Accept messages from any origin for iframe communication
      // In production, you should restrict this to specific allowed origins
      const { type, payload, smiles } = event.data;
      
      // Ignore messages that don't have our expected structure
      if (!type) return;

      try {
        switch (type) {
          case 'setMolecule':
          case 'set-molecule':
            if (payload || smiles) {
              const moleculeData = payload || smiles;
              if (moleculeData.trim()) {
                await ketcherInstance.setMolecule(moleculeData);
                // Wait for structure to be fully rendered
                await new Promise((resolve) => setTimeout(resolve, 200));
                // Get the actual SMILES from what was drawn
                const actualSmiles = await ketcherInstance.getSmiles();
                lastSmiles = actualSmiles;
                // Send the actual SMILES back
                window.parent.postMessage(
                  {
                    type: 'smiles-update',
                    smiles: actualSmiles || '',
                  },
                  '*',
                );
              } else {
                ketcherInstance.editor.clear();
                lastSmiles = '';
                window.parent.postMessage(
                  {
                    type: 'smiles-update',
                    smiles: '',
                  },
                  '*',
                );
              }
            } else {
              ketcherInstance.editor.clear();
              lastSmiles = '';
              window.parent.postMessage(
                {
                  type: 'smiles-update',
                  smiles: '',
                },
                '*',
              );
            }
            // Send confirmation back
            window.parent.postMessage(
              {
                type: 'moleculeSet',
                success: true,
              },
              '*',
            );
            break;

          case 'getSmiles':
          case 'get-smiles':
            try {
              await new Promise((resolve) => setTimeout(resolve, 100));
              const currentSmiles = await ketcherInstance.getSmiles();
              window.parent.postMessage(
                {
                  type: 'smiles',
                  payload: currentSmiles || '',
                },
                '*',
              );
            } catch {
              window.parent.postMessage(
                {
                  type: 'smiles',
                  payload: '',
                },
                '*',
              );
            }
            break;

          case 'clear':
            ketcherInstance.editor.clear();
            window.parent.postMessage(
              {
                type: 'cleared',
                success: true,
              },
              '*',
            );
            break;

          default:
            // Ignore unhandled message types
            break;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        window.parent.postMessage(
          {
            type: 'error',
            error: errorMessage,
          },
          '*',
        );
      }
    };

    // Listen for messages from parent window
    window.addEventListener('message', handleMessage);

    // Set up periodic SMILES updates
    const updateInterval = setInterval(async () => {
      // Prevent overlapping SMILES requests
      if (isGettingSmiles) return;

      try {
        isGettingSmiles = true;
        const currentSmiles = await ketcherInstance.getSmiles();

        // Only update if SMILES actually changed
        if (currentSmiles !== lastSmiles) {
          lastSmiles = currentSmiles;
          window.parent.postMessage(
            {
              type: 'smiles-update',
              smiles: currentSmiles || '',
            },
            '*',
          );
        }
      } catch {
        // Silently ignore errors during periodic updates
      } finally {
        isGettingSmiles = false;
      }
    }, 1000);

    // Cleanup function
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(updateInterval);
    };
  }, [ketcherInstance]);

  if (!structServiceProvider) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Editor
        errorHandler={(message: string) => {
          setHasError(true);
          setErrorMessage(message.toString());
        }}
        buttons={hiddenButtonsConfig}
        staticResourcesUrl={import.meta.env.PUBLIC_URL || ''}
        structServiceProvider={structServiceProvider}
        onInit={(ketcher: Ketcher) => {
          // Store ketcher instance for internal use
          (window as typeof window & { ketcher: Ketcher }).ketcher = ketcher;
          setKetcherInstance(ketcher);

          // Send init message to parent
          window.parent.postMessage(
            {
              eventType: 'init',
              type: 'init'
            },
            '*',
          );

          // Send initial SMILES state
          setTimeout(async () => {
            try {
              const initialSmiles = await ketcher.getSmiles();
              window.parent.postMessage(
                {
                  type: 'smiles-update',
                  smiles: initialSmiles || '',
                },
                '*',
              );
            } catch {
              // Silently ignore initial SMILES error
            }
          }, 500);

          window.scrollTo(0, 0);
        }}
      />
      {hasError && (
        <InfoModal
          message={errorMessage}
          close={() => {
            setHasError(false);

            // Focus on editor after modal is closed
            const cliparea: HTMLElement | null =
              document.querySelector('.cliparea');
            cliparea?.focus();
          }}
        />
      )}
    </>
  );
};

export default App;
