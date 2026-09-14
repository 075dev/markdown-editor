# 构建进度台账(骨架阶段)
格式:Wave [N] [task] status:PASS|FAIL|NOT_RUN | acceptance:"..." | strictness:HEAVY|LIGHT | evidence/reason

Wave 1 T1-skeleton status:PASS | acceptance:"worktree vue-tsc 0 错 + vitest errors.test 全绿;合并后主区 cargo check 通过" | strictness:HEAVY | evidence:commits a06145c + errors.test 16/16 + cargo check Finished(merge cdd5f2e)
Wave 1 T3-skeleton status:PASS | acceptance:"worktree vue-tsc 0 错 + settings 三测试文件全绿" | strictness:LIGHT | evidence:commits 426b38b + 29/29(merge 3143cfb)
Wave 1 verify status:PASS | acceptance:"主区 vue-tsc + vitest 全量 + cargo check" | strictness:- | evidence:vue-tsc exit 0;136/136;cargo Finished
Wave 2 T2-skeleton status:PASS | acceptance:"worktree vue-tsc 0 错 + useAutoSave/workspace/watch 测试全绿" | strictness:HEAVY | evidence:commits cc9631b + 34/34(merge bb049df)
Wave 2 verify status:PASS | acceptance:"主区 vue-tsc + vitest 全量 + 宪法门控 grep" | strictness:- | evidence:vue-tsc exit 0;148/148;C1 存量违规 1 处已登记(非本次引入)

# ===== 填充阶段 =====
Wave 1 T1-fill status:PASS | acceptance:"worktree vue-tsc 0 错 + errors/fileService/EditorPane 三测试 39/39;主区全量不回退" | strictness:HEAVY | evidence:commit 367a0a0(merge e0659c9)+ vitest 39/39 + 173/173
Wave 1 T3-fill status:PASS | acceptance:"worktree vue-tsc 0 错 + settings.autosave 9/9;文案含防抖/失焦/重试/安全网语义" | strictness:LIGHT | evidence:commit 81aa742(merge 8eea2eb)+ 9/9
Wave 1 verify status:PASS | acceptance:"主区 vue-tsc + vitest 全量 173/173 + cargo check" | strictness:- | evidence:vue-tsc exit 0;173/173(基线 148 净增 25);cargo Finished 0.36s
Wave 2 T2-fill status:PASS | acceptance:"worktree vue-tsc 0 错 + vitest 全量 201/201;边缘场景表 9 条逐条落地并有测试" | strictness:HEAVY | evidence:commit 89cb132(merge 7714952)+ 201/201(diff 6 文件全在边界内)
Wave 2 verify status:PASS | acceptance:"主区 vue-tsc + vitest 全量不回退 + C1/残留 grep" | strictness:- | evidence:vue-tsc exit 0;201/201(基线 173 净增 28);C1 仅存量 plantumlRehype.ts:53

# ===== 修复轮(round 1,评审 verdict: criticals_found) =====
Round 1 C1-fix status:PASS | acceptance:"mount HomeView → 编辑 → advanceTimers 越过 1500ms → saveMarkdownFile 被调;开关关闭不被调;卸载后不再触发" | strictness:HEAVY | evidence:commit 071cfad + HomeView.autosave.test.ts 3/3
Round 1 F2-fix status:PASS | acceptance:"安排保存后关闭开关→advanceTimers→不写盘;重试链中途关闭→剩余重试全部停止" | strictness:HEAVY | evidence:commit 52e0a1f + useAutoSave.test.ts 23/23(新增 3 例)
Round 1 F3-fix status:PASS | acceptance:"两标签同冲突,横幅逐标签渲染,点第一条目按钮只写盘该标签,另一条保持冲突" | strictness:LIGHT | evidence:commit 464e90f + AutoSaveBanner.test.ts 9/9(新增多标签用例)
Round 1 F4-fix status:PASS | acceptance:"读盘失败保持 conflict + error 通知;读盘期间切换标签仍按 path 正确落 clean、不污染新活动标签;读盘期间关标签不复活" | strictness:HEAVY | evidence:commit 06e9134 + workspace.watch.test.ts 21/21(新增 5 例)+ AutoSaveBanner 失败保持用例
Round 1 verify status:PASS | acceptance:"vue-tsc 0 错 + vitest 全量不回退(基线 201 只增不减)" | strictness:- | evidence:vue-tsc exit 0;214/214,25 文件(净增 13,全部为修复回归测试)
