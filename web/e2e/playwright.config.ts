import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 테스트 설정
 * vais-monitor 프론트엔드 (http://localhost:8080) 기준
 */

const isCI = !!process.env.CI

export default defineConfig({
  // 테스트 파일 위치
  testDir: './tests',

  // 결과물 저장 디렉토리
  outputDir: './test-results',

  // 전체 테스트 타임아웃 (ms)
  timeout: 30000,

  // expect() 어서션 타임아웃 (ms)
  expect: {
    timeout: 5000,
  },

  // 실패 시 재시도 횟수: 로컬 1회, CI 2회
  retries: isCI ? 2 : 1,

  // 병렬 워커 수: CI에서는 단일 프로세스로 안정성 확보
  workers: isCI ? 1 : undefined,

  // 리포터 설정: HTML 보고서 + 콘솔 목록
  reporter: [
    ['html', { outputFolder: './playwright-report', open: 'never' }],
    ['list'],
  ],

  // 모든 프로젝트에 공통 적용되는 설정
  use: {
    // 테스트 대상 baseURL
    baseURL: 'http://localhost:8080',

    // 실패한 테스트에 대해 trace 수집
    trace: 'on-first-retry',

    // 실패 시 스크린샷 자동 저장
    screenshot: 'only-on-failure',

    // 실패 시 비디오 녹화
    video: 'on-first-retry',
  },

  // 브라우저별 테스트 프로젝트
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // webkit은 선택적으로 활성화 (macOS/Linux 환경 필요)
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // 테스트 실행 전 개발 서버 자동 시작
  webServer: {
    // 프론트엔드 빌드 결과를 서빙하는 명령
    command: 'cd .. && vaisc build app/layout.vaisx --target js -o dist/ && npx serve dist -p 8080',
    url: 'http://localhost:8080',
    // 이미 실행 중인 서버 재사용 여부 (개발 중 편의)
    reuseExistingServer: !isCI,
    // 서버 시작 대기 타임아웃 (ms)
    timeout: 60000,
  },
})
