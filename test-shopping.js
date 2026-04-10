const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file:///' + path.resolve(__dirname, 'shopping-list.html').replace(/\\/g, '/');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function addItem(page, text) {
  await page.fill('#itemInput', text);
  await page.click('button:has-text("추가")');
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(FILE_URL);
  await clearStorage(page);

  console.log('\n========================================');
  console.log('  쇼핑 리스트 앱 자동 테스트 시작');
  console.log('========================================\n');

  // ─────────────────────────────────────────
  // TEST 1: 초기 상태
  // ─────────────────────────────────────────
  console.log('[TEST 1] 초기 화면 렌더링');
  const title = await page.textContent('h1');
  assert(title.includes('쇼핑 리스트'), '제목이 "쇼핑 리스트"를 포함함');

  const emptyMsg = await page.isVisible('#empty');
  assert(emptyMsg, '빈 상태 메시지가 표시됨');

  const itemCount = await page.locator('ul li').count();
  assert(itemCount === 0, '초기 리스트가 비어 있음');

  // ─────────────────────────────────────────
  // TEST 2: 아이템 추가 (버튼 클릭)
  // ─────────────────────────────────────────
  console.log('\n[TEST 2] 아이템 추가 - 버튼 클릭');
  await addItem(page, '사과');
  await page.waitForTimeout(200);

  const items1 = await page.locator('ul li').count();
  assert(items1 === 1, '아이템 1개 추가됨');

  const itemText = await page.locator('.item-text').first().textContent();
  assert(itemText === '사과', '추가된 아이템 텍스트가 "사과"임');

  const inputVal = await page.inputValue('#itemInput');
  assert(inputVal === '', '추가 후 입력창이 비워짐');

  const emptyHidden = await page.isHidden('#empty');
  assert(emptyHidden, '아이템 추가 후 빈 상태 메시지가 숨겨짐');

  // ─────────────────────────────────────────
  // TEST 3: 아이템 추가 (Enter 키)
  // ─────────────────────────────────────────
  console.log('\n[TEST 3] 아이템 추가 - Enter 키');
  await page.fill('#itemInput', '바나나');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(200);

  const items2 = await page.locator('ul li').count();
  assert(items2 === 2, 'Enter로 두 번째 아이템 추가됨');

  const item2Text = await page.locator('.item-text').nth(1).textContent();
  assert(item2Text === '바나나', '두 번째 아이템이 "바나나"임');

  // ─────────────────────────────────────────
  // TEST 4: 빈 입력 무시
  // ─────────────────────────────────────────
  console.log('\n[TEST 4] 빈 입력 방어 처리');
  await page.fill('#itemInput', '   ');
  await page.click('button:has-text("추가")');
  await page.waitForTimeout(200);

  const items3 = await page.locator('ul li').count();
  assert(items3 === 2, '공백만 입력 시 아이템이 추가되지 않음');

  // ─────────────────────────────────────────
  // TEST 5: 체크(완료) 기능
  // ─────────────────────────────────────────
  console.log('\n[TEST 5] 체크 기능');
  await addItem(page, '우유');
  await page.waitForTimeout(200);

  const checkbox = page.locator('ul li').first().locator('input[type="checkbox"]');
  await checkbox.check();
  await page.waitForTimeout(200);

  const isChecked = await checkbox.isChecked();
  assert(isChecked, '체크박스가 체크됨');

  const hasCheckedClass = await page.locator('ul li').first().evaluate(el => el.classList.contains('checked'));
  assert(hasCheckedClass, '체크된 아이템에 "checked" 클래스가 추가됨');

  const statsText = await page.textContent('#stats');
  assert(statsText.includes('완료 1개'), '통계에 완료 1개가 표시됨');

  // ─────────────────────────────────────────
  // TEST 6: 체크 해제
  // ─────────────────────────────────────────
  console.log('\n[TEST 6] 체크 해제');
  await checkbox.uncheck();
  await page.waitForTimeout(200);

  const isUnchecked = await checkbox.isChecked();
  assert(!isUnchecked, '체크박스가 해제됨');

  const statsAfterUncheck = await page.textContent('#stats');
  assert(statsAfterUncheck.includes('완료 0개'), '통계에 완료 0개가 표시됨');

  // ─────────────────────────────────────────
  // TEST 7: 개별 아이템 삭제
  // ─────────────────────────────────────────
  console.log('\n[TEST 7] 개별 삭제');
  const countBefore = await page.locator('ul li').count();
  await page.locator('ul li').first().locator('.delete-btn').click();
  await page.waitForTimeout(200);

  const countAfter = await page.locator('ul li').count();
  assert(countAfter === countBefore - 1, '삭제 버튼 클릭 후 아이템 수가 1 감소함');

  // ─────────────────────────────────────────
  // TEST 8: 완료 항목 일괄 삭제
  // ─────────────────────────────────────────
  console.log('\n[TEST 8] 완료 항목 일괄 삭제');
  await clearStorage(page);
  await addItem(page, '딸기');
  await addItem(page, '포도');
  await addItem(page, '수박');
  await page.waitForTimeout(200);

  // 딸기, 포도 체크
  await page.locator('ul li').nth(0).locator('input[type="checkbox"]').check();
  await page.locator('ul li').nth(1).locator('input[type="checkbox"]').check();
  await page.waitForTimeout(200);

  await page.click('button.clear-btn');
  await page.waitForTimeout(200);

  const remainCount = await page.locator('ul li').count();
  assert(remainCount === 1, '체크된 2개 삭제 후 1개만 남음');

  const remainText = await page.locator('.item-text').first().textContent();
  assert(remainText === '수박', '남은 아이템이 체크되지 않은 "수박"임');

  // ─────────────────────────────────────────
  // TEST 9: localStorage 영속성
  // ─────────────────────────────────────────
  console.log('\n[TEST 9] localStorage 데이터 영속성');
  await clearStorage(page);
  await addItem(page, '감자');
  await addItem(page, '고구마');
  await page.waitForTimeout(200);

  await page.reload();
  await page.waitForTimeout(300);

  const persistedCount = await page.locator('ul li').count();
  assert(persistedCount === 2, '페이지 새로고침 후 데이터가 유지됨');

  const persisted1 = await page.locator('.item-text').nth(0).textContent();
  const persisted2 = await page.locator('.item-text').nth(1).textContent();
  assert(persisted1 === '감자' && persisted2 === '고구마', '새로고침 후 아이템 내용이 유지됨');

  // ─────────────────────────────────────────
  // TEST 10: 마지막 아이템 삭제 → 빈 상태
  // ─────────────────────────────────────────
  console.log('\n[TEST 10] 모두 삭제 시 빈 상태 복원');
  await clearStorage(page);
  await addItem(page, '테스트');
  await page.waitForTimeout(200);
  await page.locator('ul li').first().locator('.delete-btn').click();
  await page.waitForTimeout(200);

  const emptyAgain = await page.isVisible('#empty');
  assert(emptyAgain, '모든 아이템 삭제 후 빈 상태 메시지가 다시 표시됨');

  const finalCount = await page.locator('ul li').count();
  assert(finalCount === 0, '리스트가 완전히 비워짐');

  // ─────────────────────────────────────────
  // 결과 요약
  // ─────────────────────────────────────────
  console.log('\n========================================');
  console.log(`  테스트 결과: ${passed} 통과 / ${failed} 실패`);
  console.log('========================================\n');

  if (failed === 0) {
    console.log('모든 테스트를 통과했습니다!');
  } else {
    console.log(`${failed}개의 테스트가 실패했습니다.`);
  }

  await page.waitForTimeout(1500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
