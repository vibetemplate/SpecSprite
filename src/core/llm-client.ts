/**
 * Cursor LLM 客户端 - 零成本架构的核心实现
 * 通过 MCP 协议向 Cursor IDE 请求 LLM 补全，实现智能对话
 */

import type { 
  LLMRequest, 
  LLMResponse, 
  ConversationTurn,
  AccumulatedContext 
} from './types.js';
import { SpecSpriteError } from './types.js';

export class CursorLLMClient {
  private mcpServer: any; // MCP 服务器实例

  constructor(mcpServer: any) {
    this.mcpServer = mcpServer;
  }

  /**
   * 核心方法：向 Cursor 请求 LLM 补全
   * 这是零成本架构的关键 - 使用用户在 Cursor 中已配置的模型
   */
  async requestCompletion(request: LLMRequest): Promise<LLMResponse> {
    try {
      console.error(`🤖 正在请求 LLM 补全...`);
      
      // 通过 MCP 协议向 Cursor 请求 LLM 补全
      // 这里使用 Cursor 提供的 LLM 能力，用户无需任何配置
      const response = await this.mcpServer.requestCompletion({
        prompt: request.prompt,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 2000,
        context: request.context
      });

      console.error(`✅ LLM 补全完成`);

      return {
        content: response.content,
        metadata: {
          model: response.model || 'cursor-default',
          tokens_used: response.tokens_used || 0,
          confidence: this.estimateConfidence(response.content)
        }
      };
    } catch (error) {
      console.error(`❌ LLM 补全失败:`, error);
      throw new SpecSpriteError(
        `LLM 补全请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'LLM_REQUEST_FAILED',
        { request, error }
      );
    }
  }

  /**
   * 意图分类 - 使用专门的分类提示词
   */
  async classifyIntent(userInput: string): Promise<{
    project_type: string;
    confidence: number;
    reasoning: string;
  }> {
    const prompt = this.buildIntentClassificationPrompt(userInput);
    
    const response = await this.requestCompletion({
      prompt,
      temperature: 0.3, // 低温度确保分类一致性
      max_tokens: 500
    });

    return this.parseIntentResponse(response.content);
  }

  /**
   * 构建对话响应 - 使用专家角色卡和上下文
   */
  async generateConversationResponse(
    userInput: string,
    expertPrompt: string,
    conversationHistory: ConversationTurn[],
    accumulatedContext: AccumulatedContext
  ): Promise<{
    response: string;
    type: 'question' | 'suggestion' | 'completion';
    confidence: number;
  }> {
    const prompt = this.buildConversationPrompt(
      userInput,
      expertPrompt,
      conversationHistory,
      accumulatedContext
    );

    const response = await this.requestCompletion({
      prompt,
      temperature: 0.7,
      max_tokens: 1000,
      context: {
        session_id: 'current',
        conversation_history: conversationHistory,
        user_context: accumulatedContext
      }
    });

    return this.parseConversationResponse(response.content);
  }

  /**
   * 分析对话准备度 - 判断是否可以生成 PRD
   */
  async analyzeReadiness(
    conversationHistory: ConversationTurn[],
    accumulatedContext: AccumulatedContext
  ): Promise<{
    ready: boolean;
    confidence: number;
    missing_info: string[];
    next_questions: string[];
  }> {
    const prompt = this.buildReadinessAnalysisPrompt(conversationHistory, accumulatedContext);
    
    const response = await this.requestCompletion({
      prompt,
      temperature: 0.4,
      max_tokens: 800
    });

    return this.parseReadinessResponse(response.content);
  }

  // ============ 私有辅助方法 ============

  private buildIntentClassificationPrompt(userInput: string): string {
    return `# 意图分类器

你是一个精确的项目类型分类器。分析用户输入，确定最匹配的项目类型。

## 项目类型定义：
- blog: 博客、内容网站、资讯平台
- ecommerce: 电商、在线商店、购物网站
- saas: SaaS产品、订阅服务、B2B平台
- portfolio: 作品集、个人网站、展示网站
- landing_page: 营销页面、产品介绍页、活动页面
- generic: 其他类型或无法明确分类

## 用户输入：
"${userInput}"

## 要求：
1. 分析用户的真实意图和需求
2. 考虑关键词、使用场景、目标用户
3. 返回 JSON 格式：{"project_type": "类型", "confidence": 85, "reasoning": "分析理由"}
4. confidence 范围 0-100
5. 如果不确定，选择 generic

请分析并返回结果：`;
  }

  private buildConversationPrompt(
    userInput: string,
    expertPrompt: string,
    conversationHistory: ConversationTurn[],
    accumulatedContext: AccumulatedContext
  ): string {
    const historyText = conversationHistory
      .slice(-5) // 只保留最近5轮对话
      .map(turn => `${turn.type}: ${turn.content}`)
      .join('\n');

    const contextText = `
当前项目理解：
- 项目类型: ${accumulatedContext.project_type || '未确定'}
- 已识别功能: ${accumulatedContext.detected_features.join(', ') || '无'}
- 用户偏好: ${Object.entries(accumulatedContext.user_preferences).map(([k, v]) => `${k}: ${v}`).join(', ') || '无'}
- 技术偏好: ${accumulatedContext.tech_preferences.join(', ') || '无'}
`;

    return `${expertPrompt}

## 对话历史：
${historyText}

## 累积上下文：
${contextText}

## 当前用户输入：
"${userInput}"

## 指令：
1. 基于专家角色，给出专业的回应
2. 如果信息不足，提出1-2个有针对性的澄清问题
3. 如果信息充足，可以开始总结并准备生成PRD
4. 保持对话自然，避免过于机械化
5. 返回 JSON 格式：{"response": "回复内容", "type": "question|suggestion|completion", "confidence": 85}

请基于专家身份回应：`;
  }

  private buildReadinessAnalysisPrompt(
    conversationHistory: ConversationTurn[],
    accumulatedContext: AccumulatedContext
  ): string {
    const contextSummary = `
项目类型: ${accumulatedContext.project_type || '未知'}
已识别功能: ${accumulatedContext.detected_features.join(', ') || '无'}
用户偏好: ${Object.keys(accumulatedContext.user_preferences).length}项
已解决澄清: ${accumulatedContext.clarifications_resolved.length}项
对话轮次: ${conversationHistory.length}
`;

    return `# PRD 生成准备度分析

分析当前对话状态，判断是否具备生成完整 PRD 的条件。

## 当前状态：
${contextSummary}

## 最近对话：
${conversationHistory.slice(-3).map(turn => `${turn.type}: ${turn.content}`).join('\n')}

## 必需信息检查表：
- [ ] 项目类型明确
- [ ] 核心功能清晰（至少3个）
- [ ] 目标用户群体确定
- [ ] 技术偏好明确
- [ ] 约束条件了解（预算、时间、团队）

## 要求：
1. 评估信息完整度 (0-100)
2. 判断是否可以生成 PRD
3. 列出缺失的关键信息
4. 建议下一步澄清问题

返回 JSON：
{
  "ready": boolean,
  "confidence": number,
  "missing_info": ["缺失信息1", "缺失信息2"],
  "next_questions": ["问题1", "问题2"]
}

请分析：`;
  }

  private parseIntentResponse(content: string): {
    project_type: string;
    confidence: number;
    reasoning: string;
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          project_type: parsed.project_type || 'generic',
          confidence: parsed.confidence || 50,
          reasoning: parsed.reasoning || '分析完成'
        };
      }
    } catch (error) {
      console.error('解析意图分类响应失败:', error);
    }

    // 回退逻辑：基于关键词判断
    const lowercaseContent = content.toLowerCase();
    if (lowercaseContent.includes('电商') || lowercaseContent.includes('商店')) {
      return { project_type: 'ecommerce', confidence: 60, reasoning: '关键词匹配' };
    }
    if (lowercaseContent.includes('博客') || lowercaseContent.includes('文章')) {
      return { project_type: 'blog', confidence: 60, reasoning: '关键词匹配' };
    }
    if (lowercaseContent.includes('作品') || lowercaseContent.includes('展示')) {
      return { project_type: 'portfolio', confidence: 60, reasoning: '关键词匹配' };
    }
    if (lowercaseContent.includes('saas') || lowercaseContent.includes('订阅')) {
      return { project_type: 'saas', confidence: 60, reasoning: '关键词匹配' };
    }

    return { project_type: 'generic', confidence: 30, reasoning: '无法明确分类' };
  }

  private parseConversationResponse(content: string): {
    response: string;
    type: 'question' | 'suggestion' | 'completion';
    confidence: number;
  } {
    try {
      const jsonMatch = content.match(/\{[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          response: parsed.response || content,
          type: parsed.type || 'suggestion',
          confidence: parsed.confidence || 70
        };
      }
    } catch (error) {
      console.error('解析对话响应失败:', error);
    }

    // 简单判断响应类型
    const type = content.includes('?') || content.includes('？') ? 'question' : 'suggestion';
    
    return {
      response: content,
      type,
      confidence: 70
    };
  }

  private parseReadinessResponse(content: string): {
    ready: boolean;
    confidence: number;
    missing_info: string[];
    next_questions: string[];
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ready: parsed.ready || false,
          confidence: parsed.confidence || 50,
          missing_info: parsed.missing_info || [],
          next_questions: parsed.next_questions || []
        };
      }
    } catch (error) {
      console.error('解析准备度响应失败:', error);
    }

    return {
      ready: false,
      confidence: 30,
      missing_info: ['无法解析响应'],
      next_questions: ['请提供更多项目信息']
    };
  }

  private estimateConfidence(content: string): number {
    // 基于内容质量估算置信度
    if (content.length < 10) return 20;
    if (content.length < 50) return 50;
    if (content.includes('不确定') || content.includes('可能')) return 60;
    if (content.includes('建议') || content.includes('推荐')) return 80;
    return 75;
  }
}