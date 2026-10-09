# Wave 1 / T3-fill:设置开关联动

- 分支:ql/wave1-t3-fill → 提交 81aa742 → merge 8eea2eb
- 严格度:LIGHT
- 执行:worktree wt-t3-fill 隔离

## 文件边界(实测一致)
- 修改:src/views/SettingsView.vue、src/stores/settings.ts、src/stores/settings.autosave.test.ts

## 实现内容
1. 开关说明文案更新为填充态语义:内容变更 1.5 秒后自动保存、窗口失焦立即保存全部未保存标签、保存失败自动重试、关闭后仅 Ctrl+S 且冲突安全网仍生效
2. settings.ts autoSaveEnabled 注释同步填充态行为
3. 补测:toggle / resetAll 两条 localStorage 写回路径

## DoD 检查单
- [x] worktree vue-tsc 0 错;settings.autosave.test 9/9
- [x] 字段与持久化正确性确认(既有 7 例 + 新增 2 例)
- [x] 开关关闭→useAutoSave 完全不触发的联动测试归 T2(useAutoSave.test 已有骨架用例,T2 补 blur 维度)
