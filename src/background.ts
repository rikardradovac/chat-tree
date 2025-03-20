// Function to save headers to chrome.storage
function saveRequestHeaders(headers: chrome.webRequest.HttpHeader[]) {
  chrome.storage.session.set({ storedRequestHeaders: headers }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving headers:', chrome.runtime.lastError);
    }
  });
}

// Function to load headers from chrome.storage
function loadRequestHeaders(): Promise<chrome.webRequest.HttpHeader[] | null> {
  return new Promise((resolve) => {
    chrome.storage.session.get(['storedRequestHeaders'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading headers:', chrome.runtime.lastError);
        resolve(null);
      } else {
        resolve(result.storedRequestHeaders || null);
      }
    });
  });
}

function captureHeaders() {
  chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      if (details.requestHeaders?.some(h => h.name.toLowerCase() === 'authorization')) {
        saveRequestHeaders(details.requestHeaders);
      }
    },
    { urls: ["https://chatgpt.com/backend-api/*"] },
    ["requestHeaders"]
  );

  chrome.webRequest.onSendHeaders.addListener(
    (details) => {
      if (details.requestHeaders?.some(h => h.name.toLowerCase() === 'authorization')) {
        saveRequestHeaders(details.requestHeaders);
      }
    },
    { urls: ["https://chatgpt.com/backend-api/*"] },
    ["requestHeaders"]
  );
}

// Add message listener to handle requests for headers and conversation history
chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse) => {
    if (request.action === "getHeaders") {
      loadRequestHeaders().then(headers => {
        sendResponse({ headers });
      });
      return true;
    } 
    else if (request.action === "fetchConversationHistory") {
      fetchConversationHistory()
        .then(data => {
          // After fetching conversation history, trigger native events
          triggerNativeArticleEvents();
          sendResponse({ success: true, data });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
    else if (request.action === "checkNodes") {
      checkNodesExistence(request.nodeIds)
        .then(existingNodes => {
          sendResponse({ success: true, existingNodes });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Important for async response
    }
    else if (request.action === "editMessage") {
      (async () => {
        try {
          await editMessage(request.messageId, request.message);
          sendResponse({ success: true, completed: true });
        } catch (error: any) {
          sendResponse({ 
            success: false, 
            completed: false, 
            error: error.message 
          });
        }
      })();
      return true; // Keep message channel open for async response
    }
    else if (request.action === "respondToMessage") {
      (async () => {
        try {
          await respondToMessage(request.childrenIds, request.message);
          sendResponse({ success: true, completed: true });
        } catch (error: any) {
          sendResponse({ 
            success: false, 
            completed: false, 
            error: error.message 
          });
        }
      })();
      return true; // Keep message channel open for async response
    } else if (request.action === "executeSteps") {
      (async () => {
        try {
          await selectBranch(request.steps);
          sendResponse({ success: true, completed: true });
        } catch (error: any) {
          sendResponse({ 
            success: false, 
            completed: false, 
            error: error.message 
          });
        }
      })();
      return true; // Keep message channel open for async response
    } else if (request.action === "goToTarget") {
      goToTarget(request.targetId);
      sendResponse({ success: true });
      return true;
    } else if (request.action === "log") {
      console.log(request.message);
      sendResponse({ success: true });
      return true;
    } else if (request.action === "triggerNativeEvents") {
      triggerNativeArticleEvents();
      sendResponse({ success: true });
      return true;
    }
    return false; // For non-async handlers
  }
);

// Function to trigger native events for all article elements in the page
async function triggerNativeArticleEvents() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  if (!currentTab?.id) {
    console.error('No active tab found for triggering native events');
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: () => {
      function triggerNativeEvents(element: Element) {
        if (!element) {
          console.error("triggerNativeEvents: Element is null or undefined.");
          return;
        }

        const eventTypes = [
          'mouseover', 'mouseenter', 'mousemove', 'mousedown', 'mouseup', 'click',
          'pointerover', 'pointerenter', 'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
          'focus', 'focusin'
        ];

        for (const eventType of eventTypes) {
          try {
            const event = new MouseEvent(eventType, {
              bubbles: true,
              cancelable: true,
              view: window,
            });

            Object.defineProperty(event, 'target', {
              value: element,
              enumerable: true,
              configurable: true
            });
            Object.defineProperty(event, 'currentTarget', {
              value: element,
              enumerable: true,
              configurable: true
            });

            element.dispatchEvent(event);
            // console.log(`Dispatched native ${eventType} event on:`, element); // Optional logging
          } catch (error) {
            console.error(`Error dispatching ${eventType} event:`, error);
          }
        }
      }

      // Keep track of triggered elements.
      const triggeredElements = new Set<Element>();

      function processArticle(article: Element) {
        if (!triggeredElements.has(article)) { //only if not already triggered
          // Trigger events on the article itself.
          triggerNativeEvents(article);

          // Trigger events on each direct child of the article.
          Array.from(article.children).forEach(child => {
            triggerNativeEvents(child);
          });
          triggeredElements.add(article); //remember we triggered.
        }
      }

      function findAndTriggerEvents() {
        const articles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
        articles.forEach(processArticle);
      }

      function startPollingForNewArticles() {
        let previousArticleCount = document.querySelectorAll('article[data-testid^="conversation-turn-"]').length;
        
        const pollingInterval = setInterval(() => {
          const currentArticleCount = document.querySelectorAll('article[data-testid^="conversation-turn-"]').length;
          
          if (currentArticleCount > previousArticleCount) {
            findAndTriggerEvents();
          }
          
          previousArticleCount = currentArticleCount;
        }, 2000);
        
        setTimeout(() => {
          clearInterval(pollingInterval);
        }, 30000);
      }

      function init() {
        findAndTriggerEvents();
        startPollingForNewArticles();

        const parentContainerSelector = '.mt-1\\.5\\.flex\\.flex-col\\.text-sm\\.\\@thread-xl\\/thread\\:pt-header-height\\.md\\:pb-9';
        const parentContainer = document.querySelector(parentContainerSelector);

        const observer = new MutationObserver(() => {
          findAndTriggerEvents();
        });

        const observeTarget = parentContainer || document.body;
        observer.observe(observeTarget, { childList: true, subtree: true });

        const chatContainer = document.querySelector('main');
        if (chatContainer) {
          const chatObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                setTimeout(() => {
                  findAndTriggerEvents();
                  startPollingForNewArticles();
                }, 500);
                break;
              }
            }
          });
          
          chatObserver.observe(chatContainer, { childList: true, subtree: true });
        }
      }

      // Check if we've already initialized to avoid duplicate observers
      // Use a data attribute on body instead of a window property
      const isInitialized = document.body.hasAttribute('data-events-initialized');
      if (!isInitialized) {
        document.body.setAttribute('data-events-initialized', 'true');
        
        // Ensure DOM is ready
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", init);
        } else {
          init();
        }
      } else {
        // If already initialized, just trigger events for any new articles
        findAndTriggerEvents();
      }
    }
  }).catch(error => {
    console.error('Error executing triggerNativeArticleEvents:', error);
  });
}

// fetch the conversation history
async function fetchConversationHistory() {
  let headers = null;
  for (let i = 0; i < 3; i++) {
    headers = await loadRequestHeaders();
    if (headers?.some(h => h.name.toLowerCase() === 'authorization')) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!headers?.some(h => h.name.toLowerCase() === 'authorization')) {
    console.error('No authorization header available');
    throw new Error('Authorization header not found');
  }

  try {
    // Use chrome.tabs.query instead of getCurrent
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab?.url) {
      console.log('No active tab URL found');
      return null;
    }
    
    const url = new URL(currentTab.url);
    const conversationId = url.pathname.split('/').pop();

    const headersList = new Headers();
    headers.forEach(header => {
      headersList.append(header.name, header.value || '');
    });

    const response = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`, {
      method: 'GET',
      headers: headersList,
    });
    
    const data = await response.json();
    if (!data) {
      throw new Error('No data received');
    }
    
    // Trigger native events after fetching conversation history
    await triggerNativeArticleEvents();
    
    return data;
  } catch (error) {
    console.error('Error in fetchConversationHistory:', error);
    throw error;
  }
}

async function checkNodesExistence(nodeIds: string[]) {
  try {
    // return true if the node does not exist in the DOM (thus hidden)
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id ?? 0 },
      func: (ids) => {
        return ids.map(id => document.querySelector(`[data-message-id="${id}"]`) === null);
      },
      args: [nodeIds]  // Pass nodeIds as an argument to the injected function
    });
    
    return results[0].result;  // Returns array of nodeIds that exist in the DOM
  } catch (error) {
    console.error('Error in checkNodesExistence:', error);
    throw error;
  }
}

async function editMessage(messageId: string, message: string) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id ?? 0 },
    func: (messageId, message) => {
      // Helper function to wait for DOM changes
      const waitForDomChange = (element: Element, timeout = 2000): Promise<void> => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error('Timeout waiting for DOM changes'));
          }, timeout);

          const observer = new MutationObserver((mutations) => {
            if (mutations.length > 0) {
              clearTimeout(timeoutId);
              observer.disconnect();
              // Give a small buffer for the DOM to settle
              setTimeout(resolve, 50);
            }
          });

          observer.observe(element, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });
        });
      };

      // Convert the callback hell into async/await
      const performEdit = async () => {
        const element = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!element) throw new Error('Message element not found');

        const buttonDiv = element.parentElement?.parentElement;
        if (!buttonDiv) throw new Error('Button container not found');

        // Click edit button
        const buttons = buttonDiv.querySelectorAll("button");
        const editButton = Array.from(buttons).find(button => 
          button.getAttribute('aria-label') === "Edit message"
        );
        if (!editButton) throw new Error('Edit button not found');
        
        editButton.click();
        await waitForDomChange(buttonDiv);

        // Set textarea value
        let textArea = buttonDiv.querySelector("textarea");
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!textArea && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          textArea = buttonDiv.querySelector("textarea");
          attempts++;
        }
        
        if (!textArea) throw new Error('Textarea not found after multiple attempts');
        
        textArea.value = message;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Find and click send button
        let currentElement: Element | null = textArea;
        let sendButton: HTMLButtonElement | null = null;
        let iterations = 0;
        
        while (currentElement && iterations < 10) {
          const buttons = currentElement.querySelectorAll('button');
          sendButton = Array.from(buttons).find(
            button => button.textContent?.trim() === 'Send'
          ) as HTMLButtonElement || null;
          if (sendButton) break;
          
          currentElement = currentElement.parentElement;
          iterations++;
        }

        if (!sendButton) throw new Error('Send button not found');
        sendButton.click();
        
        // Wait for final update after sending
        await waitForDomChange(buttonDiv, 2000);
      };

      // Execute the async function and handle errors
      return performEdit().catch(error => {
        console.error('Error in editMessage:', error);
        throw error;
      });
    },
    args: [messageId, message]
  });
}


async function respondToMessage(childrenIds: string[], message: string) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id ?? 0 },
    func: (childrenIds, message: string) => {
      // Helper function to wait for DOM changes
      const waitForDomChange = (element: Element, timeout = 2000): Promise<void> => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            observer.disconnect();
            reject(new Error('Timeout waiting for DOM changes'));
          }, timeout);

          const observer = new MutationObserver((mutations) => {
            if (mutations.length > 0) {
              clearTimeout(timeoutId);
              observer.disconnect();
              setTimeout(resolve, 50);
            }
          });

          observer.observe(element, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
          });
        });
      };

      const performResponse = async () => {
        // Find the first visible message element
        let element = null;
        for (const messageId of childrenIds) {
          element = document.querySelector(`[data-message-id="${messageId}"]`);
          if (element) break;
        }
        if (!element) throw new Error('No visible message element found');

        const buttonDiv = element.parentElement?.parentElement;
        if (!buttonDiv) throw new Error('Button container not found');

        // Click edit button
        const buttons = buttonDiv.querySelectorAll("button");
        const editButton = Array.from(buttons).find(button => 
          button.getAttribute('aria-label') === "Edit message"
        );
        if (!editButton) throw new Error('Edit button not found');

        editButton.click();
        await waitForDomChange(buttonDiv);

        // Set textarea value
        let textArea = buttonDiv.querySelector("textarea");
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!textArea && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          textArea = buttonDiv.querySelector("textarea");
          attempts++;
        }
        
        if (!textArea) throw new Error('Textarea not found after multiple attempts');
        
        textArea.value = message;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Find and click send button
        let currentElement: Element | null = textArea;
        let sendButton: HTMLButtonElement | null = null;
        let iterations = 0;

        while (currentElement && iterations < 10) {
          const buttons = currentElement.querySelectorAll('button');
          sendButton = Array.from(buttons).find(
            button => button.textContent?.trim() === 'Send'
          ) as HTMLButtonElement || null;
          if (sendButton) break;

          currentElement = currentElement.parentElement;
          iterations++;
        }

        if (!sendButton) throw new Error('Send button not found');
        sendButton.click();

        // Wait for final update after sending
        await waitForDomChange(buttonDiv, 2000);
      };

      // Execute the async function and handle errors
      return performResponse().catch(error => {
        console.error('Error in respondToMessage:', error);
        throw error;
      });
    },
    args: [childrenIds, message]
  });
}

async function selectBranch(stepsToTake: any[]) {
  try {
    if (!Array.isArray(stepsToTake)) {
      throw new Error('stepsToTake must be an array');
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }
    const currentTab = tabs[0];
    if (!currentTab.id) {
      throw new Error('Current tab has no ID');
    }

    await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: (stepsToTake) => {
        // Optimized DOM change detection with shorter timeout
        const waitForDomChange = (): Promise<void> => {
          return new Promise((resolve) => {
            // Much shorter timeout - just enough for the UI to update
            const maxWaitTime = 500;
            
            const timeout = setTimeout(() => {
              observer.disconnect();
              resolve();
            }, maxWaitTime);

            const observer = new MutationObserver((mutations) => {
              // Check if we have meaningful mutations that suggest content change
              if (mutations.some(m => 
                  m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0) ||
                  (m.type === 'attributes' && ['style', 'class'].includes(m.attributeName || '')))) {
                clearTimeout(timeout);
                observer.disconnect();
                resolve();
              }
            });

            // Observe the main content area for faster detection
            const mainContent = document.querySelector('main') || document.body;
            observer.observe(mainContent, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style', 'class', 'aria-hidden']
            });
          });
        };

        // Process all steps as fast as possible
        const processSteps = async () => {
          try {
            for (const step of stepsToTake) {
              if (!step.nodeId) {
                throw new Error('Step missing nodeId');
              }

              // Find the target element
              const element = document.querySelector(`[data-message-id="${step.nodeId}"]`);
              if (!element) {
                throw new Error(`Element not found for nodeId: ${step.nodeId}`);
              }
              
              const buttonDiv = element.parentElement?.parentElement;
              if (!buttonDiv) {
                throw new Error(`Button container not found for nodeId: ${step.nodeId}`);
              }

              // Find the navigation button by aria-label
              const targetLabel = step.stepsLeft > 0 ? "Previous response" : "Next response";
              const buttons = Array.from(buttonDiv.querySelectorAll("button"));
              const button = buttons.find(btn => btn.getAttribute('aria-label') === targetLabel);
              
              if (!button) {
                throw new Error(`Button with required aria-label not found for nodeId: ${step.nodeId}`);
              }

              // Click the button and wait for DOM changes
              button.click();
              await waitForDomChange();
            }
          } catch (error) {
            console.error('Error processing steps:', error);
            throw error;
          }
        };

        return processSteps();
      },
      args: [stepsToTake]
    });

  } catch (error) {
    console.error('selectBranch failed:', error);
    throw error;
  }
}

async function goToTarget(targetId: string) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id ?? 0 },
    func: (targetId) => {
      const element = document.querySelector(`[data-message-id="${targetId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    args: [targetId]
  })
}

captureHeaders();

const CHATGPT_ORIGIN = 'https://chatgpt.com';

chrome.tabs.onUpdated.addListener(async (tabId, _info, tab) => {
  try {
    if (!tab.url) {
      console.log('No URL found for tab:', tabId);
      return;
    }
    const url = new URL(tab.url);
    if (url.origin === CHATGPT_ORIGIN) {
      await chrome.sidePanel.setOptions({
        tabId,
        path: 'index.html',
        enabled: true
      });
      
      // Trigger native events when a ChatGPT page is loaded or updated
      // Wait a bit for the page to fully load
      setTimeout(() => {
        triggerNativeArticleEvents();
      }, 1500);
    } else {
      await chrome.sidePanel.setOptions({
        tabId,
        enabled: false
      });
    }
  } catch (error) {
    console.error('Error in onUpdated listener:', error);
  }
});




chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (!tab.url) return;
  const url = new URL(tab.url);
  
  if (url.origin === CHATGPT_ORIGIN) {
    await chrome.sidePanel.setOptions({
      tabId: activeInfo.tabId,
      path: 'index.html',
      enabled: true
    });
    
    // Trigger native events when switching to a ChatGPT tab
    // Wait a bit for the page to be fully active
    setTimeout(() => {
      triggerNativeArticleEvents();
    }, 500);
  } else {
    await chrome.sidePanel.setOptions({
      tabId: activeInfo.tabId,
      enabled: false
    });
  }
});


chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
