/**
 * 会话管理器 - 基于 vibecli/mcp-context-manager.ts 的设计模式
 * 负责维护多轮对话状态、用户偏好和渐进式信息收集
 */

import { randomBytes } from 'crypto';
import type {
  SpecSpriteSession,
  ConversationTurn,
  AccumulatedContext,
  ProjectType,
  ReadinessAnalysis,
  IntentAnalysisResult,
  SpecSpriteError
} from './types.js';

export class ConversationManager {
  private sessions = new Map<string, SpecSpriteSession>();
  private readonly SESSION_TIMEOUT_MINUTES = 30;
  private readonly MAX_CONVERSATION_TURNS = 50;

  /**
   * 获取或创建会话
   */
  getOrCreateSession(sessionId?: string): SpecSpriteSession {
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      
      // 检查会话是否过期
      const timeSinceLastActivity = Date.now() - session.last_activity.getTime();
      const timeoutMs = this.SESSION_TIMEOUT_MINUTES * 60 * 1000;
      
      if (timeSinceLastActivity > timeoutMs) {
        console.error(`⏰ 会话 ${sessionId} 已过期，创建新会话`);
        return this.createNewSession();
      }
      
      session.last_activity = new Date();
      return session;
    }

    return this.createNewSession();
  }

  /**
   * 记录用户输入并更新上下文
   */
  recordUserInput(session: SpecSpriteSession, userInput: string): ConversationTurn {
    const turn: ConversationTurn = {
      id: this.generateTurnId(),
      timestamp: new Date(),
      type: 'user',
      content: userInput,
      metadata: {
        // 这些将在后续的意图分析中填充
      }
    };

    session.conversation_history.push(turn);
    session.last_activity = new Date();

    // 限制对话历史长度
    if (session.conversation_history.length > this.MAX_CONVERSATION_TURNS) {
      session.conversation_history = session.conversation_history.slice(-this.MAX_CONVERSATION_TURNS);
    }

    return turn;
  }

  /**
   * 记录助手响应
   */
  recordAssistantResponse(
    session: SpecSpriteSession, 
    response: string, 
    metadata?: any
  ): ConversationTurn {
    const turn: ConversationTurn = {
      id: this.generateTurnId(),
      timestamp: new Date(),
      type: 'assistant',
      content: response,
      metadata
    };

    session.conversation_history.push(turn);
    session.last_activity = new Date();

    return turn;
  }

  /**
   * 更新累积上下文 - 基于意图分析结果
   */
  updateAccumulatedContext(
    session: SpecSpriteSession, 
    intentAnalysis: IntentAnalysisResult
  ): void {
    const context = session.accumulated_context;

    // 更新项目类型（如果置信度足够高）
    if (intentAnalysis.confidence > 70 && intentAnalysis.project_type !== 'generic') {
      context.project_type = intentAnalysis.project_type as ProjectType;
    }

    // 合并检测到的功能
    intentAnalysis.detected_features.forEach(feature => {
      if (!context.detected_features.includes(feature)) {
        context.detected_features.push(feature);
      }
    });

    // 更新准备度分数
    session.readiness_score = this.calculateReadinessScore(session);

    console.error(`📊 会话 ${session.id} 上下文更新完成，准备度: ${session.readiness_score}%`);
  }

  /**
   * 提取用户偏好 - 从对话中智能提取
   */
  extractUserPreferences(session: SpecSpriteSession, userInput: string): void {
    const context = session.accumulated_context;
    const lowercaseInput = userInput.toLowerCase();

    // 技术偏好提取
    const techKeywords = {
      'react': 'React',
      'vue': 'Vue.js',
      'angular': 'Angular',
      'next': 'Next.js',
      'nuxt': 'Nuxt.js',
      'gatsby': 'Gatsby',
      'astro': 'Astro',
      'svelte': 'Svelte',
      'typescript': 'TypeScript',
      'javascript': 'JavaScript',
      'tailwind': 'Tailwind CSS',
      'bootstrap': 'Bootstrap',
      'material': 'Material UI',
      'chakra': 'Chakra UI',
      'postgresql': 'PostgreSQL',
      'mysql': 'MySQL',
      'mongodb': 'MongoDB',
      'sqlite': 'SQLite',
      'prisma': 'Prisma',
      'supabase': 'Supabase',
      'firebase': 'Firebase'
    };

    Object.entries(techKeywords).forEach(([keyword, tech]) => {
      if (lowercaseInput.includes(keyword) && !context.tech_preferences.includes(tech)) {
        context.tech_preferences.push(tech);
      }
    });

    // 约束条件提取
    if (lowercaseInput.includes('预算有限') || lowercaseInput.includes('成本')) {
      context.constraints.budget = 'low';
    }
    if (lowercaseInput.includes('急需') || lowercaseInput.includes('赶时间')) {
      context.constraints.timeline = 'urgent';
    }
    if (lowercaseInput.includes('一个人') || lowercaseInput.includes('独立开发')) {
      context.constraints.team_size = 1;
    }
    if (lowercaseInput.includes('简单') || lowercaseInput.includes('入门')) {
      context.constraints.complexity_preference = 'simple';
    }

    // 目标用户群体
    const audienceKeywords = {
      '个人': 'individual',
      '企业': 'enterprise',
      '小公司': 'small_business',
      '创业': 'startup',
      '学生': 'students',
      '开发者': 'developers',
      '设计师': 'designers'
    };

    Object.entries(audienceKeywords).forEach(([keyword, audience]) => {
      if (lowercaseInput.includes(keyword)) {
        context.user_preferences.target_audience = audience;
      }
    });
  }

  /**
   * 分析是否准备生成 PRD
   */
  analyzeReadiness(session: SpecSpriteSession): ReadinessAnalysis {
    const context = session.accumulated_context;
    const history = session.conversation_history;

    // 必需信息检查
    const requirements = {
      project_type: !!context.project_type && context.project_type !== 'generic',
      core_features: context.detected_features.length >= 3,
      conversation_depth: history.length >= 4,
      tech_preferences: context.tech_preferences.length >= 2,
      user_input_quality: this.assessInputQuality(history)
    };

    const completedRequirements = Object.values(requirements).filter(Boolean).length;
    const totalRequirements = Object.keys(requirements).length;
    const completeness = (completedRequirements / totalRequirements) * 100;

    const readyForPRD = completeness >= 70 && session.readiness_score >= 75;

    // 生成缺失信息和澄清问题
    const missingInfo: string[] = [];
    const clarificationQuestions: string[] = [];

    if (!requirements.project_type) {
      missingInfo.push('明确的项目类型');
      clarificationQuestions.push('您的项目主要是什么类型？（网站、电商、SaaS平台等）');
    }

    if (!requirements.core_features) {
      missingInfo.push('核心功能需求');
      clarificationQuestions.push('这个项目需要哪些核心功能？');
    }

    if (!requirements.tech_preferences) {
      missingInfo.push('技术栈偏好');
      clarificationQuestions.push('您对技术选型有什么偏好吗？（如React、Vue等）');
    }

    if (context.detected_features.length > 0 && !context.user_preferences.target_audience) {
      missingInfo.push('目标用户群体');
      clarificationQuestions.push('这个项目的主要用户是谁？');
    }

    return {
      ready_for_prd: readyForPRD,
      confidence: Math.round(completeness),
      missing_information: missingInfo,
      clarification_questions: clarificationQuestions,
      current_completeness: Math.round(completeness)
    };
  }

  /**
   * 生成智能澄清问题
   */
  generateClarificationQuestions(session: SpecSpriteSession): string[] {
    const context = session.accumulated_context;
    const questions: string[] = [];

    // 基于项目类型生成针对性问题
    if (context.project_type === 'ecommerce') {
      if (!context.detected_features.includes('payment')) {
        questions.push('需要支持哪些支付方式？');
      }
      if (!context.user_preferences.product_type) {
        questions.push('主要销售什么类型的商品？');
      }
    } else if (context.project_type === 'saas') {
      if (!context.detected_features.includes('auth')) {
        questions.push('需要支持团队协作功能吗？');
      }
      if (!context.user_preferences.billing_model) {
        questions.push('计划采用什么样的订阅模式？');
      }
    } else if (context.project_type === 'blog') {
      if (!context.detected_features.includes('cms')) {
        questions.push('希望通过什么方式管理内容？');
      }
    }

    // 通用性问题
    if (context.tech_preferences.length === 0) {
      questions.push('您对技术选型有特殊要求吗？');
    }

    if (!context.constraints.timeline) {
      questions.push('项目的时间要求如何？');
    }

    return questions.slice(0, 2); // 最多返回2个问题，避免用户负担过重
  }

  /**
   * 获取会话摘要
   */
  getSessionSummary(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const context = session.accumulated_context;
    return `
会话摘要 (${session.id}):
- 项目类型: ${context.project_type || '未确定'}
- 检测功能: ${context.detected_features.join(', ') || '无'}
- 技术偏好: ${context.tech_preferences.join(', ') || '无'}
- 对话轮次: ${session.conversation_history.length}
- 准备度: ${session.readiness_score}%
- 状态: ${session.status}
    `.trim();
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    const timeoutMs = this.SESSION_TIMEOUT_MINUTES * 60 * 1000;
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastActivity = now - session.last_activity.getTime();
      if (timeSinceLastActivity > timeoutMs) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.error(`🧹 清理了 ${cleanedCount} 个过期会话`);
    }

    return cleanedCount;
  }

  // ============ 私有辅助方法 ============

  private createNewSession(): SpecSpriteSession {
    const sessionId = this.generateSessionId();
    const session: SpecSpriteSession = {
      id: sessionId,
      started_at: new Date(),
      last_activity: new Date(),
      conversation_history: [],
      accumulated_context: {
        detected_features: [],
        user_preferences: {},
        clarifications_resolved: [],
        tech_preferences: [],
        constraints: {}
      },
      status: 'active',
      readiness_score: 0
    };

    this.sessions.set(sessionId, session);
    console.error(`🆕 创建新会话: ${sessionId}`);
    
    return session;
  }

  private generateSessionId(): string {
    return `ss_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private generateTurnId(): string {
    return `turn_${Date.now()}_${randomBytes(2).toString('hex')}`;
  }

  private calculateReadinessScore(session: SpecSpriteSession): number {
    const context = session.accumulated_context;
    const history = session.conversation_history;

    let score = 0;

    // 项目类型明确 (20分)
    if (context.project_type && context.project_type !== 'generic') {
      score += 20;
    }

    // 功能需求 (30分)
    score += Math.min(30, context.detected_features.length * 6);

    // 对话深度 (20分)
    score += Math.min(20, history.length * 3);

    // 技术偏好 (15分)
    score += Math.min(15, context.tech_preferences.length * 5);

    // 约束条件 (10分)
    score += Math.min(10, Object.keys(context.constraints).length * 3);

    // 用户偏好 (5分)
    score += Math.min(5, Object.keys(context.user_preferences).length * 2);

    return Math.min(100, Math.round(score));
  }

  private assessInputQuality(history: ConversationTurn[]): boolean {
    const userTurns = history.filter(turn => turn.type === 'user');
    if (userTurns.length === 0) return false;

    const avgLength = userTurns.reduce((sum, turn) => sum + turn.content.length, 0) / userTurns.length;
    const hasDetailedInput = userTurns.some(turn => turn.content.length > 50);

    return avgLength > 20 && hasDetailedInput;
  }
}