# 公众号接入指南

## 概述

本文档说明如何配置微信公众号（订阅号）接收用户发送的链接，并自动收录到旅行灵感库。

## 整体架构

```
用户发送链接 → 微信服务器 → 开发者服务器 → 解析链接 → 存储到数据库
                        ↓
                  返回"已收录"给用户

用户打开小程序 → 微信登录 → 获取同一 OpenID → 显示已收录灵感
```

## 配置步骤

### 1. 获取公众号的 AppID 和 AppSecret

登录微信公众平台：https://mp.weixin.qq.com

1. 进入「设置与开发」→「基本配置」
2. 记录 AppID 和 AppSecret（AppSecret 需要点击「重置」获取）

### 2. 配置服务器地址（URL）

1. 进入「设置与开发」→「基本配置」
2. 点击「服务器配置」旁边的「修改」按钮
3. 填写以下信息：
   - **URL**：填写你的后端服务器地址，例如：`https://your-domain.com/api/message/receive`
   - **Token**：自定义一个 Token，用于验证请求来源
   - **EncodingAESKey**：点击「随机生成」获取
   - **消息加密方式**：选择「明文模式」或「安全模式」

### 3. 配置后端环境变量

在后端服务器添加以下环境变量：

```bash
# 微信公众号配置
WECHAT_APPID=wx_your_appid
WECHAT_APPSECRET=your_appsecret
WECHAT_TOKEN=your_token

# 服务器域名（用于回调）
SERVER_DOMAIN=https://your-domain.com
```

### 4. 验证服务器地址

配置完成后，点击「提交」按钮。微信会发送一个 GET 请求到你的服务器进行验证。

后端需要返回 `echostr` 参数才能验证通过。

### 5. 启用服务器配置

验证通过后，点击「启用」按钮。

## 消息处理流程

### 接收消息格式

微信服务器会发送 XML 格式的消息：

```xml
<xml>
  <ToUserName><![CDATA[gh_xxxxxxx]]></ToUserName>
  <FromUserName><![CDATA[oXXXXX]]></FromUserName>  <!-- 用户OpenID -->
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[https://www.xiaohongshu.com/...]]></Content>
  <CreateTime>1234567890</CreateTime>
</xml>
```

### 处理逻辑

1. 解析消息，获取 `FromUserName`（用户 OpenID）
2. 通过 OpenID 查询/创建用户
3. 解析消息内容中的链接
4. 调用链接解析服务获取标题、类型等信息
5. 存储到数据库（关联到该用户）
6. 返回「已收录」消息给用户

### 支持的消息类型

| 消息类型 | 说明 |
|---------|------|
| text | 文本消息（包含链接） |
| link | 链接消息（用户分享的链接卡片） |

### 支持的平台

| 平台 | 识别方式 | 类型判断 |
|------|---------|---------|
| 小红书 | xiaohongshu.com / xhslink.com | 根据内容判断 |
| 大众点评 | dianping.com | 根据内容判断 |
| 大麦 | damai.cn | show |
| 携程 | ctrip.com | spot/hotel |
| 马蜂窝 | mafengwo.cn | spot |
| 抖音 | douyin.com | 根据内容判断 |
| 其他 | 通用解析 | spot |

## 小程序端配置

### 获取用户 OpenID

在小程序端调用 `wx.login()` 获取 code，然后调用后端接口换取 OpenID：

```typescript
// 小程序端
const loginRes = await Taro.login()
// 将 code 发送到后端
const res = await Network.request({
  url: '/api/wx/code2session',
  method: 'POST',
  data: { code: loginRes.code }
})
// 后端返回 openid
```

### 获取灵感列表

```typescript
const res = await Network.request({
  url: '/api/trip/inspirations',
  method: 'GET',
  data: { userId: 用户ID }
})
```

## 常见问题

### Q: 公众号必须认证吗？

A: 个人订阅号也可以使用消息接收功能，无需认证。但建议完成基本设置。

### Q: 小程序和公众号的 OpenID 一样吗？

A: 同一用户对小程序的 OpenID 和对公众号的 OpenID **可能不同**，取决于是否在同一个主体下。
- 如果小程序和公众号在同一个公众号账号下创建，OpenID 相同
- 如果不在同一主体下，需要通过 UnionID 关联

### Q: 如何获取 UnionID？

A: 需要用户授权获取用户信息，且公众号需完成微信认证。用户通过公众号授权后，可以获取 UnionID。

### Q: 消息收不到怎么办？

A: 检查：
1. 服务器是否正常响应
2. URL 是否可公网访问
3. 消息加密方式是否匹配
4. 查看后端日志排查错误

## 安全建议

1. **启用消息加密**：生产环境建议使用安全模式
2. **配置 IP 白名单**：在微信公众平台配置服务器 IP 白名单
3. **Token 保密**：不要泄露 Token
4. **日志记录**：记录所有消息处理日志便于排查

## 示例响应

用户发送链接后，公众号自动回复：

```
🏛️ 已收录！

上海外滩夜景攻略 | 外滩超美打卡点分享

类型：景点
来源：小红书

请打开小程序查看您的灵感库～
```
