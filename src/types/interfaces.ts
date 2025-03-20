export interface Author {
    role: string;
    name: string | null;
    metadata: Record<string, any>;
}

export interface Content {
    content_type: string;
    model_set_context?: string | null; 
    repository?: string | null;        
    repo_summary?: string | null;       
    parts?: string[] | null;
}

export interface MetaData {
    is_visually_hidden_from_conversation?: boolean | null;
    serialization_metadata?: Record<string, any> | null;
    request_id?: string | null;
    message_source?: string | null;
    timestamp_?: string | null;
    message_type?: string | null;
    model_slug?: string | null;
    default_model_slug?: string | null;
    parent_id?: string | null;
    model_switcher_deny?: string[];
    finish_details?: Record<string, any> | null;
    is_complete?: boolean | null;
    citations?: Citation[] | null;
    content_references?: string[];
    gizmo_id?: string | null;
    kwargs?: Record<string, any> | null;
    

}
export interface Citation {
    start_ix: number;
    end_ix: number;
    citation_format_type: string;
    metadata: {
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
    };
}


export interface Message {
    id: string;
    author: Author;
    create_time: number | null;
    update_time: number | null;
    content: Content;
    status: string;
    end_turn: boolean | null;
    weight: number;
    metadata: MetaData;
    recipient: string;
    channel: string | null;
}

export interface Node {
    position: { x: number; y: number };
    id: string;
    data?: { label: string; role?: string; timestamp?: number, id?: string, hidden?: boolean, contentType?: string, model_slug?: string};
    message: Message | null;
    parent: string | null;
    children: string[];
    type?: string;
}

export interface Edge {
    id: string;
    source: string;
    target: string;
    type: string;
    animated?: boolean;
    style?: any;
    [key: string]: any;
}

export interface Mapping {
    [key: string]: Node;
}

export interface ConversationData {
    title: string;
    create_time: number;
    update_time: number;
    mapping: Mapping;
    moderation_results: any[];
    current_node: string;
    plugin_ids: string | null;
    conversation_id: string;
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
    [key: string]: any;
}

export type MenuState = {
    messageId: string;
    message: string;
    childrenIds: string[];
    role: string;
    top: number | boolean;
    left: number | boolean;
    right: number | boolean;
    bottom: number | boolean;
    hidden?: boolean;
} | null;

export interface ContextMenuProps {
    messageId: string;
    message: string;
    childrenIds: string[];
    role: string;
    top: number | boolean;
    left: number | boolean;
    right: number | boolean;
    bottom: number | boolean;
    hidden?: boolean;
    onClick?: () => void;
    onNodeClick: (messageId: string) => any[];
    onRefresh: () => void;
    refreshNodes: () => void;
}