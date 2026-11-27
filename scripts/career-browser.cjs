const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PORTFOLIO_PLAYWRIGHT || 'playwright');

const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8787/portfolio/';
const artifacts = process.env.PORTFOLIO_QA_DIR || process.cwd();

async function open(page, url) {
  const response = await page.goto(new URL(url,base).href);
  assert.equal(response.status(),200,url);
  if (url.includes('?sample=')) await page.locator('#career-form').waitFor();
}

async function edit(page, fields) {
  for (const [name,value] of Object.entries(fields)) {
    const field = page.locator(`[name="${name}"]`).first();
    if (name === 'choice') await field.selectOption(value);
    else await field.fill(value);
  }
}

async function score(page,name,values) {
  for (let i = 0; i < values.length; i++) await page.locator(`[name="${name}"]`).nth(i).selectOption(String(values[i]));
}

async function download(page,name) {
  const [file] = await Promise.all([page.waitForEvent('download'),page.locator(`[data-export="${name}"]`).click()]);
  assert.equal(await file.failure(),null);
  return fs.readFile(await file.path(),'utf8');
}

async function review(page,action,note) {
  await page.locator('[name=review_note]').fill(note);
  await page.locator(`[value="${action}"]`).click();
}

async function run() {
  const browser = await chromium.launch({headless:true,executablePath:process.env.PORTFOLIO_EDGE});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:930},acceptDownloads:true});
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if (r.status() >= 400 && r.url().startsWith(base)) errors.push(`${r.status()} ${r.url()}`);});
    await open(page,'');
    assert.equal(await page.locator('h3').count(),5);
    await page.screenshot({path:path.join(artifacts,'home-desktop.png'),fullPage:true});
    const resume = await page.locator('a.nav-cta').getAttribute('href');
    const response = await page.request.get(new URL(resume,base).href);
    assert.equal(response.status(),200);
    assert.match(response.headers()['content-type'], /pdf/);

    await open(page,'aesthetic.html?sample=DB-e76138ca-7832-4e17-a637-4c3388819814');
    await page.locator('#career-media img').first().evaluate(i=>i.decode());
    await page.locator('#comparison').selectOption('DB-e68ccbf5-c8a9-4f0c-9aed-d71f535f2618');
    assert.equal(await page.locator('#career-media img').count(),2);
    await page.locator('#career-media img').nth(1).evaluate(i=>i.decode());
    await score(page,'scores',[3,3,4]);
    await edit(page,{reason:'QA 测试，图像焦点可分辨程度有差异。',choice:'B'});
    await page.getByLabel('模糊或伪影').check();
    await page.locator('[value=submit]').click();
    await review(page,'approve','QA 复核保存。');
    await page.reload();
    await page.locator('#career-form').waitFor();
    const aest = JSON.parse(await download(page,'json'))[0];
    assert.equal(aest.review_status,'approved');
    assert.equal(aest.quality_score,3.33);
    assert.equal(aest.error_tags[0],'模糊或伪影');
    await page.locator('#career-filter').selectOption('bad');
    assert.equal(await page.locator('#career-list button').count(),1);
    assert.match(await download(page,'csv'), /模糊或伪影/);

    await open(page,'caption.html?sample=VID-bunny-4');
    await page.locator('video').evaluate(async video=>{
      if (!video.readyState) await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject;});
      if (!Number.isFinite(video.duration)) throw new Error('Invalid video duration');
      await video.play();
      video.pause();
    });
    await page.locator('[value=submit]').click();
    assert.match(await page.locator('#career-status').textContent(),/时序/);
    await edit(page,{caption_zh:'一只卡通动物与一只蝴蝶同框。',caption_en:'A cartoon animal appears in the frame with a butterfly.',objects:'动物、蝴蝶',actions:'同框',spatial_relations:'动物与蝴蝶相邻',time_sequence:'从片段中间帧核对，完整动作待核。'});
    await page.locator('[value=submit]').click();
    await review(page,'return','QA 退回，检查完整时段。');
    await edit(page,{caption_zh:'画面出现卡通动物和一只蝴蝶。'});
    await page.locator('[value=submit]').click();
    await review(page,'approve','QA 通过记录。');
    const cap = JSON.parse(await download(page,'json'))[0];
    assert.equal(cap.history.length,4);
    assert.equal(cap.history[2].previous.caption_zh,'一只卡通动物与一只蝴蝶同框。');
    assert.match(await download(page,'csv'),/caption_zh/);

    await open(page,'modelbench.html?sample=UF-00095');
    await score(page,'scores_a',[5,5,5]);
    await score(page,'scores_b',[1,2,1]);
    await edit(page,{reason:'QA 测试，B 的均值为 16，正确值为 3。',evidence:'(1+2+3+4+5)/5=3',revised:'Population SD √2. Sample SD √2.5.',choice:'A'});
    await page.getByLabel('事实错误').check();
    await page.locator('[value=submit]').click();
    await review(page,'approve','QA 核算。');
    const pair = JSON.parse((await download(page,'jsonl')).trim());
    assert.match(pair.chosen,/15 \/ 5 = 3/);
    assert.match(pair.rejected,/mean of the array is 16/);
    assert.equal(pair.revised_answer,'Population SD √2. Sample SD √2.5.');
    await page.screenshot({path:path.join(artifacts,'modelbench-desktop.png'),fullPage:false});

    for (const url of ['llm-eval.html','feedback-insight.html','analysis-results.html']) {
      await open(page,url);
      assert(await page.locator('h1').first().isVisible());
      await page.reload();
    }
    for (const mode of ['aesthetic','caption','modelbench']) {
      for (const ext of ['.csv','.json','-examples.json','-rubric.md','-report.md']) {
        assert.equal((await page.request.get(new URL(`downloads/career-data/${mode}${ext}`,base).href)).status(),200,`${mode}${ext}`);
      }
    }

    await page.setViewportSize({width:390,height:844});
    for (const url of ['', 'aesthetic.html?sample=CMA-162868','caption.html?sample=VID-bunny-4','modelbench.html?sample=UF-00095','llm-eval.html','feedback-insight.html']) {
      await open(page,url);
      const metrics = await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
      assert(metrics[0] <= metrics[1] + 1,`${url} overflows mobile width ${metrics}`);
      if (!url) await page.screenshot({path:path.join(artifacts,'home-mobile.png'),fullPage:true});
      if (url.startsWith('aesthetic')) await page.screenshot({path:path.join(artifacts,'aesthetic-mobile.png'),fullPage:false});
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: homepage, three workbench flows, A/B images, video, QA errors, return/revise, refresh, CSV/JSON/JSONL, original tools, 15 files, six mobile layouts, zero local 4xx or page errors');
  } finally {
    await browser.close();
  }
}

run().catch(error=>{console.error(error);process.exitCode = 1;});
