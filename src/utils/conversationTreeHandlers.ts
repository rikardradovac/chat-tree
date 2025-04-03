import { OpenAINode, OpenAIMenuState, ClaudeNode, ClaudeMenuState } from '../types/interfaces';

export const createContextMenuHandler = (ref: React.RefObject<HTMLDivElement>, setMenu: (menu: OpenAIMenuState) => void) => {
  return (event: React.MouseEvent, node: OpenAINode) => {
    event.preventDefault();
    
    const pane = ref?.current?.getBoundingClientRect();
    const nodeId = node.data?.id ?? '';
    
    if (pane) {
      // Get scroll position
      const scrollTop = ref.current?.scrollTop || 0;
      const scrollLeft = ref.current?.scrollLeft || 0;

      // Calculate position considering scroll offset
      const yPos = event.clientY + scrollTop;
      const xPos = event.clientX + scrollLeft;

      setMenu({
        messageId: nodeId,
        message: node.data!.label,
        childrenIds: node.children,
        role: node.data?.role ?? '',
        top: yPos < pane.height - 200 && yPos ? yPos - 48 : false,
        left: xPos < pane.width - 200 && xPos ? xPos : false,
        right: xPos >= pane.width - 200 && pane.width - xPos,
        bottom: yPos >= pane.height - 200 && pane.height - yPos + 48,
        hidden: node.data?.hidden
      });
    }
  };
};

export const createClaudeContextMenuHandler = (
  ref: React.RefObject<HTMLDivElement>, 
  setMenu: (menu: ClaudeMenuState) => void,
  nodes: ClaudeNode[]
) => {
  return (event: React.MouseEvent, node: ClaudeNode) => {
    event.preventDefault();
    
    const pane = ref?.current?.getBoundingClientRect();
    
    if (pane) {
      // Get scroll position
      const scrollTop = ref.current?.scrollTop || 0;
      const scrollLeft = ref.current?.scrollLeft || 0;

      // Calculate position considering scroll offset
      const yPos = event.clientY + scrollTop;
      const xPos = event.clientX + scrollLeft;

      // Map child IDs to their text content
      const childrenTexts = node.children.map(childId => {
        // Find the child node in the graph
        const childNode = nodes.find(n => n.id === childId);
        // Return the text content if found, or empty string if not
        return childNode?.data?.text || '';
      });

      setMenu({
        message: node.data.text,
        childrenTexts: childrenTexts,  // Now using the mapped text content
        role: node.data?.role ?? '',
        top: yPos < pane.height - 200 && yPos ? yPos - 48 : false,
        left: xPos < pane.width - 200 && xPos ? xPos : false,
        right: xPos >= pane.width - 200 && pane.width - xPos,
        bottom: yPos >= pane.height - 200 && pane.height - yPos + 48,
        hidden: node.data?.hidden
      });
    }
  };
};

export const checkNodes = async (nodeIds: string[]) => {
  console.log('checkNodes received params:', nodeIds);
  
  if (!nodeIds || !Array.isArray(nodeIds)) {
    throw new Error('nodeIds must be provided');
  }

  const response = await chrome.runtime.sendMessage({
    action: "checkNodes",
    nodeIds,
  });
    
  if (response.success) {
    return response.existingNodes;
  } else {
    console.error('Error checking nodes:', response.error);
    throw new Error(response.error);
  }
}; 

export const checkNodesClaude = async (nodeTexts: string[]) => {
  if (!nodeTexts || !Array.isArray(nodeTexts)) {
    throw new Error('Invalid nodeTexts provided');
  }

  const response = await chrome.runtime.sendMessage({
    action: "checkNodesClaude",
    nodeTexts
  });

  if (response.success) {
    return response.existingNodes;
  } else {
    console.error('Error checking nodes:', response.error);
    throw new Error(response.error);
  }
};

