import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  testMatch:'**/*.e2e.ts',
  fullyParallel:false,
  workers:1,
  timeout:45_000,
  expect:{timeout:10_000},
  outputDir:'test-results/e2e',
  reporter:[['list'],['html',{open:'never',outputFolder:'playwright-report'}]],
  use:{
    baseURL:process.env.PLAYWRIGHT_BASE_URL||'http://localhost:3000',
    trace:'retain-on-failure',screenshot:'only-on-failure',video:'off',
    reducedMotion:'reduce',
  },
  projects:[
    {name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1440,height:960}}},
    {name:'mobile-chromium',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}},
    // WebKit at a phone viewport exercises an iOS-like engine. This is not a real iPhone.
    {name:'mobile-webkit',use:{browserName:'webkit',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}},
  ],
});
