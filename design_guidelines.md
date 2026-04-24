# 旅行路线生成器 - 设计指南

## 1. 品牌定位

**应用定位**：旅行路线规划工具，帮助用户收集旅行灵感并自动生成行程路线。

**设计风格**：极简旅行风，干净利落，操作直观

**目标用户**：自由行旅行者、结伴出行的小团体

**核心原则**：
- 按钮式交互，禁止对话界面
- 所有操作不超过3步
- 文案不出现"AI"、"智能"字眼，用"自动规划"、"系统推荐"

## 2. 配色方案

### 主色调（蓝色系 - 旅行/天空/海洋联想）
```
--primary: #3B82F6          /* 主蓝色 */
--primary-hover: #2563EB    /* 深蓝 */
--primary-light: #EFF6FF    /* 浅蓝背景 */

--secondary: #10B981        /* 绿色 - 确认/成功 */
--accent: #F59E0B           /* 橙色 - 强调/提醒 */
```

### 中性色
```
--background: #FFFFFF       /* 页面背景 */
--surface: #F8FAFC          /* 卡片背景 */
--border: #E2E8F0           /* 边框色 */
--text-primary: #1E293B     /* 主要文字 */
--text-secondary: #64748B    /* 次要文字 */
--text-muted: #94A3B8       /* 弱化文字 */
```

### 来源平台色
```
--xiaohongshu: #FF2442      /* 小红书红 */
--dazhong: #FF6600           /* 大众点评橙 */
--damai: #00B51D            /* 大麦绿 */
```

### 标签色
```
--tag-spot: #3B82F6         /* 景点 - 蓝色 */
--tag-food: #F59E0B         /* 美食 - 橙色 */
--tag-show: #8B5CF6         /* 演出 - 紫色 */
--tag-hotel: #10B981        /* 住宿 - 绿色 */
```

## 3. 字体规范

```
--font-heading: "PingFang SC", "Helvetica Neue", sans-serif
--font-body: "PingFang SC", "Helvetica Neue", sans-serif

H1 (页面标题): 20px, font-weight: 600
H2 (模块标题): 18px, font-weight: 600
H3 (卡片标题): 16px, font-weight: 500
Body: 14px, font-weight: 400
Caption: 12px, font-weight: 400
```

## 4. 间距系统

```
--page-padding: 16px        /* 页面水平边距 */
--card-padding: 12px         /* 卡片内边距 */
--section-gap: 16px         /* 区块间距 */
--item-gap: 12px            /* 列表项间距 */
--button-height: 48px        /* 主按钮高度 */
--bottom-safe: 84px          /* 底部安全区 */
```

## 5. 圆角系统

```
--radius-sm: 8px            /* 小按钮/标签 */
--radius-md: 12px           /* 卡片/输入框 */
--radius-lg: 16px          /* 大卡片/弹窗 */
--radius-full: 9999px      /* 全圆角胶囊 */
```

## 6. 阴影系统

```
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05)
--shadow-md: 0 4px 6px rgba(0,0,0,0.07)
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1)
```

## 7. 组件使用原则

### 必须优先使用 @/components/ui/* 组件
- Button (按钮)
- Card (卡片容器)
- Badge (标签)
- Tabs (版本切换)
- Dialog/Drawer (弹窗)
- Input/Textarea (表单)
- Slider (滑块)
- Calendar (日历)
- Progress (进度条)
- Skeleton (加载态)

### 禁止手搓通用组件
- 禁止用 View/Text 手搓按钮
- 禁止用 View/Text 手搓输入框
- 禁止用 View/Text 手搓弹窗
- 禁止用 View/Text 手搓卡片

### 瀑布流卡片实现
- 使用 CSS columns 或 Grid 布局
- 图片使用 AspectRatio 组件保持比例
- 卡片使用 Card 组件

## 8. 页面结构

### 页面1：首页（灵感池）
- 顶部导航：标题 + 添加按钮
- 瀑布流灵感列表（卡片形式）
- 底部固定"生成路线"按钮

### 页面2：路线设置页
- 日期选择（Calendar）
- 天数滑块（Slider 1-7）
- 预算滑块（Slider 可选）
- 出行方式单选（RadioGroup）
- 底部"开始生成"按钮

### 页面3：路线展示页
- 顶部Tab切换版本
- 日程列表（按天分组）
- 底部操作栏

### 页面4-5：投票页/结果页
- 横向滑动卡片
- 进度条显示票数
- 投票/确认按钮

## 9. 状态展示

### 空状态
- 图标 + 简短文案 + 操作按钮
- 文案示例："暂无灵感，添加旅行目的地吧"

### 加载态
- 使用 Skeleton 骨架屏
- 卡片列表展示灰色占位块

### 成功/失败提示
- 使用 Sonner 轻提示
- 3秒自动消失

## 10. 交互反馈

### 按钮点击
- 按下态：opacity 0.8 + scale 0.98

### 卡片操作
- 长按显示删除按钮
- 左滑也可删除

### 表单验证
- 实时校验，红色边框提示
- 错误文案显示在输入框下方

## 11. 小程序约束

### 包体积优化
- 图片资源走 TOS 对象存储
- 禁止打包大图片
- 使用 iconfont 替代 icon 图片

### 性能优化
- 列表使用懒加载
- 图片使用懒加载
- 避免频繁 setData

### 兼容适配
- 适配不同屏幕尺寸
- iOS/Android 微信版本兼容
