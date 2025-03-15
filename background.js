let tabInfo = new Map();
let securityViolations = new Map();
let consoleLogs = new Map();

// Track tab updates and initial states
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url) {
    tabInfo.set(tabId, {
      url: tab.url,
      title: tab.title || 'Untitled'
    });
  }
  if (changeInfo.status === 'complete') {
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.addEventListener('securitypolicyviolation', (e) => {
          chrome.runtime.sendMessage({
            action: 'securityViolation',
            violation: {
              blockedURI: e.blockedURI,
              violatedDirective: e.violatedDirective,
              originalPolicy: e.originalPolicy,
              disposition: e.disposition,
              documentURI: e.documentURI,
              timeStamp: e.timeStamp
            }
          });
        });

        window.addEventListener('error', (e) => {
          if (e.message.includes('sandboxed')) {
            chrome.runtime.sendMessage({
              action: 'sandboxError',
              error: {
                message: e.message,
                url: e.filename,
                line: e.lineno,
                column: e.colno,
                error: e.error
              }
            });
          }
        });

        // Add console log capturing
        const originalConsole = {
          log: console.log,
          error: console.error,
          warn: console.warn,
          info: console.info
        };

        function sendConsoleLog(type, args) {
          chrome.runtime.sendMessage({
            action: 'consoleLog',
            log: {
              type,
              message: Array.from(args).map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' '),
              timestamp: Date.now()
            }
          });
        }

        console.log = function(...args) {
          sendConsoleLog('log', args);
          originalConsole.log.apply(console, args);
        };
        console.error = function(...args) {
          sendConsoleLog('error', args);
          originalConsole.error.apply(console, args);
        };
        console.warn = function(...args) {
          sendConsoleLog('warn', args);
          originalConsole.warn.apply(console, args);
        };
        console.info = function(...args) {
          sendConsoleLog('info', args);
          originalConsole.info.apply(console, args);
        };
      }
    }).catch(() => {}); // Ignore errors for pages where we can't inject
  }
});

// Get initial tabs
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    tabInfo.set(tab.id, {
      url: tab.url,
      title: tab.title || 'Untitled'
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getTabsWithViolations") {
    const tabsWithViolations = Array.from(securityViolations.keys()).map(tabId => ({
      tabId,
      info: tabInfo.get(parseInt(tabId)),
      violations: securityViolations.get(tabId) || [],
      logs: consoleLogs.get(tabId) || []
    }));
    sendResponse({ tabs: tabsWithViolations });
  } else if (message.action === "securityViolation") {
    const tabId = sender.tab.id;
    if (!securityViolations.has(tabId)) {
      securityViolations.set(tabId, []);
    }
    securityViolations.get(tabId).push(message.violation);
  } else if (message.action === "sandboxError") {
    console.log('Sandbox Error:', message.error);
  } else if (message.action === "consoleLog") {
    const tabId = sender.tab.id;
    if (!consoleLogs.has(tabId)) {
      consoleLogs.set(tabId, []);
    }
    consoleLogs.get(tabId).push(message.log);
  }
  return true;
});