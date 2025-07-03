/**
 * SpecSprite 核心类型定义
 * 基于 vibecli 的成功模式，复用和扩展核心类型
 */

// ============ 基础类型（复用自 vibecli） ============

export type ProjectType = 'blog' | 'ecommerce' | 'saas' | 'portfolio' | 'landing_page' | 'generic';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============ PRD 相关类型 ============

export interface PRDMetadata {
  name: string;
  version: string;
  generated_at: string;
  confidence_score: number;
  session_id: string;
}

export interface ProjectInfo {
  type: ProjectType;
  description: string;
  target_audience: string;
  key_features: string[];
  business_model?: string;
  scale_expectations?: 'small' | 'medium' | 'large';
}

export interface TechStackConfig {
  framework: string;
  database?: string;
  ui_library: string;
  deployment_platform?: string;
  additional_tools: string[];
}

export interface FeatureFlags {
  auth: boolean;
  payment: boolean;
  admin: boolean;
  search: boolean;
  upload: boolean;
  realtime: boolean;
  analytics: boolean;
  email: boolean;
  [key: string]: boolean;
}

export interface FeatureSpecification {
  name: string;
  description: string;
  requirements: string[];
  dependencies: string[];
  implementation_notes: string[];
}

export interface PRDSchema {
  metadata: PRDMetadata;
  project: ProjectInfo;
  tech_stack: TechStackConfig;
  features: FeatureFlags;
  specifications: FeatureSpecification[];
  constraints: {
    budget?: 'low' | 'medium' | 'high';
    timeline?: 'urgent' | 'normal' | 'flexible';
    team_size?: number;
    complexity_preference?: 'simple' | 'standard' | 'advanced';
  };
  next_steps: string[];
}

// ============ MCP 工具接口 ============

export interface GeneratePRDInput {
  user_input: string;
  session_id?: string;
  continue_conversation?: boolean;
}

export interface GeneratePRDOutput {
  type: 'conversation' | 'prd' | 'clarification';
  session_id: string;
  content: {
    // 对话状态
    message?: string;
    questions?: string[];
    suggestions?: string[];
    // 完成状态
    prd?: PRDSchema;
    // 调试信息
    debug_info?: {
      expert_used: string;
      confidence: number;
      reasoning: string;
    };
  };
}

// ============ 会话管理（基于 vibecli） ============

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  type: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    intent?: string;
    confidence?: number;
    features_detected?: string[];
  };
}

export interface AccumulatedContext {
  project_type?: ProjectType;
  detected_features: string[];
  user_preferences: Record<string, any>;
  clarifications_resolved: string[];
  tech_preferences: string[];
  constraints: Record<string, any>;
}

export interface SpecSpriteSession {
  id: string;
  started_at: Date;
  last_activity: Date;
  conversation_history: ConversationTurn[];
  accumulated_context: AccumulatedContext;
  current_expert?: string;
  status: 'active' | 'completed' | 'abandoned';
  readiness_score: number; // 0-100, 准备生成 PRD 的程度
}

// ============ 专家系统 ============

export interface ExpertRoleCard {
  id: string;
  name: string;
  project_type: ProjectType;
  description: string;
  conversation_flow: {
    opening_questions: string[];
    core_topics: string[];
    clarification_templates: string[];
    completion_criteria: string[];
  };
  knowledge_base: {
    recommended_tech_stack: string[];
    common_features: string[];
    best_practices: string[];
    pitfalls_to_avoid: string[];
  };
}

// ============ LLM 调用相关 ============

export interface LLMRequest {
  prompt: string;
  context?: {
    session_id: string;
    expert_role?: string;
    conversation_history?: ConversationTurn[];
    user_context?: AccumulatedContext;
  };
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  content: string;
  metadata?: {
    model: string;
    tokens_used: number;
    confidence?: number;
  };
}

// ============ 意图分析 ============

export interface IntentAnalysisResult {
  project_type: ProjectType;
  confidence: number;
  detected_features: string[];
  complexity_estimate: 'simple' | 'medium' | 'complex';
  clarifications_needed: string[];
  suggestions: string[];
  reasoning: string;
}

export interface ReadinessAnalysis {
  ready_for_prd: boolean;
  confidence: number;
  missing_information: string[];
  clarification_questions: string[];
  current_completeness: number; // 0-100
}

// ============ 错误处理 ============

export class SpecSpriteError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'SpecSpriteError';
  }
}

export interface ErrorContext {
  session_id?: string;
  operation?: string;
  user_input?: string;
  timestamp: Date;
}

// ============ 配置接口 ============

export interface SpecSpriteConfig {
  server: {
    name: string;
    version: string;
    debug: boolean;
  };
  llm: {
    default_temperature: number;
    max_tokens: number;
    timeout_ms: number;
  };
  conversation: {
    session_timeout_minutes: number;
    max_conversation_turns: number;
    min_confidence_for_prd: number;
  };
  experts: {
    default_expert: string;
    confidence_threshold: number;
  };
}