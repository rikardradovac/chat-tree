import { Node } from '../types/interfaces';

export const findFirstContentParent = (node: Node, mapping: Record<string, Node>): Node | null => {
    const queue: Node[] = [...node.children.map(childId => mapping[childId])];
    
    while (queue.length > 0) {
        const currentNode = queue.shift()!;
        
        if (currentNode.message?.content?.parts?.[0] && 
            currentNode.message.author.role === "user") {
            let tempParent = mapping[currentNode.parent!];
            
            tempParent.children.forEach((childId, index) => {
                let currentChild = mapping[childId];
                
                while (currentChild && !isValidNode(currentChild)) {
                    if (currentChild.children.length > 0) {
                        currentChild = mapping[currentChild.children[0]];
                    } else {
                        break;
                    }
                }
                
                if (currentChild) {
                    tempParent.children[index] = currentChild.id;
                    currentChild.parent = tempParent.id;
                }
            });
            
            return tempParent;
        }
        
        queue.push(...currentNode.children.map(childId => mapping[childId]));
    }
    
    return null;
};

export const isValidNode = (node: Node): boolean => {
    return !!(node.message?.content?.parts?.[0] &&
        node.message.author.role !== 'system' && 
        node.message.author.role !== 'tool' &&
        node.message.recipient === 'all');
};

export const getNodeContent = (node: Node): string => {
    if (!node.message?.content) return '';
    
    if (node.message.content.content_type !== 'text') {
        return node.message.content.parts?.find(part => typeof part === 'string') ?? 'No text provided';
    }
    return node.message.content.parts?.[0] ?? '';
};