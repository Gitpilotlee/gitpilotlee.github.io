# Gitpilotlee 个人主页

白色亮釉陶瓷杯个人网站，白天采用白色与蓝色按钮，支持深浅主题和近 365 天 GitHub 贡献趋势。

网站：部署完成后为 https://gitpilotlee.github.io/

## 部署

把这些文件上传到 Gitpilotlee/gitpilotlee.github.io 的 main 分支。
在 Settings → Pages 中选择 Deploy from a branch → main → / (root)。
仓库根目录必须包含 index.html；不要把所有文件再套在一个文件夹里。

## 修改

- index.html：个人介绍和区块结构
- style.css：日夜主题与布局
- app.js：仓库、贡献记录、主题切换
- assets/language-heat-mug.png：原创陶瓷杯图片

杯身为 TypeScript、Python、JavaScript 的艺术热力图，依据 GitHub Octoverse 2026；点击页面上的语言热度依据可查看来源。

贡献趋势来源为 GitHub Contributions API，包含符合 GitHub 规则的提交、PR、Issue 等活动，可能缓存约一小时。
