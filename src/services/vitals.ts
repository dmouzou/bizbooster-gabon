import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';

export function initWebVitals(onReport?: (metric: Metric) => void) {
  const reporter = onReport || ((metric: Metric) => {
    if (import.meta.env.DEV) {
      console.log(`[Web Vitals] ${metric.name}:`, Math.round(metric.value), metric);
    }
  });

  try {
    onCLS(reporter);
    onINP(reporter);
    onLCP(reporter);
    onFCP(reporter);
    onTTFB(reporter);
  } catch (err) {
    console.warn('Failed to initialize web-vitals:', err);
  }
}
