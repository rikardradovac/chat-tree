import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import {
  Handle,
  Position,
} from '@xyflow/react';

import { nodeWidth, nodeHeight } from "../constants/constants"


export const CustomNode = ({ data }: { data: any }) => {   
    // State to track if the node is expanded to full screen
    const [isExpanded, setIsExpanded] = useState(false);
  
    return (
      <>
        <div 
          // Dynamic classes for styling based on role (user/assistant), visibility, and expansion state
          className={`px-4 py-2 shadow-lg rounded-lg border transition-all duration-300 
            ${data.role === 'user' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}
            ${data.hidden ? 'grayscale' : ''}
            ${isExpanded ? 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[80vw] h-[80vh]' : ''}
          `} 
          // Dynamic styles for node dimensions and appearance
          style={{
            width: isExpanded ? undefined : nodeWidth,
            height: isExpanded ? undefined : nodeHeight,
            position: isExpanded ? 'fixed' : 'relative',
            opacity: data.hidden && !isExpanded ? 0.4 : 1,
            background: data.hidden && !isExpanded ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)' : undefined
          }}
          onDoubleClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Connection handle - only shown when not expanded */}
          {!isExpanded && <Handle type="target" position={Position.Top} className="w-2 h-2" />}
          
          {/* Header section with role indicator and content type icon */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                data.role === 'user' ? 'bg-yellow-400' : 'bg-gray-400'
              }`} />
              <div className="text-xs font-semibold text-gray-500 uppercase">
                {data.role}
              </div>
            </div>
            {/* Document icon for multimodal content */}
            {data.contentType === 'multimodal_text' && (
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 26 26">
                <path d="M 20.265625 4.207031 C 20.023438 3.96875 19.773438 3.722656 19.527344 3.476563 C 19.277344 3.230469 19.035156 2.980469 18.792969 2.734375 C 17.082031 0.988281 16.0625 0 15 0 L 7 0 C 4.796875 0 3 1.796875 3 4 L 3 22 C 3 24.203125 4.796875 26 7 26 L 19 26 C 21.203125 26 23 24.203125 23 22 L 23 8 C 23 6.9375 22.011719 5.917969 20.265625 4.207031 Z M 21 22 C 21 23.105469 20.105469 24 19 24 L 7 24 C 5.894531 24 5 23.105469 5 22 L 5 4 C 5 2.894531 5.894531 2 7 2 L 14.289063 1.996094 C 15.011719 2.179688 15 3.066406 15 3.953125 L 15 7 C 15 7.550781 15.449219 8 16 8 L 19 8 C 19.996094 8 21 8.003906 21 9 Z"></path>
                </svg>
              </div>
            )}
          </div>
  
          {/* Message content with markdown support */}
          <div className={`mt-2 text-sm text-gray-700 ${
            isExpanded  
              ? 'h-[calc(100%-100px)] overflow-y-auto nowheel' 
              : 'line-clamp-3'
            }`} 
            style={{ wordBreak: 'break-word' }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.label}</ReactMarkdown>
          </div>
  
          {/* Timestamp display */}
          {data.timestamp && (
            <div className="absolute bottom-2 left-4 text-xs text-gray-400">
              {new Date(parseFloat(data.timestamp) * 1000).toLocaleString()} 
            </div>
          )}
          
          {/* Bottom connection handle - only shown when not expanded */}
          {!isExpanded && <Handle type="source" position={Position.Bottom} className="w-2 h-2" />}
  
          {/* Close button for expanded view */}
          {isExpanded && (
            <button 
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
              onClick={() => setIsExpanded(false)}
            >
              ✕
            </button>
          )}
        </div>
  
        {/* Overlay background when expanded */}
        {isExpanded && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 -z-10"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </>
    );
  };