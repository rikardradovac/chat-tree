
let storedRequestHeaders: chrome.webRequest.HttpHeader[] | null = null;

function captureHeaders() {
  chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      storedRequestHeaders = details.requestHeaders || null;
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
      // Since fetchConversationHistory is async, we need to handle it differently
      fetchConversationHistory()
        .then(data => {
          sendResponse({ success: true, data });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // Important: return true to indicate we'll respond asynchronously
    }
    return true;
  }
);

// fetch the conversation history
async function fetchConversationHistory() {
  if (!storedRequestHeaders) {
    console.log('No stored headers available');
    return null;
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

captureHeaders();
