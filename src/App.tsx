import Header from "./components/header";
import ChatGraph from "./components/tree"

function App() {
  return (
    <div className="w-screen h-screen min-w-[800px] min-h-[800px]">
      <Header />
      <ChatGraph />
    </div>
  );
}

export default App;
