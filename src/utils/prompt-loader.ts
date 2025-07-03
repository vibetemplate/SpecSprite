/**
 * 提示词加载器
 * 负责动态加载专家角色卡和系统提示词
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ExpertRoleCard, ProjectType } from '../core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PromptLoader {
  private readonly promptsDir: string;
  private promptCache = new Map<string, string>();

  constructor() {
    this.promptsDir = join(__dirname, '..', 'prompts');
  }

  /**
   * 加载专家角色卡
   */
  async loadExpertCard(expertType: string): Promise<ExpertRoleCard> {
    try {
      console.error(`📖 加载专家角色卡: ${expertType}`);
      
      const expertPath = join(this.promptsDir, 'experts', `${expertType}-expert.md`);
      
      if (!existsSync(expertPath)) {
        console.error(`⚠️ 专家角色卡文件不存在: ${expertPath}`);
        return this.createFallbackExpert(expertType);
      }
      
      const content = this.loadPromptFile(expertPath);
      const expertCard = this.parseExpertCard(content, expertType);
      
      console.error(`✅ 专家角色卡加载成功: ${expertCard.name}`);
      return expertCard;
      
    } catch (error) {
      console.error(`❌ 加载专家角色卡失败 (${expertType}):`, error);
      return this.createFallbackExpert(expertType);
    }
  }

  /**
   * 加载系统提示词
   */
  async loadSystemPrompt(promptName: string): Promise<string> {
    try {
      const promptPath = join(this.promptsDir, 'system', `${promptName}.md`);
      return this.loadPromptFile(promptPath);
    } catch (error) {
      console.error(`❌ 加载系统提示词失败 (${promptName}):`, error);
      return this.getFallbackSystemPrompt(promptName);
    }
  }

  /**
   * 获取意图分类提示词
   */
  async getIntentClassifierPrompt(): Promise<string> {
    return this.loadSystemPrompt('intent-classifier');
  }

  /**
   * 获取元提示词
   */
  async getMetaPrompt(): Promise<string> {
    return this.loadSystemPrompt('meta-prompt');
  }

  // ============ 私有方法 ============

  private loadPromptFile(filePath: string): string {
    // 检查缓存
    if (this.promptCache.has(filePath)) {
      return this.promptCache.get(filePath)!;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      this.promptCache.set(filePath, content);
      return content;
    } catch (error) {
      throw new Error(`无法读取提示词文件: ${filePath}`);
    }
  }

  private parseExpertCard(content: string, expertType: string): ExpertRoleCard {
    // 简单的 Markdown 解析，提取专家角色卡信息
    const lines = content.split('\n');
    
    let name = `${expertType.toUpperCase()} 专家`;
    let description = '';
    const openingQuestions: string[] = [];
    const coreTopics: string[] = [];
    const clarificationTemplates: string[] = [];
    const completionCriteria: string[] = [];
    const recommendedTechStack: string[] = [];
    const commonFeatures: string[] = [];
    const bestPractices: string[] = [];
    const pitfallsToAvoid: string[] = [];

    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 提取标题作为名称
      if (trimmedLine.startsWith('# ') && !name.includes('专家')) {
        name = trimmedLine.substring(2).trim();
        continue;
      }
      
      // 检测章节
      if (trimmedLine.startsWith('## ')) {
        currentSection = trimmedLine.substring(3).toLowerCase();
        continue;
      }
      
      // 提取描述
      if (currentSection.includes('专长') || currentSection.includes('描述')) {
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          description += trimmedLine + '\n';
        }
        continue;
      }
      
      // 提取列表项
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        const item = trimmedLine.substring(2).trim();
        
        if (currentSection.includes('开场') || currentSection.includes('问题')) {
          openingQuestions.push(item);
        } else if (currentSection.includes('核心') || currentSection.includes('主题')) {
          coreTopics.push(item);
        } else if (currentSection.includes('澄清')) {
          clarificationTemplates.push(item);
        } else if (currentSection.includes('完成') || currentSection.includes('标准')) {
          completionCriteria.push(item);
        } else if (currentSection.includes('技术') || currentSection.includes('栈')) {
          recommendedTechStack.push(item);
        } else if (currentSection.includes('功能')) {
          commonFeatures.push(item);
        } else if (currentSection.includes('实践')) {
          bestPractices.push(item);
        } else if (currentSection.includes('避免') || currentSection.includes('陷阱')) {
          pitfallsToAvoid.push(item);
        }
      }
    }

    return {
      id: `expert_${expertType}`,
      name: name.trim(),
      project_type: expertType as ProjectType,
      description: description.trim() || this.getDefaultDescription(expertType),
      conversation_flow: {
        opening_questions: openingQuestions.length > 0 ? openingQuestions : this.getDefaultOpeningQuestions(expertType),
        core_topics: coreTopics.length > 0 ? coreTopics : this.getDefaultCoreTopics(expertType),
        clarification_templates: clarificationTemplates.length > 0 ? clarificationTemplates : this.getDefaultClarificationTemplates(),
        completion_criteria: completionCriteria.length > 0 ? completionCriteria : this.getDefaultCompletionCriteria()
      },
      knowledge_base: {
        recommended_tech_stack: recommendedTechStack.length > 0 ? recommendedTechStack : this.getDefaultTechStack(expertType),
        common_features: commonFeatures.length > 0 ? commonFeatures : this.getDefaultFeatures(expertType),
        best_practices: bestPractices.length > 0 ? bestPractices : this.getDefaultBestPractices(),
        pitfalls_to_avoid: pitfallsToAvoid.length > 0 ? pitfallsToAvoid : this.getDefaultPitfalls()
      }
    };
  }

  private createFallbackExpert(expertType: string): ExpertRoleCard {
    return {
      id: `expert_${expertType}`,
      name: this.getExpertName(expertType),
      project_type: expertType as ProjectType,
      description: this.getDefaultDescription(expertType),
      conversation_flow: {
        opening_questions: this.getDefaultOpeningQuestions(expertType),
        core_topics: this.getDefaultCoreTopics(expertType),
        clarification_templates: this.getDefaultClarificationTemplates(),
        completion_criteria: this.getDefaultCompletionCriteria()
      },
      knowledge_base: {
        recommended_tech_stack: this.getDefaultTechStack(expertType),
        common_features: this.getDefaultFeatures(expertType),
        best_practices: this.getDefaultBestPractices(),
        pitfalls_to_avoid: this.getDefaultPitfalls()
      }
    };
  }

  private getExpertName(expertType: string): string {
    const names = {
      saas: 'SaaS产品顾问',
      ecommerce: '电商平台专家',
      blog: '博客平台顾问',
      portfolio: '作品集网站专家',
      landing_page: '营销页面专家',
      generic: '通用项目顾问'
    };
    
    return names[expertType as keyof typeof names] || '项目顾问';
  }

  private getDefaultDescription(expertType: string): string {
    const descriptions = {
      saas: '您好！我是专门负责 SaaS 产品的顾问。我擅长多租户架构、订阅制计费和用户权限管理，会帮助您设计可扩展的SaaS解决方案。',
      ecommerce: '您好！我是电商平台专家。我专注于在线零售、支付网关集成、库存和订单管理，会为您打造完整的电商解决方案。',
      blog: '您好！我是博客平台顾问。我专长于内容管理、SEO优化和社区互动，会帮您构建优秀的内容发布平台。',
      portfolio: '您好！我是作品集网站专家。我专注于视觉表现力、加载性能和用户转化率，会为您打造令人印象深刻的个人品牌网站。',
      landing_page: '您好！我是营销页面专家。我专注于用户转化、A/B测试和营销效果优化，会帮您创建高转化率的营销页面。',
      generic: '您好！我是您的项目顾问。我会根据您的具体需求，为您推荐最适合的技术方案和实现路径。'
    };
    
    return descriptions[expertType as keyof typeof descriptions] || descriptions.generic;
  }

  private getDefaultOpeningQuestions(expertType: string): string[] {
    const questions = {
      saas: [
        '您的SaaS产品主要解决什么核心问题？',
        '目标用户是个人用户还是企业客户？',
        '计划采用什么样的订阅模式？'
      ],
      ecommerce: [
        '您计划销售什么类型的商品？',
        '需要支持哪些支付方式？',
        '是否需要库存管理功能？'
      ],
      blog: [
        '这个博客的主要内容方向是什么？',
        '希望支持多作者协作吗？',
        '需要什么样的评论和互动功能？'
      ],
      portfolio: [
        '这个作品集主要展示什么类型的作品？',
        '希望实现什么样的视觉效果？',
        '需要哪些联系和互动功能？'
      ],
      landing_page: [
        '这个页面要推广什么产品或服务？',
        '主要的转化目标是什么？',
        '目标用户群体有什么特征？'
      ]
    };
    
    return questions[expertType as keyof typeof questions] || [
      '请详细描述一下您的项目想法',
      '这个项目的主要目标用户是谁？',
      '您希望实现哪些核心功能？'
    ];
  }

  private getDefaultCoreTopics(expertType: string): string[] {
    const topics = {
      saas: ['订阅模式', '用户权限', '多租户架构', '计费系统', '用户仪表板'],
      ecommerce: ['商品管理', '购物车', '支付流程', '订单管理', '库存系统'],
      blog: ['内容管理', '文章编辑器', '评论系统', '分类标签', 'SEO优化'],
      portfolio: ['作品展示', '联系表单', '响应式设计', '加载优化', '视觉效果'],
      landing_page: ['转化优化', '表单设计', '行为追踪', 'A/B测试', '营销集成']
    };
    
    return topics[expertType as keyof typeof topics] || [
      '功能需求', '技术选型', '用户体验', '性能优化'
    ];
  }

  private getDefaultClarificationTemplates(): string[] {
    return [
      '关于{}功能，您希望如何实现？',
      '在{}方面，您有什么特殊要求吗？',
      '对于{}，您更倾向于哪种方案？',
      '{}的优先级如何？是核心功能还是可选功能？'
    ];
  }

  private getDefaultCompletionCriteria(): string[] {
    return [
      '项目类型和目标明确',
      '核心功能需求清晰',
      '技术栈选择确定',
      '约束条件了解清楚',
      '用户群体定义明确'
    ];
  }

  private getDefaultTechStack(expertType: string): string[] {
    const stacks = {
      saas: ['Next.js', 'TypeScript', 'PostgreSQL', 'Prisma', 'Stripe', 'NextAuth.js'],
      ecommerce: ['Next.js', 'TypeScript', 'PostgreSQL', 'Stripe', 'Tailwind CSS'],
      blog: ['Astro', 'Markdown', 'TypeScript', 'Tailwind CSS'],
      portfolio: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion'],
      landing_page: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Analytics']
    };
    
    return stacks[expertType as keyof typeof stacks] || [
      'React', 'TypeScript', 'Tailwind CSS', 'Next.js'
    ];
  }

  private getDefaultFeatures(expertType: string): string[] {
    const features = {
      saas: ['用户认证', '订阅管理', '用户仪表板', '团队协作', '数据分析'],
      ecommerce: ['商品展示', '购物车', '支付处理', '订单管理', '用户账户'],
      blog: ['文章发布', '分类管理', '评论系统', '搜索功能', 'RSS订阅'],
      portfolio: ['作品展示', '项目详情', '联系表单', '响应式设计', '性能优化'],
      landing_page: ['产品介绍', '特性展示', '客户证言', '行为追踪', '转化优化']
    };
    
    return features[expertType as keyof typeof features] || [
      '用户界面', '数据管理', '基础功能'
    ];
  }

  private getDefaultBestPractices(): string[] {
    return [
      'SEO友好的URL结构',
      '响应式设计确保移动端体验',
      '性能优化和快速加载',
      '安全性考虑和数据保护',
      '用户体验和可访问性',
      '代码可维护性和测试覆盖'
    ];
  }

  private getDefaultPitfalls(): string[] {
    return [
      '过度设计导致复杂性增加',
      '忽略性能优化影响用户体验',
      '技术选型不当增加开发成本',
      '缺乏测试导致质量问题',
      '忽略安全性留下漏洞',
      '不考虑扩展性限制未来发展'
    ];
  }

  private getFallbackSystemPrompt(promptName: string): string {
    const fallbacks = {
      'intent-classifier': `# 意图分类器

你是一个智能的项目类型分类器。请分析用户输入，确定最匹配的项目类型。

支持的项目类型：blog, ecommerce, saas, portfolio, landing_page, generic

请返回 JSON 格式：{"project_type": "类型", "confidence": 数字, "reasoning": "理由"}`,

      'meta-prompt': `# SpecSprite 元提示词

你是 VibeGen 团队的智慧向导 SpecSprite（需求精灵）。你的使命是通过智能对话，帮助用户将模糊的项目想法转化为清晰、结构化的产品需求文档。

## 核心原则
1. 专业且友好的对话风格
2. 基于专家角色提供针对性建议
3. 通过澄清问题深入理解需求
4. 在信息充足时主动推进到PRD生成

请始终保持专业和耐心，帮助用户明确他们的项目需求。`
    };
    
    return fallbacks[promptName as keyof typeof fallbacks] || '# 默认提示词\n\n请协助用户完成任务。';
  }
}