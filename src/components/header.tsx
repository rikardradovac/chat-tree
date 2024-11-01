function Header() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-slate-200/50 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-2.5">
          <img 
            src="public/logo128.png" 
            alt="Logo" 
            className="h-6 w-6 opacity-80"
          />
          <span className="font-medium text-slate-600 text-sm">
            ChatGPT Visualizer
          </span>
        </div>
      </div>
    </nav>
  );
}

export default Header;
