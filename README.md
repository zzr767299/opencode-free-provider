# opencode-free-provider

把 **OpenCode Zen 免费模型**转成本地 **OpenAI 兼容接口**，让 ZCode、DeepSeek Harness、Cline、Continue、Aider、OpenCode 等任意客户端都能直接调用。

> 本项目是 [jcleng/opencode-free-provider](https://github.com/jcleng/opencode-free-provider) 的 Windows 友好封装版：补齐了启动脚本、修掉了非 ASCII 路径下无法启动的问题，并整理了中文使用文档。上游代码版权归其作者所有，详见 [NOTICE](NOTICE)。

---

## 特性

- 零依赖，只需要 Node.js 18+，不需要 `npm install`
- 同时支持流式（SSE）和非流式响应
- 支持函数调用 / 工具调用（tool calls），大小写工具名都能正确回传
- 监听 `127.0.0.1:8791`，只对本机开放，不对外暴露
- 自动处理上游的客户端指纹校验，调用方无感

## 环境要求

- Node.js 18 或更高版本（[下载](https://nodejs.org)）
- Windows / macOS / Linux 均可

## 快速开始

### Windows

双击 `run-proxy.cmd`。看到下面这行就说明启动成功：

```
[opencode-free-provider] listening on http://127.0.0.1:8791/v1
```

窗口会一直开着，代理就在里面运行；关掉窗口即停止。重复双击会提示 `Proxy is already running`，不会启动第二个实例。

### 命令行（全平台）

```bash
cd opencode-free-provider
node run.mjs
```

### 验证

```bash
curl http://127.0.0.1:8791/v1/models
```

应该返回一个 JSON 模型列表。

---

## 接入 ZCode

在 ZCode 的「管理模型 / 添加提供方」中新建一个 OpenAI 兼容提供方：

| 配置项 | 值 |
| --- | --- |
| 接口类型 | `openai-chat-completions`（OpenAI 兼容） |
| Base URL | `http://127.0.0.1:8791/v1` |
| API Key | `public`（任意非空字符串均可） |
| 模型名 | `opencode-free/deepseek-v4.1-flash-free` |

推荐从 `opencode-free/deepseek-v4.1-flash-free` 开始，响应最快也最稳定。

## 接入其他客户端

任何支持自定义 `baseURL` 的 OpenAI 兼容客户端，参数都一样：

```
Base URL: http://127.0.0.1:8791/v1
API Key:  public
Model:    opencode-free/<模型名>
```

例如 Cline、Continue、Aider、Roo Code、各种 OpenCode 分支。

### 直接用 curl 测试

```bash
curl http://127.0.0.1:8791/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer public" \
  -d '{
    "model": "opencode-free/deepseek-v4.1-flash-free",
    "stream": false,
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

---

## 可用模型

模型列表来自上游实时同步，以 `GET /v1/models` 的返回为准。当前免费档包括：

| 模型 ID | 说明 |
| --- | --- |
| `opencode-free/deepseek-v4.1-flash-free` | DeepSeek V4.1 Flash，速度快，推荐首选 |
| `opencode-free/glm-5.3-flash-free` | GLM 5.3 Flash |
| `opencode-free/minimax-m3.1-flash-free` | MiniMax M3.1 Flash |
| `opencode-free/longcat-2.5-preview-free` | LongCat 2.5 Preview |
| `opencode-free/mimo-v2.6-flash-free` | MiMo V2.6 Flash |
| `opencode-free/big-pickle` | DeepSeek V4 Flash 别名，响应较慢 |
| `opencode-free/beam-free` | Beam Free |
| `opencode-free/nemotron-3.5-lightning-free` | NVIDIA Nemotron 3.5 Lightning |
| `opencode-free/nemotron-3.5-super-vl-free` | NVIDIA Nemotron 3.5 Super VL |
| `opencode-free/jev-1.13-free` | Jev 1.13 |

免费模型是**限时供应**，随时可能下线、改名或被限流。

---

## 工作原理

OpenCode 免费层的上游地址是 `https://opencode.ai/inference/v1`（也兼容 `/zen/v1`），协议本身是 OpenAI 兼容的，但加了一道**客户端指纹网关**。裸请求会被拒绝：

```
403 FreeTierError: OpenCode's free tier can only be used from within OpenCode
```

放行需要同时满足：

| 条件 | 要求 |
| --- | --- |
| `User-Agent` | `opencode/1.18` 或更高 |
| `x-opencode-session` | `ses_` + 12 位小写 hex + 14 位 base62 |
| 请求体 `stream` | 必须为 `true` |
| 请求体 `tools` | 必须包含 `bash`、`glob`、`grep`、`read` 四个小写工具名，且不能重名 |

本代理会在转发时自动补齐这些特征，并把模型回传的工具调用名映射回调用方自己的工具名（例如把 `bash` 映射回 `Bash`），所以客户端不需要做任何改造。

---

## 常见问题

**双击后窗口一闪而过**
批处理文件必须是 CRLF 行尾。如果用编辑器改过 `run-proxy.cmd`，注意保存为 CRLF；另外不要用 `node server.js` 直接启动（见下一条）。

**`node server.js` 没有监听、进程直接退出**
`server.js` 用字符串比较 `import.meta.url` 和 `process.argv[1]` 判断是否直接运行，在 Windows 中文路径下 URL 是百分号编码的，比较永远失败。用 `node run.mjs` 或 `run-proxy.cmd` 即可。

**返回 403 FreeTierError**
请求缺少指纹特征。用本项目启动的代理不会有这个问题；如果你是自己直连上游，需要补齐上面表格里的四项。

**返回 429**
免费层按 IP 限流，等一会儿再试，或者换一个出口 IP。

**某个模型一直不返回**
免费模型稳定性不一。实测 `glm-5.3-flash-free` 有时会挂起，换 `deepseek-v4.1-flash-free` 即可。

**端口被占用**
默认端口 8791 被其他程序占用时，可以用环境变量 `PORT` 指定其他端口，同时记得同步修改客户端的 Base URL。

---

## 法律与风险提示

**请在使用前完整阅读。使用本项目即表示你已知悉并自行承担以下风险。**

1. **可能违反 OpenCode 的服务条款。**
   免费层设置了客户端指纹校验，其意图就是限制只能在 OpenCode 客户端内使用。通过代理绕过该校验，很可能违反 OpenCode / SST 的服务条款。由此导致的**账号限流、封禁或其他处罚，由使用者自行承担**，本项目作者不承担任何责任。

2. **免费额度是限时优惠。**
   上游明确标注为 limited-time free。模型可能随时下线、改价或整个免费层被关闭，本项目对此没有任何控制能力。

3. **数据隐私风险。**
   部分免费模型（如 `beam-free`、`big-pickle`、`mimo-*`）会用提交的请求数据改进模型。**不要通过本项目发送密钥、密码、个人隐私、商业机密或任何敏感代码。** 需要零留存时可选择 `deepseek-v4.1-flash-free`、`glm-5.3-flash-free`、`minimax-m3.1-flash-free`、`longcat-2.5-preview-free` 等标注零留存的模型，但该标注由上游单方面提供，本项目无法验证。

4. **仅供个人学习与研究。**
   请勿用于商业转售、对外提供 API 服务、大规模分发或任何自动化滥用行为。本代理默认绑定 `127.0.0.1` 且没有鉴权，**不要把它暴露到公网**，否则任何人都能白嫖你的出口 IP 并触发限流。

5. **无任何担保。**
   本软件按 "AS IS" 提供，不附带任何明示或暗示的担保。因使用本项目造成的任何直接或间接损失（包括但不限于账号封禁、数据泄露、服务中断），作者均不承担责任。

6. **第三方商标与内容。**
   OpenCode 及相关模型名称归其各自权利人所有。本项目与 OpenCode、SST 及各模型提供方没有任何隶属或背书关系。

如果你不能接受上述任意一条，请不要使用本项目。

---

## 许可与致谢

- 本仓库整体以 [Apache License 2.0](LICENSE) 发布。
- `opencode-free-provider/` 目录的代码来自 [jcleng/opencode-free-provider](https://github.com/jcleng/opencode-free-provider)，该项目在其 `package.json` 中声明为 MIT 许可。原始版权归其作者所有，MIT 许可文本与署名见 [NOTICE](NOTICE)。
- 感谢 OpenCode 提供免费模型额度，以及上游项目作者的开源工作。
