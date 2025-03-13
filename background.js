let logs = new Map();
let pendingRequests = new Map();
let tabInfo = new Map();

// Track tab updates and initial states
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url) {
    tabInfo.set(tabId, {
      url: tab.url,
      title: tab.title || 'Untitled'
    });
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
  if (message.action === "downloadLogs") {
    const tabId = message.tabId;
    let outputData = {};
    
    if (tabId) {
      // Single tab download
      const tabLogs = logs.get(tabId) || [];
      outputData = {
        tabId: tabId,
        tabInfo: tabInfo.get(tabId) || { url: "unknown", title: "Unknown Tab" },
        requests: tabLogs
      };
    } else {
      // All tabs download
      outputData = {
        tabs: Array.from(logs.entries()).map(([tabId, tabLogs]) => ({
          tabId: tabId,
          tabInfo: tabInfo.get(parseInt(tabId)) || { url: "unknown", title: "Unknown Tab" },
          requests: tabLogs
        }))
      };
    }
    
    const jsonString = JSON.stringify(outputData, null, 2);
    const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
    chrome.downloads.download({
      url: dataUrl,
      filename: `traffic_logs_${tabId || 'all'}.json`
    });
    sendResponse({ status: "Download started" });
  } else if (message.action === "getTabsWithLogs") {
    const tabsWithLogs = Array.from(logs.keys()).map(tabId => ({
      tabId,
      info: tabInfo.get(parseInt(tabId)),
      count: logs.get(tabId).length
    }));
    sendResponse({ tabs: tabsWithLogs });
  }
  return true;
});

// Listen to all outgoing requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const requestData = {
      id: details.requestId,
      timeStamp: details.timeStamp,
      url: details.url,
      method: details.method,
      type: details.type,
      requestBody: details.requestBody,
      initiator: details.initiator,
      tabId: details.tabId
    };
    pendingRequests.set(details.requestId, requestData);
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const request = pendingRequests.get(details.requestId);
    if (request) {
      request.requestHeaders = details.requestHeaders;
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// Modify the onHeadersReceived listener
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const request = pendingRequests.get(details.requestId);
    if (request) {
      const logEntry = {
        request: request,
        response: {
          status: details.statusCode,
          statusLine: details.statusLine,
          responseHeaders: details.responseHeaders,
          timeStamp: details.timeStamp,
          fromCache: details.fromCache,
          ip: details.ip
        }
      };
      
      // Store logs per tab
      if (!logs.has(details.tabId)) {
        logs.set(details.tabId, []);
      }
      logs.get(details.tabId).push(logEntry);
      pendingRequests.delete(details.requestId);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);