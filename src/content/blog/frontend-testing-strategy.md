---
title: 前端到底该写哪些测试？单测、组件测试、E2E 的分工
excerpt: 我以前也以为前端测试就是把覆盖率刷上去，后来踩过脆弱快照、过度 mock、E2E 雪崩之后，才慢慢意识到测试真正要解决的是风险分层。
publishDate: '2026-05-30'
isFeatured: true
cover: ../../assets/images/blog/frontend-testing-strategy.png
series: 前端测试
tags:
  - 前端
  - 测试
  - 工程化
seo:
  title: 前端到底该写哪些测试？单测、组件测试、E2E 的分工
  description: 结合前端项目里的真实踩坑，聊聊单测、组件测试和 E2E 分别应该测什么，以及为什么测试不是覆盖率游戏。
  image:
    src: ../../assets/images/blog/frontend-testing-strategy.png
    alt: 前端测试分工文章封面
  pageType: article
---

我刚开始给前端项目补测试的时候，其实有一个很幼稚的想法：覆盖率越高，项目就越稳。

后来我发现这句话只对了一半。覆盖率确实能说明一些问题，但它说明不了最关键的问题：这些测试到底有没有保护业务。

有一段时间，我写过不少“看起来很勤奋”的测试。组件渲染一下，快照拍一下；按钮点一下，断言某个 mock 函数被调用；工具函数随便补几个 case，覆盖率就涨上去了。当时代码覆盖率很好看，但我心里并没有更踏实。因为真正改业务的时候，该怕还是怕。

最典型的一次是我改了一个表单组件的 DOM 结构。业务逻辑没变，用户看到的交互也没变，只是把几个 `div` 换成了更合理的结构。结果一堆快照测试全红。我花了半天看 diff，最后基本都只是更新快照。那一刻我有点崩溃：这些测试没有帮我发现 bug，只是在提醒我“你改了 HTML”。

也是从那以后，我开始重新看待前端测试。测试不是写得越多越好，也不是越接近真实用户越好。真正有用的测试，应该把不同层级的风险交给不同层级的测试去兜。

我现在更喜欢用这句话总结：

> 单测保证逻辑对，组件测试保证交互对，E2E 保证流程对。

这句话不复杂，但真正写项目的时候很容易忘。

## 测试最怕的是职责错位

前端测试里最容易踩的坑，不是工具不会用，而是测试类型选错了。

比如一个很简单的邮箱校验规则：

```ts
export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

这种逻辑明明一个单测就能说清楚，但如果非要打开浏览器、进入登录页、输入邮箱、点击提交，再通过 E2E 去验证邮箱格式，那就太重了。

反过来，如果一个“发布文章”的完整流程，涉及登录、权限、路由跳转、接口请求、列表刷新，你只测其中一个 `formatPostData` 函数，也很难证明流程真的没断。

以前我很容易犯这个错误：能写单测的地方写成组件测试，应该写组件测试的地方又偷懒写成 mock 函数断言，真正该用 E2E 兜住的核心链路反而没测。

后来我给自己定了一个判断标准：

- 逻辑规则清楚，就先想单测
- 用户交互复杂，就先想组件测试
- 业务链路不能断，才上 E2E

这个顺序能帮我少写很多没必要的测试。

## 单测：适合那些“不需要打开页面也能讲清楚”的逻辑

单测最适合测纯逻辑。

比如权限判断、表单校验、金额计算、日期格式化、接口数据转换、状态 reducer，这些代码都有一个共同点：输入是什么、输出应该是什么，基本能讲清楚。

我比较喜欢给这类代码写单测，因为它反馈快，也不太容易被 UI 重构影响。你今天用 React，明天换 Vue，或者只是把页面结构改了，只要规则没变，测试就不应该变。

举个权限判断的例子：

```ts
type User = {
  id: string;
  role: 'admin' | 'editor' | 'viewer';
};

type Post = {
  authorId: string;
  status: 'draft' | 'published';
};

export function canEditPost(user: User, post: Post) {
  if (user.role === 'admin') return true;
  if (post.status === 'published') return false;
  return user.id === post.authorId && user.role === 'editor';
}
```

这段代码就不需要组件测试，更不需要 E2E。它的规则很明确：

- admin 可以编辑任何文章
- 已发布文章不能被普通 editor 编辑
- editor 只能编辑自己的草稿

对应的测试也应该直接表达这些业务规则：

```ts
import { describe, expect, it } from 'vitest';
import { canEditPost } from './permission';

describe('canEditPost', () => {
  it('allows admin to edit any post', () => {
    expect(canEditPost({ id: 'u1', role: 'admin' }, { authorId: 'u2', status: 'published' })).toBe(true);
  });

  it('prevents editor from editing published post', () => {
    expect(canEditPost({ id: 'u1', role: 'editor' }, { authorId: 'u1', status: 'published' })).toBe(false);
  });

  it('allows editor to edit own draft', () => {
    expect(canEditPost({ id: 'u1', role: 'editor' }, { authorId: 'u1', status: 'draft' })).toBe(true);
  });
});
```

我现在写单测时会尽量避免一个问题：为了覆盖率去测没有意义的代码。

比如一个函数只是简单地把参数传给第三方库，或者只是返回一个固定配置，我一般不会强行写测试。这样的测试就算写了，失败时也很难告诉我什么有价值的信息。

我判断一个单测值不值得写，通常会问自己：

> 如果这个逻辑错了，业务会不会真的出问题？

如果答案是会，那就写。如果只是为了覆盖率数字好看，我会先忍住。

## 组件测试：别测内部实现，要测用户能感知的结果

组件测试是我以前最容易写错的一层。

我曾经写过这样的测试：点击按钮后，断言 `onSubmit` 被调用了一次。这个测试本身没错，但它太弱了。它只能证明按钮点击触发了一个函数，不能证明用户真的看到了 loading，不能证明错误提示展示出来了，也不能证明成功后页面状态正确。

后来我更倾向于这样写组件测试：不关心组件内部怎么组织，只关心用户做了什么，以及页面给了什么反馈。

比如登录表单：

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

it('shows validation message when email is invalid', async () => {
  const user = userEvent.setup();

  render(<LoginForm />);

  await user.type(screen.getByLabelText('邮箱'), 'wrong-email');
  await user.click(screen.getByRole('button', { name: '登录' }));

  expect(screen.getByText('请输入正确的邮箱地址')).toBeInTheDocument();
});
```

这个测试的重点不是 `validateEmail` 有没有被调用，而是用户输入错误邮箱之后，页面有没有给出正确反馈。

我踩过一个很典型的坑：测试里大量使用 `.querySelector('.error-text')` 或者直接找 className。后来 UI 改版，className 变了，测试就全挂。但用户其实仍然能看到错误提示，业务没有坏。

从那以后，我尽量使用更接近用户视角的查询方式，比如：

- `getByRole`
- `getByLabelText`
- `getByText`
- `getByPlaceholderText`

这些选择器不只是测试更稳定，也会倒逼组件写得更可访问。比如一个输入框如果没有 label，`getByLabelText` 就找不到，这其实是在提醒我组件本身也不够好。

组件测试很适合覆盖这些场景：

- 表单输入和错误提示
- loading、empty、error 状态
- 弹窗打开和关闭
- 列表筛选、排序、分页
- 批量操作按钮的禁用状态
- 接口失败后的错误提示

不过组件测试也不能写太细。比如组件内部有几个 `useState`，某个 hook 返回了什么中间状态，这些我一般不会测。因为这些都是实现细节，重构时很容易变化。

我现在对组件测试的要求很简单：

> 像用户一样操作页面，像用户一样判断结果。

这句话听起来像口号，但真能少踩很多坑。

## E2E：不要贪多，只保护最不能断的链路

E2E 是最接近真实用户的测试，也是最容易让人又爱又恨的测试。

我以前做过一个错误决定：给后台系统的很多细节功能都写 E2E。新增、编辑、删除、筛选、排序、导出、权限弹窗，几乎每个功能都走浏览器测一遍。刚开始很爽，感觉系统被保护得很完整。

问题很快就来了。

测试变慢了，本地没人愿意跑。CI 上偶发失败变多，有时是测试数据没清理干净，有时是接口慢了一点，有时是页面动画还没结束。最难受的是，E2E 一旦失败，排查成本很高。你要判断是前端坏了、接口坏了、测试数据坏了，还是测试本身写得太脆。

后来我才意识到，E2E 不适合拿来覆盖所有细节。它应该只保护那些“真的不能断”的关键路径。

比如：

- 用户能不能登录
- 用户能不能完成下单
- 用户能不能发布文章
- 管理员能不能创建核心资源
- 权限错误时是否真的进不去页面

以发布文章为例，一条 E2E 可以这样设计：

```ts
import { expect, test } from '@playwright/test';

test('user can publish a post', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('邮箱').fill('editor@example.com');
  await page.getByLabel('密码').fill('password');
  await page.getByRole('button', { name: '登录' }).click();

  await page.getByRole('link', { name: '写文章' }).click();
  await page.getByLabel('标题').fill('前端测试分层实践');
  await page.getByLabel('正文').fill('这是一篇关于前端测试策略的文章正文。');
  await page.getByLabel('标签').fill('前端,测试');
  await page.getByRole('button', { name: '发布' }).click();

  await expect(page.getByText('发布成功')).toBeVisible();
  await expect(page.getByRole('link', { name: '前端测试分层实践' })).toBeVisible();
});
```

这条测试的目标不是把所有校验规则都测一遍。标题为空、正文太短、标签过多，这些更适合单测和组件测试。

这条 E2E 只回答一个问题：用户能不能从登录开始，真的发布一篇文章，并在列表里看到它。

我现在写 E2E 时会非常克制。每加一条 E2E，我都会问自己：

> 如果这条测试失败，是否说明一个关键业务流程真的可能坏了？

如果答案不是很明确，我一般不会把它放进 E2E。

## 一个功能应该怎么拆测试

还是拿“发布文章”举例。

这个功能看起来只是一个表单，但里面其实有三层风险。

第一层是规则风险：

- 标题不能为空
- 正文不能少于 20 个字
- 标签最多 5 个
- 草稿和发布可能有不同校验规则

这些适合单测。

```ts
export function validatePost(input: { title: string; content: string; tags: string[] }) {
  if (!input.title.trim()) return '标题不能为空';
  if (input.content.trim().length < 20) return '正文不能少于 20 个字';
  if (input.tags.length > 5) return '标签不能超过 5 个';
  return null;
}
```

第二层是交互风险：

- 用户点发布后是否显示 loading
- 校验失败是否展示错误
- 接口失败是否提示重试
- 提交成功后按钮是否恢复
- 用户修改输入后错误是否消失

这些适合组件测试。

```tsx
it('shows error message when title is empty', async () => {
  const user = userEvent.setup();

  render(<PostEditor />);

  await user.type(screen.getByLabelText('正文'), '这是一段足够长的正文内容，用来通过正文长度校验。');
  await user.click(screen.getByRole('button', { name: '发布' }));

  expect(screen.getByText('标题不能为空')).toBeInTheDocument();
});
```

第三层是流程风险：

- 用户是否能登录
- 是否能进入发布页
- 是否能提交成功
- 是否能在列表页看到新文章

这些适合用一条 E2E 兜住。

如果这三层都用 E2E 测，会很重。如果三层都只写单测，又很虚。比较舒服的分工是：

- 校验规则用单测
- 编辑器状态和错误提示用组件测试
- 发布成功的完整闭环用 E2E

这样测试不会太多，但关键风险基本都有人负责。

## 我现在会避开的几类测试

踩坑之后，我对一些测试会比较谨慎。

第一类是纯展示组件的测试。比如一个没有逻辑的标题组件、布局组件，如果只是把 props 渲染出来，我一般不会专门测。除非它承担了很重要的语义或可访问性职责。

第二类是脆弱快照。快照不是不能用，但我不会把它当作业务组件的主要测试方式。因为它太容易变成“看不懂 diff，然后直接更新”的流程。

第三类是过度 mock 的测试。如果一个测试要 mock 十几个模块才能跑起来，我会警惕。因为这通常说明测试离真实使用方式太远，或者代码本身耦合太重。

第四类是测试框架本身已经保证的东西。比如 React 能不能正常渲染一个文本，路由库能不能跳转，UI 库按钮能不能点击，这些一般不需要我重复证明。

第五类是只验证内部实现的测试。比如某个内部函数调用几次、某个临时变量是什么值、组件内部 state 如何变化。只要用户结果没变，这些细节就不应该限制重构。

测试不是越多越专业。测试越多，维护成本也越高。真正专业的是知道哪些地方值得测，哪些地方应该放过。

## 一个简单的分工表

| 类型     | 主要测试目标           | 优点                   | 缺点                   | 适合例子                       |
| -------- | ---------------------- | ---------------------- | ---------------------- | ------------------------------ |
| 单测     | 纯逻辑是否正确         | 快、稳定、便宜         | 不覆盖真实 UI          | 权限判断、表单校验、数据转换   |
| 组件测试 | 单个组件的交互是否正确 | 接近用户行为，反馈较快 | 需要 mock 上下文和接口 | 表单、弹窗、列表、筛选器       |
| E2E      | 完整业务流程是否跑通   | 最接近真实用户         | 慢、贵、容易受环境影响 | 登录、下单、发布、后台核心流程 |

我自己的实践倾向是：

- 单测可以多写，尤其是核心业务规则
- 组件测试适量写，重点覆盖复杂交互
- E2E 一定要少，只测关键链路

这其实是一种成本选择。越底层的测试越快、越稳定、越便宜，可以多写。越接近真实用户的测试越可信，但也越慢、越贵、越难维护，所以要精挑细选。

## 最后：测试不是为了证明代码没问题

我以前总觉得测试是为了证明代码没问题。现在我觉得这个理解不太准确。

测试更像是一套反馈系统。它不能证明系统完全正确，但它能在你改动代码时，尽快告诉你有没有碰坏重要的东西。

单测让我敢改业务规则。组件测试让我敢改 UI 结构。E2E 让我敢改关键流程。

如果一套测试在业务出问题时不报警，在正常重构时却天天报警，那它就是在消耗团队耐心。反过来，如果一套测试数量不多，但每次失败都能指向真实风险，它就很有价值。

所以前端到底该写哪些测试？

我的答案是：不要从覆盖率出发，要从风险出发。逻辑复杂就写单测，交互复杂就写组件测试，流程关键就写 E2E。剩下那些只是为了显得“测试很完整”的部分，可以先放一放。

测试的目标不是让项目看起来严谨，而是让我们真的敢改代码。
