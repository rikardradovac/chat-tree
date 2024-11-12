import Header from "./components/header";
import ChatGraph from "./components/tree"

function App() {
  return (
    <div className="w-full h-screen flex flex-col">
      <Header />
      <div className="flex-1 overflow-hidden">
        <ChatGraph />
      </div>
    </div>
  );
}

export default App;
