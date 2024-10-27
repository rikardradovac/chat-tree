# React TypeScript + Vite Chrome Extension Starter

![build](https://github.com/timelessco/react-vite-chrome-extension/workflows/build/badge.svg)

![react-vite-chrome-extension](./assets/cover.png)

This project is a boilerplate for creating a Google Chrome Extension with React + Vitejs + TailwindCSS + TypeScript.

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)

## :bulb: Preview

![react-vite-chrome-extension](./assets/preview.png)

## :package: Requirements

- Nodejs v18+ LTS

## :atom_symbol: Development

- Clone this repository

```
git clone https://github.com/timelessco/react-vite-chrome-extension
```

- Install dependencies

```
pnpm install
```

- Start Development Server

```
pnpm dev
```

## :computer: Production

- Building the chrome extension for production

```
pnpm build
```

## :rocket: Usage

- You can find the chrome extension contents in the `dist` folder
- Open `chrome://extension` and turn on Developer Mode.
- Click the `Load unpacked extension` button.
- Now, select the `dist` folder.
- Your extension is ready to use.

### :hamburger: Additional Details

- This boilerplate can be extended even further using [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
- You can use [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/) to inject content into the page or accessing the DOM conent.
- By using the [Message Passing](https://developer.chrome.com/extensions/messaging) API, you can communicate with the content script and the popup.

## :green_heart: Message

I hope you find this useful. If you have any questions, please create an issue.

## :mortar_board: License

- MIT
