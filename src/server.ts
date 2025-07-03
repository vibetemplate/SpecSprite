#!/usr/bin/env node

/**
 * SpecSprite MCP 服务器
 * VibeGen 需求精灵 (SpecSprite) - 智能 PRD 生成服务
 * 
 * 基于双独立 MCP 服务架构，实现零用户成本的智能对话
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SpecSpriteService } from './core/spec-sprite-service.js';
import type { GeneratePRDInput, GeneratePRDOutput } from './core/types.js';

// 服务器配置
const SERVER_CONFIG = {
  name: 'specsprite-mcp',
  version: '1.0.0',
  description: 'VibeGen 需求精灵 - 智能PRD生成服务'
};

// 创建 MCP 服务器
const server = new McpServer({
  name: SERVER_CONFIG.name,
  version: SERVER_CONFIG.version
});

// 初始化核心服务
const specSpriteService = new SpecSpriteService(server);

// ============ MCP 工具注册 ============

/**
 * 主工具：generate_prd
 * 智能生成产品需求文档，支持多轮对话和上下文理解
 */
server.registerTool(
  'generate_prd',
  {
    title: '智能PRD生成器',
    description: '通过智能对话生成完整的产品需求文档 (PRD)，支持多轮澄清和专家建议',
    inputSchema: {
      user_input: z.string()
        .min(5, '用户输入至少需要5个字符')
        .max(2000, '用户输入不能超过2000个字符')
        .describe('用户对项目的需求描述'),
      session_id: z.string()
        .optional()
        .describe('可选的会话ID，用于多轮对话延续'),
      continue_conversation: z.boolean()
        .optional()
        .default(false)
        .describe('是否继续现有对话（而非开始新对话）')
    }
  },
  async ({ user_input, session_id, continue_conversation = false }) => {
    try {
      console.error(`🎯 SpecSprite 处理用户请求: "${user_input.substring(0, 50)}..."`);
      
      const input: GeneratePRDInput = {
        user_input,
        session_id,
        continue_conversation
      };

      const result = await specSpriteService.processUserInput(input);
      
      // 构建用户友好的响应
      const responseText = buildUserResponse(result);
      
      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };

    } catch (error) {
      console.error('❌ SpecSprite 处理失败:', error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **处理失败**\n\n${error instanceof Error ? error.message : '未知错误'}\n\n请尝试重新描述您的需求。`
        }]
      };
    }
  }
);

/**
 * 辅助工具：continue_conversation
 * 用于复杂多轮对话的延续
 */
server.registerTool(
  'continue_conversation',
  {
    title: '对话延续',
    description: '继续现有的需求澄清对话',
    inputSchema: {
      session_id: z.string().describe('要继续的会话ID'),
      user_response: z.string().describe('用户的回复内容')
    }
  },
  async ({ session_id, user_response }) => {
    try {
      console.error(`💬 继续会话 ${session_id}: "${user_response.substring(0, 30)}..."`);
      
      const result = await specSpriteService.processUserInput({
        user_input: user_response,
        session_id,
        continue_conversation: true
      });

      const responseText = buildUserResponse(result);
      
      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };

    } catch (error) {
      console.error('❌ 对话延续失败:', error);
      
      return {
        content: [{
          type: 'text',
          text: `❌ **对话延续失败**\n\n${error instanceof Error ? error.message : '未知错误'}`
        }]
      };
    }
  }
);

/**
 * 调试工具：get_session_info
 * 获取会话状态信息（开发调试用）
 */
server.registerTool(
  'get_session_info',
  {
    title: '会话信息查看',
    description: '查看指定会话的详细状态信息（调试用）',
    inputSchema: {
      session_id: z.string().describe('会话ID')
    }
  },
  async ({ session_id }) => {
    try {
      const sessionInfo = specSpriteService.getSessionInfo(session_id);
      
      if (!sessionInfo) {
        return {
          content: [{
            type: 'text',
            text: `❌ 未找到会话: ${session_id}`
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: `📊 **会话信息**\n\n${sessionInfo}`
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ 获取会话信息失败: ${error instanceof Error ? error.message : '未知错误'}`
        }]
      };
    }
  }
);

// ============ 辅助函数 ============

/**
 * 构建用户友好的响应文本
 */
function buildUserResponse(result: GeneratePRDOutput): string {
  switch (result.type) {
    case 'conversation':
      return buildConversationResponse(result);
    
    case 'clarification':
      return buildClarificationResponse(result);
    
    case 'prd':
      return buildPRDResponse(result);
    
    default:
      return `🤖 **SpecSprite 回复**\n\n${result.content.message || '继续描述您的项目需求吧！'}`;
  }
}

function buildConversationResponse(result: GeneratePRDOutput): string {
  const { content } = result;
  let response = `🧠 **需求精灵 SpecSprite**\n\n`;
  
  if (content.message) {
    response += `${content.message}\n\n`;
  }

  if (content.questions && content.questions.length > 0) {
    response += `**澄清问题**:\n`;
    content.questions.forEach((q, i) => {
      response += `${i + 1}. ${q}\n`;
    });
    response += '\n';
  }

  if (content.suggestions && content.suggestions.length > 0) {
    response += `**建议**:\n`;
    content.suggestions.forEach((s, i) => {
      response += `• ${s}\n`;
    });
    response += '\n';
  }

  response += `💡 *会话ID: ${result.session_id}*\n`;
  response += `📝 使用 \`continue_conversation\` 工具继续对话`;

  return response;
}

function buildClarificationResponse(result: GeneratePRDOutput): string {
  const { content } = result;
  let response = `🔍 **需要澄清**\n\n`;
  
  if (content.message) {
    response += `${content.message}\n\n`;
  }

  if (content.questions && content.questions.length > 0) {
    response += `**请回答以下问题**:\n`;
    content.questions.forEach((q, i) => {
      response += `${i + 1}. ${q}\n`;
    });
    response += '\n';
  }

  response += `💡 *会话ID: ${result.session_id}*`;

  return response;
}

function buildPRDResponse(result: GeneratePRDOutput): string {
  const { content } = result;
  
  if (!content.prd) {
    return `❌ PRD 生成失败：缺少PRD数据`;
  }

  const prd = content.prd;
  
  let response = `✅ **PRD 生成完成！**\n\n`;
  
  response += `# ${prd.metadata.name}\n\n`;
  response += `**项目类型**: ${prd.project.type}\n`;
  response += `**置信度**: ${prd.metadata.confidence_score}%\n`;
  response += `**生成时间**: ${prd.metadata.generated_at}\n\n`;
  
  response += `## 项目概述\n`;
  response += `${prd.project.description}\n\n`;
  
  response += `**目标用户**: ${prd.project.target_audience}\n\n`;
  
  response += `## 核心功能\n`;
  prd.project.key_features.forEach((feature, i) => {
    response += `${i + 1}. ${feature}\n`;
  });
  response += '\n';
  
  response += `## 技术栈\n`;
  response += `- **框架**: ${prd.tech_stack.framework}\n`;
  if (prd.tech_stack.database) {
    response += `- **数据库**: ${prd.tech_stack.database}\n`;
  }
  response += `- **UI库**: ${prd.tech_stack.ui_library}\n`;
  if (prd.tech_stack.deployment_platform) {
    response += `- **部署平台**: ${prd.tech_stack.deployment_platform}\n`;
  }
  if (prd.tech_stack.additional_tools.length > 0) {
    response += `- **其他工具**: ${prd.tech_stack.additional_tools.join(', ')}\n`;
  }
  response += '\n';
  
  response += `## 功能标志\n`;
  const enabledFeatures = Object.entries(prd.features)
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => feature);
  
  if (enabledFeatures.length > 0) {
    response += `启用: ${enabledFeatures.join(', ')}\n\n`;
  } else {
    response += `基础功能配置\n\n`;
  }
  
  response += `## 下一步行动\n`;
  prd.next_steps.forEach((step, i) => {
    response += `${i + 1}. ${step}\n`;
  });
  response += '\n';
  
  response += `---\n`;
  response += `💡 *会话ID: ${result.session_id}*\n`;
  response += `📋 PRD 已生成，可以开始项目开发了！`;

  // 如果有调试信息，添加到响应中
  if (content.debug_info) {
    response += `\n\n**调试信息**:\n`;
    response += `- 使用专家: ${content.debug_info.expert_used}\n`;
    response += `- 推理过程: ${content.debug_info.reasoning}`;
  }

  return response;
}

// ============ 服务器启动 ============

async function main() {
  try {
    console.error('🚀 启动 SpecSprite MCP 服务器...');
    console.error(`📋 服务信息: ${SERVER_CONFIG.name} v${SERVER_CONFIG.version}`);
    console.error(`🎯 ${SERVER_CONFIG.description}`);
    
    // 初始化服务
    await specSpriteService.initialize();
    console.error('✅ SpecSprite 服务初始化完成');
    
    // 启动 MCP 服务器
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('✅ SpecSprite MCP 服务器已启动，等待连接...');
    console.error('🔧 注册的工具: generate_prd, continue_conversation, get_session_info');
    
  } catch (error) {
    console.error('❌ SpecSprite 启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGINT', async () => {
  console.error('\n🛑 收到关闭信号，正在优雅关闭...');
  
  try {
    await specSpriteService.cleanup();
    console.error('✅ SpecSprite 清理完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 清理过程中出错:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.error('\n🛑 收到终止信号，正在关闭...');
  await specSpriteService.cleanup();
  process.exit(0);
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  console.error('Promise:', promise);
  process.exit(1);
});

// 启动服务器
main().catch(console.error);

export { server, specSpriteService };