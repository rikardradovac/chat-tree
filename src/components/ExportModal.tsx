interface ExportModalProps {
  onClose: () => void;
  onExport: (format: 'markdown' | 'xml' | 'obsidian') => void;
  visibleNodesCount: number;
}

export const ExportModal = ({ onClose, onExport, visibleNodesCount }: ExportModalProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Conversation</h3>
        <p className="text-sm text-gray-600 mb-6">
          Only the currently visible branch ({visibleNodesCount} messages) will be exported.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onExport('markdown')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Export as Markdown
          </button>
          <button
            onClick={() => onExport('obsidian')}
            className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Export for Obsidian
          </button>
          <button
            onClick={() => onExport('xml')}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Export as XML
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}; 