# Coursera Quiz Automation

A personal Chrome extension to automate Coursera quizzes using AI (OpenAI GPT or Google Gemini).

## Features

- **AI-Powered Answers**: Uses GPT-4 or Gemini to analyze and answer quiz questions
- **Auto-Select**: Automatically selects the correct answers
- **Confidence Scores**: Shows AI confidence level for each answer
- **Visual Highlighting**: Highlights selected answers with color coding
- **Keyboard Shortcuts**: Quick access with Alt+Z to solve quizzes
- **Multiple AI Providers**: Supports both OpenAI and Google Gemini

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
   - Select the `coursera-quiz-automation` folder

4. **Configure your API key**
   - Click the extension icon in Chrome toolbar
   - Select your AI provider (OpenAI or Gemini)
   - Enter your API key
   - Click "Save Settings"

## Usage

### Method 1: Popup Button
1. Navigate to a Coursera quiz page
2. Click the extension icon
3. Click "Solve Current Quiz"

### Method 2: Keyboard Shortcut
1. Navigate to a Coursera quiz page
2. Press `Alt + Z` to solve the quiz
3. Press `Alt + N` to go to the next question

### Method 3: Auto-Solve
1. Enable "Auto-solve on page load" in settings
2. Quiz will automatically be solved when you open a quiz page

## Settings

| Setting | Description |
|---------|-------------|
| AI Provider | Choose between OpenAI or Gemini |
| Model | Select the AI model (GPT-4o, Gemini Pro, etc.) |
| Auto-solve | Automatically solve quizzes on page load |
| Auto-select | Automatically click/select the answers |
| Show confidence | Display confidence percentage badges |
| Highlight answers | Visually highlight correct answers |

## Supported Question Types

- Multiple choice (single answer)
- Multiple choice (multiple answers)
- True/False questions

## Accuracy

- **GPT-4o**: ~95% accuracy on most questions
- **Gemini Pro**: ~90% accuracy on most questions
- **GPT-4o-mini**: ~85% accuracy (faster and cheaper)

*Note: Accuracy varies by subject matter. Technical and programming questions tend to have higher accuracy.*

## Troubleshooting

### "API key not configured"
- Click the extension icon and enter your API key

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

## Privacy & Security

- Your API key is stored locally in Chrome's secure storage
- Questions are sent to OpenAI/Google for processing
- No data is stored on external servers
- No tracking or analytics

## Disclaimer

This extension is for personal educational use only. Use responsibly and in accordance with your institution's academic policies.

## License

MIT License - Free for personal use.
