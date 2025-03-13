function updateTabsList() {
  chrome.runtime.sendMessage({ action: "getTabsWithLogs" }, (response) => {
    const tabsList = document.getElementById("tabsList");
    tabsList.innerHTML = '';
    
    response.tabs.forEach(tab => {
      const tabDiv = document.createElement('div');
      tabDiv.className = 'tab-item';
      tabDiv.innerHTML = `
        <div class="tab-title">${tab.info?.title || 'Unknown Tab'}</div>
        <div>Requests logged: ${tab.count}</div>
        <button class="download-tab" data-tabid="${tab.tabId}">Download Tab Logs</button>
      `;
      tabsList.appendChild(tabDiv);
    });

    // Add click handlers for tab download buttons
    document.querySelectorAll('.download-tab').forEach(button => {
      button.addEventListener('click', () => {
        const tabId = parseInt(button.dataset.tabid);
        chrome.runtime.sendMessage(
          { action: "downloadLogs", tabId: tabId },
          response => document.getElementById("status").innerText = response.status
        );
      });
    });
  });
}

document.getElementById("downloadAllBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage(
    { action: "downloadLogs" },
    response => document.getElementById("status").innerText = response.status
  );
});

// Update tabs list when popup opens
document.addEventListener('DOMContentLoaded', updateTabsList);