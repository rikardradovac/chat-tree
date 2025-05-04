# ChatTree Chat 🌳💬

A browser extension that visualizes ChatGPT and Claude.ai conversations as interactive graphs, allowing you to explore and navigate your AI conversations in a non-linear way.

<p align="center">
  <img src="assets/preview.png" alt="Preview Image" width="90%">
</p>

## Features 🚀

- **Graph Visualization**: View your ChatGPT and Claude.ai conversations as interactive graphs
- **Non-linear Navigation**: Jump between different parts of the conversation without following the linear flow
- **Search Functionality**: Search through your conversation history to find specific messages
- **Export Options**: Export your conversations in multiple formats:
  - Markdown (for general use)
  - Obsidian (for Obsidian note-taking)
  - XML (for structured data)
- **Cross-Platform Support**: Works with both OpenAI's ChatGPT and Anthropic's Claude.ai

## Tech Stack

- [React](https://reactjs.org/) - UI Framework
- [Vite](https://vitejs.dev/) - Build Tool
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [@xyflow/react](https://reactflow.dev/) - Graph Visualization
- [@dagrejs/dagre](https://github.com/dagrejs/dagre) - Graph creation
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load the extension in your browser:
   - Open Chrome/Edge
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory from this project

## Usage 

1. Open a ChatGPT or Claude.ai conversation
2. Click the extension icon to visualize the conversation as a graph
3. Navigate the conversation by clicking on nodes
4. Use the search feature to find specific messages
5. Export your conversation in your preferred format

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Security & Privacy

This extension requires the following permissions to function:

- **storage**: To save headers in session in order to fetch the conversations
- **tabs**: To access the current ChatGPT/Claude.ai conversation
- **webRequest**: To monitor API requests for conversation data
- **scripting**: To inject the visualization interface
- **activeTab**: To interact with the current tab

This extension requires the `webRequest` permission to:
- Capture authentication headers only from chat.openai.com and claude.ai
- Enable local API calls to fetch conversation history
- Headers are stored securely in your browser's session
- No data is sent to external servers

All data processing happens locally in your browser. No data is sent to external servers.

## License 

MIT

---

If you find this tool useful, please star the repository! ⭐
