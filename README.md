# Coursera Quiz & Grades Automation

A Chrome extension to automate Coursera quizzes and complete all graded assignments using AI (OpenAI GPT or Google Gemini).

## Features

### Quiz Solver
- **AI-Powered Answers**: Uses GPT-4 or Gemini to analyze and answer quiz questions
- **Auto-Select**: Automatically selects the correct answers
- **Confidence Scores**: Shows AI confidence level for each answer
- **Visual Highlighting**: Highlights selected answers with color coding
- **Keyboard Shortcuts**: Quick access with Alt+Z to solve quizzes
- **Multiple AI Providers**: Supports both OpenAI and Google Gemini

### Grades Automation (NEW!)
- **Automatic Course Completion**: Navigate through all graded assignments in a course
- **Quiz Auto-Solve**: Automatically solves all quizzes and exams
- **Written Assignment Generation**: AI generates responses for written assignments
- **Auto-Upload**: Automatically uploads generated documents
- **Specialization Support**: Continues to next course in a specialization
- **Progress Tracking**: Real-time stats showing completed items

## Requirements

You need an API key from one of the following providers:

### Option 1: OpenAI API Key (Recommended)
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create an account or sign in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Add billing/credits to your account at [Billing](https://platform.openai.com/account/billing)

**Cost**: ~$0.01-0.03 per quiz depending on length (using GPT-4o)

### Option 2: Google Gemini API Key (Free tier available)
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIza`)

**Cost**: Free tier includes 60 requests/minute, paid tier for more

## Installation

1. **Download/Clone this extension folder**

2. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the extension folder

4. **Configure your API key**
   - Click the extension icon in Chrome toolbar
   - Go to "Settings" tab
   - Select your AI provider (OpenAI or Gemini)
   - Enter your API key
   - Click "Save Settings"

## Usage

### Quiz Solver

#### Method 1: Popup Button
1. Navigate to a Coursera quiz page
2. Click the extension icon
3. Click "Solve Current Quiz"

#### Method 2: Keyboard Shortcut
1. Navigate to a Coursera quiz page
2. Press `Alt + Z` to solve the quiz
3. Press `Alt + N` to go to the next question

#### Method 3: Auto-Solve
1. Enable "Auto-solve on page load" in settings
2. Quiz will automatically be solved when you open a quiz page

### Grades Automation

The grades automation feature will automatically complete all graded assignments in a course.

#### How to Use
1. Navigate to any page within a Coursera course
2. Click the extension icon
3. Go to "Grades Auto" tab
4. Configure options:
   - **Continue to next course**: Automatically proceed to the next course in a specialization
   - **Redo completed assignments**: Re-attempt even if already passed
   - **Auto-submit assignments**: Automatically click submit after completing
5. Click "Start Grades Automation"

#### What It Does
1. Navigates to the course's Grades page
2. Identifies all graded assignments
3. For each incomplete assignment:
   - **Quizzes/Exams**: Automatically answers all questions using AI
   - **Written Assignments**: Generates a response based on instructions, creates a document, and uploads it
   - **Discussions**: Posts AI-generated responses
4. After completing all assignments, moves to the next course if enabled

#### Supported Assignment Types
| Type | Automation Level |
|------|------------------|
| Multiple Choice Quizzes | Fully Automated |
| Exams | Fully Automated |
| Written Assignments | Fully Automated (generates and uploads) |
| Discussion Posts | Fully Automated |
| Peer Reviews | Manual Required |
| Programming Assignments | Manual Required |

## Settings

### Quiz Settings
| Setting | Description |
|---------|-------------|
| AI Provider | Choose between OpenAI or Gemini |
| Model | Select the AI model (GPT-4o, Gemini Pro, etc.) |
| Auto-solve | Automatically solve quizzes on page load |
| Auto-select | Automatically click/select the answers |
| Show confidence | Display confidence percentage badges |
| Highlight answers | Visually highlight correct answers |

### Grades Automation Settings
| Setting | Description |
|---------|-------------|
| Continue to next course | Auto-proceed through specialization courses |
| Redo completed assignments | Retry assignments even if already passed |
| Auto-submit assignments | Automatically submit after completion |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt + Z | Solve current quiz |
| Alt + N | Go to next question |
| Alt + G | Start grades automation |

## Supported Question Types

- Multiple choice (single answer)
- Multiple choice (multiple answers)
- True/False questions
- Written response assignments
- Discussion prompts

## Accuracy

- **GPT-4o**: ~95% accuracy on most questions
- **Gemini Pro**: ~90% accuracy on most questions
- **GPT-4o-mini**: ~85% accuracy (faster and cheaper)

*Note: Accuracy varies by subject matter. Technical and programming questions tend to have higher accuracy.*

## Troubleshooting

### "API key not configured"
- Click the extension icon and enter your API key in Settings tab

### "No questions found"
- Make sure you're on a quiz page
- Wait for the page to fully load
- Try pressing Alt+Z to trigger manually

### Answers not being selected
- Some quiz formats may require manual selection
- Check if "Auto-select" is enabled in settings

### Rate limiting errors
- Wait a few seconds and try again
- Consider upgrading your API plan

### Grades automation stops
- Check if you're still logged in to Coursera
- Some assignment types require manual completion
- Re-start automation from the Grades Auto tab

### Written assignment upload fails
- The file will be downloaded automatically
- Upload the downloaded file manually
- Check if the assignment requires a specific file format

## Privacy & Security

- Your API key is stored locally in Chrome's secure storage
- Questions and assignment content are sent to OpenAI/Google for processing
- No data is stored on external servers
- No tracking or analytics
- Generated documents are created locally

## Technical Details

### Files
- `manifest.json` - Chrome extension configuration
- `background.js` - Service worker for API calls
- `content.js` - Quiz solving logic
- `grades-automation.js` - Grades automation module
- `popup.html/js` - Extension popup UI
- `styles.css` - Visual styling

### Permissions
- `storage` - Store settings and API keys
- `activeTab` - Access current tab
- `scripting` - Run scripts on Coursera pages
- `downloads` - Download generated documents

## Disclaimer

This extension is for personal educational use only. Use responsibly and in accordance with your institution's academic policies.

## License

MIT License - Free for personal use.

## Changelog

### v2.0.0
- Added Grades Automation feature
- Support for written assignments and discussions
- Automatic document generation and upload
- Specialization course navigation
- Progress tracking dashboard
- New tabbed popup interface

### v1.0.0
- Initial release
- Quiz solving with OpenAI and Gemini
- Keyboard shortcuts
- Confidence badges
