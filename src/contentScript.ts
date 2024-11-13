function addButtonListeners() {
    console.log("addButtonListeners called"); // Log when the function is called
    // Using mutation observer to handle dynamically added buttons when new messages are created
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          setupListeners();
        }
      }
    });
  
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

  
    function setupListeners() {
      // send buttons have different classes and text. aria-label for the basic at the bottom and when editing a message it has send in the text
      const sendButtons = [
        ...document.querySelectorAll('button[aria-label="Send prompt"]'),
        ...document.querySelectorAll('button.btn.btn-primary')
      ].filter(button => 
        button.getAttribute('aria-label') === 'Send prompt' || 
        button.textContent?.trim() === 'Send'
      );

      sendButtons.forEach(button => {
        if (button.hasAttribute('data-listener-added')) {
          return;
        }
        
        button.setAttribute('data-listener-added', 'true');
        button.addEventListener('click', (e) => {
          e.preventDefault();
          console.log("Calling waitForStreamComplete");
          
          // start waiting for the stream to complete
          chrome.runtime.sendMessage({
            action: 'waitForStreamComplete',
          });
        
        });
      });
  }
  
    // Initial setup
    setupListeners();
  }


addButtonListeners();