import Tree from "./components/ConversationTree";

function App() {
  return (
    <div className="w-full h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <Tree />
      </div>
    </div>
  );
}

export default App;
