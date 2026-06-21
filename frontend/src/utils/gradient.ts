export const FALLBACK_GRADIENTS = ['#fa233b,#fb5c74', '#34c759,#30d158', '#0a84ff,#5ac8fa', '#bf5af2,#da8fff', '#ff9f0a,#ffd60a']

export function gradientFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length]
}
