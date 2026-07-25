---
title: 做一个真正有用的数据分析 Agent：模型做决策，本地引擎做计算
excerpt: 用自然语言生成受控 PivotConfig，在浏览器内完成字段校验、Web Worker 聚合和证据化报告，让模型不接管计算事实。
publishDate: '2026-07-20'
isFeatured: false
draft: true
series: AI Agent 实践
tags:
  - AI Agent
  - TypeScript
  - Web Worker
  - 数据可视化
seo:
  title: 构建本地数据分析 Agent：自然语言到 PivotConfig 与可验证报告
  description: 以本地数据工作台为例，将自然语言转换成 PivotConfig，经字段校验与 Web Worker 聚合后生成带数据证据的分析报告。
  pageType: article
---

> 本文是《AI Agent 实践》系列第 5 篇。前四篇分别搭好了循环、架构边界、计划协议和工具层，这一篇把它们组合成一个完整应用。

“给模型几个工具”很容易做出一次成功演示，但我更关心另一个问题：Agent 能不能进入一个真实产品，在不牺牲数据精度、隐私和可测试性的前提下，完成用户原本需要手动配置的任务？

我在 [AI 数据透视分析工作台](/projects/pivot-workbench/) 里采用的核心思路是：

> 模型负责理解目标和选择分析动作，本地引擎负责读取数据、执行聚合并产生事实。

用户可以用自然语言描述需求，但模型不直接算金额，也不直接操作原始表格。下面用一个具体任务把整条链路串起来。

## 这次要完成的任务

假设用户上传一份包含百万级订单的销售表，字段如下：

| 字段             | 类型   | 含义                 |
| ---------------- | ------ | -------------------- |
| `order_date`     | date   | 下单时间             |
| `region`         | string | 销售地区             |
| `channel`        | string | 销售渠道             |
| `revenue`        | number | 有效销售额           |
| `cost`           | number | 订单成本             |
| `customer_phone` | string | 客户手机号，敏感字段 |

用户输入：

> 只看华东地区，按月份和渠道统计销售额，找出环比下降最大的渠道。

最终界面需要给出图表、结论和可以回查的统计结果。系统还要保证：

- 金额由确定性引擎计算，不由模型心算。
- 原始订单和手机号不发送给模型。
- 模型只能使用实际存在、当前用户可访问的字段。
- 用户修改数据或快速发起新任务后，旧结果不能覆盖新结果。
- 报告中的每条数值结论都能关联到计算证据。

这几条约束共同决定了应用架构。

## 完整链路不是一次模型请求

我会把一次分析拆成七步：

```text
1. 浏览器解析文件并建立数据集
2. 生成可暴露的字段目录
3. 模型把用户目标转换成分析计划
4. 应用校验计划与当前数据版本
5. Web Worker 执行本地聚合
6. 应用整理结构化事实与证据
7. 模型基于事实生成解释
```

对应的组件关系是：

```text
┌──────────── 浏览器 ────────────────────────────────────────┐
│                                                           │
│  文件 → Dataset Store → Field Catalog                    │
│              │                 │                          │
│              │                 └────→ Planner（模型）      │
│              │                            │ PivotPlan      │
│              │                            ↓                │
│              └────→ Validator → Web Worker / Pivot Engine │
│                                      │                    │
│                                      ↓                    │
│                               Analysis Evidence           │
│                                      │                    │
└──────────────────────────────────────┼────────────────────┘
                                       ↓
                                Reporter（模型）
                                       ↓
                              结论、图表说明与引用
```

模型服务只接收必要字段目录、用户目标和聚合结果。原始数据保留在浏览器的数据存储和 Worker 中。

## 第一步：给数据集稳定身份

一次分析不应只依赖“当前页面里那份数组”。用户可能重新导入文件、修改字段类型，或者在 Agent 运行中切换数据集。

因此先给数据集建立身份和版本：

```typescript
interface DatasetMeta {
  datasetId: string;
  revision: number;
  name: string;
  rowCount: number;
  importedAt: string;
}

interface DatasetSnapshot {
  meta: DatasetMeta;
  fields: DatasetField[];
}
```

以下动作都会增加 `revision`：

- 重新导入文件。
- 修改字段类型。
- 删除或重命名字段。
- 应用会改变计算语义的数据清洗规则。

模型生成的计划、Worker 请求和最终证据都绑定 `datasetId + revision`。这样每一个结果都能回答“它是基于哪一版数据算出来的”。

## 第二步：只构造必要的字段目录

浏览器解析 CSV 或 Excel 后，可以生成一份供模型规划的字段目录：

```typescript
interface ModelVisibleField {
  id: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  description?: string;
  allowedAggregations: Array<'sum' | 'count' | 'avg' | 'min' | 'max'>;
  filterable: boolean;
}
```

对于敏感字段，策略层可以直接排除：

```typescript
function createModelFieldCatalog(fields: DatasetField[], permissions: FieldPermission[]): ModelVisibleField[] {
  return fields
    .filter((field) => permissions.some((item) => item.fieldId === field.id && item.allowPlanning))
    .filter((field) => !field.sensitive)
    .map(toModelVisibleField);
}
```

`customer_phone` 不会进入模型目录，也不会成为可选维度。字段不可见比在 Prompt 里写“请不要使用手机号”更可靠。

对于 `region` 这类分类字段，可以按策略提供少量去重值，帮助模型识别“华东”是合法筛选值；对于姓名、地址等高基数字段，不发送样例。

## 第三步：生成领域计划

Planner 接收到的内容只包括：

- 原始用户目标。
- 当前可见字段目录。
- `PivotPlan` 的结构化输出协议。
- 当前应用支持的分析能力。

一个合理输出可能是：

```json
{
  "version": 1,
  "goalSummary": "比较华东地区各渠道的月度销售额并找出最大环比下降",
  "rows": [{ "field": "channel" }],
  "columns": [{ "field": "order_month" }],
  "measures": [
    {
      "field": "revenue",
      "aggregation": "sum",
      "alias": "monthly_revenue"
    }
  ],
  "filters": [
    {
      "field": "region",
      "operator": "eq",
      "value": "华东"
    }
  ],
  "limit": 100
}
```

这里出现了一个新问题：原始字段只有 `order_date`，计划里却用了 `order_month`。

不能让模型凭空创建字段。应用可以明确提供受控派生字段目录：

```typescript
interface DerivedFieldDefinition {
  id: 'order_month';
  sourceField: 'order_date';
  transform: 'year_month';
  outputType: 'string';
}
```

只有注册过的派生字段才能进入计划。这样保留了“按月”这种自然表达，同时不开放任意表达式执行能力。

## 第四步：在模型之后再次校验

计划进入 Worker 前，要依次检查：

1. JSON 与 Schema 是否合法。
2. 字段是否在当前可见目录中。
3. 聚合函数是否支持对应类型。
4. 筛选值是否符合字段类型和业务规则。
5. 数据集版本是否与规划时一致。
6. 预计分组数量和结果规模是否超预算。

可以让校验函数返回三类结果：

```typescript
type PreparedAnalysis =
  | {
      status: 'ready';
      action: AnalysisAction;
    }
  | {
      status: 'needs_clarification';
      question: string;
      options?: ClarificationOption[];
    }
  | {
      status: 'rejected';
      issues: PlanIssue[];
    };
```

例如“销售额”同时匹配含税和不含税字段时，返回澄清；请求手机号维度时，直接拒绝；字段拼写错误且只有一个明确候选时，可以提出一份修复后的计划供重新校验。

所有自动修复都要保留差异，不能在用户不知情时改变指标口径。

## 第五步：把计算交给 Web Worker

百万行数据的解析、分组和聚合不应该阻塞主线程。主线程向 Worker 发送的是已经校验的领域动作，而不是自然语言：

```typescript
interface RunPivotMessage {
  type: 'pivot.run';
  requestId: string;
  runId: string;
  datasetId: string;
  datasetRevision: number;
  plan: PivotPlan;
}

interface CancelPivotMessage {
  type: 'pivot.cancel';
  requestId: string;
}

type PivotWorkerMessage = RunPivotMessage | CancelPivotMessage;
```

Worker 返回结构化事件：

```typescript
type PivotWorkerEvent =
  | {
      type: 'pivot.progress';
      requestId: string;
      processedRows: number;
      totalRows: number;
    }
  | {
      type: 'pivot.completed';
      requestId: string;
      result: PivotResult;
    }
  | {
      type: 'pivot.failed';
      requestId: string;
      error: WorkerError;
    };
```

`requestId` 很重要。用户连续发起两个分析时，第一个任务可能更晚完成。如果只监听“最近一次 Worker 消息”，旧结果就会覆盖新结果。

主线程必须确认结果属于当前请求：

```typescript
function handleWorkerEvent(event: PivotWorkerEvent) {
  const active = activeRequests.get(event.requestId);
  if (!active) return;

  if (active.datasetRevision !== currentDataset.revision) {
    active.reject(new Error('数据集已经更新，丢弃旧结果'));
    activeRequests.delete(event.requestId);
    return;
  }

  // 根据 requestId 更新对应运行，而不是覆盖全局结果。
}
```

取消也要真正传到 Worker。在长循环中定期检查取消标记，停止后释放中间 `Map` 和数组，避免用户虽然点了取消，CPU 和内存仍在继续消耗。

## 第六步：把计算结果整理成证据

Pivot Engine 返回的矩阵适合渲染图表，但给模型生成报告时，还需要一层更明确的证据结构。

```typescript
interface AnalysisEvidence {
  evidenceId: string;
  datasetId: string;
  datasetRevision: number;
  planHash: string;
  computedAt: string;
  facts: AnalysisFact[];
  warnings: string[];
}

interface AnalysisFact {
  factId: string;
  label: string;
  value: number;
  unit: 'CNY' | 'percent' | 'count';
  dimensions: Record<string, string>;
  comparison?: {
    baseline: number;
    change: number;
    changeRate: number | null;
  };
}
```

例如：

```json
{
  "factId": "fact-17",
  "label": "直播渠道 2026-06 销售额",
  "value": 821000,
  "unit": "CNY",
  "dimensions": {
    "region": "华东",
    "channel": "直播",
    "month": "2026-06"
  },
  "comparison": {
    "baseline": 1160000,
    "change": -339000,
    "changeRate": -0.2922
  }
}
```

模型不需要看到百万行原始订单，只需要读取足以回答问题的结构化事实。图表也使用同一份 Pivot 结果，避免“图表一套数据、报告另一套数据”。

`warnings` 要明确记录：

- 数据是否被截断。
- 是否存在空值。
- 某个月是否缺少完整周期。
- 环比基线是否为零。
- 当前结果是否包含自动修复过的字段映射。

这些警告不应该在生成自然语言报告时被悄悄丢掉。

## 第七步：报告只能引用事实

Reporter 的任务不是重新分析原始数据，而是组织已经计算出的事实。

它的输入可以限制为：

```typescript
interface ReportInput {
  userGoal: string;
  evidence: AnalysisEvidence;
  outputFormat: 'summary' | 'detailed';
}
```

要求输出结构包含事实引用：

```typescript
interface ReportSection {
  title: string;
  content: string;
  factIds: string[];
}
```

最终报告可以展示：

> 华东地区直播渠道 6 月销售额为 82.1 万元，较 5 月下降 29.22%，是本次比较中降幅最大的渠道。`[fact-17]`

前端把 `[fact-17]` 渲染成可点击引用，用户可以展开对应月份、渠道、基线值和计算配置。

如果模型输出一个不存在的 `factId`，或者文字里的金额与引用事实不一致，报告校验器应拒绝结果并进行一次受限修复，而不是直接展示。

## 用一个编排函数串起来

省略具体 SDK 后，主流程可以写成：

```typescript
async function analyzeDataset(input: AnalysisRequest, context: AnalysisContext): Promise<AnalysisRunResult> {
  const snapshot = context.datasetStore.getSnapshot(input.datasetId);
  const catalog = createModelFieldCatalog(snapshot.fields, context.permissions);

  const planning = await context.planner.createPlan({
    goal: input.goal,
    dataset: snapshot.meta,
    fields: catalog
  });

  if (planning.kind !== 'ready') {
    return planning;
  }

  const prepared = prepareAnalysis(planning.plan, {
    snapshot,
    catalog,
    permissions: context.permissions,
    budget: context.budget
  });

  if (prepared.status !== 'ready') {
    return prepared;
  }

  const pivotResult = await context.pivotWorker.run(prepared.action, context.signal);

  const evidence = buildEvidence(prepared.action, pivotResult);
  const report = await context.reporter.createReport({
    userGoal: input.goal,
    evidence,
    outputFormat: input.outputFormat
  });

  return {
    status: 'completed',
    plan: prepared.action.plan,
    pivotResult,
    evidence,
    report
  };
}
```

这段代码看起来更像一个受控工作流，而不是自由循环。原因是这个具体任务的主路径能够提前确定。

当应用支持“检查数据质量、按结果继续下钻、必要时检索指标文档”等开放任务后，外层 Agent 可以动态选择这些领域工具；每个工具内部仍然保持确定性。

这正是上一章提到的混合架构：**Agent 负责选择能力，工作流负责可靠地完成一次能力。**

## 三个最容易踩的坑

### 让模型直接计算数值

即使只有十几行数据，也不应该把金额求和交给模型。模型生成的数字无法保证精度，数据量增加后还会受到上下文限制。

正确做法是让模型生成计划，让计算引擎输出结果，再让模型解释。

### 把原始数据全部发送给模型

这样不仅消耗大量 Token，还会把客户信息、订单明细和业务数据带出本地边界。大多数规划只需要字段目录，报告只需要聚合事实。

如果某个任务确实需要查看明细，也应通过带权限和行数限制的专用工具返回最小样本，而不是默认上传整表。

### 只有最终答案，没有中间证据

用户看到一句“直播渠道下降 29%”，却不知道数据范围、筛选条件和比较基线，系统就很难被信任。

计划、数据版本、事实 ID 和警告都应该成为结果的一部分。可解释不是展示模型思考过程，而是展示可验证的数据来源和执行动作。

## 怎样验证这个应用真的有用

可以为主链路建立一组确定性数据集：

- 小数据集用于手算核对聚合结果。
- 包含空值、重复值和错误类型的数据集。
- 含敏感字段的数据集，验证模型目录不会泄露。
- 百万行数据集，测量 Worker 耗时和取消响应。
- 快速连续提交多个任务，验证旧结果不会回写。

然后再增加自然语言任务评测：

- 计划字段是否正确。
- 遇到歧义是否澄清。
- 报告数字是否全部来自事实。
- 引用是否存在且与文字一致。
- 整次运行的步骤、延迟和 Token 是否在预算内。

只有计算、计划和解释三层分别通过测试，才能说明这不是一次碰巧成功的演示。

## 最后

这个数据分析 Agent 的关键不在于模型能做多少，而在于每一层只做自己擅长的事：

- 模型理解自然语言和组织表达。
- Schema 与领域规则约束计划。
- 本地引擎负责精确计算。
- 数据版本和请求 ID 保证状态一致。
- Evidence 把报告连接回真实结果。
- 浏览器边界保护原始数据和用户隐私。

当概率性决策被包在确定性执行和验证中，Agent 才开始从“聊天演示”变成一个可以进入产品的能力。

下一篇转向用户真正看到的部分：[Agent 前端不只是一个聊天框：状态、事件流、取消与恢复](/blog/agent-frontend-state-streaming-recovery/)。
