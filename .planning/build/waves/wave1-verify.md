# Wave 1 波次验证(主工作区 ql/phase-1-autosave @ 8eea2eb)

| 门 | 命令 | 结果 |
|----|------|------|
| 类型 | ./node_modules/.bin/vue-tsc --noEmit | PASS(exit 0) |
| 单测 | ./node_modules/.bin/vitest run | PASS 173/173(基线 148 + 新增 25,零回退) |
| Rust | cargo check(src-tauri) | PASS Finished 0.36s(唯一 warning 为既有 health_url dead_code,无新增) |

目标化检查:T1 产出 QlError/FILE_WRITE_FAILED 判别面与 T3 文案语义一致,未破坏骨架既有接口(saveActive 签名不变,HomeView Ctrl+S 路径无感知)。
