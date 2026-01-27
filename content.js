// Content script for Coursera Quiz Automation

(function() {
  'use strict';

  // Settings cache
  let settings = {
    autoSolve: false,
    autoSelect: true,
    showConfidence: true,
    highlightAnswers: true
  };

  // State
  let isProcessing = false;
  let solvedQuestions = new Set();

  // Initialize
  init();

  async function init() {
    // Load settings
    const stored = await chrome.storage.sync.get({
      autoSolve: false,
      autoSelect: true,
      showConfidence: true,
      highlightAnswers: true
    });
    settings = { ...settings, ...stored };

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'solveQuiz') {
        solveQuiz().then(result => sendResponse(result));
        return true;
      }
      if (request.action === 'nextQuestion') {
        navigateToNextQuestion();
        sendResponse({ success: true });
        return true;
      }
      if (request.action === 'settingsUpdated') {
        settings = { ...settings, ...request.settings };
        sendResponse({ success: true });
        return true;
      }
    });

    // Auto-solve if enabled
    if (settings.autoSolve && isQuizPage()) {
      setTimeout(() => solveQuiz(), 3000);
    }

    // Watch for page changes (SPA navigation)
    observePageChanges();

    console.log('[Coursera Quiz Automation] Initialized');
  }

  // Check if current page is a quiz
  function isQuizPage() {
    const url = window.location.href;
    return url.includes('/exam/') ||
           url.includes('/quiz/') ||
           url.includes('/assignment/') ||
           document.querySelector('[data-testid="quiz-question"]') !== null ||
           document.querySelector('.rc-FormPartsQuestion') !== null ||
           document.querySelector('[class*="QuestionContent"]') !== null;
  }

  // Observe page changes for SPA navigation
  function observePageChanges() {
    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        solvedQuestions.clear();

        if (settings.autoSolve && isQuizPage()) {
          setTimeout(() => solveQuiz(), 3000);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Main function to solve the quiz
  async function solveQuiz() {
    if (isProcessing) {
      return { success: false, error: 'Already processing' };
    }

    isProcessing = true;
    showNotification('Analyzing quiz questions...', 'info');

    try {
      const questions = extractQuestions();

      if (questions.length === 0) {
        showNotification('No questions found on this page', 'error');
        return { success: false, error: 'No questions found' };
      }

      showNotification(`Found ${questions.length} questions. Getting answers...`, 'info');

      let answeredCount = 0;

      for (const q of questions) {
        if (solvedQuestions.has(q.index)) {
          continue;
        }

        try {
          const result = await chrome.runtime.sendMessage({
            action: 'getAnswer',
            question: q.question,
            options: q.options
          });

          if (result.error) {
            console.error(`Error for question ${q.index}:`, result.error);
            showNotification(`Error: ${result.error}`, 'error');
            continue;
          }

          applyAnswer(q, result);
          solvedQuestions.add(q.index);
          answeredCount++;

          // Small delay between questions to avoid rate limiting
          await sleep(500);
        } catch (error) {
          console.error(`Failed to get answer for question ${q.index}:`, error);
        }
      }

      showNotification(`Solved ${answeredCount} questions!`, 'success');
      return { success: true, questionsAnswered: answeredCount };

    } catch (error) {
      console.error('Quiz solving error:', error);
      showNotification(`Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    } finally {
      isProcessing = false;
    }
  }

  // Extract all questions from the page
  function extractQuestions() {
    const questions = [];

    // Try multiple selectors for different Coursera quiz formats
    const questionSelectors = [
      '.rc-FormPartsQuestion',
      '[data-testid="quiz-question"]',
      '[class*="QuestionContent"]',
      '.css-1qxtz39', // Newer format
      '[data-test="question"]',
      '.question-content',
      '[class*="questionContainer"]'
    ];

    let questionElements = [];

    for (const selector of questionSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        questionElements = Array.from(elements);
        break;
      }
    }

    // If no specific containers found, try to find questions by structure
    if (questionElements.length === 0) {
      questionElements = findQuestionsByStructure();
    }

    questionElements.forEach((elem, index) => {
      const questionData = extractQuestionData(elem, index);
      if (questionData) {
        questions.push(questionData);
      }
    });

    return questions;
  }

  // Find questions by DOM structure analysis
  function findQuestionsByStructure() {
    const containers = [];

    // Look for elements that contain both question text and radio/checkbox inputs
    const allRadioGroups = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    const processedParents = new Set();

    allRadioGroups.forEach(input => {
      // Find the parent container that holds the question
      let parent = input.closest('form') || input.closest('[role="group"]') || input.closest('fieldset');

      // Go up to find a better container
      if (!parent) {
        parent = input.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
          if (parent.querySelector('input[type="radio"], input[type="checkbox"]') &&
              (parent.textContent.length > 50)) {
            break;
          }
          parent = parent.parentElement;
        }
      }

      if (parent && !processedParents.has(parent)) {
        processedParents.add(parent);
        containers.push(parent);
      }
    });

    return containers;
  }

  // Extract question data from an element
  function extractQuestionData(elem, index) {
    // Extract question text
    const questionText = extractQuestionText(elem);

    if (!questionText || questionText.length < 10) {
      return null;
    }

    // Extract options
    const options = extractOptions(elem);

    if (options.length < 2) {
      return null;
    }

    return {
      index,
      element: elem,
      question: questionText,
      options: options.map(o => o.text),
      optionElements: options.map(o => o.element),
      type: determineQuestionType(elem)
    };
  }

  // Extract question text
  function extractQuestionText(elem) {
    // Try specific question text selectors
    const textSelectors = [
      '.questionPrompt',
      '[class*="QuestionPrompt"]',
      '.rc-CML',
      '[data-testid="question-text"]',
      '.css-1y7z9xa', // Specific Coursera class
      'h3',
      'p:first-of-type',
      '[class*="questionText"]',
      '[class*="prompt"]'
    ];

    for (const selector of textSelectors) {
      const textElem = elem.querySelector(selector);
      if (textElem) {
        const text = textElem.textContent.trim();
        if (text.length > 10) {
          return cleanText(text);
        }
      }
    }

    // Fallback: get text before the options
    const clone = elem.cloneNode(true);
    const inputs = clone.querySelectorAll('input, label');
    inputs.forEach(el => el.remove());

    const text = clone.textContent.trim();
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    if (lines.length > 0) {
      return cleanText(lines[0]);
    }

    return '';
  }

  // Extract options
  function extractOptions(elem) {
    const options = [];

    // Try to find option elements
    const optionSelectors = [
      'label',
      '[role="radio"]',
      '[role="checkbox"]',
      '[class*="Option"]',
      '[class*="choice"]',
      '.rc-Option'
    ];

    let optionElements = [];

    for (const selector of optionSelectors) {
      const elements = elem.querySelectorAll(selector);
      if (elements.length >= 2) {
        optionElements = Array.from(elements);
        break;
      }
    }

    // Filter and extract text from options
    optionElements.forEach(optElem => {
      const text = extractOptionText(optElem);

      if (text && text.length > 0) {
        // Find associated input
        let input = optElem.querySelector('input[type="radio"], input[type="checkbox"]');
        if (!input && optElem.tagName === 'LABEL') {
          const forId = optElem.getAttribute('for');
          if (forId) {
            input = document.getElementById(forId);
          }
        }

        options.push({
          text: text,
          element: optElem,
          input: input
        });
      }
    });

    // Deduplicate options
    const seen = new Set();
    return options.filter(opt => {
      const key = opt.text.toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Extract text from an option element
  function extractOptionText(elem) {
    // Clone to manipulate
    const clone = elem.cloneNode(true);

    // Remove any checkboxes/radios visually
    const inputs = clone.querySelectorAll('input');
    inputs.forEach(input => input.remove());

    // Get text content
    let text = clone.textContent.trim();

    // Clean up common prefixes
    text = text.replace(/^[A-D]\.\s*/i, '');
    text = text.replace(/^[1-4]\.\s*/, '');

    return cleanText(text);
  }

  // Determine if question is multiple choice or single choice
  function determineQuestionType(elem) {
    const checkboxes = elem.querySelectorAll('input[type="checkbox"]');
    const radios = elem.querySelectorAll('input[type="radio"]');

    if (checkboxes.length > radios.length) {
      return 'multiple';
    }
    return 'single';
  }

  // Apply the answer to the question
  function applyAnswer(questionData, result) {
    const { answerIndices, confidence, explanation } = result;

    if (settings.highlightAnswers) {
      // Remove previous highlights
      questionData.optionElements.forEach(elem => {
        elem.classList.remove('cqa-correct', 'cqa-highlight');
      });
    }

    // Select the answer(s)
    answerIndices.forEach(idx => {
      if (idx >= 0 && idx < questionData.optionElements.length) {
        const optionElem = questionData.optionElements[idx];

        // Highlight
        if (settings.highlightAnswers) {
          optionElem.classList.add('cqa-correct', 'cqa-highlight');
        }

        // Auto-select if enabled
        if (settings.autoSelect) {
          selectOption(optionElem, questionData.element);
        }

        // Show confidence badge
        if (settings.showConfidence) {
          showConfidenceBadge(optionElem, confidence, explanation);
        }
      }
    });

    console.log(`[CQA] Question ${questionData.index}: Answer indices ${answerIndices}, Confidence: ${confidence}%`);
  }

  // Select an option element
  function selectOption(optionElem, questionContainer) {
    // Find the input element
    let input = optionElem.querySelector('input[type="radio"], input[type="checkbox"]');

    if (!input && optionElem.tagName === 'LABEL') {
      const forId = optionElem.getAttribute('for');
      if (forId) {
        input = document.getElementById(forId);
      }
    }

    // If still no input, look in parent
    if (!input) {
      input = optionElem.closest('label')?.querySelector('input') ||
              optionElem.parentElement?.querySelector('input');
    }

    if (input && !input.checked) {
      // For radio buttons, need to uncheck others first
      if (input.type === 'radio') {
        const name = input.name;
        if (name) {
          document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
            if (r !== input && r.checked) {
              r.checked = false;
              r.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        }
      }

      // Click/check the input
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Also trigger click on the label/option for React-based forms
      optionElem.click();
    } else if (!input) {
      // No input found, just click the element
      optionElem.click();
    }
  }

  // Show confidence badge on an option
  function showConfidenceBadge(optionElem, confidence, explanation) {
    // Remove existing badge
    const existingBadge = optionElem.querySelector('.cqa-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const badge = document.createElement('div');
    badge.className = 'cqa-badge';
    badge.innerHTML = `
      <span class="cqa-confidence">${confidence}%</span>
      ${explanation ? `<span class="cqa-tooltip">${explanation}</span>` : ''}
    `;

    // Determine badge color based on confidence
    if (confidence >= 90) {
      badge.classList.add('cqa-high');
    } else if (confidence >= 70) {
      badge.classList.add('cqa-medium');
    } else {
      badge.classList.add('cqa-low');
    }

    optionElem.style.position = 'relative';
    optionElem.appendChild(badge);
  }

  // Navigate to next question
  function navigateToNextQuestion() {
    // Look for next button
    const nextButtonSelectors = [
      '[data-testid="next-button"]',
      'button[aria-label*="Next"]',
      'button:contains("Next")',
      '.css-1xdhyk6', // Coursera specific
      '[class*="NextButton"]',
      'button.next'
    ];

    for (const selector of nextButtonSelectors) {
      try {
        const btn = document.querySelector(selector);
        if (btn) {
          btn.click();
          return;
        }
      } catch (e) {
        // Selector might be invalid, continue
      }
    }

    // Try finding by text content
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.toLowerCase().includes('next') ||
          btn.textContent.toLowerCase().includes('continue')) {
        btn.click();
        return;
      }
    }
  }

  // Show notification toast
  function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.cqa-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `cqa-notification cqa-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.classList.add('cqa-fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // Utility functions
  function cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();
