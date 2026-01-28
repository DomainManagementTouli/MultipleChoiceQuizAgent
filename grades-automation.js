// Grades Automation Module for Coursera Quiz Automation
// This module handles navigating through course grades, completing all assignments

(function() {
  'use strict';

  // Automation state
  window.GradesAutomation = {
    isRunning: false,
    currentCourse: null,
    currentAssignment: null,
    completedAssignments: new Set(),
    pendingAssignments: [],
    stats: {
      quizzesCompleted: 0,
      assignmentsCompleted: 0,
      coursesCompleted: 0,
      errors: []
    }
  };

  // Configuration
  const CONFIG = {
    DELAYS: {
      PAGE_LOAD: 3000,
      BETWEEN_ASSIGNMENTS: 2000,
      BETWEEN_QUESTIONS: 500,
      FORM_SUBMIT: 1500,
      NAVIGATION: 2000
    },
    MAX_RETRIES: 3,
    ASSIGNMENT_TYPES: {
      QUIZ: 'quiz',
      PEER_REVIEW: 'peer-review',
      PROGRAMMING: 'programming',
      WRITTEN: 'written',
      DISCUSSION: 'discussion',
      PRACTICE: 'practice'
    }
  };

  // ==================== NAVIGATION FUNCTIONS ====================

  // Navigate to grades page for current course
  async function navigateToGrades() {
    const currentUrl = window.location.href;

    // Check if already on a Coursera course page
    if (!currentUrl.includes('coursera.org')) {
      throw new Error('Please navigate to a Coursera course first');
    }

    // Extract course slug from URL
    const courseMatch = currentUrl.match(/learn\/([^\/\?]+)/);
    if (!courseMatch) {
      throw new Error('Could not identify course from URL. Please navigate to a course page.');
    }

    const courseSlug = courseMatch[1];
    const gradesUrl = `https://www.coursera.org/learn/${courseSlug}/home/grades`;

    // Navigate if not already on grades page
    if (!currentUrl.includes('/grades')) {
      showNotification('Navigating to Grades page...', 'info');
      window.location.href = gradesUrl;
      return false; // Page will reload
    }

    return true; // Already on grades page
  }

  // Navigate to a specific assignment
  async function navigateToAssignment(assignment) {
    if (!assignment.url) {
      throw new Error('Assignment URL not found');
    }

    showNotification(`Opening: ${assignment.title}`, 'info');
    window.location.href = assignment.url;
  }

  // Navigate to next course in specialization
  async function navigateToNextCourse() {
    showNotification('Looking for next course in specialization...', 'info');

    // Try to find specialization link
    const specLinks = document.querySelectorAll('a[href*="/specializations/"]');
    if (specLinks.length > 0) {
      const specUrl = specLinks[0].href;
      window.location.href = specUrl;
      return true;
    }

    // Try to find "View all courses" or next course link
    const nextCourseSelectors = [
      '[data-testid="next-course"]',
      'a[href*="/learn/"]:not([href*="' + window.location.pathname + '"])',
      '.rc-CourseCard a',
      '[class*="NextCourse"] a'
    ];

    for (const selector of nextCourseSelectors) {
      const nextLink = document.querySelector(selector);
      if (nextLink && nextLink.href) {
        window.location.href = nextLink.href;
        return true;
      }
    }

    // Check breadcrumb for specialization
    const breadcrumbs = document.querySelectorAll('[class*="breadcrumb"] a, .cds-BreadcrumbItem a');
    for (const crumb of breadcrumbs) {
      if (crumb.href.includes('/specializations/')) {
        window.location.href = crumb.href;
        return true;
      }
    }

    return false;
  }

  // ==================== GRADES PAGE PARSING ====================

  // Extract all graded assignments from grades page
  function extractGradedAssignments() {
    const assignments = [];

    // Multiple selectors for different Coursera UI versions
    const assignmentSelectors = [
      '[data-testid="grade-assignment"]',
      '.rc-GradeRow',
      '[class*="GradeRow"]',
      '[class*="AssignmentRow"]',
      'table tbody tr',
      '.grades-list-item',
      '[class*="grade-item"]'
    ];

    let assignmentElements = [];

    for (const selector of assignmentSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        assignmentElements = Array.from(elements);
        break;
      }
    }

    // If no specific elements found, try to find by structure
    if (assignmentElements.length === 0) {
      assignmentElements = findAssignmentsByStructure();
    }

    assignmentElements.forEach((elem, index) => {
      const assignment = parseAssignmentElement(elem, index);
      if (assignment) {
        assignments.push(assignment);
      }
    });

    return assignments;
  }

  // Find assignments by analyzing DOM structure
  function findAssignmentsByStructure() {
    const containers = [];

    // Look for links that lead to assignments
    const allLinks = document.querySelectorAll('a[href*="/quiz/"], a[href*="/exam/"], a[href*="/assignment/"], a[href*="/peer/"], a[href*="/programming/"]');

    allLinks.forEach(link => {
      // Find the parent row/container
      let parent = link.closest('tr') || link.closest('[class*="row"]') || link.closest('[class*="item"]');
      if (!parent) {
        parent = link.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
          if (parent.querySelector('a') && parent.textContent.length > 20) {
            break;
          }
          parent = parent.parentElement;
        }
      }

      if (parent && !containers.includes(parent)) {
        containers.push(parent);
      }
    });

    return containers;
  }

  // Parse individual assignment element
  function parseAssignmentElement(elem, index) {
    // Extract assignment link and URL
    const linkSelectors = [
      'a[href*="/quiz/"]',
      'a[href*="/exam/"]',
      'a[href*="/assignment/"]',
      'a[href*="/peer/"]',
      'a[href*="/programming/"]',
      'a[href*="/discussionPrompt/"]',
      'a'
    ];

    let link = null;
    for (const selector of linkSelectors) {
      link = elem.querySelector(selector);
      if (link && link.href) break;
    }

    if (!link || !link.href) {
      return null;
    }

    // Extract title
    const title = extractAssignmentTitle(elem, link);
    if (!title) return null;

    // Determine assignment type
    const type = determineAssignmentType(link.href, elem);

    // Extract grade/status
    const gradeInfo = extractGradeInfo(elem);

    // Check if assignment is already completed and passed
    const isComplete = isAssignmentComplete(gradeInfo);

    return {
      index,
      title: title,
      url: link.href,
      type: type,
      grade: gradeInfo.grade,
      status: gradeInfo.status,
      isComplete: isComplete,
      element: elem
    };
  }

  // Extract assignment title
  function extractAssignmentTitle(elem, link) {
    // Try specific title selectors
    const titleSelectors = [
      '[class*="title"]',
      '[class*="name"]',
      'h3', 'h4', 'h5',
      'strong',
      '.rc-AssignmentName'
    ];

    for (const selector of titleSelectors) {
      const titleElem = elem.querySelector(selector);
      if (titleElem && titleElem.textContent.trim().length > 3) {
        return titleElem.textContent.trim();
      }
    }

    // Fallback to link text
    if (link.textContent.trim().length > 3) {
      return link.textContent.trim();
    }

    return null;
  }

  // Determine assignment type from URL and content
  function determineAssignmentType(url, elem) {
    if (url.includes('/quiz/') || url.includes('/exam/')) {
      return CONFIG.ASSIGNMENT_TYPES.QUIZ;
    }
    if (url.includes('/peer/')) {
      return CONFIG.ASSIGNMENT_TYPES.PEER_REVIEW;
    }
    if (url.includes('/programming/')) {
      return CONFIG.ASSIGNMENT_TYPES.PROGRAMMING;
    }
    if (url.includes('/assignment/')) {
      // Check if it's a written assignment or quiz
      const text = elem.textContent.toLowerCase();
      if (text.includes('upload') || text.includes('submit') || text.includes('essay')) {
        return CONFIG.ASSIGNMENT_TYPES.WRITTEN;
      }
      return CONFIG.ASSIGNMENT_TYPES.QUIZ;
    }
    if (url.includes('/discussionPrompt/')) {
      return CONFIG.ASSIGNMENT_TYPES.DISCUSSION;
    }

    // Check content for hints
    const text = elem.textContent.toLowerCase();
    if (text.includes('practice')) {
      return CONFIG.ASSIGNMENT_TYPES.PRACTICE;
    }
    if (text.includes('quiz') || text.includes('exam') || text.includes('test')) {
      return CONFIG.ASSIGNMENT_TYPES.QUIZ;
    }

    return CONFIG.ASSIGNMENT_TYPES.QUIZ; // Default
  }

  // Extract grade information
  function extractGradeInfo(elem) {
    const gradeSelectors = [
      '[class*="grade"]',
      '[class*="score"]',
      '[class*="percentage"]',
      '[class*="status"]'
    ];

    let grade = null;
    let status = 'not_started';

    // Look for grade percentage
    const gradeMatch = elem.textContent.match(/(\d+(?:\.\d+)?)\s*%/);
    if (gradeMatch) {
      grade = parseFloat(gradeMatch[1]);
    }

    // Determine status
    const text = elem.textContent.toLowerCase();
    if (text.includes('passed') || (grade !== null && grade >= 80)) {
      status = 'passed';
    } else if (text.includes('failed') || (grade !== null && grade < 80)) {
      status = 'failed';
    } else if (text.includes('submitted') || text.includes('completed')) {
      status = 'submitted';
    } else if (text.includes('in progress') || text.includes('started')) {
      status = 'in_progress';
    } else if (text.includes('overdue') || text.includes('late')) {
      status = 'overdue';
    }

    return { grade, status };
  }

  // Check if assignment is complete and doesn't need attention
  function isAssignmentComplete(gradeInfo) {
    return gradeInfo.status === 'passed' ||
           (gradeInfo.grade !== null && gradeInfo.grade >= 80);
  }

  // ==================== QUIZ SOLVING ====================

  // Check if current page is a quiz/exam
  function isQuizPage() {
    const url = window.location.href;
    return url.includes('/exam/') ||
           url.includes('/quiz/') ||
           (url.includes('/assignment/') && hasQuizElements());
  }

  // Check if page has quiz elements
  function hasQuizElements() {
    return document.querySelector('input[type="radio"]') !== null ||
           document.querySelector('input[type="checkbox"]') !== null ||
           document.querySelector('[data-testid="quiz-question"]') !== null ||
           document.querySelector('.rc-FormPartsQuestion') !== null;
  }

  // Solve all questions on current quiz page
  async function solveCurrentQuiz() {
    // Use the existing content.js solveQuiz function if available
    if (typeof window.solveQuiz === 'function') {
      return await window.solveQuiz();
    }

    // Otherwise, send message to trigger it
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'triggerQuizSolve' }, (response) => {
        resolve(response);
      });
    });
  }

  // Handle multi-page quizzes
  async function handleMultiPageQuiz() {
    let questionsAnswered = 0;
    let maxPages = 50; // Safety limit

    while (maxPages > 0) {
      // Solve current page
      const result = await solveCurrentQuiz();
      if (result && result.questionsAnswered) {
        questionsAnswered += result.questionsAnswered;
      }

      await sleep(CONFIG.DELAYS.BETWEEN_QUESTIONS);

      // Try to go to next question
      const hasNext = await goToNextQuestion();
      if (!hasNext) {
        // No more questions, try to submit
        await submitQuiz();
        break;
      }

      await sleep(CONFIG.DELAYS.PAGE_LOAD);
      maxPages--;
    }

    return { questionsAnswered };
  }

  // Navigate to next question in quiz
  async function goToNextQuestion() {
    const nextButtonSelectors = [
      '[data-testid="next-button"]',
      'button[aria-label*="Next"]',
      '[class*="NextButton"]',
      '.css-1xdhyk6',
      'button.next'
    ];

    for (const selector of nextButtonSelectors) {
      const btn = document.querySelector(selector);
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
    }

    // Try finding by text
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent.toLowerCase();
      if ((text.includes('next') || text.includes('continue')) && !btn.disabled) {
        btn.click();
        return true;
      }
    }

    return false;
  }

  // Submit completed quiz
  async function submitQuiz() {
    const submitSelectors = [
      '[data-testid="submit-button"]',
      'button[type="submit"]',
      '[class*="SubmitButton"]',
      'button[aria-label*="Submit"]'
    ];

    for (const selector of submitSelectors) {
      const btn = document.querySelector(selector);
      if (btn && !btn.disabled) {
        btn.click();
        await sleep(CONFIG.DELAYS.FORM_SUBMIT);
        return true;
      }
    }

    // Try finding by text
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent.toLowerCase();
      if ((text.includes('submit') || text.includes('finish')) && !btn.disabled) {
        btn.click();
        await sleep(CONFIG.DELAYS.FORM_SUBMIT);
        return true;
      }
    }

    return false;
  }

  // ==================== WRITTEN ASSIGNMENT HANDLING ====================

  // Extract written assignment instructions
  function extractAssignmentInstructions() {
    const instructionSelectors = [
      '[class*="instructions"]',
      '[class*="description"]',
      '[class*="prompt"]',
      '.rc-AssignmentInstructions',
      '[data-testid="assignment-description"]',
      '.assignment-body',
      '.rc-CML',
      'article',
      '[class*="content"]'
    ];

    let instructions = '';

    for (const selector of instructionSelectors) {
      const elem = document.querySelector(selector);
      if (elem && elem.textContent.trim().length > 50) {
        instructions = elem.textContent.trim();
        break;
      }
    }

    // Also extract any rubric information
    const rubricSelectors = [
      '[class*="rubric"]',
      '[class*="criteria"]',
      '[class*="grading"]'
    ];

    for (const selector of rubricSelectors) {
      const rubricElem = document.querySelector(selector);
      if (rubricElem) {
        instructions += '\n\nGrading Criteria:\n' + rubricElem.textContent.trim();
      }
    }

    return instructions;
  }

  // Generate response for written assignment using AI
  async function generateWrittenResponse(instructions, assignmentTitle) {
    const settings = await chrome.storage.sync.get({
      aiProvider: 'openai',
      openaiKey: '',
      openaiModel: 'gpt-4o',
      geminiKey: '',
      geminiModel: 'gemini-1.5-pro'
    });

    const provider = settings.aiProvider;
    const apiKey = provider === 'openai' ? settings.openaiKey : settings.geminiKey;
    const model = provider === 'openai' ? settings.openaiModel : settings.geminiModel;

    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const prompt = `You are a diligent student completing a Coursera assignment.

Assignment Title: ${assignmentTitle}

Assignment Instructions:
${instructions}

Please write a comprehensive, well-structured response that:
1. Directly addresses all requirements in the instructions
2. Is professional and academic in tone
3. Includes relevant examples where appropriate
4. Follows any word count or format requirements mentioned
5. Would receive a high grade based on any rubric criteria provided

Important: Write the response as if you are the student submitting the assignment. Do not include meta-commentary or notes about the response.`;

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'generateText',
        prompt: prompt,
        maxTokens: 2000
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.text);
        }
      });
    });
  }

  // Create and download document file
  function createDocument(content, title, format = 'txt') {
    const fileName = `${sanitizeFileName(title)}.${format}`;
    let blob;

    if (format === 'txt') {
      blob = new Blob([content], { type: 'text/plain' });
    } else if (format === 'html') {
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }</style>
</head>
<body>
<h1>${title}</h1>
${content.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('\n')}
</body>
</html>`;
      blob = new Blob([htmlContent], { type: 'text/html' });
    } else if (format === 'md') {
      const mdContent = `# ${title}\n\n${content}`;
      blob = new Blob([mdContent], { type: 'text/markdown' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { fileName, blob };
  }

  // Sanitize file name
  function sanitizeFileName(name) {
    return name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  // Upload file to assignment
  async function uploadAssignmentFile(blob, fileName) {
    // Find file input
    const fileInputSelectors = [
      'input[type="file"]',
      '[data-testid="file-input"]',
      '[class*="FileUpload"] input',
      '.upload-input'
    ];

    let fileInput = null;
    for (const selector of fileInputSelectors) {
      fileInput = document.querySelector(selector);
      if (fileInput) break;
    }

    if (!fileInput) {
      showNotification('Could not find file upload input. Please upload manually.', 'error');
      return false;
    }

    // Create a File object from the blob
    const file = new File([blob], fileName, { type: blob.type });

    // Create a DataTransfer to set files on input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // Trigger change events
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    await sleep(CONFIG.DELAYS.FORM_SUBMIT);

    return true;
  }

  // Handle text input submission (for assignments with text box instead of file upload)
  async function submitTextResponse(content) {
    const textInputSelectors = [
      'textarea',
      '[contenteditable="true"]',
      '[data-testid="text-input"]',
      '.rc-TextArea',
      '[class*="editor"]'
    ];

    let textInput = null;
    for (const selector of textInputSelectors) {
      textInput = document.querySelector(selector);
      if (textInput) break;
    }

    if (!textInput) {
      return false;
    }

    // Set content
    if (textInput.tagName === 'TEXTAREA') {
      textInput.value = content;
    } else {
      textInput.innerHTML = content.replace(/\n/g, '<br>');
    }

    // Trigger events
    textInput.dispatchEvent(new Event('input', { bubbles: true }));
    textInput.dispatchEvent(new Event('change', { bubbles: true }));

    await sleep(CONFIG.DELAYS.FORM_SUBMIT);
    return true;
  }

  // Handle complete written assignment flow
  async function handleWrittenAssignment(assignmentTitle) {
    showNotification('Analyzing assignment instructions...', 'info');

    // Extract instructions
    const instructions = extractAssignmentInstructions();
    if (instructions.length < 50) {
      throw new Error('Could not extract assignment instructions');
    }

    showNotification('Generating response...', 'info');

    // Generate response
    const response = await generateWrittenResponse(instructions, assignmentTitle);

    // Determine submission method
    const hasFileUpload = document.querySelector('input[type="file"]') !== null;
    const hasTextArea = document.querySelector('textarea') !== null;

    if (hasTextArea) {
      // Submit via text area
      showNotification('Submitting response...', 'info');
      const success = await submitTextResponse(response);
      if (success) {
        await submitAssignment();
        return { success: true, method: 'text' };
      }
    }

    if (hasFileUpload) {
      // Create and upload file
      showNotification('Creating document...', 'info');
      const { fileName, blob } = createDocument(response, assignmentTitle, 'txt');

      showNotification('Uploading file...', 'info');
      const uploaded = await uploadAssignmentFile(blob, fileName);
      if (uploaded) {
        await submitAssignment();
        return { success: true, method: 'file', fileName };
      }
    }

    // Fallback: download file for manual upload
    showNotification('Auto-upload not available. Downloading file...', 'info');
    createDocument(response, assignmentTitle, 'txt');
    return { success: false, method: 'download' };
  }

  // Submit the assignment
  async function submitAssignment() {
    const submitSelectors = [
      '[data-testid="submit-button"]',
      'button[type="submit"]',
      '[class*="Submit"]',
      'button[aria-label*="Submit"]'
    ];

    for (const selector of submitSelectors) {
      const btn = document.querySelector(selector);
      if (btn && !btn.disabled) {
        btn.click();
        await sleep(CONFIG.DELAYS.FORM_SUBMIT);
        return true;
      }
    }

    // Try finding by text
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent.toLowerCase().includes('submit') && !btn.disabled) {
        btn.click();
        await sleep(CONFIG.DELAYS.FORM_SUBMIT);
        return true;
      }
    }

    return false;
  }

  // ==================== DISCUSSION HANDLING ====================

  async function handleDiscussion(title) {
    const instructions = extractAssignmentInstructions();

    showNotification('Generating discussion response...', 'info');

    const response = await generateWrittenResponse(instructions, title);

    const submitted = await submitTextResponse(response);
    if (submitted) {
      await submitAssignment();
      return { success: true };
    }

    return { success: false };
  }

  // ==================== MAIN AUTOMATION FLOW ====================

  // Start full automation
  async function startGradesAutomation(options = {}) {
    if (window.GradesAutomation.isRunning) {
      showNotification('Automation already running', 'error');
      return;
    }

    window.GradesAutomation.isRunning = true;
    window.GradesAutomation.stats = {
      quizzesCompleted: 0,
      assignmentsCompleted: 0,
      coursesCompleted: 0,
      errors: []
    };

    showNotification('Starting grades automation...', 'info');

    try {
      // Navigate to grades if needed
      const onGradesPage = await navigateToGrades();
      if (!onGradesPage) {
        // Page is reloading, save state for continuation
        await saveAutomationState();
        return;
      }

      // Wait for page to load
      await sleep(CONFIG.DELAYS.PAGE_LOAD);

      // Extract all assignments
      const assignments = extractGradedAssignments();
      showNotification(`Found ${assignments.length} graded items`, 'info');

      // Filter to incomplete assignments unless overrideComplete is true
      const toComplete = options.overrideComplete
        ? assignments
        : assignments.filter(a => !a.isComplete);

      if (toComplete.length === 0) {
        showNotification('All assignments are already complete!', 'success');

        if (options.continueToNextCourse) {
          await handleCourseComplete();
        }
        return;
      }

      showNotification(`${toComplete.length} assignments to complete`, 'info');
      window.GradesAutomation.pendingAssignments = toComplete;

      // Save state and start with first assignment
      await saveAutomationState();
      await processNextAssignment();

    } catch (error) {
      console.error('Grades automation error:', error);
      showNotification(`Error: ${error.message}`, 'error');
      window.GradesAutomation.stats.errors.push(error.message);
    }
  }

  // Process next pending assignment
  async function processNextAssignment() {
    const pending = window.GradesAutomation.pendingAssignments;

    if (pending.length === 0) {
      showNotification('All assignments processed!', 'success');
      await handleCourseComplete();
      return;
    }

    const assignment = pending.shift();
    window.GradesAutomation.currentAssignment = assignment;
    await saveAutomationState();

    showNotification(`Processing: ${assignment.title}`, 'info');
    await navigateToAssignment(assignment);
  }

  // Handle current page based on assignment type
  async function handleCurrentAssignment() {
    const state = await loadAutomationState();
    if (!state || !state.currentAssignment) {
      return;
    }

    const assignment = state.currentAssignment;

    // Wait for page to fully load
    await sleep(CONFIG.DELAYS.PAGE_LOAD);

    try {
      let result;

      switch (assignment.type) {
        case CONFIG.ASSIGNMENT_TYPES.QUIZ:
          showNotification('Solving quiz...', 'info');
          result = await handleMultiPageQuiz();
          window.GradesAutomation.stats.quizzesCompleted++;
          break;

        case CONFIG.ASSIGNMENT_TYPES.WRITTEN:
          result = await handleWrittenAssignment(assignment.title);
          window.GradesAutomation.stats.assignmentsCompleted++;
          break;

        case CONFIG.ASSIGNMENT_TYPES.DISCUSSION:
          result = await handleDiscussion(assignment.title);
          window.GradesAutomation.stats.assignmentsCompleted++;
          break;

        case CONFIG.ASSIGNMENT_TYPES.PEER_REVIEW:
          showNotification('Peer review requires manual completion', 'info');
          result = { success: false, reason: 'manual_required' };
          break;

        case CONFIG.ASSIGNMENT_TYPES.PROGRAMMING:
          showNotification('Programming assignment requires manual completion', 'info');
          result = { success: false, reason: 'manual_required' };
          break;

        default:
          // Try to detect and handle
          if (isQuizPage()) {
            result = await handleMultiPageQuiz();
            window.GradesAutomation.stats.quizzesCompleted++;
          } else {
            result = await handleWrittenAssignment(assignment.title);
            window.GradesAutomation.stats.assignmentsCompleted++;
          }
      }

      // Mark as completed
      window.GradesAutomation.completedAssignments.add(assignment.url);

      // Continue to next assignment
      await sleep(CONFIG.DELAYS.BETWEEN_ASSIGNMENTS);

      // Navigate back to grades page
      await navigateToGrades();

    } catch (error) {
      console.error(`Error processing ${assignment.title}:`, error);
      window.GradesAutomation.stats.errors.push(`${assignment.title}: ${error.message}`);

      // Continue with next assignment despite error
      await sleep(CONFIG.DELAYS.BETWEEN_ASSIGNMENTS);
      await navigateToGrades();
    }
  }

  // Handle course completion
  async function handleCourseComplete() {
    window.GradesAutomation.stats.coursesCompleted++;

    const stats = window.GradesAutomation.stats;
    showNotification(
      `Course complete! Quizzes: ${stats.quizzesCompleted}, Assignments: ${stats.assignmentsCompleted}`,
      'success'
    );

    // Check if we should continue to next course
    const state = await loadAutomationState();
    if (state && state.options && state.options.continueToNextCourse) {
      await sleep(CONFIG.DELAYS.NAVIGATION);
      const foundNext = await navigateToNextCourse();
      if (!foundNext) {
        showNotification('No more courses found in specialization!', 'success');
        await clearAutomationState();
      }
    } else {
      await clearAutomationState();
    }
  }

  // ==================== STATE PERSISTENCE ====================

  async function saveAutomationState() {
    const state = {
      isRunning: window.GradesAutomation.isRunning,
      currentAssignment: window.GradesAutomation.currentAssignment,
      pendingAssignments: window.GradesAutomation.pendingAssignments,
      completedAssignments: Array.from(window.GradesAutomation.completedAssignments),
      stats: window.GradesAutomation.stats,
      options: window.GradesAutomation.options || {},
      timestamp: Date.now()
    };

    await chrome.storage.local.set({ gradesAutomationState: state });
  }

  async function loadAutomationState() {
    const result = await chrome.storage.local.get('gradesAutomationState');
    const state = result.gradesAutomationState;

    if (state && Date.now() - state.timestamp < 30 * 60 * 1000) { // 30 minute timeout
      window.GradesAutomation.isRunning = state.isRunning;
      window.GradesAutomation.currentAssignment = state.currentAssignment;
      window.GradesAutomation.pendingAssignments = state.pendingAssignments || [];
      window.GradesAutomation.completedAssignments = new Set(state.completedAssignments || []);
      window.GradesAutomation.stats = state.stats || {};
      window.GradesAutomation.options = state.options || {};
      return state;
    }

    return null;
  }

  async function clearAutomationState() {
    window.GradesAutomation.isRunning = false;
    window.GradesAutomation.currentAssignment = null;
    window.GradesAutomation.pendingAssignments = [];
    await chrome.storage.local.remove('gradesAutomationState');
  }

  // ==================== UTILITIES ====================

  function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.cqa-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `cqa-notification cqa-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button class="cqa-notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('cqa-fade-out');
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== MESSAGE HANDLING ====================

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'startGradesAutomation':
        window.GradesAutomation.options = request.options || {};
        startGradesAutomation(request.options)
          .then(() => sendResponse({ success: true }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;

      case 'stopGradesAutomation':
        clearAutomationState()
          .then(() => sendResponse({ success: true }));
        return true;

      case 'getAutomationStatus':
        sendResponse({
          isRunning: window.GradesAutomation.isRunning,
          stats: window.GradesAutomation.stats,
          currentAssignment: window.GradesAutomation.currentAssignment
        });
        return true;

      case 'continueAutomation':
        handleCurrentAssignment()
          .then(() => sendResponse({ success: true }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
  });

  // ==================== INITIALIZATION ====================

  // Check if we need to continue automation on page load
  async function initGradesAutomation() {
    const state = await loadAutomationState();

    if (state && state.isRunning) {
      // We're in the middle of automation, continue
      if (window.location.href.includes('/grades')) {
        // On grades page, process next assignment
        await sleep(CONFIG.DELAYS.PAGE_LOAD);
        await processNextAssignment();
      } else if (state.currentAssignment) {
        // On an assignment page, handle it
        await handleCurrentAssignment();
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGradesAutomation);
  } else {
    setTimeout(initGradesAutomation, 1000);
  }

  // Export functions for external use
  window.GradesAutomation.start = startGradesAutomation;
  window.GradesAutomation.stop = clearAutomationState;
  window.GradesAutomation.getAssignments = extractGradedAssignments;
  window.GradesAutomation.navigateToGrades = navigateToGrades;
  window.GradesAutomation.navigateToNextCourse = navigateToNextCourse;

  console.log('[Coursera Quiz Automation] Grades automation module loaded');

})();
