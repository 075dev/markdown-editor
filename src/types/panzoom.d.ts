declare module 'panzoom' {
  /**
   * panzoom 实例由 `panzoom()` 调用返回。
   * panzoom 9.x 没有官方 .d.ts，下面是基于其 README 的最小可用类型描述。
   */
  export interface PanZoomOptions {
    /** 缩放下限，默认 0.1 */
    minZoom?: number
    /** 缩放上限，默认 10 */
    maxZoom?: number
    /** 缩放步长（每次滚轮 / 按钮），默认 1.1 或按实现 */
    zoomSpeed?: number
    /** 初始缩放 */
    initialZoom?: number
    /** 初始 X 偏移（CSS 像素） */
    initialX?: number
    /** 初始 Y 偏移 */
    initialY?: number
    /** 禁用平移 */
    bounds?: boolean
    /** 平移时是否带边界限制 */
    boundsPadding?: number
    /** 是否平滑动画 */
    smoothScroll?: boolean
    /** 自定义滚轮事件过滤器：返回 false 阻止缩放 */
    beforeWheel?: (e: WheelEvent) => boolean
    /** 自定义鼠标按下过滤器 */
    beforeMouseDown?: (e: MouseEvent) => boolean
    /** 自定义双击过滤器 */
    beforeDoubleClick?: (e: MouseEvent) => boolean
    /** DOM 事件监听对象 */
    owner?: EventTarget
  }

  export interface PanZoomInstance {
    /** 当前变换 */
    getTransform(): { x: number; y: number; scale: number }
    /** 平移到指定点 */
    moveTo(x: number, y: number): void
    /** 应用变换（瞬时）：zoomTo(x, y, scale) */
    zoomTo(x: number, y: number, scale: number): void
    /** 围绕 (x, y) 缩放到 zoomAbs 倍率 */
    zoomAbs(x: number, y: number, zoomAbs: number): void
    /** 销毁实例，移除事件监听 */
    dispose(): void
    /** 平移 / 缩放事件订阅 */
    on(event: 'panstart' | 'panmove' | 'panend' | 'zoom', cb: (...args: unknown[]) => void): void
  }

  export function panzoom(target: HTMLElement | SVGElement, opts?: PanZoomOptions): PanZoomInstance
}