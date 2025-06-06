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

  // Prevent touch screen keyboard triggers on canvas interactions
  useEffect(() => {
    // Detect touch screen capability
    const hasTouchScreen = 'ontouchstart' in window ||
                          navigator.maxTouchPoints > 0 ||
                          ((navigator as Navigator & { msMaxTouchPoints?: number }).msMaxTouchPoints || 0) > 0;

    if (!hasTouchScreen) return;

    const preventTouchKeyboard = (event: Event) => {
      const target = event.target as HTMLElement;
      
      // Target any input or textarea elements that could trigger keyboard
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Check if it's a Ketcher-related element (clipboard, canvas inputs, etc.)
        const isKetcherInput = target.classList.contains('cliparea') ||
                              target.closest('.ketcher-canvas') ||
                              target.closest('.ketcher-editor') ||
                              target.closest('[class*="ketcher"]') ||
                              target.hasAttribute('readonly') ||
                              target.style.position === 'absolute' ||
                              target.style.left?.includes('-9999') ||
                              target.style.opacity === '0';

        if (isKetcherInput) {
          // Completely prevent focus and input for drawing canvas
          event.preventDefault();
          event.stopImmediatePropagation();
          
          // Immediately blur if somehow focused
          (target as HTMLInputElement | HTMLTextAreaElement).blur();
          
          // Disable the element temporarily for touch interaction
          const originalTabIndex = target.tabIndex;
          target.tabIndex = -1;
          target.setAttribute('readonly', 'true');
          target.setAttribute('inputmode', 'none');
          
          // Reset after a brief moment
          setTimeout(() => {
            target.tabIndex = originalTabIndex;
          }, 100);
          
          return false;
        }
      }
    };

    // Listen for all interaction events that could trigger keyboard
    const events = ['touchstart', 'touchend', 'click', 'focus', 'focusin', 'mousedown'];
    
    events.forEach(eventType => {
      document.addEventListener(eventType, preventTouchKeyboard, {
        capture: true,
        passive: false
      });
    });

    // Also monitor for dynamically added input elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node as HTMLElement;
            // Check for new input/textarea elements
            const inputs = element.tagName === 'INPUT' || element.tagName === 'TEXTAREA'
              ? [element]
              : element.querySelectorAll('input, textarea');
              
            inputs.forEach((input) => {
              const inputElement = input as HTMLInputElement | HTMLTextAreaElement;
              if (inputElement.closest('.ketcher-canvas') || inputElement.closest('.ketcher-editor')) {
                inputElement.setAttribute('inputmode', 'none');
                inputElement.setAttribute('readonly', 'true');
                inputElement.tabIndex = -1;
              }
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Cleanup
    return () => {
      events.forEach(eventType => {
        document.removeEventListener(eventType, preventTouchKeyboard, true);
      });
      observer.disconnect();
    };
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
    return (
      <div className="loading-screen">
        <div className="loading-dots">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>
    );
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
