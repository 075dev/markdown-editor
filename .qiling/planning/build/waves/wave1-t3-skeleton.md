# Wave1 / T3-skeleton:自动保存设置字段

## 任务卡(摘要)
- 边界:src/stores/settings.ts、src/views/SettingsView.vue、新建 src/stores/settings.autosave.test.ts
- 严格度:LIGHT(store 窄改 + 视图一行开关)
- 验收:worktree 内 vue-tsc 0 错 + settings 三测试文件全绿

## 执行记录
- 实现:autoSaveEnabled:boolean 默认 false(骨架安全默认),纳入 PersistedSettings/load 三分支默认/parsed 读取/watch 持久化/resetAll;setAutoSaveEnabled/toggleAutoSaveEnabled;SettingsView 编辑器组新增开关行(testid autosave-on/off)
- 实现备注:load() 的 if(!raw) 分支为 8 空格缩进,补丁锚点需区分
- worktree 验证:vue-tsc 0 错;vitest settings.autosave/font/settings 29/29

## 提交
- feat:426b38b(3 files, +136/-2)
- merge:3143cfb
