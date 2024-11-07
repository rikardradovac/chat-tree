let storedRequestHeaders: chrome.webRequest.HttpHeader[] | null = null;

// Function to save headers to chrome.storage
function saveRequestHeaders(headers: chrome.webRequest.HttpHeader[]) {
  chrome.storage.local.set({ storedRequestHeaders: headers }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving headers:', chrome.runtime.lastError);
    }
  });
}

// Function to load headers from chrome.storage
function loadRequestHeaders(): Promise<chrome.webRequest.HttpHeader[] | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['storedRequestHeaders'], (result) => {
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

function getRequestHeaders(): chrome.webRequest.HttpHeader[] | null {
  return storedRequestHeaders;
}

// Add message listener to handle requests for headers and conversation history
chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse) => {
    if (request.action === "getHeaders") {
      sendResponse({ headers: storedRequestHeaders });
    } 
    else if (request.action === "fetchConversationHistory") {
      fetchConversationHistory()
        .then(data => {
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
      editMessage(request.messageId);
      sendResponse({ success: true });
      return true;
    }
    else if (request.action === "respondToMessage") {
      respondToMessage(request.childrenIds);
      sendResponse({ success: true });
      return true;
    }
    return true;
  }
);

// fetch the conversation history
async function fetchConversationHistory() {
  for (let i = 0; i < 3; i++) {
    storedRequestHeaders = await loadRequestHeaders();
    if (storedRequestHeaders?.some(h => h.name.toLowerCase() === 'authorization')) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
  }

  if (!storedRequestHeaders?.some(h => h.name.toLowerCase() === 'authorization')) {
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

    const headers = new Headers();
    storedRequestHeaders.forEach(header => {
      headers.append(header.name, header.value || '');
    });

    const response = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`, {
      method: 'GET',
      headers,
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
            buttons[0].click(); // the edit message button
            
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
            buttons[0].click(); // the edit message button
            
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

captureHeaders();
