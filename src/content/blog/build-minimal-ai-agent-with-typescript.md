---
title: 从聊天框到 AI Agent：用 TypeScript 写一个最小工具调用循环
excerpt: 不依赖 Agent 框架，从模型决策、工具执行、状态回填和终止条件开始，拆开一个最小可用 Agent 的核心结构。
publishDate: '2026-07-16'
isFeatured: false
draft: true
series: AI Agent 实践
tags:
  - AI Agent
  - TypeScript
  - LLM
  - 工程化
seo:
  title: 从聊天框到 AI Agent：用 TypeScript 实现最小工具调用循环
  description: 不依赖 Agent 框架，用 TypeScript 拆解模型决策、工具执行、状态回填与终止条件，实现一个最小可测试的 Agent 循环。
  pageType: article
---

> 本文是《AI Agent 实践》系列第 1 篇。这个系列不从框架 API 开始，而是从一个最小循环出发，逐步把 Agent 做成可验证、可控制的真实应用。

第一次接触 AI Agent 时，我很容易把它理解成“一个会调用工具的聊天机器人”：给模型挂上搜索、数据库和发邮件工具，再补一段 system prompt，一个 Agent 好像就完成了。

真正把它放进应用以后，问题才刚开始：模型请求了不存在的工具怎么办？参数不合法怎么办？工具结果怎样交还给模型？模型一直重复同一个动作怎么办？什么时候应该停止？

这些问题与某个框架关系不大。无论使用哪一家模型、哪一种 SDK，最里面都绕不开一个循环。因此这篇先暂时放下 RAG、长期记忆、多 Agent 和复杂编排，只完成一件事：**用 TypeScript 写出一个有状态、受约束、能够终止的最小 Agent。**

## 先把 Agent 缩成一个循环

一个最小 Agent 可以概括成下面几步：

```text
用户目标
   ↓
模型判断下一步
   ├─ 已经可以回答 → 返回最终结果
   └─ 需要外部信息 → 请求调用工具
                         ↓
                      应用执行工具
                         ↓
                    结果写回上下文
                         └────→ 再次判断
```

普通聊天通常是“一次输入，一次生成”。Agent 的区别，是模型在给出最终答案前，可以根据当前状态多次选择动作。

这里最重要的不是“工具调用”四个字，而是一个**有状态、受约束、能够终止的决策循环**。模型负责提出下一步，应用代码负责判断这一步是否存在、是否合法、能否执行。

我更愿意把它写成下面这个公式：

> Agent = 模型 + 工具 + 状态 + 循环 + 约束

少了循环，它更像带函数调用的聊天；少了约束，它就可能变成一个不稳定、不可控的自动化脚本。

## 先分清聊天、工作流和 Agent

这三个概念经常被混在一起：

- **聊天机器人**根据上下文生成回答，执行路径通常很短。
- **工作流**由代码提前确定步骤，例如“读取订单 → 检查状态 → 退款 → 通知”。
- **Agent**接收目标，下一步动作由模型结合当前状态动态选择。

Agent 的价值是处理无法完全预先枚举的路径，但并不意味着所有 AI 功能都应该变成 Agent。如果步骤固定、规则明确、错误成本高，普通函数或状态机通常更便宜，也更可靠。

在动手之前，我会先问：

> 这个任务真的需要模型决定下一步吗？

如果答案是否定的，就没有必要为了“Agent”这个名字引入额外不确定性。下一篇会专门讨论工作流、RAG 与 Agent 的边界，这里先把注意力放回最小循环。

## 定义模型与应用之间的协议

先不绑定任何模型厂商，只定义应用真正需要的类型。模型每轮只能做两件事：直接回答，或者请求调用一个工具。

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

type ModelDecision = { kind: 'answer'; content: string } | { kind: 'tool'; call: ToolCall };

type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCall?: ToolCall }
  | {
      role: 'tool';
      callId: string;
      name: string;
      content: string;
    };

interface ModelAdapter {
  next(input: { messages: Message[]; tools: ToolDefinition[]; signal: AbortSignal }): Promise<ModelDecision>;
}
```

`ModelAdapter` 是模型 SDK 与业务代码之间的隔离层。不同厂商的工具调用格式、流式事件和错误对象都不一样，但进入 Agent 运行器之前，统一转换成 `ModelDecision`。

这个适配层带来两个好处：

1. 更换模型时，不需要重写 Agent 循环。
2. 测试时可以使用一个按脚本返回结果的假模型，不必真的请求 API。

工具也要区分“给模型看的定义”和“应用实际执行的函数”：

```typescript
interface Tool {
  definition: ToolDefinition;
  execute(input: unknown, signal: AbortSignal): Promise<unknown>;
}
```

模型只能看到名称、说明和参数结构，拿不到函数本身，更不应该绕开应用直接执行代码。

## 给运行过程建立事件

如果运行器只有一个最终返回值，出了问题时很难判断它卡在哪一步。即使是最小实现，我也会先定义几个事件：

```typescript
type AgentEvent =
  | { type: 'model.started'; step: number }
  | { type: 'tool.started'; step: number; call: ToolCall }
  | { type: 'tool.completed'; step: number; callId: string }
  | { type: 'tool.failed'; step: number; callId: string; error: string }
  | { type: 'run.completed'; step: number; answer: string }
  | { type: 'run.failed'; step: number; reason: string };
```

这些事件以后既可以写入日志，也可以通过 SSE 推给前端。更重要的是，它们让“模型正在思考”这种模糊状态，变成“第几步、正在调用什么、执行是否成功”的可观察事实。

这里展示的是动作摘要，不是模型隐藏的思维链。用户需要知道系统做了什么，不需要看到模型内部生成的所有推理文本。

## 写出核心循环

下面是一个刻意保持简单的运行器：

```typescript
interface RunAgentOptions {
  model: ModelAdapter;
  tools: Tool[];
  maxSteps?: number;
  timeoutMs?: number;
  onEvent?: (event: AgentEvent) => void;
}

export async function runAgent(goal: string, { model, tools, maxSteps = 8, timeoutMs = 30_000, onEvent = () => undefined }: RunAgentOptions) {
  const messages: Message[] = [{ role: 'user', content: goal }];
  const toolMap = new Map(tools.map((tool) => [tool.definition.name, tool]));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let step = 1; step <= maxSteps; step += 1) {
      onEvent({ type: 'model.started', step });

      const decision = await model.next({
        messages,
        tools: tools.map((tool) => tool.definition),
        signal: controller.signal
      });

      if (decision.kind === 'answer') {
        onEvent({
          type: 'run.completed',
          step,
          answer: decision.content
        });

        return {
          status: 'completed' as const,
          answer: decision.content,
          steps: step,
          messages
        };
      }

      const { call } = decision;
      const tool = toolMap.get(call.name);

      messages.push({
        role: 'assistant',
        content: '',
        toolCall: call
      });

      if (!tool) {
        const error = `未知工具：${call.name}`;
        messages.push({
          role: 'tool',
          callId: call.id,
          name: call.name,
          content: JSON.stringify({ ok: false, error })
        });
        onEvent({ type: 'tool.failed', step, callId: call.id, error });
        continue;
      }

      onEvent({ type: 'tool.started', step, call });

      try {
        const output = await tool.execute(call.arguments, controller.signal);
        messages.push({
          role: 'tool',
          callId: call.id,
          name: call.name,
          content: JSON.stringify({ ok: true, data: output })
        });
        onEvent({ type: 'tool.completed', step, callId: call.id });
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : '工具执行失败';
        messages.push({
          role: 'tool',
          callId: call.id,
          name: call.name,
          content: JSON.stringify({ ok: false, error })
        });
        onEvent({ type: 'tool.failed', step, callId: call.id, error });
      }
    }

    const reason = `超过最大步骤数 ${maxSteps}`;
    onEvent({ type: 'run.failed', step: maxSteps, reason });
    return { status: 'failed' as const, reason, messages };
  } catch (cause) {
    const reason = controller.signal.aborted ? `运行超过 ${timeoutMs}ms，已取消` : cause instanceof Error ? cause.message : 'Agent 运行失败';

    onEvent({ type: 'run.failed', step: 0, reason });
    return { status: 'failed' as const, reason, messages };
  } finally {
    clearTimeout(timer);
  }
}
```

代码本身并不神秘，关键是控制权在哪里：

- 模型只能返回回答或工具请求。
- 工具必须从应用注册表中查找。
- 工具由应用执行，结果再以普通消息返回模型。
- 最大步骤和总超时由运行器决定。
- 每一步都产生事件，失败也会成为下一轮可见的状态。

模型提出动作，不等于动作已经获得执行权。

## 用两个只读工具跑通一次任务

假设后面要做一个数据分析 Agent，第一版只给它两个只读能力：查看数据集字段，以及执行已经通过校验的聚合配置。

```typescript
const listDatasetFields: Tool = {
  definition: {
    name: 'list_dataset_fields',
    description: '读取当前数据集的字段名称和类型，不返回原始数据',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  async execute() {
    return [
      { name: '月份', type: 'date' },
      { name: '渠道', type: 'string' },
      { name: '销售额', type: 'number' }
    ];
  }
};

const runPivot: Tool = {
  definition: {
    name: 'run_pivot',
    description: '使用字段、聚合方式和筛选条件执行本地透视计算',
    inputSchema: {
      type: 'object',
      required: ['rows', 'measures'],
      properties: {
        rows: { type: 'array', items: { type: 'string' } },
        measures: { type: 'array', items: { type: 'object' } }
      },
      additionalProperties: false
    }
  },
  async execute(input) {
    // 真正项目里还要先做结构校验和字段语义校验。
    return calculatePivot(input);
  }
};
```

当用户问“按渠道统计销售额”时，一次合理轨迹可能是：

```text
第 1 步：list_dataset_fields
第 2 步：run_pivot({ rows: ['渠道'], measures: [...] })
第 3 步：根据工具返回的聚合结果生成回答
```

这已经具备 Agent 的基本形态：模型没有被写死必须先调用哪一个工具，而是根据当前信息决定下一步；应用仍然掌握字段访问、计算和终止权。

## 为什么必须设置终止条件

最小循环也不能只写一个无条件的 `while (true)`。至少要处理四类终止：

1. 模型已经返回最终回答。
2. 达到最大步骤数。
3. 超过总耗时或用户主动取消。
4. 检测到没有进展的重复调用。

上面的实现已经覆盖前三类。对于重复调用，可以把工具名和规范化后的参数组成指纹：

```typescript
function createCallFingerprint(call: ToolCall) {
  return `${call.name}:${stableStringify(call.arguments)}`;
}
```

同一个指纹连续出现两三次，而且工具结果没有变化时，继续循环通常不会产生新信息。运行器可以直接停止，也可以向模型返回一个明确错误，让它改用其他方案。

需要注意，`JSON.stringify` 不能稳定处理对象键顺序，真实实现应先排序键、裁剪无意义字段，再生成指纹。

## 错误应该回到状态里，而不是消失

工具失败后有两种极端做法：直接让整个运行崩溃，或者悄悄重试到成功。两者都不够好。

对于“字段不存在”“没有匹配数据”这类业务错误，可以将结构化错误写回上下文，让模型决定是换参数还是向用户澄清：

```json
{
  "ok": false,
  "error": {
    "code": "FIELD_NOT_FOUND",
    "message": "数据集中不存在字段：客户等级",
    "retryable": false
  }
}
```

对于网络闪断、临时限流等错误，可以由运行器按明确策略重试。至于权限拒绝、参数错误和高风险操作未确认，不应该依靠模型反复尝试绕过去。

错误分类、重试和幂等会在工具设计一篇中展开，这里先记住：**失败同样是 Agent 状态的一部分。**

## 最小 Agent 也应该能测试

如果核心循环依赖真实模型，每次测试都要花时间和费用，而且结果会波动。`ModelAdapter` 的价值在这里就体现出来了：测试可以给它一段固定脚本。

```typescript
const decisions: ModelDecision[] = [
  {
    kind: 'tool',
    call: {
      id: 'call-1',
      name: 'list_dataset_fields',
      arguments: {}
    }
  },
  {
    kind: 'answer',
    content: '当前数据集包含月份、渠道和销售额字段。'
  }
];
```

然后断言：

- 工具是否只执行了一次。
- 工具结果是否以相同 `callId` 回填。
- 最终状态是否为 `completed`。
- 模型连续请求未知工具时，是否会被 `maxSteps` 截断。
- `AbortSignal` 触发后，工具是否能够停止。

这类测试不判断模型聪不聪明，只验证运行器的确定性规则。模型能力和任务完成率要放到评测集里单独验证。

## 这个最小实现还缺什么

到这里，我们只是搭起了骨架。离真正可用还缺少很多东西：

- 如何判断一个需求该用工作流、RAG 还是 Agent。
- 如何把自然语言转换成可校验的领域计划。
- 如何验证工具参数与输出，并设计错误和重试协议。
- 如何保存运行状态，支持暂停、取消和恢复。
- 如何处理写操作、权限和外部内容中的提示注入。
- 如何记录轨迹并建立稳定的回归评测。

后面的七篇会逐一补上这些部分，并把同一个循环接入一个本地数据分析场景。

## 最后

Agent 并不是一个神秘的新运行时。拆开来看，它仍然由输入、状态、函数调用、错误处理和权限控制组成，只是“下一步做什么”有一部分交给了模型决定。

这种动态决策带来了灵活性，也带来了不确定性。工程上真正重要的，不是让 Agent 拥有尽可能多的工具，而是让它在有限权限、有限步骤和可观察的环境里完成明确目标。

如果只保留一句话，我会这样总结：

> 让模型负责提出下一步，让代码负责决定这一步能不能执行。

下一篇：[不是所有 AI 功能都需要 Agent：工作流、RAG 与 Agent 如何选](/blog/choose-workflow-rag-or-agent/)。
