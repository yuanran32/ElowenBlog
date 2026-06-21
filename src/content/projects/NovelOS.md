---
title: NovelOS AI 小说创作工作台
description: 面向小说创作的 AI 辅助工具。负责前端创作工作台，实现实时生成事件流、服务端状态管理和从设定到章节的完整创作闭环。
publishDate: '2026-05-10'
isFeatured: true
techStack:
  - React 19
  - TypeScript
  - Vite
  - React Router
  - TanStack Query
  - React Hook Form
  - Zod
  - SSE
  - OpenAPI
githubUrl: 'https://github.com/fishimei/NovelOS'
role: 前端开发
defaultHighlight: false
highlights:
  - 封装通用 SSE Hook 统一管理连接生命周期、事件监听和异常状态，实现 AI 正文增量预览
  - 基于 TanStack Query 管理服务端状态，针对剧情推进、设定应用等写操作设计缓存失效策略
  - 串联种子构想、设定讨论、草稿生成、剧情推进到章节裁切的完整 AI 创作工作流
  - 对齐 OpenAPI 维护前端类型契约，建模 Story Run、Timeline Branch、Tick、Memory Patch 等复杂结构
seo:
  title: NovelOS AI 小说创作工作台
  description: NovelOS 是一个 AI 辅助小说创作工具，负责前端创作工作台，实现 SSE 实时事件流、TanStack Query 状态管理和从设定到章节的完整闭环。
---

## 项目背景

NovelOS 是一个面向小说创作场景的 AI 辅助写作工具。它不只是让 AI 续写文本，而是帮助作者把模糊灵感逐步整理成世界设定、角色关系、故事章节和长期记忆。项目中我负责前端创作工作台的全部开发。

## 重难点与解决方案

### 1. 实时生成事件流 — SSE 通用封装

AI 长文本生成需要把服务端推送的增量内容实时渲染到页面，同时还要处理角色回合切换、剧情变量变更等结构化事件。如果每个页面各自裸写 `EventSource`，连接生命周期和异常恢复会散落各处，难以维护。

**方案**：封装通用 `useSSE` Hook，统一处理：

- 连接建立、关闭、超时和错误重连
- 具名事件监听与 JSON 自动解析
- 在剧情工作台中解析 `draft_delta`（增量正文）、角色回合边界、剧情变量更新等事件
- 实现 AI 正文增量预览和生成过程可视化，让用户感知生成进度而非面对空白 loading

### 2. 服务端状态管理 — TanStack Query 缓存策略

项目涉及项目、角色、关系、章节、时间线和运行结果等多类服务端状态。AI 创作中有大量写操作（剧情推进、设定应用、章节裁切），写完后相关联的列表和详情必须反映最新数据，单纯手动 `refetch` 容易遗漏，导致页面间数据不一致。

**方案**：基于 TanStack Query 管理全部服务端状态：

- 按资源类型划分 queryKey 层级（`['project', id]` → `['project', id, 'chapters']` → `['chapter', chapterId]`）
- 针对写操作设计缓存失效策略：剧情推进后失效相关章节列表和运行结果、设定应用后失效角色/关系缓存、章节裁切后失效时间线
- 通过 `onMutate` 乐观更新 + `onSettled` 兜底失效，兼顾交互响应速度和数据一致性

### 3. AI 创作流程编排

创作流程跨越多个阶段：初始想法 → 设定讨论 → 结构化草稿 → 剧情推进 → 审校 → 章节裁切。每个阶段的输入依赖上一阶段的产出，中途可能回退重试。

**方案**：设计流程工作台，以管线模型串联各阶段：

- 种子构想 → 设定讨论 → 结构化草稿生成 → 剧情推进 → 审校结果展示 → 章节裁切
- 每个阶段有独立的状态模型（`idle` / `loading` / `success` / `error`），支持单阶段重试而不丢失已完成阶段的成果
- 草稿与正式内容严格分离 — AI 产出先进入草稿区，用户确认后才应用，避免生成内容污染正式项目状态

### 4. 复杂类型建模与接口契约

后端领域模型复杂：Project、Character、Relationship、Story Run、Timeline Branch、Tick、Memory Patch 等，且接口仍在快速迭代。前后端字段不一致会导致难以排查的运行时错误。

**方案**：

- 对齐后端 OpenAPI 文档维护前端类型定义，将 schema 作为类型契约而非文档注释
- 对 Story Run（一次创作会话的完整状态）、Timeline Branch（时间线分叉）、Tick（故事时间粒度推进）、Memory Patch（角色记忆增量更新）等核心概念建立独立类型
- 接口字段变更时 TypeScript 编译报错，在开发阶段即暴露问题，而非上线后排查

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19、TypeScript |
| 构建 | Vite |
| 路由 | React Router |
| 状态管理 | TanStack Query |
| 表单/校验 | React Hook Form、Zod |
| 实时通信 | SSE（EventSource） |
| 接口契约 | OpenAPI |
| 后端（协作） | Go、Gin、PostgreSQL |
