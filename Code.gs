const domain = /^(?:(?:[A-Za-z][A-Za-z0-9+.\-]*:)?\/\/)?[^\/?#]*/;
const cache = CacheService.getScriptCache();
let uuid_charset_cache = null;

function UuidCharset() {
  if (uuid_charset_cache === null) {
    uuid_charset_cache = String.fromCodePoint(...Range(6016, 55291)).split("").filter(c => /^[\p{L}\p{N}\p{P}\p{S}]$/u.test(c));
  }
  return uuid_charset_cache;
}

const pdf_lib_url = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";

function LoadPdfLib() {
  if (typeof PDFLib === "undefined") {
    (0, eval)(UrlFetchApp.fetch(pdf_lib_url).getContentText());
  }
  return PDFLib;
}

let locks = [];

function SendMail(to, subject, htmlBody) {
  MailApp.sendEmail(to, subject, "", {
    htmlBody: htmlBody
  });
}

function PostAsync(path, params_obj = {}, headers_obj = {}) {
  return (async () => {
    return PostSync(path, params_obj, headers_obj);
  })()
}

function GetAsync(path, params_obj = {}, headers_obj = {}) {
  return (async () => {
    return GetSync(path, params_obj, headers_obj);
  })()
}

function PostSync(path, params_obj = {}, headers_obj = {}) {
  return UrlFetchApp.fetch(path, {
    method: 'POST',
    muteHttpExceptions: true,
    headers: headers_obj,
    payload: params_obj
  })
}

function GetSync(path, params_obj = {}, headers_obj = {}) {
  const query = ObjectToQueryString(params_obj);
  if (query !== "") {
    const hashAt = path.indexOf("#");
    const fragment = hashAt === -1 ? "" : path.slice(hashAt);
    path = hashAt === -1 ? path : path.slice(0, hashAt);
    path += (path.includes("?") ? (/[?&]$/.test(path) ? "" : "&") : "?") + query + fragment;
  }
  return UrlFetchApp.fetch(path, {
    muteHttpExceptions: true,
    headers: headers_obj,
  })
}

function Range(min, max) {
  min = Number(min);
  max = Number(max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("Range needs finite numbers: " + min + ", " + max);
  }
  let ret = [];
  for (let i = min; i <= max; i++) {
    ret.push(i);
  }
  return ret;
}

function WriteToCache(name, key, value, time = 21600) {
  let obj = {};
  try {
    const stored = Parse(cache.get(name));
    if (stored !== null && typeof stored === "object") {
      obj = stored;
    }
  } catch (e) {
    obj = {};
  }
  Object.defineProperty(obj, key, { value: value, enumerable: true, writable: true, configurable: true });
  cache.put(name, Stringify(obj), time);
}

function ReadFromCache(name, key) {
  const text = cache.get(name);
  if (text == null) {
    return null;
  }
  try {
    const stored = Parse(text);
    return stored !== null && typeof stored === "object" && Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] ?? null : null;
  } catch (e) {
    return null;
  }
}

function MoveCacheToDatabase(dbName, ...cache_names) {
  let c = null;
  let k = null;

  try {
    c = cache.getAll(Flatten(cache_names));
    console.log(c);
    k = Object.keys(c);
  } catch (e) {
    console.log("No data to move from cache into database!");
    return;
  }

  const moved = [];
  for (let i = 0; i < k.length; i++) {
    let pairs = [];
    let done = 0;
    try {
      let objs_arr = Flatten([Parse(c[k[i]])]);
      for (let j = 0; j < objs_arr.length; j++) {
        pairs.push(...Object.entries(objs_arr[j]));
      }
      for (; done < pairs.length; done++) {
        AddToDatabase(dbName, k[i], pairs[done][0], pairs[done][1]);
      }
      moved.push(k[i]);
    } catch (e) {
      console.log("Could not move cache " + k[i] + " into database: " + e);
      if (done > 0) {
        cache.put(k[i], Stringify(Object.fromEntries(pairs.slice(done))), 21600);
      }
    }
  }

  if (moved.length > 0) {
    cache.removeAll(moved);
  }
}

function Flatten(arr) {
  arr = [...arr];
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? Flatten(toFlatten) : toFlatten);
  }, []);
}

function Exec(str, ...args) {
  let arr = args.map(function (arg, index) {
    return `const _${index + 1} = ${arg === undefined ? "undefined" : Stringify(arg)}`;
  });
  arr.push(str);
  return (new Function(arr.join(";")))();
}

function Unique(arr, min_length = 0) {
  return [...new Set(arr.filter(v => (v ?? "").toString().length >= min_length))];
}

function Html(str) {
  return HtmlService.createHtmlOutput(str);
}

function Out(str) {
  return ContentService.createTextOutput(str);
}

function CreateDatabase(dbName) {

  let folders = DriveApp.getRootFolder().getFoldersByName("[DB]");

  if (!folders.hasNext()) {
    DriveApp.getRootFolder().createFolder("[DB]");
  } else {
    folders.next()
    if (folders.hasNext()) {
      throw new Error("Multiple [DB] folders detected!");
    }
  }

  folders = DriveApp.getRootFolder().getFoldersByName("[DB]");
  let folder = folders.next();

  dbName = "Database " + dbName.toString();
  if (!folder.getFilesByName(dbName).hasNext()) {
    let ss = SpreadsheetApp.create(dbName);
    SpreadsheetApp.setActiveSpreadsheet(ss);
    let sh = ss.getSheets()[0];
    sh.deleteColumns(3, 24);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
  }
}

function GetDatabaseFile(dbName) {
  const folders = DriveApp.getRootFolder().getFoldersByName("[DB]");
  if (!folders.hasNext()) {
    throw new Error("The [DB] folder was not found. Run CreateDatabase first.");
  }
  const files = folders.next().getFilesByName(dbName);
  if (!files.hasNext()) {
    throw new Error("Database not found: " + dbName);
  }
  return files.next();
}

function CountFromDatabase(dbName, sheetName, key, miliseconds = 0) {

  let ts_backward = miliseconds;

  let start_date = (new Date(0));
  let min_ts = 0;
  if (miliseconds > 0) {
    start_date = (new Date());
    min_ts = start_date.getTime() - ts_backward;
  }

  let count = 0;

  dbName = "Database " + dbName.toString();

  let db_file = GetDatabaseFile(dbName);
  let main_ss = SpreadsheetApp.open(db_file);
  SpreadsheetApp.setActiveSpreadsheet(main_ss);

  let ids = main_ss.getSheets()[0].getRange("B1:B");
  let id_values = Flatten(ids.getValues().filter(v => v.toString().length >= 1));
  id_values.reverse();

  let seconds_col = main_ss.getSheets()[0].getRange("A1:A");
  let second_values = Flatten(seconds_col.getValues().filter(v => v.toString().length >= 1));
  second_values.reverse();

  for (let index = 0; index < id_values.length; index++) {

    let parts = second_values[index].split(/[\.\/ :]/);
    let hr = (+parts[3]);
    let min = (+parts[4]);
    let sec = (+parts[5]);
    let year = (+parts[2]);
    let month_i = (+parts[1]) - 1;
    let day = (+parts[0]);
    let current_datetime = (new Date(year, month_i, day, hr, min, sec));
    current_datetime.setTime(current_datetime.getTime() + 1000);
    const current_ts = current_datetime.getTime();
    if (min_ts > current_ts) {
      break;
    }

    let id = id_values[index];
    let current_ss = SpreadsheetApp.openById(id);
    let current_sheet = current_ss.getSheetByName(sheetName);
    if (!current_sheet) {
      continue;
    }

    let timestamps = Flatten(current_sheet.getRange("A1:A").getValues());
    timestamps = timestamps.reverse();

    let keys = Flatten(current_sheet.getRange("B1:B").getValues());
    keys = keys.reverse();

    let backward_index = keys.findIndex(k => String(k) === String(key));
    if (backward_index === -1) {
      continue;
    }

    let sec_ts = (new Date(year, month_i, day, hr, min, sec)).getTime();

    let matched_indexes = keys.map((k, i) => String(k) === String(key) ? i : -1).filter(ind => ind >= 0);
    let matched_indexes_in_time = matched_indexes.filter(
      tested_index => min_ts <= (
        +timestamps[tested_index] + sec_ts
      )
    );
    count += matched_indexes_in_time.length;
  }
  return count;
}

function ReadFromDatabase(dbName, sheetName, key, miliseconds = 0) {

  let ts_backward = miliseconds;

  let start_date = (new Date(0));
  let min_ts = 0;
  if (miliseconds > 0) {
    start_date = (new Date());
    min_ts = start_date.getTime() - ts_backward;
  }

  dbName = "Database " + dbName.toString();

  let db_file = GetDatabaseFile(dbName);
  let main_ss = SpreadsheetApp.open(db_file);
  SpreadsheetApp.setActiveSpreadsheet(main_ss);

  let ids = main_ss.getSheets()[0].getRange("B1:B");
  let id_values = Flatten(ids.getValues().filter(v => v.toString().length >= 1));
  id_values.reverse();

  let seconds_col = main_ss.getSheets()[0].getRange("A1:A");
  let second_values = Flatten(seconds_col.getValues().filter(v => v.toString().length >= 1));
  second_values.reverse();

  for (let index = 0; index < id_values.length; index++) {

    let parts = second_values[index].split(/[\.\/ :]/);
    let hr = (+parts[3]);
    let min = (+parts[4]);
    let sec = (+parts[5]);
    let year = (+parts[2]);
    let month_i = (+parts[1]) - 1;
    let day = (+parts[0]);
    let current_datetime = (new Date(year, month_i, day, hr, min, sec));
    current_datetime.setTime(current_datetime.getTime() + 1000);
    const current_ts = current_datetime.getTime();
    if (min_ts > current_ts) {
      return null;
    }

    let id = id_values[index];
    let current_ss = SpreadsheetApp.openById(id);
    let current_sheet = current_ss.getSheetByName(sheetName);
    if (!current_sheet) {
      continue;
    }

    let timestamps = Flatten(current_sheet.getRange("A1:A").getValues());
    timestamps = timestamps.reverse();

    let keys = Flatten(current_sheet.getRange("B1:B").getValues());
    keys = keys.reverse();

    let backward_index = keys.findIndex(k => String(k) === String(key));
    if (backward_index === -1) {
      continue;
    }

    let row_ts = +timestamps[backward_index] + (new Date(year, month_i, day, hr, min, sec)).getTime();
    if (min_ts > row_ts) {
      return null;
    }

    let values = Flatten(current_sheet.getRange("C1:C").getValues());
    values = values.reverse();
    return Parse(values[backward_index]);
  }
  return null;
}

function AddToDatabase(dbName, sheetName, key, value) {

  dbName = "Database " + dbName.toString();

  let k = Lock();
  try {
    let current_sec = Now();
    let parts = current_sec.split(/[\.\/ :]/);
    let hr = (+parts[3]);
    let min = (+parts[4]);
    let sec = (+parts[5]);
    let year = (+parts[2]);
    let month_i = (+parts[1]) - 1;
    let day = (+parts[0]);
    let current_datetime = (new Date(year, month_i, day, hr, min, sec));
    let ms = (new Date()).getTime() - current_datetime.getTime();

    let db_file = GetDatabaseFile(dbName);
    let main_ss = SpreadsheetApp.open(db_file);
    SpreadsheetApp.setActiveSpreadsheet(main_ss);

    let main_name = main_ss.getName();
    let main_sh = main_ss.getSheets()[0];

    let sec_linking_col = main_sh.getRange("A1:A");
    let sec_linking_values = Flatten(sec_linking_col.getValues());

    let ids_col = main_sh.getRange("B1:B");
    let ids_values = Flatten(ids_col.getValues());

    let created_new_ss = false;

    let current_sec_ss = null;

    let current_sheet = null;

    if (!sec_linking_values.includes(current_sec)) {

      current_sec_ss = SpreadsheetApp.create(main_name + " (" + current_sec + ")");
      let current_sec_id = current_sec_ss.getId();

      DriveApp.getFileById(current_sec_id).moveTo(DriveApp.getRootFolder().getFoldersByName("[DB]").next());

      sec_linking_values.push(current_sec);
      sec_linking_values = sec_linking_values.filter(v => v.toString().length >= 1);
      sec_linking_col = main_sh.getRange(`A1:A${sec_linking_values.length}`);
      sec_linking_col.setNumberFormat("@");
      sec_linking_col.setValues(sec_linking_values.map(v => [v]));

      ids_values.push(current_sec_id);
      ids_values = ids_values.filter(v => v.toString().length >= 1);
      ids_col = main_sh.getRange(`B1:B${ids_values.length}`);
      ids_col.setNumberFormat("@");
      ids_col.setValues(ids_values.map(v => [v]));

      created_new_ss = true;

    } else {

      ids_values = ids_values.filter(v => v.toString().length >= 1);
      let current_sec_id = ids_values[ids_values.length - 1];
      current_sec_ss = SpreadsheetApp.openById(current_sec_id);
    }

    if (
      !current_sec_ss.getSheetByName(sheetName)
    ) {
      current_sheet = current_sec_ss.insertSheet(sheetName);
      current_sheet.deleteColumns(4, 23);
    } else {
      current_sheet = current_sec_ss.getSheetByName(sheetName);
    }

    if (created_new_ss) {
      const default_sheet = current_sec_ss.getSheets()[0];
      if (default_sheet.getSheetId() === current_sheet.getSheetId()) {
        current_sheet.deleteColumns(4, 23);
      } else {
        current_sec_ss.deleteSheet(default_sheet);
      }
    }

    let next_row = current_sheet.getRange(`A1:A`).getValues().filter(row => (row[0] ?? "").toString().length >= 1).length + 1;
    current_sheet.getRange(`A${next_row}:A${next_row}`).setValue(ms.toString());
    current_sheet.getRange(`B${next_row}:B${next_row}`).setNumberFormat("@").setValue(key.toString());
    current_sheet.getRange(`C${next_row}:C${next_row}`).setNumberFormat("@").setValue(Stringify(value));
  } finally {
    Unlock(k);
  }
}

async function PhotoDataUrl() {

  let lock = LockService.getDocumentLock();
  if (!lock.tryLock("30000")) {
    throw new Error("Could not acquire the document lock within 30 seconds!");
  }
  try {
    let headers = {
      'headers': {
        'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
      }
    }

    let id = await ExportCurrentCellPhoto();
    try {
      ShareFile(id);

      let url = DriveIdToUrl(id);
      let type = GetType(url, headers);
      if (
        !type || type.split("/")[0] != "image"
      ) {
        return;
      }
      let name = "temp." + type.split("/")[1];
      let content = ParseUrlContent(url, headers);
      let blob = PackContent(name, type, content);

      let dataUrl = `data:${type};base64,${Utilities.base64Encode(blob.getBytes())}`;
      return dataUrl;
    } finally {
      TrashFile(id);
    }
  } finally {
    lock.releaseLock();
  }
}

async function ExportCurrentCellPhoto() {
  let cell = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getActiveCell();
  let cellLoc = GetCellLocation(cell);
  let pdfId = ExportPdf(GetActiveSheetName(), cellLoc, cellLoc, {
    fzr: false,
    size: "2x2",
    top_margin: 0,
    bottom_margin: 0,
    left_margin: 0,
    right_margin: 0,
    pagenum: false
  });

  let pdf = DriveApp.getFileById(pdfId);
  try {
    let blob = (await PdfToPng(pdf.getBlob()))[0];
    blob.setName(`${GetActiveSheetName()}_${cellLoc}.png`);
    return SaveFile(blob);
  } finally {
    pdf.setTrashed(true);
  }
}

async function ExportCellPhoto(sheet, locat) {
  let pdfId = ExportPdf(sheet, locat, locat, {
    fzr: false,
    size: "2x2",
    top_margin: 0,
    bottom_margin: 0,
    left_margin: 0,
    right_margin: 0,
    pagenum: false
  });

  let pdf = DriveApp.getFileById(pdfId);
  try {
    let blob = (await PdfToPng(pdf.getBlob()))[0];
    blob.setName(`${sheet}_${locat}.png`);
    return SaveFile(blob);
  } finally {
    pdf.setTrashed(true);
  }
}

function TrashFile(id) {
  DriveApp.getFileById(id).setTrashed(true);
}

async function PhotoTemp(apiLayerApiKey) {
  let cell = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getActiveCell();
  let imgId = await ExportCurrentCellPhoto();
  ShareFile(imgId);

  let url = DriveIdToUrl(imgId);

  let options = {
    'followRedirects': true,
    'muteHttpExceptions': true,
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify({
      'url': url,
      'delay': 1,
      'quality': 99
    }),
    'headers': {
      'apikey': apiLayerApiKey
    }
  };

  let res;
  try {
    res = UrlFetchApp.fetch(`https://api.apilayer.com/image_upload/url`, options);
  } finally {
    TrashFile(imgId);
  }
  console.log(res.getContentText());
  let obj;
  try {
    obj = JSON.parse(res.getContentText());
  } catch (e) {
    obj = {};
  }

  if (!obj || !obj['image_url']) {
    const reason = (obj && obj['message']) || res.getContentText();
    throw new Error(`PhotoTemp failed (${res.getResponseCode()}): ${reason}`);
  }

  let l = Lock();
  try {
    cell.setValue(obj['image_url']);
  } finally {
    Unlock(l);
  }
}

function BlobToDataUrl(blob) {
  let dataUrl = `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`;
  return dataUrl;
}

function OptimizePhotoUrl(url, quality = 50, px = 120) {
  url = FinalUrl(url);
  let params = {
    'followRedirects': false,
    'muteHttpExceptions': true
  };
  let ftch = UrlFetchApp.fetch(url, params);
  if (ftch.getResponseCode() >= 400) {
    throw new Error(`OptimizePhotoUrl could not download the image (${ftch.getResponseCode()}): ${url}`);
  }
  let blob = ftch.getBlob();
  let { width, height } = ImgApp.getSize(blob);
  let scale = 1 / (Math.max(width, height) / px);
  if (scale >= 1) {
    return blob;
  }
  width = Math.max(1, Math.round(width * scale)).toFixed(0);
  height = Math.max(1, Math.round(height * scale)).toFixed(0);
  let resized = GetSync("https://resize.sardo.work", {
    imageUrl: url,
    width: width,
    height: height,
    quality: quality
  });
  if (resized.getResponseCode() >= 400) {
    throw new Error(`OptimizePhotoUrl resize failed (${resized.getResponseCode()}): ${url}`);
  }
  return resized.getBlob();
}

function OptimizePhotoId(id, px = 120) {
  let blob = DriveApp.getFileById(id).getBlob();
  let { width, height } = ImgApp.getSize(blob);
  let scale = 1 / (Math.max(width, height) / px);
  if (scale >= 1) {
    return blob;
  }
  let blob2 = ImgApp.doResize(
    id,
    Math.max(1, Math.round(width * scale)).toFixed(0)
  ).blob;
  return blob2;
}

function Locker(Fn) {
  let lock = LockService.getScriptLock();
  if (!lock.tryLock("30000")) {
    throw new Error("Could not acquire the script lock within 30 seconds!");
  }

  const release = function () {
    try {
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  };

  let result;
  try {
    result = Fn();
  } catch (e) {
    release();
    throw e;
  }
  if (result && typeof result.then === "function") {
    return Promise.resolve(result).finally(release);
  }
  release();
  return result;
}

function Lock() {
  let n = locks.findIndex(l => !l);
  if (n === -1) {
    n = locks.length;
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock("30000")) {
    throw new Error("Could not acquire the script lock within 30 seconds!");
  }
  locks[n] = lock;
  return n;
}

function Unlock(n) {
  SpreadsheetApp.flush();
  const lock = locks[n];
  locks[n] = null;
  if (lock) {
    lock.releaseLock();
  }
}

function GetCellLocation(cell) {
  return `${ColumnToLetter(cell.getColumn())}${cell.getRow()}`;
}

async function CurrentPhotoIntoUrl(bitlyApiKey, bitlyGuid) {
  let cell = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getActiveCell();
  let id = await ExportCurrentCellPhoto();
  let url;
  try {
    ShareFile(id);
    url = ShortUrl(bitlyApiKey, bitlyGuid, DriveIdToUrl(id));
  } catch (e) {
    TrashFile(id);
    throw e;
  }
  let l = Lock();
  try {
    cell.setValue(url);
  } finally {
    Unlock(l);
  }
  return url;
}

function OpenFile(id) {
  let url = EscapeHtml(DriveIdToUrl(id));
  let html = Html(`
    <button id="1">
      <a style="display: none;" id="2" target="_blank" href="${url}"></a>
    </button>
    <script id="3">
      document.getElementById("2").click();
      google.script.host.close();
    </script>
  `);
  SpreadsheetApp.getUi().showModelessDialog(html.setHeight(200).setWidth(200), 'Opening...');
}

function GetScriptAuthHeaders() {
  return {
    'headers': {
      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
    }
  };
}

function GetScriptIdentityHeaders() {
  return {
    'headers': {
      'Authorization': `Bearer ${ScriptApp.getIdentityToken()}`
    }
  };
}

function InsertImage(sheet, cell, id) {

  let image = SpreadsheetApp.newCellImage().setSourceUrl("https://drive.google.com/uc?id=" + id).build();
  let target = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet);
  if (!target) {
    throw new Error("Sheet not found: " + sheet);
  }
  cell = target.getRange(cell);

  let l = Lock();
  try {
    cell.setValue(image);
  } finally {
    Unlock(l);
  }
}

function ExportPdf(sheet = null, start = "A1", end = null, options = {}) {

  let sheetName = sheet;
  sheet = !!sheet ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet) : SpreadsheetApp.getActiveSheet();
  if (!sheet) {
    throw new Error("Sheet not found: " + sheetName);
  }
  end = end ?? ColumnToLetter(GetColumnsCount(sheet)) + GetRowsCount(sheet);
  let startCell = ParseCellLocation(start);
  let endCell = ParseCellLocation(end);

  let headers = {
    'headers': {
      'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
    }
  }

  let printOptions = {
    'exportFormat': 'pdf',
    'format': 'pdf',
    'size': 'A4',
    'fzr': true,
    'portrait': true,
    'fitw': true,
    'sheetnames': false,
    'printtitle': false,
    'pagenum': 'RIGHT',
    'gridlines': false,
    'attachment': false,
    'horizontal_alignment': 'CENTER',
    'vertical_alignment': 'MIDDLE',
    'alt': 'media',
    'top_margin': 0.50,
    'bottom_margin': 0.50,
    'left_margin': 0.50,
    'right_margin': 0.50,
    'gid': sheet.getSheetId(),
    'c1': startCell.column - 1,
    'r1': startCell.row - 1,
    'c2': endCell.column,
    'r2': endCell.row
  }

  let options_keys = Object.keys(options);
  for (let i = 0; i < options_keys.length; i++) {
    let key = options_keys[i];
    if (key == "name" || key == "path") {
      continue;
    }
    printOptions[key] = options[key];
  }

  let spsh_id = SpreadsheetApp.getActiveSpreadsheet().getId();
  let exportUrl = `https://docs.google.com/spreadsheets/d/${spsh_id}/export?${ObjectToQueryString(printOptions)}`;
  console.log(exportUrl);
  let blob = UrlFetchApp.fetch(exportUrl, headers).getBlob();
  blob.setName(TimeNow().replaceAll(":", "-") + " " + (options["name"] ?? "export") + ".pdf");
  let id = SaveFile(blob, (options["path"] ?? "/") + "/" + DateNow().replaceAll("/", "-"));

  return id;
}

function Qr(txt, options = {}) {

  console.log("QR text: " + txt);

  let blob = UrlFetchApp.fetch(`https://api.qrserver.com/v1/create-qr-code?size=500x500&data=${encodeURIComponent(txt)}`).getBlob();

  blob.setName(TimeNow().replaceAll(":", "-") + " " + (options.name ?? "QR_Code") + ".png");

  let id = SaveFile(blob, (options.path ?? "/") + "/" + DateNow().replaceAll("/", "-"));

  console.log(id);

  return id;
}

async function ExportRangeAsPng(sheet = null, start = "A1", end = null, options = {}) {

  const name = options["name"] ?? `טווח בטבלה`;

  options = {
    fzr: false,
    bottom_margin: 0,
    left_margin: 0,
    right_margin: 0,
    top_margin: 0,
    pagenum: false,
    ...options
  };

  console.log(options);

  let pdfId = ExportPdf(sheet, start, end, options);

  try {
    let pdf = DriveApp.getFileById(pdfId);
    let blob = (
      await PdfToPng(pdf.getBlob())
    )[0];

    blob.setName(TimeNow().replaceAll(":", "-") + " " + name + ".png");

    return SaveFile(blob, (options["path"] ?? "/") + "/" + DateNow().replaceAll("/", "-"));
  } finally {
    TrashFile(pdfId);
  }
}

function Now() {
  return DateNow() + " " + TimeNow();
}

function DateNow(language = "en", country = "IL", timeZone = "Asia/Jerusalem") {
  return (new Date()).toLocaleDateString(`${language}-${country}`, {
    timeZone: timeZone,
    weekday: undefined,
    year: 'numeric',
    month: "2-digit",
    day: "2-digit"
  });
}

function TimeNow(language = "en", country = "IL", timeZone = "Asia/Jerusalem") {
  return (new Date()).toLocaleTimeString(`${language}-${country}`, {
    timeZone: timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: "2-digit"
  });
}

function GetActiveSheetName() {
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().getName();
}

function GetEmail() {
  return Session.getEffectiveUser().getEmail();
}

function EscapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function Alert(msg) {
  let html = Html(`
    <style>
      html, body, h1 {
        overflow: hidden;
        text-align: center;
        display: flex;
        width: 100%;
        height: 100%;
        align-content: space-evenly;
        margin: 0;
        flex-wrap: wrap;
        flex-direction: row;
        flex: auto 1 1;
        direction: rtl;
        justify-content: center;
        align-content: middle;
      }
      h1 {
        height: 150px;
        width: 300px;
      }
    </style>
    <h1>
      ${EscapeHtml(msg)}
    </h1>
  `);
  SpreadsheetApp.getUi().showModelessDialog(html.setWidth(300).setHeight(150), 'שימו לב');
}

function Uuid(len) {
  const charset = UuidCharset();
  len = Math.max(1, len);
  if (len === Infinity) {
    throw new Error("Uuid needs a finite length");
  }
  let ret = charset[Random(0, charset.length - 1)];
  for (let i = 0; i < len - 1; i++) {
    ret += charset[Random(0, charset.length - 1)];
  }
  return ret;
}

function Random(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("Random needs finite numbers: " + min + ", " + max);
  }
  if (min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function Stringify(obj) {
  const FunctionSource = function (fn) {
    const text = fn.toString();
    if (/\{\s*\[native code\]\s*\}\s*$/.test(text)) {
      return "null";
    }
    const method = /^(async\s+)?(\*\s*)?([A-Za-z_$][\w$]*)\s*\(/.exec(text);
    if (method && !/^(function|async)\b/.test(method[3]) && !/^async\s*\(/.test(text)) {
      return text.replace(/^(async\s+)?(\*\s*)?/, function (all, isAsync, star) {
        return (isAsync || "") + "function " + (star || "");
      });
    }
    return text;
  };
  const Primitive = function (val) {
    return typeof val === "symbol" ? "null" : JSON.stringify(val);
  };
  let ret = "";
  let isArr = Array.isArray(obj);
  let isNull = obj === null;
  let isUndefined = obj === undefined;
  let isObj = typeof obj === "object";
  let isFunc = typeof obj === "function";
  let isPromise = typeof obj === "object" && obj instanceof Promise;
  let isDate = typeof obj === "object" && obj instanceof Date;
  if (isNull) {
    return "null";
  } else if (isUndefined) {
    return "null";
  } else if (isDate) {
    return JSON.stringify(obj);
  } else if (isPromise) {
    throw new Error("Could not convert Promise into String!")
  } else if (isFunc) {
    return FunctionSource(obj);
  } else if (isObj) {
    ret += isArr ? "[" : "{";
  } else {
    return Primitive(obj);
  }
  if (isArr) {
    let len = obj.length;
    for (let i = 0; i < len; i++) {
      let val = obj[i];
      if (typeof val === 'function') {
        ret += FunctionSource(val);
      } else if (val === null) {
        ret += "null";
      } else if (val === undefined) {
        ret += "null";
      } else if (typeof val === 'object') {
        ret += Stringify(val);
      } else {
        ret += Primitive(val);
      }
      if (i < len - 1) {
        ret += ",";
      }
    }
  } else {
    let keys = Object.keys(obj);
    let len = keys.length;
    let written = 0;
    for (let i = 0; i < len; i++) {
      let key = keys[i];
      let val = obj[key];
      if (val === undefined) {
        continue;
      }
      if (written > 0) {
        ret += ",";
      }
      written++;
      ret += JSON.stringify(key) + ":";
      if (typeof val === 'function') {
        ret += FunctionSource(val);
      } else if (val === null) {
        ret += "null";
      } else if (typeof val === 'object') {
        ret += Stringify(val);
      } else {
        ret += Primitive(val);
      }
    }
  }
  ret += isArr ? "]" : "}";
  return ret;
}

function Parse(str) {
  const isOneFunction = function (src) {
    const text = src.trim();
    const isArrow = !/^(async\s+)?function\b/.test(text);
    const closers = { ")": "(", "]": "[", "}": "{" };
    const stack = [];
    let regexAllowed = true;
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      const two = text.slice(i, i + 2);
      if (two === "//") {
        const nl = text.indexOf("\n", i);
        i = nl === -1 ? text.length : nl + 1;
      } else if (two === "/*") {
        const end = text.indexOf("*/", i + 2);
        if (end === -1) {
          return false;
        }
        i = end + 2;
      } else if (c === "'" || c === '"') {
        i++;
        while (i < text.length && text[i] !== c) {
          i += text[i] === "\\" ? 2 : 1;
        }
        if (i >= text.length) {
          return false;
        }
        i++;
        regexAllowed = false;
      } else if (c === "`") {
        stack.push("`");
        i++;
        while (stack[stack.length - 1] === "`") {
          if (i >= text.length) {
            return false;
          }
          if (text[i] === "\\") {
            i += 2;
          } else if (text[i] === "`") {
            stack.pop();
            i++;
          } else if (text.slice(i, i + 2) === "${") {
            stack.push("${");
            i += 2;
            break;
          } else {
            i++;
          }
        }
        regexAllowed = false;
      } else if (c === "/" && regexAllowed) {
        i++;
        let inClass = false;
        while (i < text.length && (inClass || text[i] !== "/")) {
          if (text[i] === "\\") {
            i++;
          } else if (text[i] === "[") {
            inClass = true;
          } else if (text[i] === "]") {
            inClass = false;
          }
          i++;
        }
        if (i >= text.length) {
          return false;
        }
        i++;
        regexAllowed = false;
      } else if (c === "(" || c === "[" || c === "{") {
        stack.push(c);
        i++;
        regexAllowed = true;
      } else if (c === ")" || c === "]" || c === "}") {
        if (c === "}" && stack[stack.length - 1] === "${") {
          stack.pop();
          i++;
          while (stack[stack.length - 1] === "`") {
            if (i >= text.length) {
              return false;
            }
            if (text[i] === "\\") {
              i += 2;
            } else if (text[i] === "`") {
              stack.pop();
              i++;
            } else if (text.slice(i, i + 2) === "${") {
              stack.push("${");
              i += 2;
              break;
            } else {
              i++;
            }
          }
          regexAllowed = false;
          continue;
        }
        if (stack.pop() !== closers[c]) {
          return false;
        }
        i++;
        if (c === "}" && stack.length === 0 && i < text.length) {
          return false;
        }
        regexAllowed = c === "}";
      } else if ((c === "," || c === ";") && stack.length === 0 && isArrow) {
        return false;
      } else if (/[\w$]/.test(c)) {
        let j = i;
        while (j < text.length && /[\w$]/.test(text[j])) {
          j++;
        }
        regexAllowed = /^(return|typeof|in|of|new|delete|void|throw|case|do|else|instanceof|yield|await)$/.test(text.slice(i, j));
        i = j;
      } else {
        if (!/\s/.test(c)) {
          regexAllowed = c !== ")" && c !== "]";
        }
        i++;
      }
    }
    return stack.length === 0;
  };
  const functionSource = /^\s*(async\s+)?(function\b[\s\S]*\}|(\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>[\s\S]+)\s*$/;
  return JSON.parse(str, function (key, val) {
    if (typeof val !== "string" || !functionSource.test(val)) {
      return val;
    }
    if (!isOneFunction(val)) {
      return val;
    }
    try {
      const fn = eval("(" + val + ")");
      return typeof fn === "function" ? fn : val;
    } catch (e) {
      return val;
    }
  });
}

function Flush() {
  SpreadsheetApp.flush();
}

function TryEndlessly(Func, ...args) {
  while (true) {
    try {
      let ret = Func(...args);
      console.log("TryEndlessly: OK");
      return ret;
    } catch (e) {
      Utilities.sleep(500);
    }
  }
}

function TryRepeatedly(attempts, Func, ...args) {
  for (let attempt = 1; ; attempt++) {
    try {
      return Func(...args);
    } catch (e) {
      if (attempt >= attempts) {
        throw e;
      }
      Utilities.sleep(500);
    }
  }
}

async function PdfToPng(blob) {
  const data = new Uint8Array(blob.getBytes());
  const pdfLib = LoadPdfLib();
  const pdfData = await pdfLib.PDFDocument.load(data);
  const pageLength = pdfData.getPageCount();
  console.log(`Total pages: ${pageLength}`);
  const obj = { imageBlobs: [], fileIds: [] };
  try {
    for (let i = 0; i < pageLength; i++) {
      const pdfDoc = await pdfLib.PDFDocument.create();
      const [page] = await pdfDoc.copyPages(pdfData, [i]);
      await pdfDoc.addPage(page);
      const bytes = await pdfDoc.save();
      const blob = Utilities.newBlob([...new Int8Array(bytes)], MimeType.PDF, `sample${i + 1}.pdf`);
      const id = DriveApp.createFile(blob).getId();
      obj.fileIds.push(id);
      let link = TryRepeatedly(60, function (id) {
        let ret = Drive.Files.get(id, { fields: "thumbnailLink" }).thumbnailLink;
        if (!ret) {
          throw new Error("Error: thumbnailLink is undefined!");
        }
        return ret;
      }, id);
      link = link.replace(/\=s[0-9]{1,}/, "=s1024");
      console.log("PdfToPng: " + link);
      const imageBlob = UrlFetchApp.fetch(link).getBlob();
      imageBlob.setName(`page${i + 1}.png`);
      obj.imageBlobs.push(imageBlob);
    }
  } finally {
    obj.fileIds.forEach(id => DriveApp.getFileById(id).setTrashed(true));
  }
  return obj.imageBlobs;
}

function ShortUrl(bitlyApiKey, bitlyGuid, url) {

  let options = {
    'followRedirects': true,
    'muteHttpExceptions': true,
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify({
      "group_guid": bitlyGuid,
      "long_url": url
    }),
    'headers': {
      'Authorization': `Bearer ${bitlyApiKey}`
    }
  };

  let res = UrlFetchApp.fetch("https://api-ssl.bitly.com/v4/shorten", options);

  console.log(res.getContentText());

  let obj;
  try {
    obj = JSON.parse(res.getContentText());
  } catch (e) {
    obj = {};
  }

  if (!obj || !obj['link']) {
    const reason = (obj && (obj['message'] || obj['description'])) || res.getContentText();
    throw new Error(`ShortUrl failed (${res.getResponseCode()}): ${reason}`);
  }

  return obj['link'];
}

function GetType(url, headers = {}) {
  let params = {
    'followRedirects': false,
    'muteHttpExceptions': true,
    ...headers
  };
  try {
    url = FinalUrl(url, headers);
    let res = UrlFetchApp.fetch(url, params);
    let responseHeaders = res.getHeaders();
    let typeKey = Object.keys(responseHeaders).find(k => k.toLowerCase() === "content-type");
    let contentType = typeKey ? responseHeaders[typeKey] : "";
    let code = res.getResponseCode();
    if(code<400){
      contentType = (contentType ?? "").toString();
      const mediaType = contentType.split(";")[0].trim().toLowerCase();
      return mediaType.length >= 1 ? mediaType : "application/unknown";
    } else {
      return null;
    }
  } catch (e) {
    console.log(e);
    return null;
  }
}

function ParseIdContent(id) {
  return ParseUrlContent("https://drive.google.com/uc?id=" + id);
}

function DriveUrlToId(url) {
  const match = /\/d\/([-\w]+)/.exec(url) || /\/folders\/([-\w]+)/.exec(url) || /[?&]id=([-\w]+)/.exec(url);
  return match ? match[1] : url;
}

function DriveIdToUrl(id) {
  return `https://drive.google.com/file/d/${id}/view`;
}

function DriveIdToFinalUrl(id) {
  return FinalUrl("https://drive.google.com/uc?id=" + id);
}

function PackContent(name, type, content) {
  let blob = Utilities.newBlob(" ");
  blob.setBytes(content);
  blob.setName(name);
  blob.setContentType(type);
  return blob;
}

function ParseUrlContent(url, headers = {}) {
  url = FinalUrl(url, headers);
  let params = {
    'followRedirects': false,
    'muteHttpExceptions': true,
    ...headers
  };
  let res = UrlFetchApp.fetch(url, params);
  if (res.getResponseCode() >= 400) {
    throw new Error(`Could not read the url (${res.getResponseCode()}): ${url}`);
  }
  return res.getBlob().getBytes();
}

function FinalUrl(url, headers = {}) {
  let max = 100;
  var params = {
    'followRedirects': false,
    'muteHttpExceptions': true,
    ...headers
  };
  let redirection = null;
  function Redirect() {
    try {
      const responseHeaders = UrlFetchApp.fetch(url, params).getHeaders();
      const locationKey = Object.keys(responseHeaders).find(k => k.toLowerCase() === "location");
      const location = locationKey ? responseHeaders[locationKey] : null;
      redirection = location ? RelativeToAbsoluteUrl(url, String(location)) : null;
    } catch (e) {
      redirection = null;
    }
  }
  Redirect();
  let current = 0;
  while (redirection) {
    current++;
    if (current > max) {
      throw new Error("Too many redirects: " + url);
    }
    url = redirection;
    Redirect();
  }
  return url;
}

function GetRowsCount(sheet) {
  return sheet.getRange("A1:A").getNumRows();
}

function GetColumnsCount(sheet) {
  return sheet.getRange("A1:1").getNumColumns();
}

function ColumnToLetter(column) {
  var temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter.toUpperCase();
}

function LettersToColumn(letters) {
  let column = 0;
  letters = letters.toUpperCase();
  for (let i = 0; i < letters.length; i++) {
    column = column * 26 + (letters.charCodeAt(i) - 64);
  }
  return column;
}

function ParseCellLocation(location) {
  const match = /^\s*\$?([A-Za-z]+)\$?(\d+)\s*$/.exec(location);
  if (!match || +match[2] < 1) {
    throw new Error("Invalid cell location: " + location);
  }
  return { column: LettersToColumn(match[1]), row: +match[2] };
}

function ObjectToQueryString(obj) {
  const pairs = [];
  const add = function (name, value) {
    if (value === undefined || value === null) {
      return;
    }
    if (value instanceof Date) {
      pairs.push(`${name}=${encodeURIComponent(value.toISOString())}`);
    } else if (typeof value === "object") {
      Object.keys(value).forEach(function (k) {
        add(`${name}%5B${encodeURIComponent(k)}%5D`, value[k]);
      });
    } else {
      pairs.push(`${name}=${encodeURIComponent(value)}`);
    }
  };
  Object.keys(obj).forEach(function (key) {
    add(encodeURIComponent(key), obj[key]);
  });
  return pairs.join("&");
}

function GetQs(args) {
  var data = '';
  for (var i = 1; i < args.length; i += 2) {
    if (args[i] === undefined || args[i] === null) {
      continue;
    }
    if (data != '') {
      data += '&';
    }
    data += `${encodeURIComponent(args[i - 1])}=${encodeURIComponent(args[i])}`;
  }
  return data;
}

function EmptyFolder(path) {
  if (typeof path !== "string" || path.split("/").every(part => part === "")) {
    throw new Error("EmptyFolder needs a folder path and will not empty the Drive root");
  }
  let folders = path.split("/");
  let folder = DriveApp.getRootFolder();
  for (let i = 0; i < folders.length; i++) {
    if (folders[i] === "") {
      continue;
    }
    let found = folder.getFoldersByName(folders[i]);
    if (!found.hasNext()) {
      throw new Error("Folder not found: " + folders[i]);
    }
    folder = found.next();
  }
  let files = folder.getFiles();
  while (files.hasNext()) {
    files.next().setTrashed(true);
  }
}

function SaveUrl(url, path = "/") {
  let parts = path.split("/");
  let folders = parts.slice(0, parts.length - 1);
  let name = parts[parts.length - 1];
  if (name === "") {
    name = url.split(/[?#]/)[0].split("/").pop() || "file";
  }
  let type = GetType(url);
  if (type === null) {
    throw new Error("Could not read the url: " + url);
  }
  let bytes = ParseUrlContent(url);
  let blob = PackContent(name, type, bytes);
  let folder = DriveApp.getRootFolder();
  for (let i = 0; i < folders.length; i++) {
    if (folders[i] === "") {
      continue;
    }
    let found = folder.getFoldersByName(folders[i]);
    folder = found.hasNext() ? found.next() : folder.createFolder(folders[i]);
  }
  return folder.createFile(blob).getId();
}

function ShareFile(id) {
  DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
}

function UnshareFile(id) {
  DriveApp.getFileById(id).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
}

function SaveFile(blob, path = "/") {
  let folders = path.split("/");
  let folder = DriveApp.getRootFolder();
  for (let i = 0; i < folders.length; i++) {
    if (folders[i] === "") {
      continue;
    }
    try {
      let f = folder.getFoldersByName(folders[i]).next();
      folder = f;
    } catch (e) {
      folder.createFolder(folders[i]);
      folder = folder.getFoldersByName(folders[i]).next();
    }
  }
  let id = folder.createFile(blob).getId();
  return id;
}

function GetObject(args) {
  var data = {};
  for (var i = 1; i < args.length; i += 2) {
    Object.defineProperty(data, args[i - 1], { value: args[i], enumerable: true, writable: true, configurable: true });
  };
  return data;
}

function Sleep(ms) {
  return (new Promise(resolve => setTimeout(resolve, ms)));
}

function WaitUntil(timeout, Test, Success, Fail = function () {
  console.error("WaitUntil() Timeout!");
}) {
  let start = (new Date()).getTime();
  
  function Internal(timeout, Test, Success, Fail, start){
    let end = timeout * 1000 + start;
    if (!Test()) {
      let now = (new Date()).getTime();
      if (now > end) {
        return Fail();
      }
      return Sleep(100).then(function () {
        requestAnimationFrame(function(){
          Internal(timeout, Test, Success, Fail, start);
        });
      });
    }
    return Success();
  }

  requestAnimationFrame(function(){
    Internal(timeout, Test, Success, Fail, start);
  });
};

function ExecAsync(Fn, ...all_params) {
  let Fn2 = async function () {
    try {
      return await Fn(...all_params);
    } catch (e) {
      console.log(e);
      return null;
    }
  };
  return Fn2();
}

function createWorker() {
    const workerCode = `self.onmessage = async function(e) {
        const { asyncFnString, deps, data } = e.data;
        eval(deps);
        let func;
        try {
            func = eval('(' + asyncFnString + ')');
        } catch (parseError) {
            self.postMessage({ error: 'Function parsing failed: ' + parseError.message });
            return;
        }

        try {
            const result = await func(...(Array.isArray(data) ? data : [data]));
            self.postMessage({ result: result });
        } catch (execError) {
            self.postMessage({ error: 'Function execution failed: ' + execError.message });
        }
    };`;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}

function Threads(AsyncFun, arr, deps = [], delay = 0, timeout = 360) {
  if (!Array.isArray(arr)) {
    arr = [arr];
  } else {
    arr = [...arr];
  }

  const allDeps = [...deps, Parse];
  const deps_txt = "" + allDeps.map(d => typeof d === "function" ? d.toString() : Stringify(d)).join("\n");

  const results = new Array(arr.length);
  let completedWorkers = 0;
  const asyncFnString = AsyncFun.toString();
  const workerUrl = createWorker();
  const workers = new Set();
  const startTimers = [];
  let timeoutId = null;

  function cleanup() {
    clearTimeout(timeoutId);
    startTimers.forEach(clearTimeout);
    workers.forEach(w => w.terminate());
    workers.clear();
    URL.revokeObjectURL(workerUrl);
  }

  return new Promise((resolve, reject) => {
    if (arr.length === 0) {
      cleanup();
      resolve([]);
      return;
    }

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Threads operation timed out after ${timeout} seconds.`));
    }, timeout * 1000);

    arr.forEach((item, index) => {
      const currentDelayMs = index * delay * 1000;

      startTimers.push(setTimeout(() => {
        const worker = new Worker(workerUrl);
        workers.add(worker);

        worker.onmessage = function(e) {
          if (e.data.result !== undefined) {
            results[index] = e.data.result;
          } else if (e.data.error) {
            console.error(`Worker ${index} error:`, e.data.error);
            results[index] = new Error(e.data.error);
          }

          completedWorkers++;
          worker.terminate();
          workers.delete(worker);

          if (completedWorkers === arr.length) {
            cleanup();
            resolve(results);
          }
        };

        worker.onerror = function(error) {
          console.error(`Worker ${index} failed to load or had a critical error:`, error);
          results[index] = new Error(`Worker initialization/critical error: ${error.message}`);
          completedWorkers++;
          worker.terminate();
          workers.delete(worker);

          if (completedWorkers === arr.length) {
            cleanup();
            resolve(results);
          }
        };

        worker.postMessage({ asyncFnString: asyncFnString, deps: deps_txt, data: item });
      }, currentDelayMs));
    });
  });
}

function UrlInfo(d) {
  const urlAttribute = /(?<=^|:)(?:(href|ref|poster|data|(data-)?(src(set)?)|(((\w)+-)*url))=("[^"]+"|'[^']+')|content=((")(?:(?!\w+")[^",\s\/]*((\/)[^",\s\/]*)+")|(')(?:(?!\w+')[^',\s\/]*((\/)[^',\s\/]*)+')))/gs;
  const nestedStr = /(&quot;|&#34;|&apos;|&#39;)[^&]*((?:(?!(&quot;|&#34;|&apos;|&#39;))&[^;]+)[^&]*)*(&quot;|&#34;|&apos;|&#39;)/gsm;
  const styles = /<\s*style[^<>]*>(?:(?!<\s*\/\s*style\s*>).)+<\s*\/\s*style\s*>/gsmi;
  const scripts = /<\s*meta[^>]*>|<\s*link[^>]*>|<\s*script[^>]*>[^">'`\/\*]*((\/\*((?!\*\/).)*\*\/|\/\/.*$|"[^"]*"|'[^']*'|`[^`]*`|\/|\*|>)[^"'`\/\*]*)*<\/\s*script\s*>/gsmi;
  const body = /<\s*body[^>]*>.+<\s*\/\s*body\s*>/gsmi;
  const bodyTags = /<\s*body[^>]*>|<\s*\/\s*body\s*>/gsmi
  const openTag = /<\s*\w+[^<>]*>/gsm;
  const biTag = /<(?:(?!(\/\s*)?>).)+\/\s*>/gsm;
  const closeTag = /<\s*\/\s*\w+\s*>/gsm;
  const tagsComponents = /<\s*\w+[^<>]*>|<(?:(?!(\/\s*)?>).)+\/\s*>|<\s*\/\s*\w+\s*>|[^<]*/gsm;
  const tagLeft = /<\s*(\/\s*)?/gsm;
  const tagRight = /\s*(\/)?\s*>/gsm;

  const randId = "_" + Math.random().toString().slice(2);
  const schemePattern = /^[A-Za-z][A-Za-z0-9+.\-]*:\/\//;
  let url = schemePattern.test(d) ? d : "http://"+d;
  d = url.replace(schemePattern, "").split(/[\/?#]/)[0];

  const toScriptLiteral = text => JSON.stringify(text).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
  const hostLiteral = toScriptLiteral(d);

  console.log("Getting final URL");

  url = FinalUrl(url);
  let dom = 'http://localhost:8000';
  const redirectValue = u => encodeURI(u).replaceAll("&", "%26").replaceAll("+", "%2B");
  const redirectUrl = u => `${dom}?redirect${randId}=${redirectValue(RelativeToAbsoluteUrl(url,u))}`;
  const cssSafe = text => text.replaceAll(/[()'"]/g, c => "%" + c.charCodeAt(0).toString(16));
  const rewriteCssUrls = css => css
    .replaceAll(/url\(\s*(['"]?)([^'")]+?)\1\s*\)/gi, (all, quote, u) => /^(data|javascript|#)/i.test(u.trim()) ? all : `url(${quote}${cssSafe(redirectUrl(u.trim()))}${quote})`)
    .replaceAll(/@import\s+(['"])([^'"]+)\1/gi, (all, quote, u) => `@import ${quote}${cssSafe(redirectUrl(u.trim()))}${quote}`);
  let b = new Uint8Array(GetSync(url).getContent());
  let str = Utilities.newBlob(b).getDataAsString().trim();
  if(!/<\s*body[\s>]/i.test(str)){
    const headOnly = /^\s*(?:<!doctype[^>]*>|<\s*\/?\s*(?:html|head)\b[^>]*>|<\s*(?:meta|link|base)\b[^>]*>|<\s*(title|style|script|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>)/i;
    let at = 0;
    let headPart;
    while((headPart = headOnly.exec(str.slice(at)))){
      at += headPart[0].length;
    }
    str = str.slice(0,at) + "<body>" + str.slice(at);
    const htmlEnd = str.search(/<\s*\/\s*html\s*>\s*$/i);
    str = htmlEnd === -1 ? str + "</body>" : str.slice(0,htmlEnd) + "</body>" + str.slice(htmlEnd);
  }
  let tester = str.replaceAll(/\s*/gsm,"").toLowerCase();
  if(!tester.endsWith(`</html>`)){
    if( str.match(body) ){
      str += `</html>`;
    } else {
      str += `</body></html>`;
    }
  }

  console.log("Generating HTML for cloning...");

  str = str.replaceAll(/<!--[\s\S]*?(-->|$)/g,"");

  const baseTag = /<\s*base\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(str);
  const baseHref = baseTag ? (baseTag[1] ?? baseTag[2] ?? baseTag[3]).trim() : "";
  if(baseHref !== ""){
    url = RelativeToAbsoluteUrl(url,baseHref);
  }

  const markup = str;
  str = str.split("");
  let isText = "";
  let inTag = false;
  let rawTag = null;
  let tagStart = 0;
  for( let i = 0 ; i < str.length ; i++ ){
    let c = str[i];
    if( !inTag && rawTag === null ){
      if( "<" === c ){
        if( /^<\/?[A-Za-z]/.test(markup.slice(i,i+3)) ){
          inTag = true;
          tagStart = i;
        } else {
          str[i] = "&lt;";
        }
      }
      continue;
    }
    if( rawTag !== null && "<" === c && new RegExp("^<\\/" + rawTag + "[\\s/>]","i").test(markup.slice(i,i+rawTag.length+3)) ){
      rawTag = null;
      isText = "";
      inTag = true;
      tagStart = i;
      continue;
    }
    if( "\\" === c && rawTag !== null ){
      i++;
    } else if( "'" === c || '"' === c ){
      isText = isText === "" ? c : isText === c ? "" : isText;
    } else if(["<",">"].includes(c)){
      str[i] = isText.length===0 ? c : c==="<" ? "&lt;" : "&gt;";
      if( ">" === c && isText.length === 0 && inTag ){
        inTag = false;
        const opened = /^<([A-Za-z]+)/.exec(markup.slice(tagStart,i));
        if( opened && ["script","style"].includes(opened[1].toLowerCase()) ){
          rawTag = opened[1].toLowerCase();
        }
      }
    }
  }
  str = str.join("");

  let matched = str.match(nestedStr);
  if(matched){
    for( let i = 0 ; i < matched.length ; i++ ){
      let m = matched[i];
      let htmlEscp = m.split(";")[0]+";";
      let content = m.split(htmlEscp).slice(1,-1).join(htmlEscp).trim();
      if( content.startsWith("http://") || content.startsWith("https://") ){
        content = `${dom}?redirect${randId}=${redirectValue(content)}`;
      }
      str = str.replace(m,`${htmlEscp}${content}${htmlEscp}`);
    }
  }

  let m1 = str.match(styles);
  let m2 = str.match(scripts);
  let m3 = str.match(body);

  let consl = `<!DOCTYPE html><html><head>
		<meta charset="utf8">
		<meta name="viewport" content="width=100,height=100,initial-scale=0.1,user-scalable=1">
		<title>Webpage duplication</title>
		<script>
			window.onbeforeunload = function(e){
				e.preventDefault();
				e.stopPropagation();
				return false;
			};
			window.preventNavigation = setInterval(function(){
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
				window.location.replace('#');
			},0.1);
			setTimeout(function(){
				clearInterval(window.preventNavigation);
			},2000);
      window.${randId} = {
        search: "",
        host: ${hostLiteral},
        hostname: ${hostLiteral},
        href: ${toScriptLiteral("https://" + d + "/")},
        origin: ${toScriptLiteral("https://" + d)},
        replace: function(...args){},
        reload: function(...args){}
      };
		</script>
  `;

  console.log("Checking M1");

  if(m1){
    console.log(`Calculating M1 (${m1.length} steps)`);
    consl += "<style>";
    m1.forEach(function(css){
      consl += `${rewriteCssUrls(css.trim().replaceAll(/<(\/)?style([^<>])*>/gsmi,""))}\n`;
    });
    console.log(`Appending M1 (${m1.length} steps)`);
    consl = consl.trim() + "</style>";
  }

  console.log("Checking M2");

  if(m2){
    console.log(`Calculating M2 (${m2.length} steps)`);
    for(let i = 0 ; i < m2.length ; i++){
      m2[i] = m2[i].trim();
      let c = m2[i];
      let open = c.match(openTag);
      open = open[0];
      let l = open.match(tagLeft)[0];
      let r = open.match(tagRight)[0];
      let n = open.replace(l,"").match(/\w+/gsm)[0].toLowerCase();
      let a = QuoteAttributes(open.replace(l,"").replace(r,"").slice(n.length).trim());
      let ay = [...(a.match(/\s*[-:\w]+=(('[^']*')|("[^"]*"))/gsm) ?? [])].map( x => {
        return x.trim();
      });
      let an = a;
      ay.map(x =>{
        an = an.replace(x,"");
      });
      let moreRes = ay.filter(_ => _.match(/^(data-)?srcset=/gms));
      ay = [...ay].map(x => {
        let matched = x.match(urlAttribute);
        if(matched){
          matched = matched[0];
          if( (!matched.match(/^(data-)?srcset=/gms)) && moreRes.length >= 1 ){
            return "";
          }
          if(moreRes.length >= 1){
            x = x.replace(/^(data-)?srcset=/gms,"src=").replace(/^(data-)/gms,"");
          }
          matched.replace(/^(href|ref|poster|data|(data-)?(src(set)?)|(((\w)+-)*url)|content)=/gms,"").slice(1,-1).replaceAll(/(\s){2,}/gsm," ").split(" ").filter(u => !u.match(/^\d+/gsm)).map((u,ind,arr) => {
            if(!u.match(/^(data|javascript|mailto|tel|sms|blob|about):/i)){
              if(ind === arr.length-1){
                x = x.replace(/=.*/gsm,`="${dom}?redirect${randId}=${redirectValue(RelativeToAbsoluteUrl(url,u))}"`);
              }
            }
          });
        }
        return x;
      });
      if(n === "link" && ay.includes('rel="preload"')){
        if(ay.includes('as="style"')){
          ay[ay.indexOf('rel="preload"')] = 'rel="stylesheet"';
          ay[ay.indexOf('as="style"')] = "";
        } else if(ay.includes('as="script"')){
          n = "script";
          ay[ay.indexOf('as="script"')] = 'defer=""';
          ay[ay.indexOf('rel="preload"')] = '';
          ay = ay.map(att => {
            if(att.startsWith("href")){
              att = att.replace("href","src");
            }
            return att;
          });
        }
      }
      an = an.replaceAll(/( ){2,}/g," ").trim().split(" ");
      let ax = [
        ...ay.filter(x => x.length >= 1),
        ...an.filter(x => x.length >= 1).map(x => x+'=""')
      ];
      open = l + (n + " " + ax.map(x=>x.trim()).filter(x => x.length >= 4).join(" ")).trim() + r;
      let close = ["link","meta"].includes(n) ? "" : "</script>";
      let inter = c.slice( c.match(openTag)[0].length, -1 * close.length ).replaceAll("location",randId);
      m2[i] = open + inter + close;
      consl += m2[i];

      //console.log(`Appending M2 [${i+1}/${m2.length}]`);
    }
  }

  consl += `</head><body>`;

  console.log("Checking M3");
  
  if(m3){
    console.log(`Pre-Processing M3`);
    m3 = m3[0].trim().replace(bodyTags,"");
    let coms = m3.match(tagsComponents);
    let lastWasScript = false;
    let rawDepth = 0;
    let tagsLifo = [];
    console.log(`Calculating M3 (${coms.length} steps)`);
    for(let i = 0 ; i < coms.length ; i++){
      //console.log(`Appending M3 [${i+1}/${coms.length}]`);
      const raw = coms[i];
      let c = raw.trim();
      if(c === ""){
        if(raw !== "" && !lastWasScript){
          consl += rawDepth > 0 ? raw : " ";
        }
        continue;
      }
      //console.log(`M3 (step ${i+1})\n${c}`);
      if(c.match(openTag)){
        let l = c.match(tagLeft)[0];
        let r = c.match(tagRight)[0];
        let n = c.replace(l,"").match(/\w+/gsm)[0].toLowerCase();
        if("link" === n){
          continue;
        }
        if("script" === n){
          lastWasScript = true;
          continue;
        }
        let a = QuoteAttributes(c.replace(l,"").replace(r,"").slice(n.length).trim());
        let ay = [...(a.match(/\s*[-:\w]+=(('[^']*')|("[^"]*"))/gsm) ?? [])].map( x => {
          return x.trim();
        });
        let an = a;
        ay.map(x =>{
          an = an.replace(x,"");
        });
        ay = ay.map(x => /^style=/i.test(x) ? rewriteCssUrls(x) : x);
        let moreRes = ay.filter(_ => _.match(/^(data-)?srcset=/gms));
        ay = [...ay].map(x => {
          let matched = x.match(urlAttribute);
          if(matched){
            matched = matched[0];
            if( (!matched.match(/^(data-)?srcset=/gms)) && moreRes.length >= 1 ){
              return "";
            }
            if(moreRes.length >= 1){
              x = x.replace(/^(data-)?srcset=/gms,"src=").replace(/^(data-)/gms,"");
            }
            matched.replace(/^(href|ref|poster|data|(data-)?(src(set)?)|(((\w)+-)*url)|content)=/gms,"").replaceAll(/&(quot|#34|apos|#39);/gms," ").slice(1,-1).replaceAll(/(\s){2,}/gsm," ").split(" ").filter(u => !u.match(/^\d+/gsm)).map((u,ind,arr) => {
              if(!u.match(/^(data|javascript|mailto|tel|sms|blob|about):/i)){
                if(ind === arr.length-1){
                  x = x.replace(/=.*/gsm,`="${dom}?redirect${randId}=${redirectValue(RelativeToAbsoluteUrl(url,u))}"`);
                }
              }
            });
          }
          return x;
        });
        an = an.replaceAll(/( ){2,}/g," ").trim().split(" ");
        let ax = [
          ...ay.filter(x => x.length >= 1),
          ...an.filter(x => x.length >= 1).map(x => x+'=""')
        ];
        tagsLifo.push(n);
        if("pre" === n || "textarea" === n){
          rawDepth++;
        }
        consl += l + (n + " " + ax.map(x=>x.trim()).filter(x => x.length >= 4).join(" ")).trim() + r;
      } else if(c.match(closeTag)){
        let l = c.match(tagLeft)[0];
        let n = c.replace(l,"").match(/\w+/gsm)[0].toLowerCase();
        if("script" === n){
          lastWasScript = false;
          continue;
        }
        if(("pre" === n || "textarea" === n) && rawDepth > 0){
          rawDepth--;
        }
        if(tagsLifo.length >= 1){
          let topStack = tagsLifo.pop();
          consl += `</${n}>`;
          if(tagsLifo.length >= 1 && topStack !== n){
            tagsLifo[tagsLifo.length-1] = topStack;
          }
        }
      } else if(c.match(biTag)){
        let l = c.match(tagLeft)[0];
        let r = c.match(tagRight)[0];
        let n = c.replace(l,"").match(/\w+/gsm)[0].toLowerCase();
        let a = QuoteAttributes(c.replace(l,"").replace(r,"").slice(n.length).trim());
        let ay = [...(a.match(/\s*[-:\w]+=(('[^']*')|("[^"]*"))/gsm) ?? [])].map( x => {
          return x.trim();
        });
        let an = a;
        ay.map(x =>{
          an = an.replace(x,"");
        });
        ay = ay.map(x => /^style=/i.test(x) ? rewriteCssUrls(x) : x);
        let moreRes = ay.filter(_ => _.match(/^(data-)?srcset=/gms));
        ay = [...ay].map(x => {
          let matched = x.match(urlAttribute);
          if(matched){
            matched = matched[0];
            if( (!matched.match(/^(data-)?srcset=/gms)) && moreRes.length >= 1 ){
              return "";
            }
            if(moreRes.length >= 1){
              x = x.replace(/^(data-)?srcset=/gms,"src=").replace(/^(data-)/gms,"");
            }
            matched.replace(/^(href|ref|poster|data|(data-)?(src(set)?)|(((\w)+-)*url)|content)=/gms,"").replaceAll(/&(quot|#34|apos|#39);/gms," ").slice(1,-1).replaceAll(/(\s){2,}/gsm," ").split(" ").filter(u => !u.match(/^\d+/gsm)).map((u,ind,arr) => {
              if(!u.match(/^(data|javascript|mailto|tel|sms|blob|about):/i)){
                if(ind === arr.length-1){
                  x = x.replace(/=.*/gsm,`="${dom}?redirect${randId}=${redirectValue(RelativeToAbsoluteUrl(url,u))}"`);
                }
              }
            });
          }
          return x;
        });
        an = an.replaceAll(/( ){2,}/gms," ").trim().split(" ");
        let ax = [
          ...ay.filter(x => x.length >= 1),
          ...an.filter(x => x.length >= 1).map(x => x+'=""')
        ];
        consl += l + n + " " + ax.join(" ") + `></${n}>`;
      } else if(lastWasScript){
        continue;
      } else {
        consl += rawDepth > 0 ? raw : (/^\s/.test(raw) ? " " : "") + c + (/\s$/.test(raw) ? " " : "");
      }
      //console.log(`Appending M3 [${i+1}/${coms.length}]`);
    }
  }

  console.log(`HTML Post-Processing`);
  consl = consl.trim() + `</body></html>`;
  console.log(`HTML Output`);
  return Out(consl);
}

function QuoteAttributes(attributes) {
  return attributes.replace(/([-:\w]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>`]+)/g, function (all, name, value) {
    const quoted = value[0] === '"' || value[0] === "'" ? value : `"${value}"`;
    return name.toLowerCase() + "=" + quoted;
  });
}

function RelativeToAbsoluteUrl(url, rel) {
  if (rel.match(/^(data|javascript):/gsm)) {
    return rel;
  }
  let internalUrl = rel.replaceAll(/&amp;|&#038;/gms, "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").trim();
  if (/^[A-Za-z][A-Za-z0-9+.\-]*:/.test(internalUrl)) {
    return internalUrl;
  }
  let dom = url.match(domain)[0];
  let scheme = (dom.match(/^[A-Za-z][A-Za-z0-9+.\-]*:(?=\/\/)/) || ["http:"])[0];
  if (internalUrl.startsWith("//")) {
    return scheme + internalUrl;
  }
  let rest = url.slice(dom.length);
  let hashAt = rest.indexOf("#");
  let withoutHash = hashAt === -1 ? rest : rest.slice(0, hashAt);
  let queryAt = withoutHash.indexOf("?");
  let basePath = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  if (internalUrl === "") {
    return dom + withoutHash;
  }
  if (internalUrl.startsWith("?")) {
    return dom + basePath + internalUrl;
  }
  if (internalUrl.startsWith("#")) {
    return dom + withoutHash + internalUrl;
  }
  let suffixAt = internalUrl.search(/[?#]/);
  let relPath = suffixAt === -1 ? internalUrl : internalUrl.slice(0, suffixAt);
  let suffix = suffixAt === -1 ? "" : internalUrl.slice(suffixAt);
  let merged = relPath.startsWith("/") ? relPath : basePath.slice(0, basePath.lastIndexOf("/") + 1) + relPath;
  if (!merged.startsWith("/")) {
    merged = "/" + merged;
  }
  let segments = [];
  let mergedSegments = merged.split("/");
  for (let i = 0; i < mergedSegments.length; i++) {
    let segment = mergedSegments[i];
    let isLast = i === mergedSegments.length - 1;
    if (segment === "..") {
      if (segments.length > 1) {
        segments.pop();
      }
      if (isLast) {
        segments.push("");
      }
    } else if (segment === ".") {
      if (isLast) {
        segments.push("");
      }
    } else {
      segments.push(segment);
    }
  }
  return dom + segments.join("/") + suffix;
}
