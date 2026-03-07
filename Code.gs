// ============================================================
//  時間割マネージャー - GAS バックエンド (REST API対応版)
//  【変更点】doGet() でも payload パラメータ経由のAPIリクエストを処理。
//           GASへのPOSTは302リダイレクトでbodyが失われるため
//           フロントからはGET+payloadパラメータで送信する。
//  【設定】デプロイ時は「アクセス：全員（匿名を含む）」を選択すること。
// ============================================================

function doGet(e) {
  // payload パラメータがある場合はAPIリクエストとして処理
  if (e && e.parameter && e.parameter.payload) {
    return handleApiRequest(JSON.parse(e.parameter.payload));
  }
  // 通常アクセス: HTMLを返す（GAS Webアプリとしても使える）
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('時間割マネージャー')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// POST も念のため残す（直接POSTできる環境向け）
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    return handleApiRequest(params);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ★ API処理の共通ハンドラ
function handleApiRequest(params) {
  try {
    const action = params.action;
    let result;

    if (action === 'getInitialData') {
      result = getInitialData(params.date);
    } else if (action === 'loadData') {
      result = loadData(params.key);
    } else if (action === 'saveData') {
      result = saveData(params.key, params.data);
    } else if (action === 'getYearlyData') {
      result = getYearlyData(params.prefix);
    } else if (action === 'saveSettings') {
      result = saveSettings(params.settings);
    } else if (action === 'getCalendarEventsForWeek') {
      result = getCalendarEventsForWeek(params.calendarId, params.monday);
    } else {
      result = { error: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ★ テスト用
function testDoGet() {
  const e = { parameter: { payload: JSON.stringify({ action: 'loadData', key: 'settings' }) } };
  Logger.log(doGet(e).getContent());
}


// ============================================================
//  以下は元のコードをそのままコピーしてください
// ============================================================

// 初期データの取得
function getInitialData(clientDateStr) {
  const settings = loadSettings() || {};
  const startDateStr = settings.startDate || '2026-04-06';
  const weekId = calculateWeekId(clientDateStr, startDateStr);
  const startYear = new Date(startDateStr).getFullYear();
  const yearPrefix = 'SY' + startYear;

  const allData = getYearlyData(yearPrefix);

  return {
    settings: settings,
    master: allData['master'] || null,
    masterA: allData['masterA'] || null,
    masterB: allData['masterB'] || null,
    currentWeek: allData[weekId] || null,
    weekId: weekId
  };
}

function getYearlyData(yearPrefix) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const result = {};

  data.forEach(row => {
    const key = row[0];
    if (key === 'master' || key === 'masterA' || key === 'masterB' || key.indexOf(yearPrefix) === 0) {
      result[key] = row[1] ? JSON.parse(row[1]) : null;
    }
  });

  return result;
}

function loadData(key) {
  const sheet = getSheet();
  const rowIndex = getRowIndexByKey(sheet, key);
  if (rowIndex > 0) {
    const json = sheet.getRange(rowIndex, 2).getValue();
    return json ? JSON.parse(json) : null;
  }
  return null;
}

function saveData(key, data) {
  const sheet = getSheet();
  const rowIndex = getRowIndexByKey(sheet, key);
  const json = JSON.stringify(data);
  const timestamp = new Date();

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 2).setValue(json);
    sheet.getRange(rowIndex, 3).setValue(timestamp);
  } else {
    sheet.appendRow([key, json, timestamp]);
  }
  return { success: true };
}

function saveSettings(settings) {
  return saveData('settings', settings);
}

function loadSettings() {
  return loadData('settings');
}

// --- カレンダーから予定を取得 ---
function getCalendarEventsForWeek(calendarId, mondayDateStr) {
  const DAYS = ['月', '火', '水', '木', '金'];
  let cal;

  try {
    if (calendarId && calendarId.trim() !== '') {
      cal = CalendarApp.getCalendarById(calendarId);
    } else {
      cal = CalendarApp.getDefaultCalendar();
    }
  } catch (e) {
    return { error: 'カレンダーが見つかりません。IDを確認してください。' };
  }

  if (!cal) return { error: 'カレンダーの取得に失敗しました。' };

  const result = {};
  const startDate = new Date(mondayDateStr);
  startDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < 5; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);

    const events = cal.getEventsForDay(currentDate);
    const eventTexts = events.map(evt => {
      let timeStr = '';
      if (evt.isAllDayEvent()) {
        timeStr = '終日';
      } else {
        const start = evt.getStartTime();
        timeStr = Utilities.formatDate(start, Session.getScriptTimeZone(), 'HH:mm');
      }
      return `${timeStr} ${evt.getTitle()}`;
    });

    result[DAYS[i]] = eventTexts;
  }

  return { success: true, data: result };
}

// --- ヘルパー関数 ---

function calculateWeekId(targetDateStr, startDateStr) {
  const targetDate = new Date(targetDateStr);
  const startDate = new Date(startDateStr);

  targetDate.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);

  const day = targetDate.getDay();
  const diffToMon = targetDate.getDate() - day + (day === 0 ? -6 : 1);
  const targetMonday = new Date(targetDate.setDate(diffToMon));

  const sDay = startDate.getDay();
  const diffStartToMon = startDate.getDate() - sDay + (sDay === 0 ? -6 : 1);
  const baseMonday = new Date(startDate.setDate(diffStartToMon));

  const diffTime = targetMonday.getTime() - baseMonday.getTime();
  const weekNo = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;

  const startYear = startDate.getFullYear();
  return 'SY' + startYear + '-W' + ('00' + weekNo).slice(-2);
}

function getSheet() {
  // スタンドアロン型GAS対応：ScriptProperties にスプレッドシートIDを保存
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');

  let ss;
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      ssId = null; // IDが無効なら再作成
    }
  }

  if (!ssId) {
    // 1. まずコンテナバインド（既存シート紐付け）かどうか確認
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        ssId = ss.getId();
        props.setProperty('SPREADSHEET_ID', ssId);
      }
    } catch (e) {}
  }

  if (!ss) {
    // 2. 紐付けシートがない場合は新規自動作成
    ss = SpreadsheetApp.create('時間割マネージャー データ');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }

  let sheet = ss.getSheetByName('Database');
  if (!sheet) {
    sheet = ss.insertSheet('Database');
    sheet.appendRow(['ID', 'Data', 'UpdatedAt']);
  }
  return sheet;
}

function getRowIndexByKey(sheet, key) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.indexOf(key);
  return index !== -1 ? index + 2 : -1;
}
