// Global variables for API endpoints and IDs
const CHATGPT_ORIGIN = 'https://chatgpt.com';
const CLAUDE_ORIGIN = 'https://claude.ai';
let claudeOrgId: string | null = null;

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

// Function to capture Claude organization IDs
function captureClaudeOrgId() {
  const CLAUDE_ORG_PATTERN = "https://claude.ai/api/organizations/*";
  const CLAUDE_ORG_PREFIX = "https://claude.ai/api/organizations/";

  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.url.startsWith(CLAUDE_ORG_PREFIX)) {
        const orgId = details.url.substring(CLAUDE_ORG_PREFIX.length).split('/')[0];
        if (orgId) {
          claudeOrgId = orgId;
          // Store the org ID in chrome.storage for potential future use
          chrome.storage.session.set({ claudeOrgId: orgId });
        }
      }
    },
    { 
      urls: [CLAUDE_ORG_PATTERN],
      types: ["xmlhttprequest"] as chrome.webRequest.ResourceType[]
    }
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
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.url) {
          sendResponse({ success: false, error: "Could not get current tab URL" });
          return;
        }
        
        const url = new URL(tabs[0].url);
        if (url.origin === CHATGPT_ORIGIN) {
          checkNodesExistence(request.nodeIds)
            .then(existingNodes => {
              sendResponse({ success: true, existingNodes });
            })
            .catch(error => {
              sendResponse({ success: false, error: error.message });
            });
        } else {
          sendResponse({ success: false, error: "Invalid origin for OpenAI check" });
        }
      });
      return true;
    }
    else if (request.action === "checkNodesClaude") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.url) {
          sendResponse({ success: false, error: "Could not get current tab URL" });
          return;
        }
        
        const url = new URL(tabs[0].url);
        if (url.origin === CLAUDE_ORIGIN) {
        
      
          if (!request.nodeTexts || !Array.isArray(request.nodeTexts)) {
            console.error('Invalid nodeTexts:', request.nodeTexts);
            sendResponse({ success: false, error: "Invalid nodeTexts provided" });
            return;
          }
          checkNodesExistenceClaude(request.nodeTexts)
            .then(existingNodes => {
              sendResponse({ success: true, existingNodes });
            })
            .catch(error => {
              sendResponse({ success: false, error: error.message });
            });
        } else {
          sendResponse({ success: false, error: "Invalid origin for Claude check" });
        }
      });
      return true;
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
    } else if (request.action === "executeStepsClaude") {
      (async () => {
        try {
          await selectBranchClaude(request.steps);
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

    } else if (request.action === "goToTargetClaude") {
      goToTargetClaude(request.targetId);
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
    } else if (request.action === "getClaudeOrgId") {
      chrome.storage.session.get(['claudeOrgId'], (result) => {
        sendResponse({ orgId: result.claudeOrgId || null });
      });
      return true;
    } else if (request.action === "respondToMessageClaude") {
      (async () => {
        try {
          await respondToMessageClaude(request.childrenIds, request.message);
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
    } else if (request.action === "editMessageClaude") {
      (async () => {
        try {
          await editMessageClaude(request.messageId, request.message);
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
          // Process recursively up to 5 levels deep
          processElementRecursively(article, 0);
          triggeredElements.add(article); //remember we triggered.
        }
      }

      function processElementRecursively(element: Element, depth: number) {
        if (depth > 5) return; // Stop at depth 5
        
        // Trigger events on the current element
        triggerNativeEvents(element);

        // Process all children recursively
        Array.from(element.children).forEach(child => {
          processElementRecursively(child, depth + 1);
        });
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
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab?.url) {
      console.log('No active tab URL found');
      return null;
    }
    
    const url = new URL(currentTab.url);
    const conversationId = url.pathname.split('/').pop();

    // Determine if we're on Claude or ChatGPT
    if (url.origin === CLAUDE_ORIGIN && claudeOrgId) {
      // Claude API endpoint - no need for headers
      const response = await fetch(
        `${CLAUDE_ORIGIN}/api/organizations/${claudeOrgId}/chat_conversations/${conversationId}?tree=True&rendering_mode=messages&render_all_tools=true`,
        {
          method: 'GET',
          credentials: 'include' // This will include cookies
        }
      );
      
      const data = await response.json();
      if (!data) {
        throw new Error('No data received from Claude API');
      }
      
      // Trigger native events after fetching conversation history
      await triggerNativeArticleEvents();
      
      return data;
    } else if (url.origin === CHATGPT_ORIGIN) {
      // ChatGPT API endpoint - needs headers
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
        throw new Error('No data received from ChatGPT API');
      }
      
      // Trigger native events after fetching conversation history
      await triggerNativeArticleEvents();
      
      return data;
    } else {
      throw new Error('Unsupported chat platform');
    }
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

async function checkNodesExistenceClaude(nodeTexts: string[] | undefined) {
  if (!nodeTexts || !Array.isArray(nodeTexts)) {
    throw new Error('Invalid nodeTexts provided');
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  if (!currentTab?.id) {
    throw new Error('No active tab found');
  }

  // Ensure nodeTexts is serializable by converting to plain strings
  const serializableTexts = nodeTexts.map(text => String(text));

  const results = await chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: (texts: string[]) => {
      function htmlTextEqualsIgnoringArtifacts(html: string, text: string): boolean {
        const decodeEntities = (str: string) =>
          str
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"');

        const stripMarkdown = (str: string) =>
          str
            .replace(/[*_`~>#-]/g, '')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/!\[(.*?)\]\(.*?\)/g, '$1');

        const removeArtifactBlocks = (str: string) =>
          str.replace(/<antArtifact[^>]*title="([^"]+)"[^>]*>[\s\S]*?<\/antArtifact>/gi, '$1 Document');

        const normalize = (str: string) =>
          decodeEntities(stripMarkdown(removeArtifactBlocks(str)))
            .replace(/^\d+\.\s*/gm, '')   // remove numbered bullets
            .replace(/^•\s*/gm, '')       // remove bullets
            .replace(/\s+/g, ' ')         // collapse all whitespace
            .trim();
        

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        function getVisibleTextWithSpacing(node: Node, listStack: number[] = []): string {
          let result = '';

        
          for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              result += child.textContent || '';
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const el = child as HTMLElement;
              const tag = el.tagName.toLowerCase();
        
              if (tag === 'br') {
                result += '\n';
                continue;
              }
        
              if (tag === 'ol') {
                const startAttr = parseInt(el.getAttribute('start') || '1', 10);
                listStack.push(startAttr);
                result += '\n' + getVisibleTextWithSpacing(el, listStack) + '\n';
                listStack.pop();
                continue;
              }
        
              if (tag === 'ul') {
                listStack.push(-1); // sentinel for unordered
                result += '\n' + getVisibleTextWithSpacing(el, listStack) + '\n';
                listStack.pop();
                continue;
              }
        
              if (tag === 'li') {
                let bullet = '• ';
                if (listStack[listStack.length - 1] !== -1) {
                  bullet = `${listStack[listStack.length - 1]++}. `;
                }
                result += bullet + getVisibleTextWithSpacing(el, listStack).trim() + '\n';
                continue;
              }
        
              result += getVisibleTextWithSpacing(el, listStack);
              if (['p', 'div', 'section', 'article', 'li'].includes(tag)) {
                result += '\n';
              }
            }
          }
        
          return result;
        }
        
        const htmlText = getVisibleTextWithSpacing(doc.body);

        const normalizedHTML = normalize(htmlText);
        const normalizedText = normalize(text);

        return normalizedHTML === normalizedText;
      }

      return texts.map(expectedText => {
        const containers = document.querySelectorAll('.grid-cols-1');
        
        for (const container of containers) {
          const containerHTML = container.innerHTML;
          if (htmlTextEqualsIgnoringArtifacts(containerHTML, expectedText)) {
            return false;
          }
        }
        return true;
      });
    },
    args: [serializableTexts]
  });

  return results[0].result;
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

        let button = null;
        let attempts = 0;
        const maxAttempts = 50;

        while (!button && attempts < maxAttempts) {
          const buttons = Array.from(buttonDiv.querySelectorAll("button"));
          // For user messages, buttons are [copy, edit, left, right]
          // For assistant messages, buttons are [buttons..., left, right, copy, thumbs up, thumbs down, read aloud, regenerate]
          const isAssistant = element.getAttribute('data-message-author-role') === 'assistant';
          const buttonIndex = isAssistant ? buttons.length - 7 : 1; // edit is always second button for user, or 7th from end for assistant
          button = buttons[buttonIndex];
          
          if (!button) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (!button) throw new Error('Edit button not found');
        
        button.click();
        await waitForDomChange(buttonDiv);

        // Set textarea value
        let textArea = buttonDiv.querySelector("textarea");
        let textAreaAttempts = 0;
        const maxTextAreaAttempts = 5;
        
        while (!textArea && textAreaAttempts < maxTextAreaAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          textArea = buttonDiv.querySelector("textarea");
          textAreaAttempts++;
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
          const buttons = Array.from(currentElement.querySelectorAll('button'));
          // Send button is always the second button in the textarea container
          sendButton = buttons[1] as HTMLButtonElement || null;
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

        let button = null;
        let attempts = 0;
        const maxAttempts = 50;

        while (!button && attempts < maxAttempts) {
          const buttons = Array.from(buttonDiv.querySelectorAll("button"));
          // For user messages, buttons are [copy, edit, left, right]
          // For assistant messages, buttons are [buttons..., left, right, copy, thumbs up, thumbs down, read aloud, regenerate]
          const isAssistant = element.getAttribute('data-message-author-role') === 'assistant';
          const buttonIndex = isAssistant ? buttons.length - 7 : 1; // edit is always second button for user, or 7th from end for assistant
          button = buttons[buttonIndex];
          
          if (!button) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (!button) throw new Error('Edit button not found');

        button.click();
        await waitForDomChange(buttonDiv);

        // Set textarea value
        let textArea = buttonDiv.querySelector("textarea");
        let textAreaAttempts = 0;
        const maxTextAreaAttempts = 5;
        
        while (!textArea && textAreaAttempts < maxTextAreaAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          textArea = buttonDiv.querySelector("textarea");
          textAreaAttempts++;
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
          const buttons = Array.from(currentElement.querySelectorAll('button'));
          // Send button is always the second button in the textarea container
          sendButton = buttons[1] as HTMLButtonElement || null;
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

async function selectBranchClaude(stepsToTake: any[]) {
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


        function findButtons(element: Element | null, maxDepth = 5) {
          if (!element) {
            return null; // Base case: Element is null, return null.
          }
        
          if (maxDepth <= 0) {
            return null; // Base case: Reached maximum depth, return null.
          }
        
          // Find all buttons inside the current element
          const buttons = element.querySelectorAll('button');
        
          if (buttons.length > 0) {
            // If buttons are found, convert NodeList to an array and return it
            return Array.from(buttons);
          }
        
          // Recursive step: Move up to the parent element
          return findButtons(element.parentElement, maxDepth - 1);
        }

        const waitForDomChange = (): Promise<void> => {
          return new Promise((resolve) => {
            const observer = new MutationObserver((mutations) => {
              if (mutations.some(m => 
                  m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0) ||
                  (m.type === 'attributes' && ['style', 'class'].includes(m.attributeName || '')))) {
                observer.disconnect();
                resolve();
              }
            });

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
              const normalizedTargetText = step.nodeText.trim().replace(/\s+/g, ' ');
              const containers = document.querySelectorAll('.grid-cols-1');
              
              let element = null;
              for (const container of containers) {
                const containerText = container.textContent?.trim().replace(/\s+/g, ' ');
                if (containerText === normalizedTargetText) {
                  element = container; // Return the element that matches
                }
              }

              
              //0 is edit, 1 is previous, 2 is next
              let buttonIndex = step.stepsLeft > 0 ? 1 : 2;

              const buttons = findButtons(element);

              if (!buttons) {
                throw new Error(`Button with required aria-label not found for nodeId: ${step.nodeId}`);
              }

              const button = buttons[buttonIndex];

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
    console.error('selectBranchClaude failed:', error);
    throw error;
  }
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
        console.log("stepsToTake", stepsToTake);

        // Function to trigger native events on a specific element
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
            } catch (error) {
              console.error(`Error dispatching ${eventType} event:`, error);
            }
          }
        }
        // Optimized DOM change detection with shorter timeout
        const waitForDomChange = (): Promise<void> => {
          return new Promise((resolve) => {
            const observer = new MutationObserver((mutations) => {
              if (mutations.some(m => 
                  m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0) ||
                  (m.type === 'attributes' && ['style', 'class'].includes(m.attributeName || '')))) {
                observer.disconnect();
                resolve();
              }
            });

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

              triggerNativeEvents(element);
              
              const buttonDiv = element.parentElement?.parentElement;
              if (!buttonDiv) {
                throw new Error(`Button container not found for nodeId: ${step.nodeId}`);
              }

              // to find the correct button to press, we need to know if the message is an assistant message or not
              let button = null;
              let attempts = 0;
              const maxAttempts = 50; // Prevent infinite loop

              while (!button && attempts < maxAttempts) {
                const buttons = Array.from(buttonDiv.querySelectorAll("button"));
                
                // Calculate button index based on role and steps
                let buttonIndex = 0;
                if (step.role === "assistant") {
                  // in the assistant case, we can have multiple buttons in the div (from the response) but the left and right buttons
                  // are always 6 and 5 steps from the end of the array respectively
                  // [buttons..., left, right, copy, thumbs up, thumbs down, read alout, regenerate]
                  buttonIndex = buttons.length - 7 + (step.stepsLeft > 0 ? 0 : 1);
                } else {
                  // buttons are [copy, edit, left, right]
                  buttonIndex = step.stepsLeft > 0 ? 2 : 3;
                }
                
                button = buttons[buttonIndex];
                
                if (!button) {
                  // Process element and its children recursively up to 5 levels
                  function processElementRecursively(element: Element, depth: number) {
                    if (depth > 5) return;
                    triggerNativeEvents(element);
                    Array.from(element.children).forEach(child => {
                      processElementRecursively(child, depth + 1);
                    });
                  }
                  
                  processElementRecursively(element, 0);
                  attempts++;
                }
              }
              
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

async function goToTargetClaude(targetText: string) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  await chrome.scripting.executeScript({
    target: { tabId: currentTab.id ?? 0 },
    func: (targetText) => {
      function htmlTextEqualsIgnoringArtifacts(html: string, text: string): boolean {
        const decodeEntities = (str: string) =>
          str
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"');

        const stripMarkdown = (str: string) =>
          str
            .replace(/[*_`~>#-]/g, '')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/!\[(.*?)\]\(.*?\)/g, '$1');

        const removeArtifactBlocks = (str: string) =>
          str.replace(/<antArtifact[^>]*title="([^"]+)"[^>]*>[\s\S]*?<\/antArtifact>/gi, '$1 Document');

        const normalize = (str: string) =>
          decodeEntities(stripMarkdown(removeArtifactBlocks(str)))
            .replace(/^\d+\.\s*/gm, '')   // remove numbered bullets
            .replace(/^•\s*/gm, '')       // remove bullets
            .replace(/\s+/g, ' ')         // collapse all whitespace
            .trim();
        

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        function getVisibleTextWithSpacing(node: Node, listStack: number[] = []): string {
          let result = '';

        
          for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              result += child.textContent || '';
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const el = child as HTMLElement;
              const tag = el.tagName.toLowerCase();
        
              if (tag === 'br') {
                result += '\n';
                continue;
              }
        
              if (tag === 'ol') {
                const startAttr = parseInt(el.getAttribute('start') || '1', 10);
                listStack.push(startAttr);
                result += '\n' + getVisibleTextWithSpacing(el, listStack) + '\n';
                listStack.pop();
                continue;
              }
        
              if (tag === 'ul') {
                listStack.push(-1); // sentinel for unordered
                result += '\n' + getVisibleTextWithSpacing(el, listStack) + '\n';
                listStack.pop();
                continue;
              }
        
              if (tag === 'li') {
                let bullet = '• ';
                if (listStack[listStack.length - 1] !== -1) {
                  bullet = `${listStack[listStack.length - 1]++}. `;
                }
                result += bullet + getVisibleTextWithSpacing(el, listStack).trim() + '\n';
                continue;
              }
        
              result += getVisibleTextWithSpacing(el, listStack);
              if (['p', 'div', 'section', 'article', 'li'].includes(tag)) {
                result += '\n';
              }
            }
          }
        
          return result;
        }
        
        const htmlText = getVisibleTextWithSpacing(doc.body);

        const normalizedHTML = normalize(htmlText);
        const normalizedText = normalize(text);


        return normalizedHTML === normalizedText;
      }

      const containers = document.querySelectorAll('.grid-cols-1');
      
      for (const container of containers) {
        const containerHTML = container.innerHTML;
        if (htmlTextEqualsIgnoringArtifacts(containerHTML, targetText)) {
          container.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    },
    args: [targetText]
  })
}

async function respondToMessageClaude(childrenIds: string[], message: string) {
  try {
    
    if (!Array.isArray(childrenIds)) {
      throw new Error('childrenIds must be an array');
    }

    if (typeof message !== 'string') {
      throw new Error('message must be a string');
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
      func: (childrenIds, message) => {
        // Helper function to wait for DOM changes with specific state check
        
        function findButtons(element: Element | null, maxDepth = 5) {
          if (!element) {
            console.log('No element provided to findButtons');
            return null;
          }
        
          if (maxDepth <= 0) {
            console.log('Reached maximum depth in findButtons');
            return null;
          }
        
          const buttons = element.querySelectorAll('button');
        
        
          if (buttons.length > 0) {
            return Array.from(buttons);
          }
        
          return findButtons(element.parentElement, maxDepth - 1);
        }

        const performResponse = async () => {
         
          
          // Find the first visible message element
          let element = null;
          for (const messageId of childrenIds) {
           
            const normalizedTargetText = messageId.trim().replace(/\s+/g, ' ');
            const containers = document.querySelectorAll('.grid-cols-1');
            
            
            for (const container of containers) {
              const containerText = container.textContent?.trim().replace(/\s+/g, ' ');
              if (containerText === normalizedTargetText) {
                
                element = container;
                break;
              }
            }
            if (element) break;
          }

          if (!element) {
            console.error('No visible message element found');
            throw new Error('No visible message element found');
          }

          // Find the edit button using the findButtons function
          const buttons = findButtons(element);
          if (!buttons) {
            console.error('No buttons found');
            throw new Error('No buttons found');
          }

          // Find the edit button (it's usually the first button)
          const editButton = buttons[0];
          if (!editButton) {
            console.error('Edit button not found');
            throw new Error('Edit button not found');
          }

          editButton.click();

          // Wait for the new textarea to appear
          let textArea: HTMLTextAreaElement | null = null;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (!textArea && attempts < maxAttempts) {
            // Look for textarea with the specific class pattern
            textArea = document.querySelector('textarea.bg-bg-000.border.border-border-300') as HTMLTextAreaElement;
            if (!textArea) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
          }

          if (!textArea) {
            console.error('Textarea not found after multiple attempts');
            throw new Error('Textarea not found after multiple attempts');
          }

          textArea.value = message as string;
          textArea.dispatchEvent(new Event('input', { bubbles: true }));

          // Find the parent element that contains the buttons
          let buttonContainer: HTMLElement | null = textArea;
          let iterations = 0;
          const maxIterations = 5;
          
          while (iterations < maxIterations) {
            buttonContainer = buttonContainer.parentElement;
            if (!buttonContainer) break;
            
            const buttons = buttonContainer.querySelectorAll('button');
            if (buttons.length > 0) {
              console.log('Found button container');
              break;
            }
            iterations++;
          }

          if (!buttonContainer) {
            console.error('Could not find button container');
            throw new Error('Could not find button container');
          }

          // Find and click the send button (usually the second button)
          const sendButton = buttonContainer.querySelectorAll('button')[1];
          if (!sendButton) {
            console.error('Send button not found');
            throw new Error('Send button not found');
          }

          sendButton.click();
        };

        return performResponse().catch(error => {
          console.error('Error in respondToMessageClaude:', error);
          throw error;
        });
      },
      args: [childrenIds, message]
    });
  } catch (error) {
    console.error('respondToMessageClaude failed:', error);
    throw error;
  }
}

async function editMessageClaude(messageText: string, newMessage: string) {
  try {
    
    if (typeof messageText !== 'string') {
      throw new Error('messageText must be a string');
    }

    if (typeof newMessage !== 'string') {
      throw new Error('newMessage must be a string');
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
      func: (messageText, newMessage) => {
        function findButtons(element: Element | null, maxDepth = 5) {
          if (!element) {
            console.log('No element provided to findButtons');
            return null;
          }
        
          if (maxDepth <= 0) {
            console.log('Reached maximum depth in findButtons');
            return null;
          }
        
          const buttons = element.querySelectorAll('button');
         
        
          if (buttons.length > 0) {
            return Array.from(buttons);
          }
        
          return findButtons(element.parentElement, maxDepth - 1);
        }

        const performEdit = async () => {
          
          // Find the message element
          const normalizedTargetText = messageText.trim().replace(/\s+/g, ' ');
          const containers = document.querySelectorAll('.grid-cols-1');
          
          let element = null;
          for (const container of containers) {
            const containerText = container.textContent?.trim().replace(/\s+/g, ' ');
            if (containerText === normalizedTargetText) {
              element = container;
              break;
            }
          }

          if (!element) {
            console.error('No visible message element found');
            throw new Error('No visible message element found');
          }

          // Find the edit button using the findButtons function
          const buttons = findButtons(element);
          if (!buttons) {
            console.error('No buttons found');
            throw new Error('No buttons found');
          }

          // Find the edit button (it's usually the first button)
          const editButton = buttons[0];
          if (!editButton) {
            console.error('Edit button not found');
            throw new Error('Edit button not found');
          }

          editButton.click();

          // Wait for the new textarea to appear
          let textArea: HTMLTextAreaElement | null = null;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (!textArea && attempts < maxAttempts) {
            // Look for textarea with the specific class pattern
            textArea = document.querySelector('textarea.bg-bg-000.border.border-border-300') as HTMLTextAreaElement;
            if (!textArea) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
          }

          if (!textArea) {
            console.error('Textarea not found after multiple attempts');
            throw new Error('Textarea not found after multiple attempts');
          }

          textArea.value = newMessage;
          textArea.dispatchEvent(new Event('input', { bubbles: true }));

          // Find the parent element that contains the buttons
          let buttonContainer: HTMLElement | null = textArea;
          let iterations = 0;
          const maxIterations = 5;
          
          while (iterations < maxIterations) {
            buttonContainer = buttonContainer.parentElement;
            if (!buttonContainer) break;
            
            const buttons = buttonContainer.querySelectorAll('button');
            if (buttons.length > 0) {
              break;
            }
            iterations++;
          }

          if (!buttonContainer) {
            console.error('Could not find button container');
            throw new Error('Could not find button container');
          }

          // Find and click the send button (usually the second button)
          const sendButton = buttonContainer.querySelectorAll('button')[1];
          if (!sendButton) {
            console.error('Send button not found');
            throw new Error('Send button not found');
          }

          sendButton.click();
        };

        return performEdit().catch(error => {
          console.error('Error in editMessageClaude:', error);
          throw error;
        });
      },
      args: [messageText, newMessage]
    });
  } catch (error) {
    console.error('editMessageClaude failed:', error);
    throw error;
  }
}

captureHeaders();
captureClaudeOrgId();

chrome.tabs.onUpdated.addListener(async (tabId, _info, tab) => {
  try {
    if (!tab.url) {
      console.log('No URL found for tab:', tabId);
      return;
    }
    const url = new URL(tab.url);
    if (url.origin === CHATGPT_ORIGIN || url.origin === CLAUDE_ORIGIN) {
      await chrome.sidePanel.setOptions({
        tabId,
        path: 'index.html',
        enabled: true
      });
      
      // Trigger native events when a ChatGPT or Claude page is loaded or updated
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
  
  if (url.origin === CHATGPT_ORIGIN || url.origin === CLAUDE_ORIGIN) {
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

