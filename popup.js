// Popup script for Coursera Quiz Automation

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const settings = await chrome.storage.sync.get({
    aiProvider: 'openai',
    openaiKey: '',
    openaiModel: 'gpt-4o',
    geminiKey: '',
    geminiModel: 'gemini-1.5-pro',
    autoSolve: false,
    autoSelect: true,
    showConfidence: true,
    highlightAnswers: true
  });

  // Populate form fields
  document.getElementById('aiProvider').value = settings.aiProvider;
  document.getElementById('openaiKey').value = settings.openaiKey;
  document.getElementById('openaiModel').value = settings.openaiModel;
  document.getElementById('geminiKey').value = settings.geminiKey;
  document.getElementById('geminiModel').value = settings.geminiModel;
  document.getElementById('autoSolve').checked = settings.autoSolve;
  document.getElementById('autoSelect').checked = settings.autoSelect;
  document.getElementById('showConfidence').checked = settings.showConfidence;
  document.getElementById('highlightAnswers').checked = settings.highlightAnswers;

  // Show/hide provider config based on selection
  updateProviderConfig(settings.aiProvider);

  // AI Provider change handler
  document.getElementById('aiProvider').addEventListener('change', (e) => {
    updateProviderConfig(e.target.value);
  });

  // Toggle password visibility
  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Hide';
      } else {
        input.type = 'password';
        btn.textContent = 'Show';
      }
    });
  });

  // Save button handler
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const newSettings = {
      aiProvider: document.getElementById('aiProvider').value,
      openaiKey: document.getElementById('openaiKey').value.trim(),
      openaiModel: document.getElementById('openaiModel').value,
      geminiKey: document.getElementById('geminiKey').value.trim(),
      geminiModel: document.getElementById('geminiModel').value,
      autoSolve: document.getElementById('autoSolve').checked,
      autoSelect: document.getElementById('autoSelect').checked,
      showConfidence: document.getElementById('showConfidence').checked,
      highlightAnswers: document.getElementById('highlightAnswers').checked
    };

    // Validate API key
    const provider = newSettings.aiProvider;
    const key = provider === 'openai' ? newSettings.openaiKey : newSettings.geminiKey;

    if (!key) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    if (provider === 'openai' && !key.startsWith('sk-')) {
      showStatus('Invalid OpenAI API key format', 'error');
      return;
    }

    if (provider === 'gemini' && !key.startsWith('AIza')) {
      showStatus('Invalid Gemini API key format', 'error');
      return;
    }

    await chrome.storage.sync.set(newSettings);
    showStatus('Settings saved successfully!', 'success');

    // Notify content script of settings update
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated', settings: newSettings });
    }
  });

  // Solve button handler
  document.getElementById('solveBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('coursera.org')) {
      showStatus('Please navigate to a Coursera quiz page', 'error');
      return;
    }

    showStatus('Solving quiz...', 'success');

    chrome.tabs.sendMessage(tab.id, { action: 'solveQuiz' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: Could not connect to page. Try refreshing.', 'error');
        return;
      }
      if (response?.success) {
        showStatus(`Solved ${response.questionsAnswered} questions!`, 'success');
      } else {
        showStatus(response?.error || 'Failed to solve quiz', 'error');
      }
    });
  });
});

function updateProviderConfig(provider) {
  const openaiConfig = document.getElementById('openaiConfig');
  const geminiConfig = document.getElementById('geminiConfig');

  if (provider === 'openai') {
    openaiConfig.style.display = 'block';
    geminiConfig.style.display = 'none';
  } else {
    openaiConfig.style.display = 'none';
    geminiConfig.style.display = 'block';
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      status.className = 'status';
    }, 3000);
  }
}
