import { Node } from '../types/interfaces';

export const calculateSteps = (nodes: Node[], targetId: string) => {
  // Tracks navigation steps needed to reach target node
  const stepsToTake: Array<{
    nodeId: string;
    stepsLeft: number;
    stepsRight: number;
  }> = [];

  let currentNode = nodes.find((node) => node.id === targetId);
    
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
  
    if (parent.children.length > 1) {
      // If no visible siblings, navigate from first child
      if (activeChildIndex === -1) {
        for (let i = 0; i < childIndex; i++) {
          stepsToTake.push({
            nodeId: parent.children[0],
            stepsLeft: -1,
            stepsRight: 1,
          });
        }
      } else {
        // Calculate steps needed to reach nearest visible sibling
        const moveRight = childIndex > activeChildIndex;
        const steps = Math.abs(activeChildIndex - childIndex);

        for (let i = 0; i < steps; i++) {
          stepsToTake.push({
            nodeId: parent.children[activeChildIndex],
            stepsLeft: moveRight ? -1 : 1,
            stepsRight: moveRight ? 1 : -1,
          });
        }
      }
    }
    currentNode = parent;
  }

  // Return steps in bottom-up order
  return stepsToTake.reverse();
}; 