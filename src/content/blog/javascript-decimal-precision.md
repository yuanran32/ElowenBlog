---
title: JavaScript 小数精度问题：为什么 0.1 + 0.2 不等于 0.3
excerpt: 从 0.1 + 0.2 的经典问题开始，聊清楚 JavaScript 小数为什么会丢精度，以及比较、展示、金额计算时应该怎么处理。
publishDate: '2026-07-04'
isFeatured: false
tags:
  - JavaScript
  - 小数精度
  - 前端
seo:
  title: JavaScript 小数精度问题：为什么 0.1 + 0.2 不等于 0.3
  description: 解释 JavaScript 小数精度问题的来源，并给出比较、展示、金额计算和高精度场景中的实用处理方式。
  pageType: article
---

刚开始写 JavaScript 的时候，我第一次看到这个结果，反应其实很直接：

```js
console.log(0.1 + 0.2); // 0.30000000000000004
console.log(0.1 + 0.2 === 0.3); // false
```

这看起来像是 JavaScript 算错了。

但它不是某个引擎的 bug，也不是浏览器突然不认识小学数学了。真正的原因是：JavaScript 的 `number` 使用 IEEE 754 双精度浮点数表示，而很多十进制小数在二进制里根本不能被精确表示。

只要理解这一点，很多看起来奇怪的小数问题就会变得很普通。

## 先说结论：小数不是都能被精确存下来

JavaScript 里的普通数字，不管你写的是整数还是小数，大多数情况下都是同一种类型：

```js
console.log(typeof 1); // number
console.log(typeof 0.1); // number
console.log(typeof 1000000); // number
```

这些 `number` 底层用的是二进制浮点数。问题在于，十进制里很简单的 `0.1`，换成二进制后会变成一个无限循环小数。

这有点像十进制里表示 `1 / 3`：

```text
1 / 3 = 0.333333333333...
```

你写不完，只能截断或者四舍五入。二进制表示 `0.1` 的时候，也会遇到类似问题。

所以 JavaScript 存下来的并不是数学意义上完全精确的 `0.1`，而是一个非常接近 `0.1` 的值。`0.2` 也是一样。两个近似值相加，结果自然也可能带一点误差。

## 为什么偏偏是 0.1 + 0.2 出问题

不是只有 `0.1 + 0.2` 有问题，它只是最出名。

```js
console.log(0.1 + 0.7); // 0.7999999999999999
console.log(0.2 + 0.4); // 0.6000000000000001
console.log(1.005 * 100); // 100.49999999999999
```

这些结果背后都是同一个原因：参与计算的小数无法被二进制浮点数精确表示。

不过也不是所有小数都会出问题。比如：

```js
console.log(0.5 + 0.25); // 0.75
```

`0.5` 是 `1 / 2`，`0.25` 是 `1 / 4`，它们可以被二进制精确表示，所以结果看起来就很正常。

判断一个小数会不会有误差，不应该靠肉眼看它在十进制里简不简单，而要看它能不能被二进制有限位表示。日常开发里我们通常不需要手算这一点，只要记住：小数计算天然可能有误差。

## `toFixed` 不是精度计算工具

很多人第一次处理这个问题时，会想到 `toFixed`：

```js
const result = (0.1 + 0.2).toFixed(2);

console.log(result); // '0.30'
```

这个写法适合展示，但不适合当成计算逻辑。

第一，`toFixed` 返回的是字符串：

```js
const value = (0.1 + 0.2).toFixed(2);

console.log(typeof value); // string
```

如果后面还要继续参与计算，就要再次转成数字，而这一步很容易让代码语义变乱。

第二，`toFixed` 自己也会受到浮点误差影响：

```js
console.log((1.005).toFixed(2)); // '1.00'
```

很多人预期这里是 `'1.01'`，但因为实际存下来的值可能略小于 `1.005`，四舍五入时就会出现不符合直觉的结果。

所以我现在会把 `toFixed` 放在很明确的位置：只在最后展示给用户时使用，不把它当成业务计算的一部分。

## 比较小数时，不要直接用 `===`

如果两个小数来自计算结果，直接比较通常是不可靠的：

```js
console.log(0.1 + 0.2 === 0.3); // false
```

更稳的方式是允许一个很小的误差范围：

```js
function isClose(a, b, tolerance = Number.EPSILON) {
  return Math.abs(a - b) < tolerance;
}

console.log(isClose(0.1 + 0.2, 0.3)); // true
```

`Number.EPSILON` 表示 `1` 和大于 `1` 的最小可表示浮点数之间的差值。它很小，但不是所有场景都适合直接拿来用。

比如你的业务数字本身很大，或者允许误差本来就是业务规则的一部分，就应该根据业务语义设置容忍范围：

```js
function isPriceClose(a, b) {
  return Math.abs(a - b) < 0.01;
}
```

这里的 `0.01` 不是技术魔法，而是业务上可以接受的最小金额误差。写这种代码时，最好让容忍范围有明确名字，而不是随手塞一个数字进去。

## 金额计算不要直接用小数

小数精度问题最容易踩坑的地方，是金额。

比如购物车里有这样的计算：

```js
const price = 19.9;
const count = 3;

console.log(price * count); // 59.699999999999996
```

如果只是展示，格式化一下看起来没问题。但如果这个结果还要参与优惠、积分、分账、对账，就很危险。

更常见的做法是：用最小货币单位保存和计算。人民币就用“分”，美元就用“cent”。

```js
const priceInCents = 1990;
const count = 3;

const totalInCents = priceInCents * count;

console.log(totalInCents); // 5970
console.log(formatMoney(totalInCents)); // '59.70'

function formatMoney(cents) {
  return (cents / 100).toFixed(2);
}
```

这样业务计算过程中一直是整数，只有展示时才转回小数。

不过这里也要注意整数本身的安全范围。JavaScript 的安全整数范围是：

```js
console.log(Number.MAX_SAFE_INTEGER); // 9007199254740991
```

大多数前端金额场景用“分”计算足够安全，但如果你在处理特别大的金额、金融账本、链上资产、超高精度计量，就不要只靠普通 `number` 了。

## 高精度场景应该用专门的库

如果业务真的要求十进制精确计算，我不会自己手写一套小数库。

更现实的选择是使用成熟库，比如 `decimal.js`、`big.js` 或 `bignumber.js`。它们会把十进制数当成更适合精确计算的数据结构来处理，而不是直接依赖二进制浮点数。

示意代码大概是这样：

```js
import Decimal from 'decimal.js';

const total = new Decimal('0.1').plus(new Decimal('0.2'));

console.log(total.toString()); // '0.3'
```

这里我更倾向于传字符串，而不是传数字：

```js
new Decimal('0.1'); // 推荐
new Decimal(0.1); // 不推荐作为默认习惯
```

因为当你写 `new Decimal(0.1)` 的时候，`0.1` 先被 JavaScript 解析成了一个 `number`，这个阶段已经进入浮点数世界了。虽然很多库会做兼容处理，但从表达语义上看，字符串更清楚。

## 常见处理方式怎么选

我现在一般按这个顺序判断：

- 只是页面展示：计算后在展示边界用 `Intl.NumberFormat` 或 `toFixed`
- 只是判断两个计算结果是否接近：用误差范围比较，不直接用 `===`
- 涉及金额、数量、库存这类可以换算成最小单位的值：优先用整数计算
- 涉及金融、账本、汇率、科学计算、高精度资产：使用专门的十进制或大数库

比如普通页面里展示价格，我会更喜欢这样：

```js
const formatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY'
});

console.log(formatter.format(59.7)); // ¥59.70
```

如果是购物车总价，我会尽量让数据源从一开始就是“分”：

```js
const items = [
  { name: '键盘', priceInCents: 19900, count: 1 },
  { name: '鼠标', priceInCents: 9900, count: 2 }
];

const totalInCents = items.reduce((total, item) => {
  return total + item.priceInCents * item.count;
}, 0);

console.log(formatMoney(totalInCents)); // '397.00'
```

这样代码读起来也更明确：业务计算处理的是整数金额，展示层负责把它格式化成人能看的价格。

## 最后

JavaScript 小数精度问题本质上不是 JavaScript 特有的问题，而是二进制浮点数的表示限制。`0.1 + 0.2 !== 0.3` 只是这个限制最容易被记住的例子。

真正重要的不是背下这个例子，而是在写业务代码时知道边界在哪里：

- 浮点数适合很多普通计算，但不适合要求十进制精确的业务
- `toFixed` 适合展示，不适合承担核心计算
- 小数比较要考虑误差范围
- 金额优先用整数最小单位
- 高精度需求交给成熟库

如果只记一句话，我会这样总结：

> 小数计算可以有误差，业务代码不能假装它没有误差。

很多精度问题不是因为某一次计算错得特别离谱，而是因为代码一路把“不够精确的中间值”当成“绝对正确的业务值”继续传下去。只要在计算、比较、存储和展示这几个边界上把语义分清楚，小数问题通常就不会变成线上问题。
