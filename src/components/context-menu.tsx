interface ContextMenuProps {
  role?: string;
  top: number | boolean;
  left: number | boolean;
  right: number | boolean;
  bottom: number | boolean;
  onClick?: () => void;
}

export default function ContextMenu({
  role,
  top,
  left,
  right,
  bottom,
  onClick,
  ...props
}: ContextMenuProps) {
  return (
    <div
      style={{ 
        position: 'absolute',
        top: typeof top === 'number' ? `${top}px` : undefined,
        left: typeof left === 'number' ? `${left}px` : undefined,
        right: typeof right === 'number' ? `${right}px` : undefined,
        bottom: typeof bottom === 'number' ? `${bottom}px` : undefined,
      }}
      className="bg-white shadow-lg rounded-lg p-3 z-50 min-w-[180px]"
      onClick={onClick}
      {...props}
    >
      {role && (
        <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-100">
          Role: {role}
        </div>
      )}
      <div className="mt-1 space-y-1">
        <button 
          className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded transition-colors"
          onClick={onClick}
        >
          Action
        </button>
        {/* Additional buttons can be added here */}
      </div>
    </div>
  );
}