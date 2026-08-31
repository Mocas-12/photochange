<div align="center">

<img src="./logo.svg" width="96" alt="PhotoChange Logo" />

# PhotoChange

**纯前端图片处理工作台 —— 上传 · 裁剪 · 调整 · 转换，全程本地完成**

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live-222?logo=githubpages&logoColor=white)](https://mocas-12.github.io/photochange/)
[![HTML5](https://img.shields.io/badge/HTML5-5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/zh-CN/docs/Web/HTML)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)
[![jsPDF](https://img.shields.io/badge/jsPDF-2.5-007EC6)](https://github.com/parallax/jsPDF)

**[🌐 在线体验（GitHub Pages）](https://mocas-12.github.io/photochange/)**

*打开页面 → 下滑进入工作台 → 拖入图片即可编辑导出*

</div>

---

## 📖 目录

- [功能特性](#-功能特性)
- [界面设计](#-界面设计)
- [工作原理](#-工作原理)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
- [额度与激活](#-额度与激活)
- [常见问题](#-常见问题)
- [隐私与安全](#-隐私与安全)
- [许可证](#-许可证)

## ✨ 功能特性

- 🖼️ **多方式上传**：按钮选择或直接拖拽，支持 PNG / JPG / JPEG / WebP / BMP
- 🔍 **画布查看**：缩放（20%–400%）、±90° 旋转、标尺网格辅助对齐
- ✂️ **自由裁剪**：自由 / 1:1 / 4:3 / 16:9 / 3:2 长宽比，选区外部半透明遮罩便于观察
- 📐 **尺寸调整**：宽高输入 + 锁定比例，内置头像、一寸/二寸证件照、公众号封面、小红书、HD/FHD 等常用预设
- 💧 **文字水印**：自定义文字 + 九宫格位置 + 透明度调节
- ↩️ **撤销 / 重置**：最多 20 步撤销（Ctrl+Z），一键重置为原图
- 💾 **多格式导出**：PNG / JPG / WebP / PDF（A4 页面自适应居中）
- 🎯 **目标体积压缩**：「压到 N KB」自动二分搜索最接近的质量参数
- 📊 **实时预估**：画布右下角徽章显示当前格式、分辨率与导出体积
- 🔑 **额度系统**：5 次免费导出，激活码永久解锁，全程无需账号

## 🎨 界面设计

| 元素 | 设计 |
| --- | --- |
| 主题 | 深空辉光（Deep Space Glow）：近黑蓝底 + 三层氛围光晕 |
| 面板 | 玻璃拟态：半透明底 + 背景模糊 + 细描边 |
| 强调色 | 蓝→紫渐变主按钮 + 外发光 |
| 页面结构 | 首页 / 工作台双屏整页切换（滚轮 · 触摸 · 键盘 · 箭头） |
| 画布 | 标尺网格底纹 + 空状态提示 + 右下角信息徽章 |
| 动效 | 工具条滑入、光点呼吸、指针特效；尊重系统「减弱动态效果」设置 |

## 🧠 工作原理

```mermaid
flowchart LR
    A[🖼️ 上传图片] --> B[✂️ 画布编辑<br/>裁剪 · 尺寸 · 水印 · 旋转]
    B --> C[⚙️ 导出参数<br/>格式 · 质量 · 目标体积]
    C --> D[💾 本地编码导出<br/>PNG · JPG · WebP · PDF]
    D --> E[⬇️ 浏览器直接下载]
```

1. **本地加载**：`FileReader` 读取图片并绘制到工作画布，原始图独立保存以便随时重置
2. **无痕编辑**：裁剪 / 缩放 / 水印全部通过 Canvas 完成，每步压入撤销栈（最多 20 步）
3. **体积压缩**：设定目标体积后，对质量参数做二分搜索（0.05–0.95，最多 9 轮），取不超过目标的最大质量
4. **PDF 导出**：画布转 JPEG 后经 jsPDF 嵌入 A4 页面，自适应缩放并居中
5. **全程本地**：图片与导出结果均不离开浏览器，无任何服务器参与

## 📁 项目结构

```text
photochange/
├── index.html          # 单页结构：工作台 + 激活弹窗 + 自定义提示
├── style.css           # 深空辉光主题（玻璃拟态 + 氛围光晕）
├── main.js             # 编辑核心：裁剪 / 尺寸 / 水印 / 导出
├── quota.js            # 免费额度计数与激活码校验
├── page-switch.js      # 首页 ↔ 工作台整页切换
├── info-badge.js       # 状态徽章：分辨率与体积实时预估
├── expose.js           # 捕获当前工作画布引用
├── overlay-fix.js      # 选区遮罩绘制兜底
├── pointer-fx.js       # 指针跟随特效
└── wechatpay/
    └── wechatpay.jpg   # 收款码图片
```

## 🚀 快速开始

无需安装任何依赖，任选一种静态服务器即可本地运行：

```bash
git clone https://github.com/Mocas-12/photochange.git
cd photochange
python -m http.server 5173
# 浏览器访问 http://localhost:5173/
```

| 命令 | 说明 |
| --- | --- |
| `python -m http.server 5173` | Python 自带静态服务器（推荐） |
| `npx serve .` | Node 环境替代方案 |

> 推送（push）到 `main` 分支后，GitHub Pages 自动更新线上站点，无需手动构建。

## 🔑 额度与激活

- 免费模式：每台设备内置 5 次免费导出（本地计数，无需注册）
- 用尽后点击导出会自动弹出激活弹窗，可跳转「面包多」获取激活码
- 激活码格式为 `CYxxxS1X`，激活后本设备永久解锁，不限导出次数
- 额度与激活状态保存在浏览器 localStorage，清除浏览器数据会重置

## ❓ 常见问题

<details>
<summary><b>为什么 PNG 没有「质量」选项</b></summary>

- PNG 为无损压缩，不提供有损「质量」参数；文件大小主要由图片内容与分辨率决定
</details>

<details>
<summary><b>填了「压到 N KB」但导出 PNG 没生效</b></summary>

- PNG 无法按体积压缩，应用会弹窗提示并自动改用 JPG 压缩导出
</details>

<details>
<summary><b>PDF 的清晰度如何</b></summary>

- 实际是把当前画布转为 JPEG 嵌入 PDF；清晰度取决于画布分辨率，导出前可先放大尺寸
</details>

<details>
<summary><b>导出文件还是太大怎么办</b></summary>

- 填写「压到 N KB」目标体积，或降低 JPG / WebP 质量，或先在「尺寸」中缩小分辨率
</details>

<details>
<summary><b>换设备 / 清浏览器数据后额度重置了吗</b></summary>

- 是。额度仅保存在本设备 localStorage 中，不与任何账号绑定
</details>

## 🔒 隐私与安全

- 🖼️ 图片全程在浏览器本地处理，**不上传、不落库、不经过任何服务器**
- 🔑 无需注册登录，额度与激活状态仅保存在本设备
- 📊 访客统计只记录匿名计数，不采集个人身份信息

## 📄 许可证

本项目用于学习与演示，未设置开源许可证；如需复用请自行 fork。

---

<div align="center">

**Made with 💙**

🌐 [在线体验](https://mocas-12.github.io/photochange/) · 🐛 [问题反馈](https://github.com/Mocas-12/photochange/issues)

</div>
