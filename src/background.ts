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
    switch (request.action) {
      case "getHeaders":
        loadRequestHeaders().then(headers => {
          sendResponse({ headers });
        });
        return true;

      case "fetchConversationHistory":
        fetchConversationHistory()
          .then(data => {
            sendResponse({ success: true, data });
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case "checkNodes":
        checkNodesExistence(request.nodeIds)
          .then(existingNodes => {
            sendResponse({ success: true, existingNodes });
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        return true;

      case "editMessage":
        editMessage(request.messageId);
        sendResponse({ success: true });
        return true;

      case "respondToMessage":
        respondToMessage(request.childrenIds);
        sendResponse({ success: true });
        return true;

      case "executeSteps":
        selectBranch(request.steps);
        sendResponse({ success: true });
        return true;

      case "goToTarget":
        goToTarget(request.targetId);
        sendResponse({ success: true });
        return true;

      case "log":
        console.log(request.message);
        sendResponse({ success: true });
        return true;
      case "waitForStreamComplete":
        waitForStreamComplete().then(() => {
          sendResponse({ success: true });
        });
        return true;

      default:
        return true;
    }
  }
);

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

async function editMessage(messageId: string) {

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id ?? 0 },
    func: (messageId) => {
      // find the message id and scroll to it
      const element = document.querySelector(`[data-message-id="${messageId}"]`);
      if (element) {

        const buttonDiv = element.parentElement?.parentElement;
        if (buttonDiv) {
          // First scroll to position
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Wait a brief moment before clicking the edit button
          setTimeout(() => {
            const buttons = buttonDiv.querySelectorAll("button");
            const buttonIndex = Array.from(buttons).findIndex(button => button.getAttribute('aria-label') === "Edit message");
            if (buttonIndex !== -1) {
              buttons[buttonIndex].click();
            } else {
              throw new Error(`Button with required aria-label not found`);
            }
            
            // Add another scroll after a slight delay to maintain position
            setTimeout(() => {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }, 100);
        }
        
      }
    },
    args: [messageId]
  });
}


async function respondToMessage(childrenIds: string[]) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id ?? 0 },
    func: (childrenIds) => {
      let element = null;

      // since not all childrenIds are visible, we need to find the one that is
      for (const messageId of childrenIds) {
        element = document.querySelector(`[data-message-id="${messageId}"]`);
        if (element) {
          break;
        }
      }
      // find the message id and scroll to it
      if (element) {
        const buttonDiv = element.parentElement?.parentElement;
        if (buttonDiv) {
          
          // Wait a brief moment before clicking the edit button
          setTimeout(() => {
            const buttons = buttonDiv.querySelectorAll("button");
            const buttonIndex = Array.from(buttons).findIndex(button => button.getAttribute('aria-label') === "Edit message");
            if (buttonIndex !== -1) {
              buttons[buttonIndex].click();
            } else {
              throw new Error(`Button with required aria-label not found`);
            }
            
            // Add another scroll after a slight delay to maintain position
            setTimeout(() => {

              // clear the text area so the user can respond
              const textArea = buttonDiv.querySelector("textarea");
              if (textArea) {
                  textArea.value = "";

                  textArea.dispatchEvent(new Event('input', { bubbles: true }));
              }
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }, 100);
        }
      }
    },
    args: [childrenIds]
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
        const waitForDomChange = (element: Element): Promise<void> => {
          return new Promise((resolve, reject) => {
            const maxWaitTime = 5000; // 5 seconds maximum wait
            const timeout = setTimeout(() => {
              observer.disconnect();
              reject(new Error('Timeout waiting for DOM changes'));
            }, maxWaitTime);

            const observer = new MutationObserver((_mutations, obs) => {
              clearTimeout(timeout);
              obs.disconnect();
              resolve();
            });

            observer.observe(element, {
              childList: true,
              subtree: true,
              attributes: true,
              characterData: true
            });
          });
        };

        // Process steps sequentially using async/await
        let prevId: string | null = null;
        let buttonDiv: Element | null | undefined = null;
        const processSteps = async () => {
          try {
            for (const step of stepsToTake) {
              if (!step.nodeId) {
                throw new Error('Step missing nodeId');
              }

              if (prevId !== step.nodeId) {
                // if the node is different from the previous one, we need to find the new buttonDiv
                const element = document.querySelector(`[data-message-id="${step.nodeId}"]`);
                if (!element) {
                  throw new Error(`Element not found for nodeId: ${step.nodeId}`);
                }
                
                buttonDiv = element.parentElement?.parentElement;
                if (!buttonDiv) {
                  throw new Error(`Button container not found for nodeId: ${step.nodeId}`);
                }
              }

              if (!buttonDiv) {
                throw new Error(`Button container not found for nodeId: ${step.nodeId}`);
              }

              const buttons = buttonDiv.querySelectorAll("button");
              if (!buttons || buttons.length < 3) {
                throw new Error(`Required buttons not found for nodeId: ${step.nodeId}`);
              }

              // Find the button with the correct aria-label based on direction
              const buttonIndex = Array.from(buttons).findIndex(button => {
                const ariaLabel = button.getAttribute('aria-label');
                return step.stepsLeft > 0 ? 
                  ariaLabel === "Previous response" :
                  ariaLabel === "Next response";
              });

              if (buttonIndex === -1) {
                throw new Error(`Button with required aria-label not found for nodeId: ${step.nodeId}`);
              }
              buttons[buttonIndex].click();
              
              try {
                prevId = step.nodeId;
                await waitForDomChange(buttonDiv);
              } catch (error) {
                console.error('Error waiting for DOM change:', error);
                throw error;
              }
            }
          } catch (error) {
            console.error('Error processing steps:', error);
            throw error;
          }
        };

        processSteps().catch(error => {
          console.error('Failed to process steps:', error);
        });
      },
      args: [stepsToTake]
    }).catch(error => {
      console.error('Script execution failed:', error);
      throw error;
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

async function waitForStreamComplete() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id ?? 0 },
    func: () => {
      return new Promise<void>((resolve, reject) => {
        let chatContainer: Element | null | undefined = null;

        // Wait briefly for the streaming element to be added
        setTimeout(() => {
          chatContainer = document.querySelector('[class*="result-streaming"]')?.parentElement;
          if (!chatContainer) {
            console.log("No chat container found");
            resolve();
            return;
          }
        }, 100); // 100ms delay

        const maxWaitTime = 5000;
        const timeout = setTimeout(() => {
          observer.disconnect();
          reject(new Error('Timeout waiting for stream to complete'));
        }, maxWaitTime);

        const observer = new MutationObserver((_mutations) => {
          // Check if any element in the container has result-streaming
          const hasStreamingElement = chatContainer?.querySelector('[class*="result-streaming"]') !== null;
          console.log("Has streaming element:", hasStreamingElement);
          
          if (!hasStreamingElement) {
            console.log('Stream completed - no more streaming elements');
            clearTimeout(timeout);
            observer.disconnect();
            resolve();
          }
        });

        observer.observe(chatContainer!, {
          subtree: true,      // Watch all descendants
          attributes: true,   // Watch for attribute changes
          attributeFilter: ['class']  // Only watch class changes
        });
      });
    }
  });
}

captureHeaders();

chrome.sidePanel.setOptions({
  path: 'index.html',
  enabled: true
});
