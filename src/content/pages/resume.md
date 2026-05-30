---
title: 简历
seo:
  title: 我的个人简历
  description: 我的个人简历、项目经历、技术栈和联系方式。
---

## 个人信息

姓名：Elowen  
邮箱：3916048194@qq.com  
GitHub：https://github.com/yuanran32   
博客：https://yuanran32.github.io/myBlog  

## 求职方向

前端开发 / 全栈开发

## 技术栈

- HTML、CSS、JavaScript、TypeScript
- React / Vue / Astro
- Node.js、接口开发、Web 工程化
- MySQL / MongoDB
- Git、npm、Vite、Tailwind CSS

## 项目经历

### 个人博客系统

项目简介：基于 Astro 和 Tailwind CSS 搭建的个人博客，用于记录技术文章、项目经验和学习笔记。  
技术栈：Astro、Markdown、Tailwind CSS、TypeScript

- 负责博客站点的页面配置、内容管理和部署流程
- 使用 Markdown 管理文章内容，支持标签、分页和 SEO 信息
- 配置站点地图、RSS 和基础 SEO 元信息，提升内容可访问性

### 前端数据透视分析工作台

项目简介：面向本地 Excel  /  CSV 数据分析场景，解决手动统计、筛选和导出效率低的问题，实现前端侧数据导入、字段建模、透视聚合、图表展示、结果导出与本地恢复闭环。

- 数据导入与字段建模：
  - 基于 xlsx  实现 Excel/CSV  文件导入，支持空行过滤、重复表头处理和字段类型推断
  - 对手机号、编号、id、code、前导 0、长数字等业务字段做字符串保留，避免数据精度丢失或误转数字；
- 透视计算与性能优化：
  - 基于 Map 分桶实现多维度分组聚合，支持 sum /  count / avg /  min / max 等聚合函数；
  - 将透视计算迁移到 Web Worker，降低主线程阻塞，提高复杂数据分析场景下是交互流畅度；
- 异步任务与缓存导出：
  - 通过 datasetId + requestId 标识 Worker 计算任务，过滤旧数据集和过期计算结果；
  - 使用 IndexedDB 缓存最近数据集、透视配置和分析模板，并用 localStorage  做异常兜底；
  - 支持 CSV/Excel/图表 PNG 导出，形成“导入-分析-可视化-导出”的本地数据分析闭环；

## 实习 / 工作经历

### 北京博视 - 前端实习

时间：2026.05 - 至今

- 参与业务模块开发，完成页面、接口或数据处理逻辑
- 与产品、设计或后端协作，推动功能上线
- 修复线上问题，提升用户体验或系统稳定性

## 教育经历

成都信息工程大学（软件工程）
时间：2025.09 - 2029.06

## 联系方式

如果你对我的经历感兴趣，可以通过邮箱或 GitHub 联系我。
