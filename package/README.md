# SpecSprite (需求精灵)

> **VibeGen 双核架构 - MCP-1 需求精灵**
>
> `SpecSprite` 是 VibeGen 系统中的"需求精灵"，通过与用户进行专家级的智能对话，将模糊的项目想法一步步转化为一份精确、结构化的产品需求文档 (`prd.json`)。
>
> **重要提示**: 此服务是 VibeGen 双核架构的第一环，专注于需求理解和蓝图构建。其最终产物 `prd.json` 将被[代码侠 (CodePaladin)](../CodePaladin/README.md) 用于自动化代码生成。

`SpecSprite` 通过智能对话将模糊的项目想法转化为精确、完整的产品需求文档 (PRD)。

## 架构

[![双核AI架构](https://github.com/vibetemplate/CodePaladin/raw/main/images/tech.png)](https://github.com/vibetemplate/CodePaladin)

SpecSprite 作为独立的 `prd-generator` 服务运行，专注于与用户交互并将需求转化为结构化的 PRD。它与 CodePaladin 共同构成了 VibeGen 的双核系统。

```
用户 → SpecSprite → PRD → CodePaladin → 项目代码
```

## ✨ 核心特性

- **🧠 智能对话**: 通过多轮对话深度理解用户需求
- **💡 专家系统**: 基于项目类型动态加载专业顾问角色
- **🔄 上下文管理**: 智能记忆对话历史，渐进式信息收集
- **📋 标准化输出**: 生成符合 JSON Schema 的标准 PRD 文档
- **💰 零用户成本**: 通过 MCP 协议借用 Cursor IDE 的 LLM 能力

## 🏗️ 架构设计

基于 [VibeGen 架构决策 (ADR-001)](../docs/vibegen_architecture_decision.md)，SpecSprite 采用**双独立 MCP 服务**架构中的 MCP-1 服务：

- **零成本原则**: 完全依赖 Cursor IDE 的 LLM 能力，用户无需配置 API Key
- **标准 MCP 实现**: 使用成熟稳定的 MCP 功能，确保兼容性
- **专注而智能**: 在 PRD 生成领域达到极致，但严格避免越界到代码生成

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建项目

```bash
npm run build
npm start
```

### 在 Cursor 中使用

1. 构建项目：`npm run build`
2. 在 Cursor 中配置 MCP 服务器
3. 使用 `@specsprite` 开始智能对话

## 🛠️ 可用工具

### `generate_prd`
智能生成产品需求文档，支持多轮对话和上下文理解

```typescript
{
  user_input: string;           // 用户需求描述
  session_id?: string;          // 可选的会话ID
  continue_conversation?: boolean; // 是否继续现有对话
}
```

### `continue_conversation`
继续现有的需求澄清对话

```typescript
{
  session_id: string;           // 要继续的会话ID
  user_response: string;        // 用户的回复内容
}
```

### `get_session_info`
查看会话状态信息（调试用）

```typescript
{
  session_id: string;           // 会话ID
}
```

## 🧠 专家系统

SpecSprite 内置多个专业顾问角色：

- **SaaS 产品顾问**: 多租户架构、订阅制计费、企业级功能
- **电商平台专家**: 商品管理、支付流程、订单处理
- **博客平台顾问**: 内容管理、SEO 优化、社区互动
- **作品集专家**: 视觉表现、性能优化、个人品牌
- **通用项目顾问**: 适用于其他类型项目

## 📋 PRD 输出格式

生成的 PRD 包含以下结构化信息：

```typescript
interface PRDSchema {
  metadata: {
    name: string;
    version: string;
    generated_at: string;
    confidence_score: number;
    session_id: string;
  };
  project: {
    type: ProjectType;
    description: string;
    target_audience: string;
    key_features: string[];
  };
  tech_stack: {
    framework: string;
    database?: string;
    ui_library: string;
    deployment_platform?: string;
    additional_tools: string[];
  };
  features: FeatureFlags;
  specifications: FeatureSpecification[];
  constraints: ProjectConstraints;
  next_steps: string[];
}
```

## 🔧 开发指南

### 项目结构

```
src/
├── core/                      # 核心服务逻辑
│   ├── types.ts              # 类型定义
│   ├── spec-sprite-service.ts # 主服务
│   ├── conversation-manager.ts # 会话管理
│   └── llm-client.ts         # LLM 调用封装
├── prompts/                   # 提示词库
│   ├── system/               # 系统提示词
│   └── experts/              # 专家角色卡
├── schemas/                   # JSON Schema
├── utils/                     # 工具类
└── __tests__/                # 测试用例
```

### 添加新的专家角色

1. 在 `src/prompts/experts/` 下创建新的专家角色卡
2. 按照现有格式编写 Markdown 文件
3. 在意图分类器中添加对应的项目类型
4. 重启服务即可自动加载

### 扩展功能规格

1. 在 `src/utils/prd-builder.ts` 中添加新的功能规格模板
2. 更新 `src/schemas/prd-schema.json` 验证规则
3. 编写相应的测试用例

## 🧪 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 代码检查
npm run lint
```

## 📚 相关文档

- [开发文档](../docs/specsprite_mcp_dev.md)
- [架构决策记录](../docs/vibegen_architecture_decision.md)
- [VibeGen 总体设计](../docs/vibegen.md)

## 🤝 贡献指南

1. 基于 vibecli 的成功模式开发
2. 遵循 TypeScript 严格模式
3. 编写完整的测试用例
4. 保持代码简洁和可读性
5. 更新相关文档

## 📄 许可证

MIT License

---

**SpecSprite**: 让每个项目想法都能转化为清晰的产品蓝图 🎯
