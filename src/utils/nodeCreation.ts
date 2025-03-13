import { Node, Edge, ConversationData } from '../types/interfaces';
import { nodeWidth, nodeHeight } from "../constants/constants";
import { findFirstContentParent } from './nodeProcessing';
import dagre from '@dagrejs/dagre';

const dagreGraph = new dagre.graphlib.Graph().setGraph({}).setDefaultEdgeLabel(() => ({}));

export const createNodesInOrder = async (
  conversationData: ConversationData,
  checkNodes: (nodeIds: string[]) => Promise<boolean[]>
) => {
  const mapping = conversationData.mapping;
  const newNodes = new Array<Node>();
  const newEdges = new Array<Edge>();

  const createChildNodes = (node: Node) => {
    if (node.children.length === 0) return;
  
    // Recursively finds first descendant with valid content and proper role/recipient
    const findFirstValidDescendant = (currentNode: Node): Node | null => {
      if (currentNode.message?.content?.parts?.[0] &&
          currentNode.message.author.role !== 'system' && 
          currentNode.message.author.role !== 'tool' &&
          currentNode.message.recipient === 'all') {
        return currentNode;
      }
  
      for (const childId of currentNode.children) {
        const validDescendant = findFirstValidDescendant(mapping[childId]);
        if (validDescendant) return validDescendant;
      }
      return null;
    };
  
    // Filter and map children to only valid descendants
    const validChildren = node.children
      .map(childId => findFirstValidDescendant(mapping[childId]))
      .filter((child): child is Node => child !== null);
  
    node.children = validChildren.map(child => child.id);
  
    // Process each valid child node
    validChildren.forEach(child => {
      child.parent = node.id;
      child.type = 'custom';
      const role = child.message!.author.role;

      // Extract content based on content type
      let content: string = 'No content available';
      if (child.message?.content?.parts && child.message.content.parts.length > 0) {
        if (child.message.content.content_type !== 'text') {
          content = child.message.content.parts.find(part => typeof part === 'string') ?? 'No text provided';
        } else {
          content = child.message.content.parts[0] || 'Empty content';
        }
      }

      // Set node data and visual properties
      child.data = {
        label: content,
        role: role,
        timestamp: child.message!.create_time ?? undefined,
        id: child.id,
        hidden: true,
        contentType: child.message!.content.content_type,
        model_slug: child.message!.metadata.model_slug ?? undefined
      };
      
      newNodes.push(child);
      // Create edge connecting parent to child
      newEdges.push({
        id: `${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#000000', strokeWidth: 2 }
      });
  
      createChildNodes(child);
    });
  };

  // Find and setup root node
  let rootNode = findFirstContentParent(
    Object.values(mapping).find(node => !node.parent) as Node,
    mapping
  );
  
  if (!rootNode) return { nodes: [], edges: [] };

  // Initialize root node properties
  let rootLabel = 'Start of your conversation';
  if (rootNode.message?.content?.parts && rootNode.message.content.parts.length > 0 && 
      rootNode.message.author.role !== 'system') {
    rootLabel = rootNode.message.content.parts[0] || 'Empty content';
  }

  rootNode.type = 'custom';
  rootNode.data = {
    label: rootLabel,
    role: rootNode.message?.author?.role || 'system',
    timestamp: rootNode.message?.create_time ?? undefined,
    id: rootNode.id,
    hidden: true,
    contentType: rootNode.message?.content?.content_type || 'text',
    model_slug: rootNode.message?.metadata?.model_slug ?? undefined
  };
  
  newNodes.push(rootNode);
  createChildNodes(rootNode);
  
  // Update visibility state of nodes
  const existingNodes = await checkNodes(newNodes.map(node => node.id));
  existingNodes.forEach((hidden: boolean, index: number) => {
    if (newNodes[index]) {
      newNodes[index]!.data!.hidden = hidden;
    }
  });

  return layoutNodes(newNodes, newEdges);
};

const layoutNodes = (nodes: Node[], edges: Edge[]) => {
  // Initialize dagre graph with node dimensions
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Apply dagre layout algorithm
  dagre.layout(dagreGraph);

  // Transform nodes with calculated positions
  const nodesWithPositions = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: 'top',
      sourcePosition: 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: nodesWithPositions, edges };
}; 