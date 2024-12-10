import dagre from '@dagrejs/dagre';
import { Node, Edge } from '../types/interfaces';
import { nodeWidth, nodeHeight } from "../constants/constants";

const dagreGraph = new dagre.graphlib.Graph().setGraph({}).setDefaultEdgeLabel(() => ({}));

export const layoutNodes = (nodes: Node[], edges: Edge[]) => {
    // Reset the graph
    dagreGraph.setGraph({});
    
    // Add nodes and edges to dagre graph
    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calculate layout
    dagre.layout(dagreGraph);

    // Return nodes with updated positions
    return nodes.map((node) => {
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
};