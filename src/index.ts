#!/usr/bin/env node

/**
 * SpecSprite 入口文件
 * VibeGen 需求精灵 (SpecSprite) - 智能PRD生成服务
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 确保以正确的方式启动服务器
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 动态导入服务器模块
async function main() {
  try {
    await import('./server.js');
    // 服务器会在模块导入时自动执行 main 函数
  } catch (error) {
    console.error('❌ SpecSprite 启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
main().catch(console.error);

export * from './core/types.js';
export * from './core/spec-sprite-service.js';
export * from './server.js';