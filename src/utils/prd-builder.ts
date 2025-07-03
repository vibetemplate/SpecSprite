/**
 * PRD 构建器
 * 负责从会话上下文构建完整的产品需求文档
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
  PRDSchema,
  SpecSpriteSession,
  ValidationResult,
  FeatureSpecification
} from '../core/types.js';
import { SpecSpriteError } from '../core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PRDBuilder {
  private prdSchema: any;

  constructor() {
    this.loadSchema();
  }

  /**
   * 从会话构建完整的 PRD
   */
  async buildPRD(session: SpecSpriteSession): Promise<PRDSchema> {
    try {
      console.error(`📋 构建 PRD，会话: ${session.id}`);
      
      const context = session.accumulated_context;
      const projectName = this.extractProjectName(session) || 'MyProject';
      
      // 构建 PRD 各个部分
      const metadata = this.buildMetadata(projectName, session);
      const project = this.buildProjectInfo(session);
      const techStack = this.buildTechStack(session);
      const features = this.buildFeatureFlags(session);
      const specifications = this.buildSpecifications(session);
      const constraints = this.buildConstraints(session);
      const environment = this.buildEnvironment(session);
      const nextSteps = this.buildNextSteps(session);

      const prd: PRDSchema = {
        metadata,
        project,
        tech_stack: techStack,
        features,
        specifications,
        constraints,
        environment,
        next_steps: nextSteps
      };

      console.error(`✅ PRD 构建完成: ${prd.metadata.name}`);
      return prd;
      
    } catch (error) {
      console.error('❌ PRD 构建失败:', error);
      throw new SpecSpriteError(
        `PRD 构建失败: ${error instanceof Error ? error.message : '未知错误'}`,
        'PRD_BUILD_FAILED',
        { session_id: session.id }
      );
    }
  }

  /**
   * 验证 PRD 格式和内容
   */
  validatePRD(prd: PRDSchema): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 基础字段验证
      if (!prd.metadata?.name) {
        errors.push('缺少项目名称');
      }
      
      if (!prd.project?.type) {
        errors.push('缺少项目类型');
      }
      
      if (!prd.project?.description || prd.project.description.length < 10) {
        errors.push('项目描述过短或缺失');
      }
      
      if (!prd.project?.key_features || prd.project.key_features.length === 0) {
        errors.push('缺少核心功能');
      }
      
      if (!prd.tech_stack?.framework) {
        errors.push('缺少技术框架');
      }
      
      if (!prd.next_steps || prd.next_steps.length === 0) {
        errors.push('缺少下一步行动计划');
      }

      // 质量检查
      if (prd.metadata?.confidence_score < 70) {
        warnings.push('PRD 置信度较低，建议进一步澄清需求');
      }
      
      if (prd.project?.key_features.length < 3) {
        warnings.push('核心功能较少，可能需要补充');
      }
      
      if (prd.specifications.length === 0) {
        warnings.push('缺少详细功能规格说明');
      }

      // JSON Schema 验证（如果已加载）
      if (this.prdSchema) {
        // 这里可以添加更严格的 schema 验证
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [`验证过程出错: ${error instanceof Error ? error.message : '未知错误'}`],
        warnings: []
      };
    }
  }

  // ============ 私有方法 ============

  private buildMetadata(projectName: string, session: SpecSpriteSession) {
    return {
      name: projectName,
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      confidence_score: Math.min(95, Math.max(60, session.readiness_score + 10)),
      session_id: session.id
    };
  }

  private buildProjectInfo(session: SpecSpriteSession) {
    const context = session.accumulated_context;
    const history = session.conversation_history;
    
    // 从对话中提取项目描述
    const description = this.extractProjectDescription(session);
    
    // 确定目标用户
    const targetAudience = context.user_preferences.target_audience || 
                          this.inferTargetAudience(context.project_type || 'generic');
    
    // 构建核心功能列表
    const keyFeatures = this.buildKeyFeaturesList(session);
    
    return {
      type: context.project_type || 'generic',
      description,
      target_audience: targetAudience,
      key_features: keyFeatures,
      business_model: context.user_preferences.business_model,
      scale_expectations: this.inferScale(session)
    };
  }

  private buildTechStack(session: SpecSpriteSession) {
    const context = session.accumulated_context;
    
    // 基于项目类型推荐框架
    const framework = this.selectFramework(context);
    
    // 选择数据库
    const database = this.selectDatabase(context);
    
    // 选择 UI 库
    const uiLibrary = this.selectUILibrary(context);
    
    // 部署平台
    const deploymentPlatform = this.selectDeploymentPlatform(context);
    
    // 其他工具
    const additionalTools = this.selectAdditionalTools(context);
    
    return {
      framework,
      database,
      ui_library: uiLibrary,
      deployment_platform: deploymentPlatform,
      additional_tools: additionalTools
    };
  }

  private buildFeatureFlags(session: SpecSpriteSession) {
    const context = session.accumulated_context;
    const features = context.detected_features;
    
    return {
      auth: features.includes('auth') || this.requiresAuth(context.project_type),
      payment: features.includes('payment'),
      admin: features.includes('admin') || this.requiresAdmin(context.project_type),
      search: features.includes('search'),
      upload: features.includes('upload'),
      realtime: features.includes('realtime'),
      analytics: features.includes('analytics'),
      email: features.includes('email')
    };
  }

  private buildSpecifications(session: SpecSpriteSession): FeatureSpecification[] {
    const context = session.accumulated_context;
    const specifications: FeatureSpecification[] = [];
    
    // 为每个检测到的功能创建规格说明
    context.detected_features.forEach(feature => {
      const spec = this.createFeatureSpecification(feature, context.project_type);
      if (spec) {
        specifications.push(spec);
      }
    });
    
    // 确保至少有基础规格
    if (specifications.length === 0) {
      specifications.push(this.createBasicSpecification(context.project_type || 'generic'));
    }
    
    return specifications;
  }

  private buildConstraints(session: SpecSpriteSession) {
    const context = session.accumulated_context;
    
    return {
      budget: context.constraints.budget,
      timeline: context.constraints.timeline,
      team_size: context.constraints.team_size,
      complexity_preference: context.constraints.complexity_preference
    };
  }

  private buildEnvironment(session: SpecSpriteSession) {
    // 目前尚未收集环境变量信息，返回空对象占位，满足验证器需求
    return {
      variables: {},
      secrets: [] as string[]
    };
  }

  private buildNextSteps(session: SpecSpriteSession): string[] {
    const context = session.accumulated_context;
    const steps: string[] = [];
    
    // 基于项目类型生成通用步骤
    steps.push('搭建项目基础架构');
    
    if (context.detected_features.includes('auth')) {
      steps.push('实现用户认证系统');
    }
    
    if (context.detected_features.includes('payment')) {
      steps.push('集成支付功能');
    }
    
    steps.push('开发核心功能模块');
    steps.push('设计用户界面');
    steps.push('编写测试用例');
    steps.push('部署到生产环境');
    
    return steps;
  }

  private extractProjectName(session: SpecSpriteSession): string | null {
    const history = session.conversation_history;
    
    for (const turn of history) {
      if (turn.type === 'user') {
        // 尝试从用户输入中提取项目名称
        const patterns = [
          /(?:项目|网站|系统|平台|应用)[\s"'《「]*([a-zA-Z0-9\u4e00-\u9fff]+)/,
          /(?:叫做|命名为|名为)[\s"'《「]*([a-zA-Z0-9\u4e00-\u9fff]+)/,
          /^([a-zA-Z][a-zA-Z0-9\-_]*)/
        ];
        
        for (const pattern of patterns) {
          const match = turn.content.match(pattern);
          if (match && match[1] && match[1].length > 1) {
            return match[1].trim();
          }
        }
      }
    }
    
    return null;
  }

  private extractProjectDescription(session: SpecSpriteSession): string {
    const history = session.conversation_history;
    const userInputs = history
      .filter(turn => turn.type === 'user')
      .map(turn => turn.content);
    
    if (userInputs.length === 0) {
      return '一个现代化的Web应用项目';
    }
    
    // 取第一个较长的用户输入作为描述基础
    const longInput = userInputs.find(input => input.length > 20);
    if (longInput) {
      return longInput.length > 200 ? longInput.substring(0, 200) + '...' : longInput;
    }
    
    return userInputs[0];
  }

  private buildKeyFeaturesList(session: SpecSpriteSession): string[] {
    const context = session.accumulated_context;
    const features: string[] = [];
    
    // 基于检测到的功能生成描述
    const featureDescriptions = {
      auth: '用户注册与登录',
      payment: '在线支付功能',
      admin: '管理后台',
      search: '搜索功能',
      upload: '文件上传',
      realtime: '实时通信',
      analytics: '数据分析',
      email: '邮件通知'
    };
    
    context.detected_features.forEach(feature => {
      const description = featureDescriptions[feature as keyof typeof featureDescriptions];
      if (description) {
        features.push(description);
      }
    });
    
    // 基于项目类型添加默认功能
    const projectType = context.project_type;
    if (projectType === 'ecommerce') {
      if (!features.some(f => f.includes('购物'))) {
        features.push('商品展示与购物车');
      }
    } else if (projectType === 'blog') {
      if (!features.some(f => f.includes('文章'))) {
        features.push('文章发布与管理');
      }
    } else if (projectType === 'saas') {
      if (!features.some(f => f.includes('仪表板'))) {
        features.push('用户仪表板');
      }
    }
    
    // 确保至少有3个功能
    while (features.length < 3) {
      features.push('响应式用户界面');
      features.push('数据管理功能');
      features.push('用户友好的交互体验');
    }
    
    return features.slice(0, 8); // 最多8个核心功能
  }

  private selectFramework(context: any): string {
    // 优先使用用户偏好
    for (const tech of context.tech_preferences) {
      if (['Next.js', 'React', 'Vue.js', 'Angular', 'Nuxt.js', 'Svelte'].includes(tech)) {
        return tech;
      }
    }
    
    // 基于项目类型推荐
    const projectType = context.project_type;
    switch (projectType) {
      case 'ecommerce':
      case 'saas':
        return 'Next.js';
      case 'blog':
        return 'Astro';
      case 'portfolio':
        return 'Next.js';
      default:
        return 'React';
    }
  }

  private selectDatabase(context: any): string | undefined {
    // 检查用户偏好
    for (const tech of context.tech_preferences) {
      if (['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'].includes(tech)) {
        return tech;
      }
    }
    
    // 基于项目复杂度推荐
    const projectType = context.project_type;
    if (['ecommerce', 'saas'].includes(projectType)) {
      return 'PostgreSQL';
    }
    
    if (context.detected_features.includes('auth') || context.detected_features.includes('payment')) {
      return 'PostgreSQL';
    }
    
    return undefined; // 简单项目可能不需要数据库
  }

  private selectUILibrary(context: any): string {
    for (const tech of context.tech_preferences) {
      if (['Tailwind CSS', 'Bootstrap', 'Material UI', 'Chakra UI'].includes(tech)) {
        return tech;
      }
    }
    
    return 'Tailwind CSS'; // 默认推荐
  }

  private selectDeploymentPlatform(context: any): string | undefined {
    const constraints = context.constraints;
    
    if (constraints.budget === 'low') {
      return 'Vercel'; // 免费额度较好
    }
    
    const projectType = context.project_type;
    if (projectType === 'saas' || projectType === 'ecommerce') {
      return 'AWS'; // 企业级需求
    }
    
    return 'Vercel'; // 默认推荐
  }

  private selectAdditionalTools(context: any): string[] {
    const tools: string[] = [];
    
    // 基于功能需求添加工具
    if (context.detected_features.includes('auth')) {
      tools.push('NextAuth.js');
    }
    
    if (context.detected_features.includes('payment')) {
      tools.push('Stripe');
    }
    
    if (context.detected_features.includes('email')) {
      tools.push('Resend');
    }
    
    // 基于技术偏好
    if (context.tech_preferences.includes('TypeScript')) {
      tools.push('TypeScript');
    }
    
    if (context.tech_preferences.includes('Prisma')) {
      tools.push('Prisma ORM');
    }
    
    // 默认工具
    if (!tools.includes('TypeScript')) {
      tools.push('TypeScript');
    }
    
    return tools;
  }

  private requiresAuth(projectType?: string): boolean {
    return ['saas', 'ecommerce'].includes(projectType || '');
  }

  private requiresAdmin(projectType?: string): boolean {
    return ['ecommerce', 'saas', 'blog'].includes(projectType || '');
  }

  private inferTargetAudience(projectType: string): string {
    const audiences = {
      blog: '内容阅读者和订阅用户',
      ecommerce: '在线购物用户',
      saas: '企业用户和团队',
      portfolio: '潜在客户和雇主',
      landing_page: '目标客户群体',
      generic: '终端用户'
    };
    
    return audiences[projectType as keyof typeof audiences] || audiences.generic;
  }

  private inferScale(session: SpecSpriteSession): 'small' | 'medium' | 'large' {
    const context = session.accumulated_context;
    
    if (context.constraints.team_size && context.constraints.team_size >= 5) {
      return 'large';
    }
    
    if (context.project_type === 'saas' || context.detected_features.length > 5) {
      return 'medium';
    }
    
    return 'small';
  }

  private createFeatureSpecification(feature: string, projectType?: string): FeatureSpecification | null {
    const specifications: Record<string, FeatureSpecification> = {
      auth: {
        name: '用户认证系统',
        description: '提供用户注册、登录、密码重置等功能',
        requirements: [
          '支持邮箱/用户名登录',
          '密码强度验证',
          '邮箱验证功能',
          '记住登录状态',
          '安全的密码重置流程'
        ],
        dependencies: ['数据库', '邮件服务'],
        implementation_notes: [
          '使用 NextAuth.js 或类似认证库',
          '实现 JWT 或 Session 管理',
          '确保密码加密存储',
          '添加 CSRF 保护'
        ]
      },
      payment: {
        name: '支付系统',
        description: '集成在线支付功能，支持多种支付方式',
        requirements: [
          '支持信用卡支付',
          '支付状态跟踪',
          '退款处理',
          '支付历史记录',
          '安全的支付流程'
        ],
        dependencies: ['支付网关API', '数据库', '邮件通知'],
        implementation_notes: [
          '集成 Stripe 或其他支付服务',
          '实现 Webhook 处理',
          '遵循 PCI DSS 标准',
          '添加支付失败重试机制'
        ]
      }
      // 可以继续添加其他功能规格...
    };
    
    return specifications[feature] || null;
  }

  private createBasicSpecification(projectType: string): FeatureSpecification {
    return {
      name: '基础功能模块',
      description: `${projectType} 项目的核心功能实现`,
      requirements: [
        '响应式用户界面',
        '基础数据管理',
        '用户友好的交互'
      ],
      dependencies: ['前端框架', 'UI组件库'],
      implementation_notes: [
        '遵循现代Web开发最佳实践',
        '确保跨浏览器兼容性',
        '优化页面加载性能'
      ]
    };
  }

  private loadSchema(): void {
    try {
      const schemaPath = join(__dirname, '..', 'schemas', 'prd-schema.json');
      const schemaContent = readFileSync(schemaPath, 'utf-8');
      this.prdSchema = JSON.parse(schemaContent);
      console.error('✅ PRD Schema 加载成功');
    } catch (error) {
      console.error('⚠️ PRD Schema 加载失败:', error);
      this.prdSchema = null;
    }
  }
}