---
title: Agent 工具不只是函数列表：Schema、错误语义、重试与幂等
excerpt: 模型是一个不稳定的 API 调用方，工具层必须独立完成输入输出校验、权限判断、超时、错误分类、重试和幂等控制。
publishDate: '2026-07-19'
isFeatured: false
draft: true
series: AI Agent 实践
tags:
  - AI Agent
  - TypeScript
  - 工具调用
  - 工程化
seo:
  title: AI Agent 工具设计：Schema、错误语义、重试与幂等
  description: 用 TypeScript 设计可靠的 Agent 工具协议，覆盖输入输出校验、风险分级、超时取消、错误分类、有限重试与写操作幂等。
  pageType: article
---

> 本文是《AI Agent 实践》系列第 4 篇。上一篇把自然语言转换成了[可校验的领域计划](/blog/structured-agent-plan-with-typescript/)，这一篇讨论计划真正执行时，工具层应该承担什么责任。

给模型提供工具时，最简单的写法是准备一个对象：

```typescript
const tools = {
  search,
  queryDatabase,
  sendEmail
};
```

Demo 阶段这样很快，但它隐藏了一个重要事实：**模型是一个不稳定的 API 调用方。**

它可能漏参数、写错枚举、重复发送同一个请求，也可能在工具失败后选择完全不合适的重试方式。既然我们不会让一个不可信的外部客户端直接调用内部函数，也不应该因为调用方变成了模型，就放弃 API 边界。

工具层真正要解决的不是“如何把函数告诉模型”，而是：

- 模型能够看到哪些能力。
- 一次调用是否符合结构、语义和权限。
- 工具失败后，模型能否理解发生了什么。
- 哪些错误可以重试，哪些必须停止。
- 写操作重复调用时，如何避免重复副作用。

## 把工具拆成三个视角

一个工具至少有三个不同使用者：模型、运行器和真正的业务实现。

### 给模型看的能力说明

模型需要知道名称、用途、输入结构和适用边界：

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
```

工具说明不是越长越好，而是要回答：

- 什么时候应该使用它。
- 什么时候不应该使用它。
- 输入字段分别表示什么。
- 返回结果能证明什么，不能证明什么。

例如 `run_pivot` 的说明应该强调“只执行聚合，不预测未来”，避免模型因为工具名称看起来万能，就把预测需求也塞进来。

### 给运行器看的策略元数据

运行器还需要知道模型不应该决定的内容：

```typescript
type ToolRisk = 'read' | 'local_write' | 'external_write';

interface ToolPolicy {
  risk: ToolRisk;
  timeoutMs: number;
  maxRetries: number;
  idempotent: boolean;
  requiresConfirmation: boolean;
  maxOutputBytes: number;
}
```

这些字段决定调用能否执行、何时取消、是否允许自动重试。它们不应该由模型在参数里自行填写。

### 给业务代码看的执行协议

最后是实际函数：

```typescript
interface ToolContext {
  runId: string;
  userId: string;
  signal: AbortSignal;
  idempotencyKey?: string;
}

interface AgentTool<TInput, TOutput> {
  definition: ToolDefinition;
  policy: ToolPolicy;
  parseInput(input: unknown): TInput;
  parseOutput(output: unknown): TOutput;
  execute(input: TInput, context: ToolContext): Promise<TOutput>;
}
```

`parseInput` 和 `parseOutput` 可以由 Zod、JSON Schema 或其他校验器实现。即使业务函数已经有 TypeScript 类型，运行时校验也不能省略，因为模型输出在运行时仍然是 `unknown`。

## 输入校验要发生在执行之前

以数据透视工具为例：

```typescript
const runPivotTool: AgentTool<PivotPlan, PivotResult> = {
  definition: {
    name: 'run_pivot',
    description: '对当前数据集执行已经校验的分组聚合；不返回原始明细',
    inputSchema: pivotPlanJsonSchema
  },
  policy: {
    risk: 'read',
    timeoutMs: 10_000,
    maxRetries: 0,
    idempotent: true,
    requiresConfirmation: false,
    maxOutputBytes: 64 * 1024
  },
  parseInput(input) {
    return pivotPlanSchema.parse(input);
  },
  parseOutput(output) {
    return pivotResultSchema.parse(output);
  },
  async execute(plan, context) {
    return pivotEngine.run(plan, { signal: context.signal });
  }
};
```

工具注册时就明确了几个边界：

- 输入只能是 `PivotPlan`，不是任意代码。
- 输出同样必须符合协议。
- 操作只读、可重复执行、不需要确认。
- 十秒后必须停止。
- 结果超过大小限制时需要裁剪或转存，不能直接塞回上下文。

结构校验之后，还要继续执行上一篇提到的字段语义、业务规则和权限校验。Schema 只是第一道门。

## 输出也必须校验

很多实现只验证模型参数，却默认工具返回值永远正确。实际项目中，工具可能来自第三方 API、旧服务、插件或浏览器页面，同样可能出现：

- 返回字段缺失。
- 数字变成字符串。
- 响应结构版本变化。
- 内容过大，挤占整个模型上下文。
- 文档中包含针对模型的恶意指令。

因此工具输出进入模型上下文前，要经历另一条管道：

```text
原始返回
  → 协议校验
  → 字段筛选与脱敏
  → 大小限制
  → 标记数据来源
  → 写入 Agent 状态
```

不要把第三方接口的完整响应直接 `JSON.stringify` 给模型。模型通常只需要完成下一步所需的少量字段。

例如聚合结果可以返回：

```typescript
interface PivotResult {
  datasetRevision: number;
  dimensions: string[];
  measures: string[];
  rows: Array<Record<string, string | number | null>>;
  totalRows: number;
  truncated: boolean;
}
```

`truncated` 明确告诉模型结果是否被截断，避免它把前 100 行误认为全部数据。

## 使用稳定的错误语义

只向模型返回一句“工具调用失败”几乎没有帮助。模型不知道应该换参数、稍后重试，还是停止并询问用户。

可以统一错误协议：

```typescript
type ToolErrorCode =
  | 'INVALID_INPUT'
  | 'FIELD_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'CONFIRMATION_REQUIRED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'OUTPUT_TOO_LARGE'
  | 'INTERNAL_ERROR';

interface ToolFailure {
  ok: false;
  error: {
    code: ToolErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

interface ToolSuccess<T> {
  ok: true;
  data: T;
}

type ToolResult<T> = ToolSuccess<T> | ToolFailure;
```

错误信息应该同时服务于两类对象：

- `code`、`retryable` 和结构化 `details` 供运行器判断。
- `message` 供模型和用户理解。

但错误细节不能泄露数据库连接串、文件绝对路径、堆栈和内部服务信息。运行日志可以保存受控诊断信息，返回模型的内容需要先脱敏。

## 重试不是遇错再来一次

不同错误需要完全不同的处理：

| 错误         | 是否自动重试 | 更合适的动作           |
| ------------ | ------------ | ---------------------- |
| 参数结构错误 | 否           | 让模型有限修复一次     |
| 字段不存在   | 否           | 返回候选字段或询问用户 |
| 权限不足     | 否           | 停止，不能靠重试绕过   |
| 等待用户确认 | 否           | 暂停运行               |
| 临时限流     | 是           | 根据服务端提示退避     |
| 网络闪断     | 视情况       | 仅对幂等操作有限重试   |
| 超时         | 视情况       | 先确认下游是否仍在执行 |
| 内部未知错误 | 通常否       | 记录并走降级方案       |

自动重试应该由运行器根据工具策略执行，不要把“要不要再试一次”完全交给模型。否则模型可能在每一轮都请求同一个失败工具，产生双重重试。

一个简单的退避函数可以是：

```typescript
function retryDelay(attempt: number, retryAfterMs?: number) {
  if (retryAfterMs) return retryAfterMs;

  const base = Math.min(500 * 2 ** attempt, 8_000);
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}
```

但只有同时满足下面条件时才执行：

1. 错误明确标记为可重试。
2. 工具本身是幂等的，或者携带幂等键。
3. 没有超过工具和整次运行的重试预算。
4. `AbortSignal` 尚未取消。

## 写操作必须有幂等边界

“发送邮件”是最典型的例子。请求超时并不代表邮件没有发出去，如果客户端直接重试，用户可能收到两封相同邮件。

有副作用的工具应接受由应用生成的幂等键：

```typescript
interface SendEmailInput {
  to: string[];
  subject: string;
  body: string;
}

interface WriteReceipt {
  operationId: string;
  status: 'created' | 'already_completed';
  completedAt: string;
}
```

执行端以 `userId + toolName + idempotencyKey` 建立唯一记录：

```text
第一次请求 → 执行动作 → 保存回执
相同幂等键再次请求 → 不重复执行 → 返回原回执
```

幂等键不能由模型随意生成。它应该绑定已经确认的结构化动作，并由应用或服务端签发。

即使具备幂等能力，外部写操作仍然通常需要人工确认。幂等解决重复执行，不解决“这个动作本来就不该执行”。

## 超时必须真的能够取消

只用 `Promise.race` 返回一个超时错误，并不会自动停止底层任务：

```typescript
await Promise.race([executeTool(), timeout(10_000)]);
```

调用方虽然收到失败，数据库查询、文件导出或 Worker 计算可能仍在后台继续。之后的重试会造成并发重复任务。

工具协议应该传递 `AbortSignal`：

```typescript
async function withTimeout<T>(timeoutMs: number, parentSignal: AbortSignal, task: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const abort = () => controller.abort(parentSignal.reason);
  parentSignal.addEventListener('abort', abort, { once: true });

  const timer = setTimeout(() => controller.abort('tool timeout'), timeoutMs);

  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
    parentSignal.removeEventListener('abort', abort);
  }
}
```

底层工具也必须真正监听信号。不能取消的第三方任务，则应该返回任务 ID，并提供查询或撤销机制，而不是假装已经停止。

## 工具注册表是权限边界

运行器不应该从模型返回的字符串动态导入任意函数，而应从显式注册表查找：

```typescript
class ToolRegistry {
  private tools = new Map<string, AgentTool<unknown, unknown>>();

  register(tool: AgentTool<unknown, unknown>) {
    if (this.tools.has(tool.definition.name)) {
      throw new Error(`工具重复注册：${tool.definition.name}`);
    }
    this.tools.set(tool.definition.name, tool);
  }

  getAllowed(name: string, allowedNames: Set<string>) {
    if (!allowedNames.has(name)) return undefined;
    return this.tools.get(name);
  }
}
```

每次运行只向模型暴露当前任务需要的工具，而不是整个系统的所有能力。例如只读数据分析任务不应该看到删除文件、发邮件或修改账号的工具。

这既能降低安全风险，也能减少模型选错工具的概率。工具越多，不一定越聪明，反而可能让决策边界更模糊。

## 工具应该按领域能力切分

两个极端都不好：

- 工具过细：`add_number`、`read_cell`、`compare_value`，模型需要大量步骤才能完成一个任务。
- 工具过宽：`execute_any_code`、`run_any_sql`，权限和结果都无法约束。

比较合适的粒度，是一个工具完成一个可描述、可验证的领域动作。

数据分析场景可以提供：

| 工具                     | 能力                     | 风险                 |
| ------------------------ | ------------------------ | -------------------- |
| `get_dataset_schema`     | 返回字段目录和数据版本   | 只读                 |
| `profile_data_quality`   | 统计缺失、重复和异常类型 | 只读、本地计算       |
| `run_pivot`              | 执行受限聚合计划         | 只读、本地计算       |
| `compare_periods`        | 比较两个明确时间范围     | 只读、本地计算       |
| `save_analysis_template` | 保存当前分析配置         | 本地写入，需要确认   |
| `export_report`          | 生成下载文件             | 本地副作用，显示预览 |

每个工具都有明确输入、输出和证据，模型负责组合它们，而不是在一个万能工具里绕过所有控制。

## 一次完整执行应该经过什么

运行器调用工具时，可以固定执行下面这条管道：

```text
根据名称查注册表
  → 检查本次运行是否允许该工具
  → 解析输入 Schema
  → 执行领域语义与权限校验
  → 如有需要，检查确认凭证
  → 建立超时与取消信号
  → 按策略执行有限重试
  → 校验并裁剪输出
  → 写入轨迹和工具回执
  → 将受控结果返回模型
```

模型参与的是最上游的“提出调用”和最下游的“阅读结果”。中间每一步都应该由确定性代码掌控。

## 怎样测试工具层

工具层的测试不需要真实模型，可以直接覆盖边界：

- 非法输入是否在业务函数执行前被拒绝。
- 当前运行未授权的工具是否不可见、不可调用。
- 工具超时后底层任务是否收到取消信号。
- `PERMISSION_DENIED` 是否绝不自动重试。
- 幂等键重复提交是否返回同一回执。
- 超大输出是否被裁剪并带上 `truncated`。
- 输出 Schema 变化时是否立即失败，而不是污染模型上下文。
- 日志是否对手机号、令牌和原始数据做了脱敏。

这些测试保护的是 Agent 系统中最确定的一层，也最适合在每次提交时快速运行。

## 最后

Agent 工具不是“给模型用的函数列表”，而是一组面向不稳定调用方设计的受控 API。

一个可靠工具至少要回答：

- 输入和输出如何验证？
- 当前运行是否有权限调用？
- 多久必须停止？
- 哪些失败可以重试？
- 重复执行会不会产生二次副作用？
- 返回给模型的数据是否必要、可信、可追踪？

当这些边界明确以后，模型可以自由选择动作，但不能自由改变执行规则。

下一篇会把前四篇的部件组合起来，完成本季的主案例：[做一个真正有用的数据分析 Agent：模型做决策，本地引擎做计算](/blog/build-local-data-analysis-agent/)。
