/**
 * 用本机 Chrome + puppeteer-core 跑一遍真实交互，截图并输出结构化结果。
 * 仅用于开发期验证，不参与生产构建。
 *
 * 用法：node scripts/ui-check.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:5173/';
const OUT = '.tmp/shots';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const problems = [];
const report = { shots: [], checks: {}, errors: [], problems };

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});

const page = await browser.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') report.errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => report.errors.push(`pageerror: ${err.message}`));

const shot = async (name) => {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  report.shots.push(path);
  console.log(`[shot] ${path}`);
};

const appPhase = () =>
  page.$eval('.app', (el) => {
    const cls = [...el.classList].find((c) => c.startsWith('phase-'));
    return cls ? cls.replace('phase-', '') : 'none';
  });

const cells = () =>
  page.$$eval('.cell', (els) =>
    els.map((el) => ({
      label: el.getAttribute('aria-label') ?? '',
      cls: el.className,
    })),
  );

const parseCoord = (label) => {
  const m = /第 (\d+) 行第 (\d+) 列/.exec(label);
  return m ? { row: Number(m[1]), col: Number(m[2]) } : null;
};

/** 地图列数（与 BALANCE.map.width 一致）。 */
const COLS = 16;
const indexOfCoord = (coord) => (coord.row - 1) * COLS + (coord.col - 1);

const clickCell = async (index) => {
  const handles = await page.$$('.cell');
  await handles[index].click();
  await sleep(320);
};

try {
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.title-screen', { timeout: 15000 });
  report.checks.titleLoaded = true;
  await shot('01-title');

  // —— 难度选择 ——
  const diffCards = await page.$$eval('.diff-card', (els) => els.length);
  report.checks.difficultyOptions = diffCards;
  if (diffCards !== 3) problems.push(`难度选项应为 3 档，实际 ${diffCards}`);
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.diff-card')].find((c) => c.textContent?.includes('简单'));
    card?.click();
  });
  await sleep(120);

  await page.click('.title-form button[type="submit"]');
  await sleep(400);

  // 首次进入会弹出新手教程
  const tutorial = await page.$('.tutorial-card');
  report.checks.tutorialShown = Boolean(tutorial);
  if (tutorial) {
    await shot('01b-tutorial');
    const steps = await page.$$eval('.tut-dot', (els) => els.length);
    report.checks.tutorialSteps = steps;
    if (steps < 5) problems.push('教程步骤过少');
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.tut-actions button')].find((b) => b.textContent?.trim() === '跳过');
      button?.click();
    });
    await sleep(300);
  } else {
    problems.push('首次开局没有弹出新手教程');
  }

  await page.waitForSelector('.map-grid', { timeout: 15000 });
  await sleep(400);
  report.checks.started = (await appPhase()) === 'map';
  const diffBadge = await page.$eval('.diff-badge', (el) => el.textContent ?? '').catch(() => '');
  report.checks.difficultyBadge = diffBadge;
  if (!diffBadge.includes('简单')) problems.push(`顶栏难度徽标不正确（${diffBadge}）`);

  const initialCells = await cells();
  report.checks.cellCount = initialCells.length;
  if (initialCells.length !== COLS * 10) problems.push(`地图格子数量应为 ${COLS * 10}，实际 ${initialCells.length}`);

  const resourceCells = initialCells.filter((c) => c.cls.includes('tile-') && !c.cls.includes('tile-empty'));
  report.checks.resourceCells = resourceCells.length;
  if (resourceCells.length === 0) problems.push('地图上没有任何资源格');

  const emptyButtons = await page.$$eval('button', (els) =>
    els.filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
  );
  report.checks.emptyButtons = emptyButtons;
  if (emptyButtons > 0) problems.push(`存在 ${emptyButtons} 个空白按钮`);

  await shot('02-map');

  // —— 挖掘：找一个与己方斑鸠相邻、且可挖掘的资源格 ——
  const mineLabel = initialCells.map((c) => c.label).find((l) => l.includes('可挖掘'));
  let mined = false;
  if (mineLabel) {
    const coord = parseCoord(mineLabel);
    if (coord) {
      await clickCell(indexOfCoord(coord));
      await sleep(300);
      mined = true;
    }
  } else {
    // 没有可挖资源时退化为一格移动
    const moveLabel = initialCells.map((c) => c.label).find((l) => l.includes('可移动'));
    if (moveLabel) {
      const coord = parseCoord(moveLabel);
      if (coord) await clickCell(indexOfCoord(coord));
    }
  }
  report.checks.performedMining = mined;
  const afterAction = await cells();
  report.checks.actionsChanged = JSON.stringify(afterAction.map((c) => c.cls)) !== JSON.stringify(initialCells.map((c) => c.cls));
  await shot('03-after-action');

  // —— 侧栏标签页：每一页都必须真实渲染内容 ——
  const tabChecks = [
    ['合成', '.recipe-row', 'craft'],
    ['熔炼', '.recipe-row', 'smelt'],
    ['孵卵', '.recipe-row', 'dove'],
    ['库存', '.player-panel', 'inventory'],
    ['对手', '.player-panel', 'foe'],
  ];
  for (const [label, selector, key] of tabChecks) {
    await page.evaluate((name) => {
      const tab = [...document.querySelectorAll('.side-tab')].find((t) => t.textContent?.trim() === name);
      tab?.click();
    }, label);
    await sleep(220);
    const count = await page.$$eval(`.side-body ${selector}`, (els) => els.length);
    report.checks[`tab_${key}`] = count;
    if (count === 0) problems.push(`「${label}」标签页没有内容`);
    await shot(`04b-tab-${key}`);
  }

  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('.side-tab')].find((t) => t.textContent?.trim() === '合成');
    tab?.click();
  });
  await sleep(200);
  const disabledCraft = await page.$$eval('.side-panel button[disabled]', (els) => els.length);
  report.checks.disabledRecipeButtons = disabledCraft;
  if (disabledCraft === 0) problems.push('开局时应存在不可合成的配方按钮（应为 disabled）');
  await shot('04-recipes');

  // —— 主题切换 ——
  await page.click('.topbar-actions button[aria-label="切换主题"]');
  await sleep(260);
  const darkTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  report.checks.themeToggle = darkTheme === 'dark';
  if (!report.checks.themeToggle) problems.push('主题切换没有生效');
  await shot('04b-dark-theme');
  await page.click('.topbar-actions button[aria-label="切换主题"]');
  await sleep(260);

  // —— 教程可以从顶栏重新打开，并逐页截图检查图文 ——
  await page.click('.topbar-actions button[aria-label="打开教程"]');
  await sleep(260);
  const reopened = Boolean(await page.$('.tutorial-card'));
  report.checks.tutorialReopen = reopened;
  if (!reopened) problems.push('顶栏教程按钮没有打开教程');
  if (reopened) {
    const reopenSteps = await page.$$eval('.tut-dot', (els) => els.length);
    report.checks.tutorialStepsDetail = reopenSteps;
    if (reopenSteps < 10) problems.push(`教程页数偏少（${reopenSteps}），应覆盖战斗教学`);
    for (let i = 0; i < reopenSteps; i += 1) {
      await shot(`01c-tutorial-${i + 1}`);
      if (i === reopenSteps - 1) break;
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('.tut-actions button')].find(
          (b) => b.textContent?.trim() === '下一步',
        );
        button?.click();
      });
      await sleep(180);
    }
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.tut-actions button')].find((b) =>
        ['跳过', '开始游戏'].includes(b.textContent?.trim() ?? ''),
      );
      button?.click();
    });
    await sleep(220);
  }

  // —— 音效开关必须真的切换状态 ——
  const soundBefore = await page.$eval('.topbar-actions button[aria-pressed]', (el) => el.textContent ?? '');
  await page.click('.topbar-actions button[aria-pressed]');
  await sleep(120);
  const soundAfter = await page.$eval('.topbar-actions button[aria-pressed]', (el) => el.textContent ?? '');
  report.checks.soundToggled = soundBefore !== soundAfter;
  if (!report.checks.soundToggled) problems.push('音效开关点击后状态没有变化');
  await page.click('.topbar-actions button[aria-pressed]');
  await sleep(120);

  // —— 切到「点击资源＝移动」，走向敌人直到触发决斗 ——
  await page.evaluate(() => {
    const segs = [...document.querySelectorAll('.cell-mode .seg')];
    const moveSeg = segs.find((s) => s.textContent?.includes('移动'));
    moveSeg?.click();
  });
  await sleep(150);

  let duelReached = false;
  const walkDeadline = Date.now() + 90000;
  let walkAttempts = 0;
  const walkDebug = { attempts: 0, lastTurn: '', lastMine: null, lastFoe: null };

  while (Date.now() < walkDeadline && walkAttempts < 150) {
    const phase = await appPhase();
    if (phase === 'duel') {
      duelReached = true;
      break;
    }
    if (phase === 'over') break;

    const turn = await page.$eval('.turn-current', (el) => el.textContent ?? '');
    walkDebug.lastTurn = turn;
    if (turn.includes('电脑') || turn.includes('决斗')) {
      await sleep(320);
      continue; // 等待电脑行动，不计入尝试次数
    }

    walkAttempts += 1;
    const state = await cells();
    const mine = state.map((c) => c.label).find((l) => l.includes('己方斑鸠'));
    const foe = state.map((c) => c.label).find((l) => l.includes('敌方斑鸠'));
    if (!mine || !foe) {
      await sleep(300);
      continue;
    }
    walkDebug.lastMine = mine;
    walkDebug.lastFoe = foe;
    const a = parseCoord(mine);
    const b = parseCoord(foe);
    if (!a || !b) break;

    if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1) {
      await sleep(300);
      if ((await appPhase()) === 'duel') {
        duelReached = true;
        break;
      }
      // 已贴脸但未开战：结束回合，让引擎在状态推进时再做一次判定
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === '结束回合' && !b.disabled,
        );
        button?.click();
      });
      await sleep(500);
      continue;
    }

    const target = { ...a };
    if (a.col !== b.col) target.col += Math.sign(b.col - a.col);
    else target.row += Math.sign(b.row - a.row);

    await clickCell(indexOfCoord(target));
  }

  walkDebug.attempts = walkAttempts;
  report.checks.walkDebug = walkDebug;
  report.checks.duelReached = duelReached;
  if (!duelReached) problems.push('走到相邻后仍未触发决斗');

  if (duelReached) {
    await page.waitForSelector('.duel-canvas', { timeout: 15000 });
    await sleep(500);
    await shot('05-duel');

    // 起跳并向右移动，截一张空中的状态
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('Space');
    await sleep(260);
    await shot('05b-duel-jump');
    await sleep(300);
    await page.keyboard.up('Space');

    // 用鼠标左键攻击（朝鼠标方向出手），S 格挡，双击 A 冲刺
    const canvasBox = await page.$eval('.duel-canvas', (el) => {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    });
    const aimX = canvasBox.x + canvasBox.w * 0.78;
    const aimY = canvasBox.y + canvasBox.h * 0.76;

    const deadline = Date.now() + 70000;
    let finished = false;
    let swing = 0;
    while (Date.now() < deadline) {
      await page.mouse.click(aimX, aimY);
      if (swing % 4 === 0) await page.keyboard.press('Space');
      if (swing % 7 === 6) {
        await page.keyboard.down('KeyS');
        await sleep(150);
        await page.keyboard.up('KeyS');
      }
      if (swing === 9) {
        // 双击 A 触发冲刺
        await page.keyboard.down('KeyA');
        await page.keyboard.up('KeyA');
        await sleep(60);
        await page.keyboard.down('KeyA');
        await page.keyboard.up('KeyA');
      }
      swing += 1;
      await sleep(240);
      const hasResult = await page.$('.duel-result');
      if (hasResult) {
        finished = true;
        break;
      }
    }
    await page.keyboard.up('ArrowRight');
    report.checks.duelFinished = finished;
    if (!finished) problems.push('决斗在 70 秒内没有产生结算');
    if (finished) {
      await shot('06-duel-result');
      const resultText = await page.$eval('.duel-result h2', (el) => el.textContent ?? '');
      report.checks.duelOutcome = resultText;
      await page.click('.duel-result button');
      await sleep(900);
      report.checks.phaseAfterDuel = await appPhase();
      await shot('07-after-duel');

      if (report.checks.phaseAfterDuel === 'over') {
        await page.click('.over-actions .btn-primary');
        await sleep(800);
        report.checks.restartedAfterGameOver = (await appPhase()) === 'map';
      }
    }
  }

  // —— 窄屏布局 ——
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  report.checks.narrowOverflowPx = overflow;
  if (overflow > 4) problems.push(`窄屏出现横向溢出 ${overflow}px`);
  await shot('08-narrow-map');

  const mapUsable = await page.evaluate(() => {
    const cell = document.querySelector('.cell');
    if (!cell) return 0;
    return Math.round(cell.getBoundingClientRect().width);
  });
  report.checks.narrowCellPx = mapUsable;
  if (mapUsable < 24) problems.push(`窄屏格子过小（${mapUsable}px），难以点击`);

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await sleep(300);
  await shot('09-desktop-final');
} catch (error) {
  problems.push(`脚本异常：${error instanceof Error ? error.message : String(error)}`);
  try {
    await shot('99-failure');
  } catch {
    /* 截图失败时忽略 */
  }
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

if (report.errors.length > 0) {
  console.error('\n运行时错误：');
  for (const e of report.errors) console.error(' -', e);
  process.exitCode = 1;
}
if (problems.length > 0) {
  console.error('\n问题：');
  for (const p of problems) console.error(' -', p);
  process.exitCode = 1;
}
