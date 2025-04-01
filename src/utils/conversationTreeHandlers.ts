import { OpenAINode, OpenAIMenuState } from '../types/interfaces';

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

export const checkNodes = async (nodeIds: string[]) => {
  const response = await chrome.runtime.sendMessage({
    action: "checkNodes",
    nodeIds: nodeIds 
  });
    
  if (response.success) {
    return response.existingNodes;
  } else {
    console.error('Error checking nodes:', response.error);
    throw new Error(response.error);
  }
}; 