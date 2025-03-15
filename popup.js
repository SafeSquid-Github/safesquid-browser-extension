function updateViolationsList() {
  chrome.runtime.sendMessage({ action: "getTabsWithViolations" }, (response) => {
    const tabsList = document.getElementById("tabsList");
    tabsList.innerHTML = '';
    
    response.tabs.forEach(tab => {
      const tabDiv = document.createElement('div');
      tabDiv.className = 'tab-item';
      let violationsHtml = tab.violations.map(v => `
        <div class="violation-item">
          <div>Blocked URI: ${v.blockedURI}</div>
          <div>Directive: ${v.violatedDirective}</div>
          <div>Time: ${new Date(v.timeStamp).toLocaleTimeString()}</div>
        </div>
      `).join('');
      
      tabDiv.innerHTML = `
        <div class="tab-title">${tab.info?.title || 'Unknown Tab'}</div>
        <div>Violations: ${tab.violations.length}</div>
        ${violationsHtml}
      `;
      tabsList.appendChild(tabDiv);
    });
  });
}

document.addEventListener('DOMContentLoaded', updateViolationsList);