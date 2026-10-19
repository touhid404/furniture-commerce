import '../env.js';

export const config = {
  get nodeEnv() {
    return process.env.NODE_ENV;
  },
  get pingUrl() {
    const appUrl = process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
    if (!appUrl) return '';
    try {
      const url = new URL(appUrl);
      return url.protocol === 'https:' ? new URL('/api/v1/health/live', url).href : '';
    } catch {
      return '';
    }
  },
};
