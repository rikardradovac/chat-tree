# ChatGPT Conversation Visualizer

<!-- ![build](https://github.com/timelessco/react-vite-chrome-extension/workflows/build/badge.svg)

![chatgpt-visualizer](./assets/cover.png) -->

This project is a Chrome Extension that visualizes ChatGPT conversations as a graph, making it easier to navigate and understand large chats.

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)

## Preview

<!-- ![chatgpt-visualizer](./assets/preview.png) -->


# Development


## Requirements

- Node.js v18+ LTS



- Clone this repository

```
git clone https://github.com/rikardradovac/non-linear-chat
```

- Install dependencies

```
npm install
```

- Start Development Server

```
npm run dev
```

## :computer: Production

- Build the Chrome extension for production

```
npm run build
```

## :rocket: Usage

- You can find the Chrome extension contents in the `dist` folder.
- Open `chrome://extensions` and turn on Developer Mode.
- Click the `Load unpacked` button.
- Now, select the `dist` folder.
- Your extension is ready to use.

### :hamburger: Additional Details

- This extension utilizes [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/) to fetch and display conversation data.
- You can use [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/) to inject content into the page or access the DOM.
- By using the [Message Passing](https://developer.chrome.com/extensions/messaging) API, you can communicate between the content script and the popup.

## :green_heart: Message

I hope you find this tool useful for visualizing your ChatGPT conversations. If you have any questions or suggestions, please create an issue.

## :mortar_board: License

- MIT
```