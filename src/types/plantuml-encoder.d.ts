declare module 'plantuml-encoder' {
  /**
   * PlantUML URL 编码器：把 PlantUML 源码编码成可放进 URL 的字符串。
   * 官方 spec：https://plantuml.com/text-encoding
   */
  interface PlantumlEncoder {
    encode(input: string): string
    decode(input: string): string
  }
  const encoder: PlantumlEncoder
  export default encoder
}