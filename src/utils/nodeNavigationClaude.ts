import { ClaudeNode } from '../types/interfaces';

export const calculateStepsClaude = (nodes: ClaudeNode[], targetId: string) => {
  // Tracks navigation steps needed to reach target node
  const stepsToTake: Array<{
    nodeText: string;
    nodeId: string;
    stepsLeft: number;
    stepsRight: number;
  }> = [];

  let currentNode = nodes.find((node) => node.id === targetId);

  chrome.runtime.sendMessage({
    action: 'log',
    message: `currentNode: ${JSON.stringify(currentNode)}`
  });
    

  chrome.runtime.sendMessage({
    action: 'log',
    message: `nodes: ${JSON.stringify(nodes, null, 2)}`
  });
  
  if (!currentNode) return [];
  // Navigate up the tree while nodes are hidden
  while (currentNode?.data?.hidden) {
    const parent = nodes.find((n) => n.id === currentNode?.parent);
    if (!parent) break;

    // Find indexes for current child and nearest visible sibling
    const childIndex = parent.children.indexOf(currentNode.id);
    const activeChildIndex = parent.children.findIndex(
      (childId) => nodes.find((node) => node.id === childId)?.data?.hidden === false
    );

    chrome.runtime.sendMessage({
      action: 'log',
      message: `childIndex: ${childIndex}, activeChildIndex: ${activeChildIndex} parent.children: ${JSON.stringify(parent.children)}`
    });
    
    if (parent.children.length > 1) {
      // If no visible siblings, navigate from first child
      if (activeChildIndex === -1) {
        for (let i = childIndex - 1; i >= 0; i--) {
          const childNode = nodes.find(n => n.id === parent.children[i]);
          if (childNode) {
            stepsToTake.push({
              nodeText: childNode.data.text,
              nodeId: childNode.id,
              stepsLeft: -1,
              stepsRight: 1,
            });
          }
        }
      } else {
        // Calculate steps needed to reach nearest visible sibling
        const moveRight = childIndex > activeChildIndex;
        const steps = Math.abs(activeChildIndex - childIndex);

        let tempStepsToTake = [];
        for (let i = 0; i < steps; i++) {
          let tempActiveChildIndex = activeChildIndex;
          if (moveRight) {
            tempActiveChildIndex = activeChildIndex + i;
          } else {
            tempActiveChildIndex = activeChildIndex - i;
          }
          
          const childNode = nodes.find(n => n.id === parent.children[tempActiveChildIndex]);
          if (childNode) {
            tempStepsToTake.push({
              nodeText: childNode.data.text,
              nodeId: childNode.id,
              stepsLeft: moveRight ? -1 : 1,
              stepsRight: moveRight ? 1 : -1,
            });
          }
        }

        // these steps are actually in the correct order, but since we are reversing all steps, we need to keep these steps in the correct order
        stepsToTake.push(...tempStepsToTake.reverse());
      }
    }
    currentNode = parent;
  }

  // Return steps in bottom-up order
  return stepsToTake.reverse();
}; 