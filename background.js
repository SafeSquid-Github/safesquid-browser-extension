let tabInfo = new Map();
let securityViolations = new Map();

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
      violations: securityViolations.get(tabId) || []
    }));
    sendResponse({ tabs: tabsWithViolations });
  } else if (message.action === "securityViolation") {
    const tabId = sender.tab.id;
    if (!securityViolations.has(tabId)) {
      securityViolations.set(tabId, []);
    }
    securityViolations.get(tabId).push(message.violation);
  }
  return true;
});