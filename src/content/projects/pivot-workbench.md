---
title: AI 数据透视分析工作台
description: 自研前端透视分析引擎，支持 CSV/Excel 导入、多维聚合、Worker 异步计算和 AI Agent 自然语言分析，形成完整本地数据分析闭环。
publishDate: '2026-05-01'
isFeatured: true
techStack:
  - Vue 3
  - TypeScript
  - Vite
  - ECharts
  - IndexedDB
  - Web Worker
  - Vitest
  - Playwright
githubUrl: 'https://github.com/yuanran32/pivot-workbench'
role: 独立开发
defaultHighlight: false
highlights:
  - 自研前端 Pivot Engine，支持行列维度、6 种聚合函数、多层筛选排序和总计计算
  - Web Worker 异步计算 + datasetId/requestId 任务管理，消除旧结果回写问题
  - AI Agent 闭环：自然语言 → PivotConfig → 字段校验 → 本地计算 → 报告生成，大模型做决策、本地引擎做聚合
  - Dexie/IndexedDB 缓存数据集与模板 + CSV/XLSX/PNG 导出 + Vitest/Playwright 覆盖核心链路
seo:
  title: AI 数据透视分析工作台
  description: 自研前端透视分析引擎，支持 CSV/Excel 导入、多维聚合、Web Worker 异步计算和 AI Agent 自然语言分析。
---

## 项目背景

面向本地 CSV/Excel 数据分析场景，解决手动统计、筛选和导出效率低的问题。核心理念：将透视计算留在本地浏览器完成，数据不出用户机器；同时引入 AI Agent 让非技术用户通过自然语言描述分析需求，降低数据分析门槛。

## 重难点与解决方案

### 1. 自研前端 Pivot Engine

市面上有现成的数据透视库，但大多依赖特定框架或体积庞大。自研引擎可以精确控制计算逻辑、输出格式，并与上层 UI 组件无缝衔接。

**方案**：

- 基于 `Map` 分桶实现多维度分组聚合，支持行维度、列维度独立配置
- 内置 `sum` / `count` / `avg` / `min` / `max` 五种聚合函数，支持多层筛选、排序和行列总计
- 将 CSV/Excel 原始数据经过「字段类型推断 → 维度配置 → 分桶聚合 → 透视矩阵」四步转换为可视化结果
- 对手机号、编号、id、code、前导 0 等业务字段做字符串保留，避免 `xlsx` 自动转数字导致精度丢失

### 2. Worker 异步计算与任务竞态处理

对万行级以上数据做透视聚合会阻塞主线程，导致页面卡顿。但把计算扔到 Worker 后，又引入新问题：用户快速切换数据源或连续修改配置时，旧 Worker 任务的结果可能晚于新任务返回，覆盖掉正确的最新结果。

**方案**：

- 将透视计算迁移至 Web Worker，释放主线程交互
- 设计 `datasetId + requestId` 双标识任务管理：每次数据切换分配新 `datasetId`，每次配置变更递增 `requestId`
- Worker 返回时校验标识是否仍为最新 — `datasetId` 不匹配说明数据已切换，`requestId` 过期说明配置已变更，直接丢弃旧结果
- 保障"快速连续操作 → 只展示最后一次结果"的交互一致性

### 3. AI Agent 分析闭环

如果让大模型直接根据用户问题生成数据结论，模型会因为看不到真实数据而胡编数字。需要一种架构让 AI 负责"理解需求、制定方案、解读结果"，而真实计算严格由本地引擎执行。

**方案**：设计「自然语言需求 → PivotConfig → 字段校验 → 本地计算 → 报告生成」Agent 流程：

- 大模型根据用户自然语言需求生成 `PivotConfig`（选择哪些行/列维度、聚合方式、筛选条件），不做任何数学计算
- 前端校验 `PivotConfig` 中的字段名是否存在于当前数据集，过滤非法字段后再提交计算
- Web Worker 执行真实透视聚合，产出的数字结果注入大模型生成的报告模板
- 大模型只负责"解释这些数字意味着什么"，源头数据完全来自本地引擎，杜绝幻觉

### 4. 工程化与结果沉淀

一次性分析不够，用户需要保存分析状态、复用模板和导出结果。

**方案**：

- 基于 Dexie/IndexedDB 实现数据集、透视配置和分析模板的持久化缓存，刷新页面后可恢复
- `localStorage` 做异常兜底 — IndexedDB 不可用时自动降级
- 支持 CSV 原始数据、XLSX 透视结果、ECharts 图表 PNG 三种导出格式
- 使用 Vitest 覆盖计算引擎核心逻辑（聚合函数、筛选排序、总计计算），Playwright 覆盖 Worker 并发竞态、Agent 恢复和导出端到端流程

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3 Composition API、TypeScript |
| 构建 | Vite |
| 可视化 | ECharts |
| 异步计算 | Web Worker |
| 本地存储 | Dexie (IndexedDB)、localStorage |
| 测试 | Vitest、Playwright |
