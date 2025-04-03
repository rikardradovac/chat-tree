// --- Interfaces for Claude Conversation Structure ---

export interface ClaudeContentBlock {
    start_timestamp: string; // ISO 8601 string timestamp
    stop_timestamp: string;  // ISO 8601 string timestamp
    type: string; // e.g., "text", potentially others like "antArtifact" reference embedded within text
    text: string; // The actual content, potentially including markdown or special tags
    citations: any[]; // Based on example, structure unknown, assuming array
}

export interface ClaudeChatMessage {
    uuid: string; // Message ID
    text: string; // Often empty, possibly a summary or alternative representation
    content: ClaudeContentBlock[]; // Array of content blocks for the message
    sender: "human" | "assistant"; // Role of the message sender
    index: number; // Sequential index of the message
    created_at: string; // ISO 8601 string timestamp
    updated_at: string; // ISO 8601 string timestamp
    truncated: boolean;
    stop_reason?: string; // Optional, usually present on assistant's last message
    attachments: any[]; // Structure unknown from example
    files: any[];       // Structure unknown from example
    files_v2: any[];    // Structure unknown from example
    sync_sources: any[];// Structure unknown from example
    parent_message_uuid: string; // UUID of the parent message
}

export interface ClaudeSettings {
    preview_feature_uses_artifacts?: boolean; // Example specific setting
    // Add other potential settings here if known
    [key: string]: any; // Allow for other unknown settings
}

export interface ClaudeConversation {
    uuid: string; // Conversation ID
    name: string; // Conversation title
    summary: string; // Conversation summary (often empty)
    created_at: string; // ISO 8601 string timestamp
    updated_at: string; // ISO 8601 string timestamp
    settings: ClaudeSettings;
    is_starred: boolean;
    current_leaf_message_uuid: string; // UUID of the latest message in the primary thread view
    chat_messages: ClaudeChatMessage[]; // The list of messages in the conversation
}

// --- Interfaces for OpenAI/ChatGPT-like Conversation Graph Structure ---

export interface OpenAIAuthor {
    role: string; // e.g., "user", "assistant", "system"
    name: string | null;
    metadata: Record<string, any>;
}

export interface OpenAIContent {
    content_type: string; // e.g., "text", "code", "execution_output"
    model_set_context?: string | null;
    repository?: string | null;
    repo_summary?: string | null;
    parts?: string[] | null; // Typically array of text parts/paragraphs
}

export interface OpenAIMetaData {
    is_visually_hidden_from_conversation?: boolean | null;
    serialization_metadata?: Record<string, any> | null;
    request_id?: string | null;
    message_source?: string | null;
    timestamp_?: string | null; // Note: Original was string, but often numeric in OpenAI context
    message_type?: string | null;
    model_slug?: string | null;
    default_model_slug?: string | null;
    parent_id?: string | null; // ID of the parent message node
    model_switcher_deny?: string[];
    finish_details?: Record<string, any> | null;
    is_complete?: boolean | null;
    citations?: OpenAICitation[] | null; // Reference the specific Citation type below
    content_references?: string[];
    gizmo_id?: string | null;
    kwargs?: Record<string, any> | null;
}

export interface OpenAICitationMetadata {
        type: string;
        title: string;
        url: string;
        text: string;
        pub_date: string | null;
        extra: {
            cited_message_idx: number;
            search_result_idx: number | null;
            evidence_text: string;
            start_line_num: number;
            end_line_num: number;
        };
        og_tags: any | null;
}

export interface OpenAICitation {
    start_ix: number;
    end_ix: number;
    citation_format_type: string;
    metadata: OpenAICitationMetadata;
}


export interface OpenAIMessage {
    id: string; // Message ID (often same as the node ID)
    author: OpenAIAuthor;
    create_time: number | null; // Typically Unix timestamp (seconds)
    update_time: number | null; // Typically Unix timestamp (seconds)
    content: OpenAIContent;
    status: string; // e.g., "finished_successfully"
    end_turn: boolean | null;
    weight: number;
    metadata: OpenAIMetaData;
    recipient: string; // Often "all"
    channel: string | null;
}

// Represents a node in the conversation graph/tree


// Represents an edge connecting nodes in the visualization
export interface OpenAIEdge {
    id: string;
    source: string; // Source node ID
    target: string; // Target node ID
    type: string; // Edge type for visualization (e.g., 'smoothstep')
    animated?: boolean;
    style?: any;
    [key: string]: any;
}

// The mapping object holding all nodes, keyed by their ID
export interface OpenAIMapping {
    [key: string]: OpenAINode;
}

// The overall conversation data structure for the graph representation
export interface OpenAIConversationData {
    title: string;
    create_time: number; // Unix timestamp
    update_time: number; // Unix timestamp
    mapping: OpenAIMapping; // Contains all the nodes
    moderation_results: any[];
    current_node: string; // ID of the node currently being viewed/focused
    plugin_ids: string | null;
    conversation_id: string; // The main ID for the conversation
    conversation_template_id: string | null;
    gizmo_id: string | null;
    is_archived: boolean;
    safe_urls: string[];
    default_model_slug: string;
    conversation_origin: string | null;
    voice: string | null;
    async_status: string | null;
    gizmo_type?: string | null;
    is_starred?: boolean | null;
    disabled_tool_ids?: string[] | any[];
    [key: string]: any; // Allow for other potential top-level fields
}

// --- UI-Related Interfaces (renamed for consistency) ---

export type OpenAIMenuState = {
    messageId: string;
    message: string; // Likely message content preview
    childrenIds: string[];
    role: string;
    top: number | boolean;
    left: number | boolean;
    right: number | boolean;
    bottom: number | boolean;
    hidden?: boolean;
} | null;

export interface ContextMenuProps {
    provider: ConversationProvider;
    messageId: string;
    message: string; // Likely message content preview
    childrenIds?: string[];
    childrenTexts?: string[];
    role: string;
    top: number | boolean;
    left: number | boolean;
    right: number | boolean;
    bottom: number | boolean;
    hidden?: boolean;
    onClick?: () => void;
    onNodeClick: (messageId: string) => any[]; // Function to handle node clicks
    onRefresh: () => void; // Function to refresh something
    refreshNodes: () => void; // Function to refresh nodes
}

export type ConversationProvider = 'openai' | 'claude';

// Common interfaces for both providers
export interface BaseNode {
    position: { x: number; y: number };
    id: string;
    data?: {
        label: string;
        role?: string;
        timestamp?: number;
        id?: string;
        hidden?: boolean;
        contentType?: string;
        model_slug?: string;
    };
    parent: string | null;
    children: string[];
    type?: string;
}

export interface BaseEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    animated?: boolean;
    style?: Record<string, any>;
}

// Update OpenAINode to extend BaseNode
export interface OpenAINode extends BaseNode {
    message: OpenAIMessage | null;
}

// New ClaudeNode interface
export interface ClaudeNode extends BaseNode {
    message: ClaudeChatMessage | null;
    data: ClaudeNodeData;
}

// Update OpenAIEdge to extend BaseEdge
export interface OpenAIEdge extends BaseEdge {}

// New ClaudeEdge interface
export interface ClaudeEdge extends BaseEdge {}

export interface ClaudeNodeData {
  label: string;  // Required by BaseNode
  text: string;
  role: string;
  hidden?: boolean;
  timestamp?: number;
  id?: string;
  contentType?: string;
  model_slug?: string;
}

export interface ClaudeMenuState {
  messageId: string;
  message: string;
  childrenTexts: string[];
  role: string;
  top: number | false;
  left: number | false;
  right: number | false;
  bottom: number | false;
  hidden?: boolean;
}