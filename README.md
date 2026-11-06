# 维修工作表系统（weehong-workspace）

器械维修公司的网页管理系统：工作表（维修流程）、零件库（AutoCount）、机械租赁、验车服务、交通运输、日历、通知。

- 网页：React + TypeScript（Vite），部署在 **Cloudflare Pages**
- 登录、数据库、照片：**Firebase**（Google 登录、Firestore、Storage、Cloud Messaging）
- 后端：**Cloudflare Worker**（`worker/`）——AutoCount 同步、推送通知、每日提醒、Google Drive 存档、Google 日历同步

没有填 Firebase 设定时，网页会以**示范模式**运行：资料只存在浏览器里，可以选身份试用全部功能。

---

## 部署步骤

### 1. Firebase

1. https://console.firebase.google.com → 建立项目 `weehong-workspace`，升级到 **Blaze** 方案（Storage 需要；有免费额度，建议设预算提醒）。
2. **Authentication** → 登录方法 → 启用 **Google**。
3. **Firestore Database** → 建立数据库 → 位置 `asia-southeast1`，正式环境模式。
4. **Storage** → 开始使用，位置同上。
5. 在 Firestore 手动加第一个管理员：集合 `users`，文档 ID = 你的 Google 邮箱（**全部小写**），字段：
   `name`（字符串）、`email`（字符串，同文档 ID）、`role` = `admin`（字符串）、`active` = `true`（布尔值）。
   其余设置在你第一次登录时自动建立。
6. **安全规则**：
   - Firestore → 规则：把本仓库 `firestore.rules` 的全部内容贴上 → 发布。
   - Storage → 规则：贴上 `storage.rules` → 发布（问到是否允许读取 Firestore 时选允许）。
7. **索引**：Firestore → 索引 → 复合 → 新增以下 5 个（集合 · 字段）：

   | 集合 | 字段 1 | 字段 2 |
   | --- | --- | --- |
   | notifications | to 递增 | createdAt 递减 |
   | worksheets | status 递增 | updatedAt 递减 |
   | worksheets | plate 递增 | createdAt 递减 |
   | trips | status 递增 | date 递减 |
   | users | role 递增 | active 递增 |

8. 项目设置 → 你的应用 → 网页 `</>` → 注册，记下 `firebaseConfig` 的 6 项。
9. 项目设置 → 云消息传递 → 网络推送证书 → 生成密钥对，记下密钥（VAPID）。
10. 项目设置 → 服务账号 → 生成新的私钥（JSON）。**这个文件是数据库总钥匙，只贴到 Cloudflare 机密变量，不要传给任何人。**

### 2. Cloudflare Pages（网页）

1. https://dash.cloudflare.com → Workers 和 Pages → 建立 → **Pages** → 连接到 Git → 授权 GitHub → 选 `TJP0113/weehong-workspace`。
2. 构建设置：框架预设 **Vite**，构建命令 `npm run build`，输出目录 `dist`。
3. 环境变量：
   - 想先看示范：只加 `VITE_DEMO` = `1`。
   - 接上 Firebase：删掉 `VITE_DEMO`，加入
     `VITE_FIREBASE_API_KEY`、`VITE_FIREBASE_AUTH_DOMAIN`、`VITE_FIREBASE_PROJECT_ID`、`VITE_FIREBASE_STORAGE_BUCKET`、`VITE_FIREBASE_MESSAGING_SENDER_ID`、`VITE_FIREBASE_APP_ID`、`VITE_FIREBASE_VAPID_KEY`、`VITE_API_URL`（第 3 步的 Worker 网址）。
4. 部署后得到网址，例如 `https://weehong-workspace.pages.dev`。
5. 回到 Firebase → Authentication → 设置 → **已授权的网域** → 加入这个网址（不含 https://）。

改了环境变量后，要在 Pages → 部署 → 重新部署一次才会生效。

### 3. Cloudflare Worker（后端）

1. Workers 和 Pages → **KV** → 建立命名空间 `weehong-kv`，记下 ID。
2. 打开 `worker/wrangler.toml`，填入：KV 的 `id`、`FIREBASE_PROJECT_ID`、`APP_URL`（第 2 步网页网址）。提交到 GitHub。
3. Workers 和 Pages → 建立 → **Workers** → 导入存储库 → 选这个仓库，**根目录填 `worker`**，部署命令 `npx wrangler deploy`。
4. Worker → 设置 → 变量和机密 → 新增**机密**：
   - `FIREBASE_SERVICE_ACCOUNT` = 服务账号 JSON 文件的**全部内容**
5. 记下 Worker 网址（例如 `https://weehong-api.<你的账号>.workers.dev`），填到 Pages 的 `VITE_API_URL`，重新部署网页。

Worker 的定时任务：每分钟发送通知；每 15 分钟同步 AutoCount、Google 日历、Drive 存档；每天早上 8 点（马来西亚时间）发提醒。

### 4. Google Drive 与 Google 日历

1. https://console.cloud.google.com → 选同一个 Firebase 项目 → API 和服务 → 启用 **Google Drive API**、**Google Calendar API**。
2. OAuth 同意屏幕：用户类型（有 Google Workspace 选“内部”，否则“外部”），填应用名称和邮箱。外部应用记得按 **发布应用**（测试模式的授权 7 天后会失效）。
3. 凭据 → 建立凭据 → OAuth 客户端 ID → 网络应用 → 已授权的重定向 URI：`https://<Worker 网址>/google/callback`。
4. 把客户端 ID 和密钥加到 Worker 机密：`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`。
5. 用管理员登录系统 → 设置 → 连接与整合 → **连接 Google 账号**，用公司的 Google 账号授权。之后会自动建立“维修工作表系统”文件夹和“机械保养与租期”日历。

### 5. AutoCount（等确认版本后）

AutoCount Accounting 需要订阅 **AutoCount On The Go (AOTG)**，并在装 AutoCount 的电脑运行 AOTG Client（要保持开机联网）。

1. 在 `worker/wrangler.toml` 填 `AUTOCOUNT_BASE_URL` 和三个接口路径（按 AOTG 文档），`AUTOCOUNT_MACHINE_GROUPS` 填 AutoCount 里机械所属的物料组。
2. Worker 机密：`AUTOCOUNT_API_KEY`、`AUTOCOUNT_USERNAME`、`AUTOCOUNT_PASSWORD`。
3. 如果 AOTG 的字段名和 `worker/src/autocount.ts` 里猜测的不同，改那里的 `pick(...)`。

### 6. 弹窗通知

每个员工在自己的手机或电脑上：设置 → 显示与语言 → **在这台设备开启弹窗通知**。
iPhone 要先用 Safari 打开系统，按“分享 → 加到主画面”，再从主画面打开后开启。

---

## 本地开发

```bash
npm install
npm run demo        # 示范模式
cp .env.example .env.local && npm run dev   # 连接真正的 Firebase
cd worker && npm install && npx wrangler dev
```

## 文件结构

```
src/lib/        数据层（Firestore / 示范模式）、登录与权限、通知、设置默认值
src/pages/      各页面；settings/ 是设置分页
src/components/ 共用组件（版面、对话框、列表、零件位置选择）
worker/src/     Cloudflare Worker：autocount / push / drive / calendar
firestore.rules storage.rules firestore.indexes.json   Firebase 规则与索引
```
