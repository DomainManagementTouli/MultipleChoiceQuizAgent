// Popup script for Coursera Quiz Automation

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize tabs
  initializeTabs();

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
    highlightAnswers: true,
    continueToNextCourse: true,
    overrideComplete: false,
    autoSubmit: true
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
  document.getElementById('continueToNextCourse').checked = settings.continueToNextCourse;
  document.getElementById('overrideComplete').checked = settings.overrideComplete;
  document.getElementById('autoSubmit').checked = settings.autoSubmit;

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
      highlightAnswers: document.getElementById('highlightAnswers').checked,
      continueToNextCourse: document.getElementById('continueToNextCourse').checked,
      overrideComplete: document.getElementById('overrideComplete').checked,
      autoSubmit: document.getElementById('autoSubmit').checked
    };

    // Validate API key
    const provider = newSettings.aiProvider;
    const key = provider === 'openai' ? newSettings.openaiKey : newSettings.geminiKey;

    if (!key) {
      showStatus('settingsStatus', 'Please enter an API key', 'error');
      return;
    }

    if (provider === 'openai' && !key.startsWith('sk-')) {
      showStatus('settingsStatus', 'Invalid OpenAI API key format', 'error');
      return;
    }

    if (provider === 'gemini' && !key.startsWith('AIza')) {
      showStatus('settingsStatus', 'Invalid Gemini API key format', 'error');
      return;
    }

    await chrome.storage.sync.set(newSettings);
    showStatus('settingsStatus', 'Settings saved successfully!', 'success');

    // Notify content script of settings update
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated', settings: newSettings });
    }
  });

  // Solve quiz button handler
  document.getElementById('solveBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('coursera.org')) {
      showStatus('quizStatus', 'Please navigate to a Coursera quiz page', 'error');
      return;
    }

    showStatus('quizStatus', 'Solving quiz...', 'info');

    chrome.tabs.sendMessage(tab.id, { action: 'solveQuiz' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('quizStatus', 'Error: Could not connect to page. Try refreshing.', 'error');
        return;
      }
      if (response?.success) {
        showStatus('quizStatus', `Solved ${response.questionsAnswered} questions!`, 'success');
      } else {
        showStatus('quizStatus', response?.error || 'Failed to solve quiz', 'error');
      }
    });
  });

  // Next question button handler
  document.getElementById('nextQuestionBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('coursera.org')) {
      showStatus('quizStatus', 'Please navigate to a Coursera page', 'error');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'nextQuestion' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('quizStatus', 'Error: Could not connect to page', 'error');
      }
    });
  });

  // Start automation button handler
  document.getElementById('startAutomationBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('coursera.org')) {
      showStatus('gradesStatus', 'Please navigate to a Coursera course first', 'error');
      return;
    }

    const options = {
      continueToNextCourse: document.getElementById('continueToNextCourse').checked,
      overrideComplete: document.getElementById('overrideComplete').checked,
      autoSubmit: document.getElementById('autoSubmit').checked
    };

    // Save options
    await chrome.storage.sync.set(options);

    showStatus('gradesStatus', 'Starting automation...', 'info');
    updateAutomationUI(true);

    chrome.tabs.sendMessage(tab.id, {
      action: 'startGradesAutomation',
      options: options
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('gradesStatus', 'Error: Could not connect to page. Try refreshing.', 'error');
        updateAutomationUI(false);
        return;
      }
      if (response?.success) {
        showStatus('gradesStatus', 'Automation started!', 'success');
      } else {
        showStatus('gradesStatus', response?.error || 'Failed to start automation', 'error');
        updateAutomationUI(false);
      }
    });
  });

  // Stop automation button handler
  document.getElementById('stopAutomationBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.tabs.sendMessage(tab.id, { action: 'stopGradesAutomation' }, (response) => {
      showStatus('gradesStatus', 'Automation stopped', 'info');
      updateAutomationUI(false);
    });
  });

  // View grades button handler
  document.getElementById('viewGradesBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('coursera.org')) {
      showStatus('gradesStatus', 'Please navigate to a Coursera course first', 'error');
      return;
    }

    // Extract course slug and navigate to grades
    const courseMatch = tab.url.match(/learn\/([^\/\?]+)/);
    if (courseMatch) {
      const gradesUrl = `https://www.coursera.org/learn/${courseMatch[1]}/home/grades`;
      chrome.tabs.update(tab.id, { url: gradesUrl });
    } else {
      showStatus('gradesStatus', 'Could not identify course. Navigate to a course page first.', 'error');
    }
  });

  // Check automation status on load
  checkAutomationStatus();

  // Poll for status updates
  setInterval(checkAutomationStatus, 2000);
});

// Tab management
function initializeTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Add active to clicked tab
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });
}

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

function showStatus(elementId, message, type) {
  const status = document.getElementById(elementId);
  status.textContent = message;
  status.className = `status ${type}`;

  if (type === 'success') {
    setTimeout(() => {
      status.className = 'status';
    }, 3000);
  }
}

function updateAutomationUI(isRunning) {
  const startBtn = document.getElementById('startAutomationBtn');
  const stopBtn = document.getElementById('stopAutomationBtn');
  const statusDot = document.getElementById('statusDot');
  const statusLabel = document.getElementById('statusLabel');
  const automationStatus = document.getElementById('automationStatus');

  if (isRunning) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    statusDot.classList.add('running');
    statusDot.classList.remove('stopped');
    statusLabel.textContent = 'Running';
    automationStatus.classList.add('running');
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    statusDot.classList.remove('running');
    statusDot.classList.add('stopped');
    statusLabel.textContent = 'Stopped';
    automationStatus.classList.remove('running');
  }
}

async function checkAutomationStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.includes('coursera.org')) {
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'getAutomationStatus' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      return;
    }

    updateAutomationUI(response.isRunning);

    // Update stats
    if (response.stats) {
      document.getElementById('statQuizzes').textContent = response.stats.quizzesCompleted || 0;
      document.getElementById('statAssignments').textContent = response.stats.assignmentsCompleted || 0;
      document.getElementById('statCourses').textContent = response.stats.coursesCompleted || 0;
    }

    // Update current task
    const currentTaskDiv = document.getElementById('currentTask');
    const currentTaskText = document.getElementById('currentTaskText');

    if (response.currentAssignment && response.isRunning) {
      currentTaskDiv.style.display = 'block';
      currentTaskText.textContent = response.currentAssignment.title;
    } else {
      currentTaskDiv.style.display = 'none';
    }
  });
}
