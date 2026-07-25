---
title: Agent 前端不只是一个聊天框：状态、事件流、取消与恢复
excerpt: 长任务需要明确状态机、结构化事件和持久化运行记录；流式文本只是传输表现，不应该成为 Agent 状态的唯一来源。
publishDate: '2026-07-21'
isFeatured: false
draft: true
series: AI Agent 实践
tags:
  - AI Agent
  - 前端
  - SSE
  - 状态管理
seo:
  title: AI Agent 前端设计：状态机、SSE 事件流、取消与恢复
  description: 设计可理解、可取消、可恢复的 Agent 前端，拆分持久化运行状态与 SSE 传输，使用结构化事件驱动进度、审批和结果界面。
  pageType: article
---

> 本文是《AI Agent 实践》系列第 6 篇。上一篇完成了[本地数据分析 Agent](/blog/build-local-data-analysis-agent/)，这一篇把视角转向用户真正接触的运行过程。

很多 AI 应用的界面都是从聊天框开始的：用户输入一句话，页面显示一个 Loading，模型开始流式吐字，最后出现答案。

短回答这样做没有问题，但 Agent 往往会经历规划、工具调用、等待确认、本地计算和报告生成。一次任务可能持续几十秒，甚至跨越刷新、断网和重新登录。如果前端仍然只有“正在生成”和“生成完成”两个状态，用户很快会遇到这些困惑：

- 它现在是在工作，还是已经卡住？
- 为什么长时间没有文字输出？
- 我点取消以后，后台真的停了吗？
- 页面刷新后，刚才的任务去了哪里？
- 某一步失败，为什么必须从头再来？
- 这段结论是模型猜的，还是工具算出来的？

Agent 前端的核心不是把聊天气泡做得更漂亮，而是让一个不确定的长任务变得**可理解、可控制、可恢复**。

## 先把“消息”和“运行”分开

聊天消息与 Agent 运行不是同一个数据模型。

一条用户消息可能创建一次运行，一次运行可能产生十几个事件、多个工具调用和一个待确认动作。最终回答只是运行的一个输出。

可以先定义顶层实体：

```typescript
type RunStatus = 'queued' | 'planning' | 'running' | 'waiting_confirmation' | 'waiting_user_input' | 'cancelling' | 'completed' | 'failed' | 'cancelled';

interface AgentRun {
  runId: string;
  conversationId: string;
  goal: string;
  status: RunStatus;
  currentStep?: string;
  createdAt: string;
  updatedAt: string;
  datasetRevision?: number;
  result?: RunResultSummary;
  error?: RunError;
}
```

而聊天消息只负责表达用户和系统之间的可见交流：

```typescript
interface ConversationMessage {
  messageId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  runId?: string;
  createdAt: string;
}
```

这样即使报告尚未生成，前端也可以展示这次运行已经完成哪些动作；同一段对话里还可以保留多次运行，而不是不断修改最后一个气泡。

## 用状态机表达允许发生什么

如果组件里散落着 `isLoading`、`isStreaming`、`needsApproval`、`hasError` 和 `isCancelled`，很容易出现互相矛盾的组合，例如既显示取消按钮，又显示已经完成。

状态机更适合表达互斥状态和合法转换：

```text
queued
  → planning
  → running
      ├─ waiting_user_input → running
      ├─ waiting_confirmation → running
      ├─ cancelling → cancelled
      ├─ failed
      └─ completed
```

可以把转换写成明确规则：

```typescript
const allowedTransitions: Record<RunStatus, RunStatus[]> = {
  queued: ['planning', 'cancelled', 'failed'],
  planning: ['running', 'waiting_user_input', 'waiting_confirmation', 'cancelling', 'failed'],
  running: ['waiting_user_input', 'waiting_confirmation', 'cancelling', 'completed', 'failed'],
  waiting_confirmation: ['running', 'cancelling', 'cancelled', 'failed'],
  waiting_user_input: ['running', 'cancelling', 'cancelled', 'failed'],
  cancelling: ['cancelled', 'failed'],
  completed: [],
  failed: [],
  cancelled: []
};
```

收到服务端事件时先验证转换。一个已经 `completed` 的运行又收到 `running`，说明事件乱序、重复或服务端状态有问题，不应直接让 UI 倒退。

状态机并不会消灭异常，但能让异常被发现，而不是被一组布尔值悄悄掩盖。

## 流式传输不等于运行状态

SSE 很适合把模型增量文本和结构化事件推给浏览器。我在 [NovelOS AI 小说创作工作台](/projects/novelos/) 这类长文本场景里，也需要同时处理正文增量、角色回合边界和运行状态。

但 SSE 只是传输通道，不应该成为运行状态的唯一存储。

如果服务端只在内存里不断推送事件：

```text
浏览器断开 → 中间事件丢失 → 页面不知道任务是否还在运行
```

更稳妥的方式是：

```text
服务端先持久化状态或事件
          ↓
再通过 SSE 通知浏览器
          ↓
浏览器断线后按 runId 重新获取快照
          ↓
从 lastEventId 继续订阅增量
```

前端至少需要两个接口概念：

```text
GET /runs/:runId          获取当前权威快照
GET /runs/:runId/events   订阅后续事件
```

SSE 连接断开后，界面不应该立刻把任务标记为失败。连接状态和任务状态是两回事：

- `connection = disconnected`
- `run.status = running`

前端可以显示“连接中断，正在恢复进度”，并重新拉取运行快照。

## 设计结构化事件，而不是解析文案

不要根据“正在查询数据……”这种文案判断工具是否开始。展示文案会修改、会国际化，也可能来自模型，不适合作为程序状态。

事件应拥有稳定类型：

```typescript
type AgentRunEvent =
  | {
      eventId: string;
      type: 'run.status_changed';
      runId: string;
      status: RunStatus;
      occurredAt: string;
    }
  | {
      eventId: string;
      type: 'plan.ready';
      runId: string;
      plan: PlanSummary;
      occurredAt: string;
    }
  | {
      eventId: string;
      type: 'tool.started';
      runId: string;
      callId: string;
      toolName: string;
      displayName: string;
      occurredAt: string;
    }
  | {
      eventId: string;
      type: 'tool.completed';
      runId: string;
      callId: string;
      resultSummary: string;
      occurredAt: string;
    }
  | {
      eventId: string;
      type: 'report.delta';
      runId: string;
      sequence: number;
      text: string;
      occurredAt: string;
    }
  | {
      eventId: string;
      type: 'confirmation.requested';
      runId: string;
      approval: ApprovalView;
      occurredAt: string;
    };
```

`tool.started` 展示的是用户可理解的动作摘要，例如“正在按月份和渠道聚合销售额”，而不是模型完整推理。后端或运行器应提供经过审查的 `displayName`，不要直接把任意模型文本当成可信 HTML 渲染。

## 用 reducer 从事件还原视图

事件进入前端后，可以由一个纯 reducer 更新运行视图：

```typescript
interface RunViewState {
  run: AgentRun;
  steps: RunStepView[];
  reportText: string;
  lastSequence: number;
  pendingApproval?: ApprovalView;
}

function reduceRunEvent(state: RunViewState, event: AgentRunEvent): RunViewState {
  switch (event.type) {
    case 'run.status_changed':
      return {
        ...state,
        run: {
          ...state.run,
          status: event.status,
          updatedAt: event.occurredAt
        }
      };

    case 'tool.started':
      return {
        ...state,
        steps: [
          ...state.steps,
          {
            id: event.callId,
            label: event.displayName,
            status: 'running'
          }
        ]
      };

    case 'report.delta':
      if (event.sequence <= state.lastSequence) return state;
      return {
        ...state,
        reportText: state.reportText + event.text,
        lastSequence: event.sequence
      };

    case 'confirmation.requested':
      return {
        ...state,
        pendingApproval: event.approval
      };

    default:
      return state;
  }
}
```

纯 reducer 有几个优点：

- 可以用固定事件序列复现 UI 问题。
- 乱序和重复事件有明确处理位置。
- SSE、WebSocket、Worker 或本地回放都能复用。
- 不需要为了测试而启动真实模型。

如果事件量很大，可以定期保存快照，页面恢复时加载“最近快照 + 后续事件”，不必从第一条开始重放。

## 增量文本要处理顺序和重复

流式输出不能简单执行 `setText((value) => value + delta)`。断线重连、代理重试或多连接都可能让增量重复。

每个文本片段至少带一个单调递增的 `sequence`：

```typescript
interface TextDelta {
  runId: string;
  streamId: string;
  sequence: number;
  text: string;
}
```

前端只接收比当前序号大的片段。如果发现序号跳跃，例如从 12 直接到 15，不应猜测缺失内容，可以重新获取当前报告快照。

另一个细节是渲染频率。模型可能每几十毫秒推送一个小片段，如果每条都触发完整 Markdown 解析，长文本会明显卡顿。可以在 `requestAnimationFrame` 或 30～50ms 窗口内批量合并，再更新 UI。

流结束后用服务端最终结果替换临时拼接文本，保证断线和重复处理后仍与权威状态一致。

## 进度应该来自真实阶段

模型生成无法准确给出“已经完成 63%”，所以不要制造虚假百分比。更适合展示阶段和已完成动作：

```text
✓ 已识别 8 个可用字段
✓ 已生成分析方案
✓ 已完成 1,020,341 行本地聚合
● 正在整理结论
```

数据计算阶段如果确实知道 `processedRows / totalRows`，可以展示真实百分比；模型规划和生成阶段则展示不确定进度状态。

一次 Agent 运行的界面可以拆成：

1. **任务头部**：目标、状态、耗时、取消或重试入口。
2. **计划卡片**：将要使用的字段、筛选和指标。
3. **执行时间线**：工具动作、成功或失败摘要。
4. **确认区**：待执行写操作的结构化预览。
5. **结果区**：报告、图表和事实引用。
6. **诊断信息**：仅在需要时展开，不默认暴露内部细节。

聊天仍然可以作为入口，但不是唯一的信息结构。

## 取消要区分“已请求”和“已完成”

用户点击取消时，前端不应该立刻把状态改成 `cancelled`。取消请求可能失败，底层工具也可能需要时间释放资源。

更准确的状态变化是：

```text
running
  → cancelling
  → cancelled
```

客户端发送：

```text
POST /runs/:runId/cancel
```

服务端完成以下动作后再确认取消：

- 中止后续模型请求。
- 向当前工具传递 `AbortSignal`。
- 撤销尚未执行的排队任务。
- 标记不能取消的外部任务，并等待最终回执。
- 持久化 `cancelled` 状态和原因。

如果某个写操作已经完成，取消不能把历史事实改成“未发生”。界面应显示“后续步骤已取消，邮件已在取消前发送”，而不是统一显示任务已取消。

## 重试应该从明确边界开始

“重试整个 Agent”很容易重复昂贵计算，甚至重复写操作。更好的做法是保存每一步的输入、输出和回执，并针对失败类型决定恢复点。

例如：

```text
计划成功
  → 本地计算成功
  → 报告生成失败
```

此时重试 Reporter 即可，不需要重新解析文件、生成计划和计算聚合。

可以给步骤建模：

```typescript
interface RunStepRecord {
  stepId: string;
  kind: 'planning' | 'tool' | 'reporting';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  inputRef?: string;
  outputRef?: string;
  idempotencyKey?: string;
  retryCount: number;
}
```

只有输入仍然有效、上游版本没有变化、步骤满足重试策略时，才允许从该点恢复。

## 页面刷新后如何恢复

刷新恢复可以遵循固定流程：

```text
1. 路由或本地缓存中找到 runId
2. 请求运行快照
3. 渲染当前状态和已完成步骤
4. 如果仍在运行，携带 lastEventId 建立 SSE
5. 收到增量事件后继续 reducer
6. 运行结束后拉取最终权威结果
```

浏览器不应该把完整敏感工具结果长期存进 `localStorage`。本地只保留必要标识和非敏感视图缓存，权威状态放在服务端，或者对于纯本地 Agent 放进带版本管理的 IndexedDB。

如果任务完全在本地 Worker 中运行，刷新会直接终止 Worker。这种情况下要么明确告诉用户“关闭页面会停止任务”，要么把可恢复的输入和中间状态持久化，重新打开后从安全检查点启动。

## 不要展示隐藏思维链

为了让 Agent 看起来透明，有些界面会直接展示模型的完整“思考过程”。这不是可靠的解释方式：它可能冗长、不稳定，也可能包含系统提示、隐私信息或与最终动作无关的内容。

用户真正需要的是：

- 系统采用了什么计划。
- 调用了哪些工具。
- 使用了哪些字段和筛选条件。
- 哪一步失败，能否重试。
- 最终结论引用了哪些事实。

因此界面应该展示**结构化动作和证据**，而不是隐藏推理文本。可解释性来自可验证记录，不来自一段看似合理的内心独白。

## 前端测试应该覆盖哪些路径

Agent 前端很适合使用事件序列测试：

### reducer 单测

- 重复 `report.delta` 不会重复拼接。
- 已完成运行不能回退到 `running`。
- 不属于当前 `runId` 的事件被忽略。
- 收到确认请求后进入正确状态。

### 组件测试

- `waiting_confirmation` 显示计划预览和确认按钮。
- `cancelling` 时按钮禁用并显示真实提示。
- 工具失败时展示可恢复入口，而不是丢失已有结果。
- 引用点击后展开对应事实。

### E2E

- SSE 中断后重新连接并恢复进度。
- 页面刷新后找回正在运行的任务。
- 快速发起两次分析时，旧结果不会覆盖新任务。
- 取消长计算后，Worker 确实停止。
- 报告阶段失败后只重试报告，不重复计算。

测试重点不是动画是否流畅，而是用户看到的状态是否与真实运行一致。

## 最后

一个可用的 Agent 前端，需要同时处理三种时间尺度：

- 毫秒级的流式文本与进度事件。
- 秒到分钟级的工具和模型任务。
- 跨刷新、断线甚至重新登录的持久化运行。

聊天消息只能覆盖其中一小部分。把消息、运行、步骤和事件分开建模之后，取消、恢复、确认和重试才有清晰落点。

用户不需要看到模型的全部思考，但应该始终知道：系统正在做什么、依据是什么、现在能采取什么动作。

下一篇会处理其中风险最高的动作：[人始终握着方向盘：澄清、预览、确认与安全边界](/blog/human-in-the-loop-agent-security/)。
