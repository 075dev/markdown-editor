<script setup lang="ts">
/**
 * 语法速查浮层(add-006)。
 *
 * 行为约定(见 event-flow.md add-006):
 *   - role="dialog" + aria-label;打开即聚焦搜索框。
 *   - 浮层只拦截 Esc / Tab:Esc 关闭并归还焦点,Tab 在浮层内循环(focus trap)。
 *     其余全局快捷键(Ctrl+S 等)不归这里管,HomeView 的处理器照常生效。
 *   - 关键词对条目的 title / description / snippet 做大小写不敏感包含匹配,
 *     无匹配时显示空态。
 *   - 复制只写剪贴板,绝不往编辑器插内容;按钮反馈按条目 id 独立,1.5s 复位。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { cheatSections, type CheatEntry } from '@/data/syntaxCheatsheet'
import { useSyntaxCheatsheet } from '@/composables/useSyntaxCheatsheet'
import { writeClipboard } from '@/services/selection'

const sheet = useSyntaxCheatsheet()

const dialogRoot = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const keyword = ref('')

/** 打开时聚焦搜索框;每次打开清空上次的关键词,内容回到全量六节。 */
watch(
  () => sheet.open.value,
  async (open) => {
    if (!open) return
    keyword.value = ''
    await nextTick()
    searchInput.value?.focus()
  },
)

/** 过滤后仍非空的节;全部为空时展示空态。 */
const filteredSections = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return cheatSections
  return cheatSections
    .map((section) => ({
      ...section,
      entries: section.entries.filter(
        (entry) =>
          entry.title.toLowerCase().includes(kw) ||
          entry.description.toLowerCase().includes(kw) ||
          entry.snippet.toLowerCase().includes(kw),
      ),
    }))
    .filter((section) => section.entries.length > 0)
})

/* ---------- 复制反馈:按条目 id 独立状态 + 定时复位 ---------- */

type CopyState = 'idle' | 'copied' | 'failed'
const copyStates = ref<Record<string, CopyState>>({})
const copyTimers = new Map<string, ReturnType<typeof setTimeout>>()

function copyLabel(entry: CheatEntry): string {
  const state = copyStates.value[entry.id] ?? 'idle'
  if (state === 'copied') return '已复制'
  if (state === 'failed') return '复制失败'
  return '复制'
}

async function copySnippet(entry: CheatEntry) {
  const result = await writeClipboard(entry.snippet)
  copyStates.value[entry.id] = result.ok ? 'copied' : 'failed'
  // 连续点击同一按钮时重置旧定时器,避免提前复位
  const prev = copyTimers.get(entry.id)
  if (prev) clearTimeout(prev)
  copyTimers.set(
    entry.id,
    setTimeout(() => {
      copyStates.value[entry.id] = 'idle'
      copyTimers.delete(entry.id)
    }, 1500),
  )
}

onBeforeUnmount(() => {
  copyTimers.forEach((t) => clearTimeout(t))
  copyTimers.clear()
})

/* ---------- Esc 关闭 + Tab 焦点循环 ---------- */

function onDocKeydown(e: KeyboardEvent) {
  if (!sheet.open.value) return
  const dialog = dialogRoot.value
  if (!dialog) return
  if (e.key === 'Escape') {
    e.preventDefault()
    sheet.closeSheet()
    return
  }
  if (e.key === 'Tab') {
    // 简洁 focus trap:浮层打开期间 Tab 只在内部可聚焦元素间循环
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusables.length === 0) return
    e.preventDefault()
    const idx = focusables.indexOf(document.activeElement as HTMLElement)
    const step = e.shiftKey ? -1 : 1
    const next = focusables[(idx + step + focusables.length) % focusables.length]
    next?.focus()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onDocKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="sheet.open.value" class="cheatsheet" data-testid="cheatsheet-overlay">
      <!-- 遮罩点击关闭:与右键菜单「点外面关闭」的交互惯例一致 -->
      <div class="cheatsheet__mask" data-testid="cheatsheet-mask" @click="sheet.closeSheet()"></div>
      <div
        ref="dialogRoot"
        class="cheatsheet__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="语法速查"
        data-testid="cheatsheet-dialog"
      >
        <header class="cheatsheet__header">
          <h2 class="cheatsheet__title">语法速查</h2>
          <input
            ref="searchInput"
            v-model="keyword"
            class="cheatsheet__search"
            type="text"
            placeholder="搜索语法…"
            aria-label="搜索语法"
            data-testid="cheatsheet-search"
          />
          <button
            type="button"
            class="cheatsheet__close"
            data-testid="cheatsheet-close"
            title="关闭 (Esc)"
            aria-label="关闭语法速查"
            @click="sheet.closeSheet()"
          >
            ✕
          </button>
        </header>
        <div class="cheatsheet__body">
          <template v-if="filteredSections.length > 0">
            <section
              v-for="section in filteredSections"
              :key="section.id"
              class="cheatsheet__section"
              :data-section-id="section.id"
            >
              <h3 class="cheatsheet__section-title">{{ section.title }}</h3>
              <div
                v-for="entry in section.entries"
                :key="entry.id"
                class="cheatsheet__entry"
                :data-entry-id="entry.id"
              >
                <div class="cheatsheet__entry-head">
                  <strong class="cheatsheet__entry-title">{{ entry.title }}</strong>
                  <button
                    type="button"
                    class="cheatsheet__copy"
                    :data-testid="`cheatsheet-copy-${entry.id}`"
                    @click="copySnippet(entry)"
                  >
                    {{ copyLabel(entry) }}
                  </button>
                </div>
                <p class="cheatsheet__entry-desc">{{ entry.description }}</p>
                <pre class="cheatsheet__snippet"><code>{{ entry.snippet }}</code></pre>
              </div>
            </section>
          </template>
          <p v-else class="cheatsheet__empty" data-testid="cheatsheet-empty">无匹配条目</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 遮罩铺满视口;卡片居中、限宽限高,窄窗口不溢出 */
.cheatsheet {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.cheatsheet__mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.cheatsheet__dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(820px, 100%);
  max-height: 80vh;
  background: var(--bg);
  color: var(--text-1);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-2);
  overflow: hidden;
}

.cheatsheet__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}

.cheatsheet__title {
  margin: 0;
  font-size: 15px;
  color: var(--text-1);
  white-space: nowrap;
}

.cheatsheet__search {
  flex: 1;
  min-width: 0;
  height: 28px;
}

.cheatsheet__close {
  flex: 0 0 auto;
  border: 1px solid var(--border);
  color: var(--text-2);
}

.cheatsheet__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 16px 20px;
}

.cheatsheet__section + .cheatsheet__section {
  margin-top: 18px;
}

.cheatsheet__section-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--accent-text);
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
}

.cheatsheet__entry {
  padding: 8px 0;
}

.cheatsheet__entry + .cheatsheet__entry {
  border-top: 1px dashed var(--border);
}

.cheatsheet__entry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cheatsheet__entry-title {
  font-size: 13px;
  color: var(--text-1);
}

.cheatsheet__copy {
  flex: 0 0 auto;
  font-size: 12px;
  padding: 1px 8px;
  color: var(--text-2);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
}

.cheatsheet__entry-desc {
  margin: 4px 0 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-2);
}

.cheatsheet__snippet {
  margin: 0;
  padding: 8px 10px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
  overflow-x: auto;
}

.cheatsheet__snippet code {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-1);
  white-space: pre;
}

.cheatsheet__empty {
  margin: 24px 0;
  text-align: center;
  color: var(--text-3);
}
</style>
