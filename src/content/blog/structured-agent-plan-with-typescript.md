---
title: 让模型只做它擅长的事：自然语言如何变成可校验的任务计划
excerpt: 结构化输出只能保证 JSON 长得正确，真正可执行的 Agent 计划还需要字段语义、业务规则、预算和澄清机制共同约束。
publishDate: '2026-07-18'
isFeatured: false
draft: true
series: AI Agent 实践
tags:
  - AI Agent
  - TypeScript
  - 结构化输出
  - Zod
seo:
  title: AI Agent 结构化计划：从自然语言到可校验的领域动作
  description: 使用 TypeScript 与 Zod 设计 Agent 任务计划，分层完成结构、字段语义、业务规则和预算校验，并处理歧义与修复。
  pageType: article
---

> 本文是《AI Agent 实践》系列第 3 篇。上一篇讨论了[工作流、RAG 与 Agent 的边界](/blog/choose-workflow-rag-or-agent/)，这一篇开始把自然语言接入真实应用。

假设用户上传了一份销售表，然后输入：

> 按月份和渠道统计销售额，找出环比下降最大的渠道，只看华东地区。

模型当然可以直接回复一段分析，但它既没有真正执行计算，也很可能在金额、字段或筛选范围上产生幻觉。更稳妥的做法，是让模型先把意图转换成应用能够理解的领域计划，再由确定性代码校验和执行。

这一步看起来只是“让模型输出 JSON”，实际上是 Agent 与业务系统之间最重要的边界。

## 不要让自然语言直接穿透到执行层

一种危险但常见的设计是让模型输出 SQL、JavaScript 或任意表达式：

```text
用户需求 → 模型生成代码 → 直接执行
```

它确实灵活，却把很多问题一起带进了运行时：

- 模型可能访问不该访问的表或字段。
- 语法正确不代表业务口径正确。
- 很难提前计算执行成本。
- 任意代码难以做权限控制和缓存。
- 测试只能围绕无穷多种代码形态展开。

更适合领域应用的方式，是先定义一个有限协议：

```text
用户需求
  → 模型生成领域计划
  → Schema 校验
  → 数据语义校验
  → 权限与预算校验
  → 确定性引擎执行
```

领域计划不是为了限制产品能力，而是把模型的开放语义压缩成应用真正支持的一组动作。

## 先设计执行器，再设计模型输出

结构化输出不应该从“模型方便生成什么”出发，而应该从“执行器能够安全消费什么”出发。

以数据透视分析为例，可以先定义一版最小计划：

```typescript
import { z } from 'zod';

const fieldRefSchema = z.object({
  field: z.string().min(1)
});

const measureSchema = z.object({
  field: z.string().min(1),
  aggregation: z.enum(['sum', 'count', 'avg', 'min', 'max']),
  alias: z.string().min(1).optional()
});

const filterSchema = z.discriminatedUnion('operator', [
  z.object({
    field: z.string().min(1),
    operator: z.enum(['eq', 'neq', 'contains']),
    value: z.string()
  }),
  z.object({
    field: z.string().min(1),
    operator: z.enum(['gt', 'gte', 'lt', 'lte']),
    value: z.number()
  }),
  z.object({
    field: z.string().min(1),
    operator: z.literal('between'),
    value: z.tuple([z.string(), z.string()])
  })
]);

export const pivotPlanSchema = z.object({
  version: z.literal(1),
  goalSummary: z.string().min(1).max(200),
  rows: z.array(fieldRefSchema).max(4),
  columns: z.array(fieldRefSchema).max(2),
  measures: z.array(measureSchema).min(1).max(6),
  filters: z.array(filterSchema).max(10),
  limit: z.number().int().positive().max(500).default(100)
});

export type PivotPlan = z.infer<typeof pivotPlanSchema>;
```

这里有几个刻意的限制：

- `version` 让协议未来可以演进。
- 聚合函数是枚举，不接受任意表达式。
- 行、列、指标和筛选都有数量上限。
- `goalSummary` 只保存用户可读的任务摘要，不要求模型输出隐藏推理过程。
- `limit` 从协议层限制结果规模。

有了这份协议，模型不是在“自由编程”，而是在填写一个受控的领域动作。

## 结构正确不等于可以执行

Zod 可以验证 JSON 结构，却不知道数据集里有没有“销售额”字段，也不知道字符串能不能求平均值。

因此校验至少要分四层。

### 第一层：传输与结构校验

这一层检查：

- 返回值是不是合法 JSON。
- 必填字段是否存在。
- 枚举和数据类型是否正确。
- 数组长度是否超过协议限制。

失败通常意味着模型没有遵守输出协议，可以进行一次受限修复，或者直接返回可理解的错误。

### 第二层：数据语义校验

执行计划必须与当前数据集匹配。先为数据集生成字段目录：

```typescript
interface DatasetField {
  id: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
}

interface DatasetSchema {
  datasetId: string;
  revision: number;
  fields: DatasetField[];
}
```

然后逐个验证字段和操作：

```typescript
interface PlanIssue {
  code: 'FIELD_NOT_FOUND' | 'AMBIGUOUS_FIELD' | 'INVALID_AGGREGATION' | 'INVALID_FILTER' | 'TOO_EXPENSIVE';
  path: string;
  message: string;
}

function validatePlanSemantics(plan: PivotPlan, schema: DatasetSchema): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const fieldMap = new Map(schema.fields.map((field) => [field.id, field]));

  plan.measures.forEach((measure, index) => {
    const field = fieldMap.get(measure.field);

    if (!field) {
      issues.push({
        code: 'FIELD_NOT_FOUND',
        path: `measures.${index}.field`,
        message: `字段不存在：${measure.field}`
      });
      return;
    }

    if (['sum', 'avg', 'min', 'max'].includes(measure.aggregation) && field.type !== 'number') {
      issues.push({
        code: 'INVALID_AGGREGATION',
        path: `measures.${index}.aggregation`,
        message: `${field.label} 不是数值字段，不能执行 ${measure.aggregation}`
      });
    }
  });

  return issues;
}
```

真实实现还要检查行列字段、筛选值类型、日期范围和字段权限。重要的是，模型不能因为“认为某个字段应该存在”就跳过数据事实。

### 第三层：业务规则校验

字段和类型都合法，仍然可能违反业务口径。

例如：

- “退款率”必须使用退款订单数除以有效订单数，不能直接平均行级百分比。
- “销售额”默认是否含税，需要参考指标定义。
- 同一字段不能同时作为敏感筛选条件和对外展示维度。
- 某些计算只允许在日粒度之后进行。

这些规则应该进入领域校验器或指标目录，而不是只写在 Prompt 里。Prompt 可以帮助模型生成正确计划，代码校验负责保证错误计划无法执行。

### 第四层：权限与预算校验

最后还要确认：

- 当前用户是否有权访问这些字段。
- 数据集版本是否仍与生成计划时一致。
- 预计扫描行数和结果规模是否在预算内。
- 当前运行是否已经超过工具调用或时间限制。

这一步决定“合法动作现在能不能执行”。即使计划语法和业务都正确，也不能绕过运行时策略。

## 给模型字段目录，而不是整份原始数据

为了生成计划，模型通常只需要知道字段名称、类型、说明和少量允许暴露的枚举，不需要读取所有原始行。

一个发给模型的字段目录可以是：

```json
{
  "datasetId": "sales-2026",
  "revision": 3,
  "fields": [
    { "id": "month", "label": "月份", "type": "date" },
    { "id": "channel", "label": "渠道", "type": "string" },
    { "id": "region", "label": "地区", "type": "string" },
    { "id": "revenue", "label": "销售额", "type": "number" }
  ]
}
```

使用稳定的字段 `id` 执行，使用 `label` 帮助模型和用户理解。这样即使 UI 展示名称调整，存量计划也不会立即失效。

样例值需要谨慎。它们能帮助模型理解“华东”属于地区，但也可能泄露姓名、手机号和订单信息。更安全的做法是：

- 默认只发送字段元数据。
- 只为明确允许的分类字段提供去重后的候选值。
- 对敏感字段不发送样例。
- 限制候选数量，并标记是否被截断。

数据最小化不只是节省 Token，也是隐私边界的一部分。

## 歧义不是校验错误，而是一次交互

用户说“按销售统计一下”时，系统可能同时存在：

- 含税销售额
- 不含税销售额
- 有效销售额
- 销售订单数

此时自动选择第一个字段虽然能让流程跑通，却可能悄悄产生错误结论。比起让模型硬猜，更好的协议是允许它明确请求澄清。

```typescript
type PlanningResult =
  | {
      kind: 'ready';
      plan: PivotPlan;
    }
  | {
      kind: 'clarification';
      question: string;
      options?: Array<{
        value: string;
        label: string;
      }>;
    }
  | {
      kind: 'unsupported';
      reason: string;
    };
```

这样，“需要用户补充信息”成为一等状态，而不是一次异常。

澄清问题应该满足三个条件：

1. 只问真正阻止执行的问题。
2. 尽量提供来自数据集的有限选项。
3. 用户回答后能够合并回原任务，而不是重新开始整段对话。

例如：

> 数据集中有“含税销售额”和“不含税销售额”，本次分析使用哪一个？

这比一句“请提供更多信息”更容易继续。

## 字段别名可以匹配，但不能偷偷猜

用户习惯说“营收”，数据字段却叫“有效销售额”。可以为字段维护别名：

```typescript
interface FieldDictionaryEntry {
  fieldId: string;
  aliases: string[];
}
```

匹配策略可以分级：

1. 稳定 `id` 精确匹配。
2. 展示名称精确匹配。
3. 已登记别名精确匹配。
4. 模糊匹配只用于生成候选，不直接执行。

当多个字段得分接近时，返回 `AMBIGUOUS_FIELD` 并请求澄清。不要为了减少一次交互，把不确定选择伪装成确定结果。

## 修复循环必须有限

结构化输出失败后，可以把精简后的错误返回模型，请它修复：

```text
计划校验失败：
- measures.0.field：字段“金额”不存在
- 可用数值字段：revenue（销售额）、cost（成本）

请只修复计划，不要改变用户目标。
```

但修复循环需要明确上限，例如最多一次或两次。连续失败通常意味着：

- 用户需求本身不明确。
- 字段目录不足。
- 协议无法表达这个任务。
- 当前模型不适合完成该步骤。

此时应该进入澄清、降级或失败状态，而不是无限消耗 Token。

还要注意：修复只针对校验问题，不能让模型借机扩大权限或改写原始目标。应用应保留原始目标、旧计划和修复差异，重新执行全部校验。

## 计划需要绑定数据版本

用户生成计划后，可能重新上传了文件，或者修改了字段类型。如果继续执行旧计划，就会产生典型的“检查时与使用时不一致”问题。

因此待执行动作至少要绑定：

```typescript
interface PlannedAction {
  runId: string;
  datasetId: string;
  datasetRevision: number;
  plan: PivotPlan;
  createdAt: string;
}
```

执行前再次比较 `datasetRevision`。版本变化后，不是直接执行，也不是只弹一个警告，而是重新校验或重新生成计划。

这个细节在人工确认场景尤其重要：用户确认的必须是当前看到的那份计划和那份数据。

## 怎样测试计划层

计划层很适合做分层测试。

### 确定性单元测试

不请求模型，直接验证校验器：

- 字符串字段不能 `sum`。
- 不存在字段必须返回 `FIELD_NOT_FOUND`。
- 超过六个指标必须被 Schema 拒绝。
- 数据版本不一致不能执行。
- 敏感字段在当前权限下不可用。

### 模型评测

使用固定用户任务和字段目录，检查模型生成的计划：

```text
任务：按渠道统计销售额
期望：rows = [channel]
期望：measures 包含 sum(revenue)
禁止：读取原始客户手机号
```

不要只比较完整 JSON 字符串。可以先对计划排序和补默认值，再针对关键语义断言。某些无关字段顺序不同，不应该被判定为失败。

### 歧义案例

评测集还要包含：

- “分析一下销售情况”这类过于宽泛的目标。
- 一个中文名称对应多个字段。
- 用户要求不存在的维度。
- 用户要求系统不支持的预测或因果结论。

正确结果不一定是一个计划，也可能是澄清或明确拒绝。

## 最后

结构化输出的价值，不是让模型“更像 API”，而是在概率性语义理解与确定性业务执行之间建立一道可检查的边界。

一份真正可执行的 Agent 计划，需要依次回答：

1. 结构是否合法？
2. 字段和数据类型是否匹配？
3. 是否符合业务口径？
4. 当前用户和运行预算是否允许？
5. 如果存在歧义，是否应该先问人？

只有全部通过，计划才可以进入执行层。

下一篇会继续沿着这条边界深入：[Agent 工具不只是函数列表：Schema、错误语义、重试与幂等](/blog/design-reliable-agent-tools/)。
