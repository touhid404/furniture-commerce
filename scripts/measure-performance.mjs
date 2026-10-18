import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
await page.addInitScript(()=>{window.__metrics={lcp:0,cls:0,inp:0};for(const[type,key]of[['largest-contentful-paint','lcp'],['layout-shift','cls'],['event','inp']])new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(key==='lcp')window.__metrics.lcp=entry.startTime;if(key==='cls'&&!entry.hadRecentInput)window.__metrics.cls+=entry.value;if(key==='inp'&&entry.interactionId)window.__metrics.inp=Math.max(window.__metrics.inp,entry.duration);}}).observe({type,buffered:true,...(type==='event'?{durationThreshold:16}:{})});});
let apiCalls=0;page.on('request',r=>{if(r.url().includes('/api/v1/'))apiCalls++;});
const base=process.env.MEASURE_URL??'http://127.0.0.1:5173';const start=Date.now();await page.goto(base+'/shop?category=lighting');const add=page.getByRole('button',{name:/^Add .* to bag$/}).first();await add.waitFor();const productsVisibleMs=Date.now()-start,initialApiCalls=apiCalls;
const click=Date.now();await add.click();await page.getByRole('button',{name:'Open bag, 1 items'}).waitFor();const addToCartMs=Date.now()-click;
const apiResponseTimes=[];for(let i=0;i<3;i++){const t=Date.now();const r=await context.request.get(base+'/api/v1/products?page=1&limit=12');await r.body();apiResponseTimes.push(Date.now()-t);}
const report={url:base,productsVisibleMs,initialApiCalls,addToCartMs,cartApiCalls:apiCalls-initialApiCalls,apiResponseTimes,...await page.evaluate(()=>window.__metrics)};
writeFileSync(process.env.MEASURE_OUTPUT??'/tmp/commerce-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
