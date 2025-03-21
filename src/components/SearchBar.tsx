import { useState, useEffect, useRef } from 'react';
import { Node } from '../types/interfaces';

interface SearchBarProps {
  nodes: Node[];
  onNodeClick: (messageId: string) => any[];
  onClose: () => void;
}

interface SearchResult {
  nodeId: string;
  node: Node;
  matches: number;
  preview: string;
}

export const SearchBar = ({ nodes, onNodeClick, onClose }: SearchBarProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        const selectedResult = results[selectedIndex];
        if (selectedResult) {
          onNodeClick(selectedResult.nodeId);
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, onNodeClick, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchResults: SearchResult[] = [];
    const searchQuery = query.toLowerCase();

    nodes.forEach(node => {
      if (!node.data?.label) return;

      const content = node.data.label.toLowerCase();
      const matches = (content.match(new RegExp(searchQuery, 'g')) || []).length;

      if (matches > 0) {
        // Create a preview with highlighted matches
        const preview = node.data.label.slice(0, 100) + (node.data.label.length > 100 ? '...' : '');
        
        searchResults.push({
          nodeId: node.id,
          node,
          matches,
          preview
        });
      }
    });

    // Sort by number of matches and then by timestamp (newer first)
    searchResults.sort((a, b) => {
      if (b.matches !== a.matches) {
        return b.matches - a.matches;
      }
      return (b.node.data?.timestamp || 0) - (a.node.data?.timestamp || 0);
    });

    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, nodes]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="p-4 border-b">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages... (⌘+K)"
              className="w-full px-4 py-2 text-lg border-none focus:outline-none focus:ring-0"
            />
            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">
              esc
            </kbd>
          </div>
        </div>
        
        {results.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <button
                key={result.nodeId}
                onClick={() => {
                  onNodeClick(result.nodeId);
                  onClose();
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 focus:outline-none ${
                  index === selectedIndex ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">
                      {result.node.data?.role === 'user' ? '👤' : '🤖'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date((result.node.data?.timestamp || 0) * 1000).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {result.matches} match{result.matches !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-700 line-clamp-2">
                  {result.preview}
                </div>
              </button>
            ))}
          </div>
        ) : query ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No results found
          </div>
        ) : null}
      </div>
    </div>
  );
}; 