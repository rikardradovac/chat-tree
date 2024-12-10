import { Node, MenuState } from '../types/interfaces';

export const createContextMenuHandler = (ref: React.RefObject<HTMLDivElement>, setMenu: (menu: MenuState) => void) => {
  return (event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    
    const pane = ref?.current?.getBoundingClientRect();
    const nodeId = node.data?.id ?? '';
    
    if (pane) {
      setMenu({
        messageId: nodeId,
        message: node.data!.label,
        childrenIds: node.children,
        role: node.data?.role ?? '',
        top: event.clientY < pane.height - 200 && event.clientY ? event.clientY - 48 : false,
        left: event.clientX < pane.width - 200 && event.clientX ? event.clientX : false,
        right: event.clientX >= pane.width - 200 && pane.width - event.clientX,
        bottom: event.clientY >= pane.height - 200 && pane.height - event.clientY + 48,
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