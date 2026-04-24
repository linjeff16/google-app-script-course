// ============================================================
// 進階練習：智慧任務派工與自動提醒系統
// 對應：Session 5（資料結構化、function & return、觸發器）
// ============================================================

/**
 * 讀取任務資料並結構化為物件陣列
 */
function 取得結構化任務() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("任務看板");
  if (!sheet) return [];
  var 資料 = sheet.getDataRange().getValues();
  var 標題 = 資料[0];
  var 任務 = [];
  for (var i = 1; i < 資料.length; i++) {
    var obj = {};
    for (var j = 0; j < 標題.length; j++) obj[標題[j]] = 資料[i][j];
    任務.push(obj);
  }
  return 任務;
}

/**
 * 智慧派工：根據員工目前負擔自動分配任務
 */
function 智慧派工() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var 任務 = 取得結構化任務();
    var 員工表 = ss.getSheetByName("員工負擔");
    if (!員工表) { SpreadsheetApp.getUi().alert("❌ 請先初始化"); return; }

    var 員工資料 = 員工表.getDataRange().getValues();
    var 員工 = [];
    for (var i = 1; i < 員工資料.length; i++) {
      員工.push({ 姓名: 員工資料[i][0], 部門: 員工資料[i][1],
                  目前任務數: 員工資料[i][2], 最大承載: 員工資料[i][3] });
    }

    // 找出未指派的任務
    var 未指派 = 任務.filter(function(t) { return !t["負責人"] || t["負責人"] === "待指派"; });

    if (未指派.length === 0) {
      SpreadsheetApp.getUi().alert("📋 目前沒有待指派的任務");
      return;
    }

    var 指派結果 = [];
    未指派.forEach(function(task) {
      // 找出有餘裕的員工（目前任務數 < 最大承載）
      var 可用員工 = 員工.filter(function(e) { return e.目前任務數 < e.最大承載; });

      if (可用員工.length === 0) {
        指派結果.push(task["任務名稱"] + " → ❌ 無可用人力");
        return;
      }

      // 優先分配給負擔最少的員工
      可用員工.sort(function(a, b) { return a.目前任務數 - b.目前任務數; });
      var 指派給 = 可用員工[0];

      指派給.目前任務數++;
      指派結果.push(task["任務名稱"] + " → " + 指派給.姓名);

      // 更新任務表
      var 任務表 = ss.getSheetByName("任務看板");
      var 任務資料 = 任務表.getDataRange().getValues();
      for (var r = 1; r < 任務資料.length; r++) {
        if (任務資料[r][0] === task["任務名稱"] && (!任務資料[r][2] || 任務資料[r][2] === "待指派")) {
          任務表.getRange(r + 1, 3).setValue(指派給.姓名);
          break;
        }
      }
    });

    // 更新員工負擔表
    for (var k = 0; k < 員工.length; k++) {
      員工表.getRange(k + 2, 3).setValue(員工[k].目前任務數);
    }

    SpreadsheetApp.getUi().alert("✅ 智慧派工完成\n\n" + 指派結果.join("\n"));

  } catch (錯誤) { Logger.log("❌ " + 錯誤.message); }
}

/**
 * 逾期任務自動提醒
 */
function 逾期提醒() {
  var 任務 = 取得結構化任務();
  var 今天 = new Date();
  今天.setHours(0, 0, 0, 0);

  var 逾期 = 任務.filter(function(t) {
    if (t["狀態"] === "已完成") return false;
    var 截止 = new Date(t["截止日期"]);
    return 截止 < 今天;
  });

  var 即將到期 = 任務.filter(function(t) {
    if (t["狀態"] === "已完成") return false;
    var 截止 = new Date(t["截止日期"]);
    var 差天 = Math.ceil((截止 - 今天) / 86400000);
    return 差天 >= 0 && 差天 <= 3;
  });

  // 更新狀態欄
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("任務看板");
  var 資料 = sheet.getDataRange().getValues();
  for (var i = 1; i < 資料.length; i++) {
    if (資料[i][5] === "已完成") continue;
    var d = new Date(資料[i][4]);
    if (d < 今天) {
      sheet.getRange(i + 1, 6).setValue("🔴 已逾期");
      sheet.getRange(i + 1, 1, 1, 7).setBackground("#ffebee");
    } else if (Math.ceil((d - 今天) / 86400000) <= 3) {
      sheet.getRange(i + 1, 6).setValue("🟡 即將到期");
      sheet.getRange(i + 1, 1, 1, 7).setBackground("#fff8e1");
    }
  }

  var msg = "📋 任務提醒\n🔴 逾期：" + 逾期.length + " 筆\n🟡 即將到期：" + 即將到期.length + " 筆";
  Logger.log(msg);
  if (逾期.length > 0 || 即將到期.length > 0) {
    SpreadsheetApp.getUi().alert(msg);
  }
}

function 初始化任務資料() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 任務看板
  var t = ss.getSheetByName("任務看板");
  if (!t) t = ss.insertSheet("任務看板"); else t.clear();
  t.getRange(1, 1, 1, 7).setValues([["任務名稱", "優先級", "負責人", "部門", "截止日期", "狀態", "進度(%)"]]);
  var 任務 = [
    ["系統效能優化", "高", "待指派", "研發部", new Date(2026, 4, 10), "進行中", 30],
    ["Q2 行銷企劃", "高", "待指派", "行銷部", new Date(2026, 4, 15), "未開始", 0],
    ["員工教育訓練", "中", "張美玲", "人資部", new Date(2026, 4, 20), "進行中", 50],
    ["客戶滿意度調查", "中", "待指派", "業務部", new Date(2026, 3, 28), "未開始", 0],
    ["新產品原型開發", "高", "陳大文", "研發部", new Date(2026, 4, 5), "進行中", 70],
    ["合約審閱", "低", "待指派", "法務", new Date(2026, 4, 30), "未開始", 0],
    ["辦公室搬遷規劃", "中", "林小芬", "總務", new Date(2026, 5, 15), "進行中", 20],
    ["ERP 系統升級", "高", "待指派", "研發部", new Date(2026, 4, 25), "未開始", 0]
  ];
  t.getRange(2, 1, 任務.length, 7).setValues(任務);
  t.getRange("A1:G1").setBackground("#4527a0").setFontColor("#fff").setFontWeight("bold");
  t.getRange("E2:E9").setNumberFormat("yyyy/mm/dd");
  t.setFrozenRows(1);
  for (var c = 1; c <= 7; c++) t.autoResizeColumn(c);

  // 員工負擔
  var e = ss.getSheetByName("員工負擔");
  if (!e) e = ss.insertSheet("員工負擔"); else e.clear();
  e.getRange(1, 1, 1, 4).setValues([["姓名", "部門", "目前任務數", "最大承載"]]);
  var 員工 = [
    ["王小明", "業務部", 2, 5], ["李小華", "行銷部", 3, 5],
    ["張美玲", "人資部", 1, 4], ["陳大文", "研發部", 4, 6],
    ["林小芬", "總務", 1, 4], ["劉家豪", "研發部", 2, 5]
  ];
  e.getRange(2, 1, 員工.length, 4).setValues(員工);
  e.getRange("A1:D1").setBackground("#00695c").setFontColor("#fff").setFontWeight("bold");
  e.setFrozenRows(1);

  SpreadsheetApp.getUi().alert("✅ 任務資料已建立！（含 4 筆「待指派」任務）");
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🤖 智慧派工系統")
    .addItem("📦 初始化任務資料", "初始化任務資料")
    .addItem("🎯 智慧派工", "智慧派工")
    .addItem("⏰ 逾期提醒", "逾期提醒")
    .addToUi();
}
