import Header from "./components/header";
import ChatGraph from "./components/tree"

function App() {
  return (
    <div className="w-screen h-screen min-w-[600px] min-h-[400px]">
      <Header />
      <ChatGraph />
    </div>
  );
}

export default App;
