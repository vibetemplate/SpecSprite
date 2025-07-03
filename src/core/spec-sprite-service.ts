/**
 * SpecSprite 核心服务
 * 整合所有组件，实现智能 PRD 生成的完整流程
 */

import { CursorLLMClient } from './llm-client.js';
import { ConversationManager } from './conversation-manager.js';
import { PRDBuilder } from '../utils/prd-builder.js';
import { PromptLoader } from '../utils/prompt-loader.js';
import type {
  GeneratePRDInput,
  GeneratePRDOutput,
  SpecSpriteSession,
  IntentAnalysisResult,
  ReadinessAnalysis,
  PRDSchema,
  SpecSpriteError,
  ExpertRoleCard
} from './types.js';

export class SpecSpriteService {
  private llmClient: CursorLLMClient;
  private conversationManager: ConversationManager;
  private prdBuilder: PRDBuilder;
  private promptLoader: PromptLoader;
  private expertCards: Map<string, ExpertRoleCard> = new Map();
  
  private readonly MIN_CONFIDENCE_FOR_PRD = 75;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(mcpServer: any) {
    this.llmClient = new CursorLLMClient(mcpServer);
    this.conversationManager = new ConversationManager();
    this.prdBuilder = new PRDBuilder();
    this.promptLoader = new PromptLoader();
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      console.error('🔧 初始化 SpecSprite 服务...');
      
      // 加载专家角色卡
      await this.loadExpertRoleCards();
      
      // 启动清理任务
      this.startCleanupTasks();
      
      console.error('✅ SpecSprite 服务初始化完成');
    } catch (error) {
      console.error('❌ SpecSprite 服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 处理用户输入 - 主要入口点
   */
  async processUserInput(input: GeneratePRDInput): Promise<GeneratePRDOutput> {
    try {
      console.error(`🎯 处理用户输入: "${input.user_input.substring(0, 50)}..."`);
      
      // 1. 获取或创建会话
      const session = this.conversationManager.getOrCreateSession(input.session_id);
      
      // 2. 记录用户输入
      this.conversationManager.recordUserInput(session, input.user_input);
      
      // 3. 提取用户偏好
      this.conversationManager.extractUserPreferences(session, input.user_input);
      
      // 4. 进行意图分析（如果是新会话或需要重新分析）
      let intentAnalysis: IntentAnalysisResult | null = null;
      if (!session.accumulated_context.project_type || session.conversation_history.length <= 1) {
        intentAnalysis = await this.analyzeUserIntent(input.user_input);
        this.conversationManager.updateAccumulatedContext(session, intentAnalysis);
      }
      
      // 5. 分析是否准备生成 PRD
      const readinessAnalysis = this.conversationManager.analyzeReadiness(session);
      
      // 6. 根据准备度决定下一步行动
      if (readinessAnalysis.ready_for_prd && readinessAnalysis.confidence >= this.MIN_CONFIDENCE_FOR_PRD) {
        return await this.generatePRD(session);
      } else {
        return await this.continueConversation(session, readinessAnalysis, intentAnalysis);
      }
      
    } catch (error) {
      console.error('❌ 处理用户输入失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话信息（调试用）
   */
  getSessionInfo(sessionId: string): string | null {
    return this.conversationManager.getSessionSummary(sessionId);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.error('🧹 清理 SpecSprite 服务资源...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // 清理过期会话
    this.conversationManager.cleanupExpiredSessions();
    
    console.error('✅ SpecSprite 服务清理完成');
  }

  // ============ 私有方法 ============

  /**
   * 分析用户意图
   */
  private async analyzeUserIntent(userInput: string): Promise<IntentAnalysisResult> {
    try {
      console.error('🔍 分析用户意图...');
      
      const result = await this.llmClient.classifyIntent(userInput);
      
      // 扩展分析结果
      const extendedResult: IntentAnalysisResult = {
        project_type: result.project_type as any,
        confidence: result.confidence,
        detected_features: this.extractFeatures(userInput),
        complexity_estimate: this.estimateComplexity(userInput),
        clarifications_needed: [],
        suggestions: [],
        reasoning: result.reasoning
      };

      console.error(`🎯 意图分析完成: ${extendedResult.project_type} (${extendedResult.confidence}%)`);
      
      return extendedResult;
    } catch (error) {
      console.error('❌ 意图分析失败:', error);
      
      // 返回默认分析结果
      return {
        project_type: 'generic',
        confidence: 30,
        detected_features: [],
        complexity_estimate: 'medium',
        clarifications_needed: ['无法分析用户意图'],
        suggestions: ['请提供更详细的项目描述'],
        reasoning: '意图分析失败，使用默认值'
      };
    }
  }

  /**
   * 继续对话
   */
  private async continueConversation(
    session: SpecSpriteSession, 
    readinessAnalysis: ReadinessAnalysis,
    intentAnalysis: IntentAnalysisResult | null
  ): Promise<GeneratePRDOutput> {
    try {
      console.error(`💬 继续对话，当前完整度: ${readinessAnalysis.current_completeness}%`);
      
      // 选择合适的专家角色卡
      const expertCard = await this.selectExpertCard(session);
      
      // 生成对话响应
      const lastUserInput = session.conversation_history[session.conversation_history.length - 1]?.content || '';
      
      const conversationResponse = await this.llmClient.generateConversationResponse(
        lastUserInput,
        expertCard.description, // 使用专家描述作为提示词
        session.conversation_history,
        session.accumulated_context
      );
      
      // 记录助手响应
      this.conversationManager.recordAssistantResponse(
        session, 
        conversationResponse.response,
        {
          expert_used: expertCard.name,
          confidence: conversationResponse.confidence,
          type: conversationResponse.type
        }
      );
      
      // 生成澄清问题
      const clarificationQuestions = readinessAnalysis.clarification_questions.length > 0
        ? readinessAnalysis.clarification_questions
        : this.conversationManager.generateClarificationQuestions(session);
      
      const responseType = conversationResponse.type === 'completion' ? 'conversation' : 'clarification';
      
      return {
        type: responseType,
        session_id: session.id,
        content: {
          message: conversationResponse.response,
          questions: clarificationQuestions,
          suggestions: intentAnalysis?.suggestions || [],
          debug_info: {
            expert_used: expertCard.name,
            confidence: conversationResponse.confidence,
            reasoning: `完整度: ${readinessAnalysis.current_completeness}%, 类型: ${conversationResponse.type}`
          }
        }
      };
      
    } catch (error) {
      console.error('❌ 对话继续失败:', error);
      throw error;
    }
  }

  /**
   * 生成 PRD
   */
  private async generatePRD(session: SpecSpriteSession): Promise<GeneratePRDOutput> {
    try {
      console.error(`📋 生成 PRD，会话: ${session.id}`);
      
      // 构建 PRD
      const prd = await this.prdBuilder.buildPRD(session);
      
      // 验证 PRD
      const validationResult = this.prdBuilder.validatePRD(prd);
      if (!validationResult.valid) {
        console.error('❌ PRD 验证失败:', validationResult.errors);
        throw new Error(`PRD 验证失败: ${validationResult.errors.join(', ')}`);
      }
      
      // 更新会话状态
      session.status = 'completed';
      
      // 记录助手响应
      this.conversationManager.recordAssistantResponse(
        session,
        `PRD 生成完成: ${prd.metadata.name}`,
        {
          prd_generated: true,
          confidence: prd.metadata.confidence_score
        }
      );
      
      console.error(`✅ PRD 生成完成: ${prd.metadata.name} (置信度: ${prd.metadata.confidence_score}%)`);
      
      return {
        type: 'prd',
        session_id: session.id,
        content: {
          prd,
          debug_info: {
            expert_used: session.current_expert || 'generic',
            confidence: prd.metadata.confidence_score,
            reasoning: `基于 ${session.conversation_history.length} 轮对话生成`
          }
        }
      };
      
    } catch (error) {
      console.error('❌ PRD 生成失败:', error);
      throw error;
    }
  }

  /**
   * 选择合适的专家角色卡
   */
  private async selectExpertCard(session: SpecSpriteSession): Promise<ExpertRoleCard> {
    const projectType = session.accumulated_context.project_type;
    
    if (projectType && this.expertCards.has(projectType)) {
      const expertCard = this.expertCards.get(projectType)!;
      session.current_expert = expertCard.id;
      return expertCard;
    }
    
    // 使用通用专家
    const genericExpert = this.expertCards.get('generic') || this.createDefaultExpert();
    session.current_expert = genericExpert.id;
    return genericExpert;
  }

  /**
   * 加载专家角色卡
   */
  private async loadExpertRoleCards(): Promise<void> {
    try {
      console.error('📚 加载专家角色卡...');
      
      const expertTypes = ['saas', 'ecommerce', 'blog', 'portfolio', 'landing_page', 'generic'];
      
      for (const type of expertTypes) {
        try {
          const expertCard = await this.promptLoader.loadExpertCard(type);
          this.expertCards.set(type, expertCard);
          console.error(`✅ 加载专家: ${expertCard.name}`);
        } catch (error) {
          console.error(`⚠️ 加载专家 ${type} 失败:`, error);
          // 创建默认专家
          this.expertCards.set(type, this.createDefaultExpert(type));
        }
      }
      
      console.error(`📚 专家角色卡加载完成，共 ${this.expertCards.size} 个专家`);
    } catch (error) {
      console.error('❌ 加载专家角色卡失败:', error);
      // 确保至少有一个默认专家
      this.expertCards.set('generic', this.createDefaultExpert());
    }
  }

  /**
   * 创建默认专家
   */
  private createDefaultExpert(type: string = 'generic'): ExpertRoleCard {
    return {
      id: `expert_${type}`,
      name: `${type.toUpperCase()} 项目专家`,
      project_type: type as any,
      description: `您好！我是专门负责 ${type} 类型项目的专家。我会帮助您明确项目需求，推荐最适合的技术方案，并生成详细的产品需求文档。`,
      conversation_flow: {
        opening_questions: [
          '请详细描述一下您的项目想法',
          '这个项目的主要目标用户是谁？',
          '您希望实现哪些核心功能？'
        ],
        core_topics: ['功能需求', '技术选型', '用户体验', '部署方案'],
        clarification_templates: [
          '关于{}功能，您希望如何实现？',
          '在{}方面，您有什么特殊要求吗？'
        ],
        completion_criteria: ['项目类型明确', '核心功能清晰', '技术栈确定', '约束条件了解']
      },
      knowledge_base: {
        recommended_tech_stack: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
        common_features: ['用户认证', '响应式设计', '数据管理'],
        best_practices: ['SEO优化', '性能优化', '安全考虑'],
        pitfalls_to_avoid: ['过度设计', '技术选型不当', '忽略用户体验']
      }
    };
  }

  /**
   * 启动清理任务
   */
  private startCleanupTasks(): void {
    // 每10分钟清理一次过期会话
    this.cleanupInterval = setInterval(() => {
      this.conversationManager.cleanupExpiredSessions();
    }, 10 * 60 * 1000);
  }

  /**
   * 从用户输入中提取功能特征
   */
  private extractFeatures(userInput: string): string[] {
    const features: string[] = [];
    const lowercaseInput = userInput.toLowerCase();

    const featureKeywords = {
      'auth': ['登录', '注册', '用户', '认证', '权限'],
      'payment': ['支付', '付费', '购买', '订阅', '收费'],
      'admin': ['管理', '后台', '控制台', '管理员'],
      'search': ['搜索', '查找', '检索'],
      'upload': ['上传', '文件', '图片', '附件'],
      'realtime': ['实时', '聊天', '消息', '通知'],
      'analytics': ['统计', '分析', '数据', '报表'],
      'email': ['邮件', '邮箱', '通知']
    };

    Object.entries(featureKeywords).forEach(([feature, keywords]) => {
      if (keywords.some(keyword => lowercaseInput.includes(keyword))) {
        features.push(feature);
      }
    });

    return features;
  }

  /**
   * 估算项目复杂度
   */
  private estimateComplexity(userInput: string): 'simple' | 'medium' | 'complex' {
    const lowercaseInput = userInput.toLowerCase();
    
    const complexityIndicators = {
      simple: ['简单', '基础', '入门', '快速'],
      complex: ['复杂', '企业级', '大型', '高级', '多租户', '微服务']
    };

    if (complexityIndicators.complex.some(word => lowercaseInput.includes(word))) {
      return 'complex';
    }
    
    if (complexityIndicators.simple.some(word => lowercaseInput.includes(word))) {
      return 'simple';
    }
    
    return 'medium';
  }
}