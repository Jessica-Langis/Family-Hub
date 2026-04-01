// // ═══════════════════════════════════════════════════════════════
//  FAMILY HUB — SHARED (PARENTALS) GAS SCRIPT
//  Sheet ID: 1G00GtbuEKDFUc7uD5qbiotTjSnFQ_7KUsVJR7ZkjkLk
//
//  Tab names (case-sensitive):
//    Chores           A=Name  B=Who  C=Frequency  D=DueDate  E=Done
//    Reminders        A=Name  B=Date
//    Movies           A=Title  B=Type(movie/show)  C=Status
//    Books            A=Title  B=Author  C=Category
//    MealIdeas        A=Name  B=Category  C=Main Ingredient  D=Link
//    Bulletin         A=Note  B=Who  C=Date  D=Color
//    FamilyReminders  A=Name  B=Date  (home tab reminders)
//    WhereAmI         A=Name  B=Location  C=Date  D=Time
//    tori_this_week   A=GoalText  B=DateSaved  (row1=current, rows2-4=past)
//    nova_this_week   A=GoalText  B=DateSaved  (row1=current, rows2-4=past)
// ═══════════════════════════════════════════════════════════════
var SS_ID = '1G00GtbuEKDFUc7uD5qbiotTjSnFQ_7KUsVJR7ZkjkLk';
var FAMILY_ICS_URL = 'https://calendar.google.com/calendar/ical/family12041959028375865807%40group.calendar.google.com/private-981312a323ea475c7a6b4c974d63fb09/basic.ics';

var ALLOWED_EMAILS = [
 'm@gmail.com', 'n@gmail.com', 'je@gmail.com',  'jl@gmail.com'
 ];

function getSheet(name) {
  return SpreadsheetApp.openById(SS_ID).getSheetByName(name);
}
function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
//  HELPER: Parse ICS text
//  Returns array of { summary, dateStr, endStr, startTime, endTime, isAllDay }
//
//  KEY FIX: timed events now timezone-correct BOTH dateStr AND endStr.
//  Previously endStr was taken from the raw UTC digits of DTEND, which caused
//  a late-evening event (e.g. 9 PM PT = next-day UTC) to appear on two dates.
// ─────────────────────────────────────────────
function parseICSEvents(icsText) {
  var events = [];
  if (!icsText || typeof icsText !== 'string') return events;
  var blocks = icsText.split('BEGIN:VEVENT');
  var tz = Session.getScriptTimeZone();

  for (var i = 1; i < blocks.length; i++) {
    var block = blocks[i];
    var summaryMatch = block.match(/SUMMARY:(.+)/);
    if (!summaryMatch) continue;
    var summary = summaryMatch[1].trim();
    summary = summary.replace(/\r?\n[ \t]/g, '');

    // Detect all-day vs timed (all-day DTSTART has only 8 digits, no T)
    var isAllDay = !block.match(/DTSTART[^:]*:\d{8}T/);

    // Base date from raw DTSTART digits (used as fallback for all-day)
    var dtMatch = block.match(/DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/);
    if (!dtMatch) continue;
    var dateStr = dtMatch[1] + '-' + dtMatch[2] + '-' + dtMatch[3];
    var endStr  = dateStr;
    var startTime = null;
    var endTime   = null;

    if (!isAllDay) {
      // ── Timed event: correct dateStr AND endStr using local timezone ──

      var startTimedMatch = block.match(/DTSTART[^:]*:(\d{8}T\d{6})(Z?)/);
      if (startTimedMatch) {
        var rS   = startTimedMatch[1];
        var sUtc = startTimedMatch[2] === 'Z';
        var sD   = sUtc
          ? new Date(Date.UTC(+rS.slice(0,4), +rS.slice(4,6)-1, +rS.slice(6,8), +rS.slice(9,11), +rS.slice(11,13), 0))
          : new Date(+rS.slice(0,4), +rS.slice(4,6)-1, +rS.slice(6,8), +rS.slice(9,11), +rS.slice(11,13), 0);
        startTime = Utilities.formatDate(sD, tz, 'h:mm a');
        dateStr   = Utilities.formatDate(sD, tz, 'yyyy-MM-dd');
        endStr    = dateStr; // default: same day as start
      }

      // FIX: also timezone-correct endStr for timed events
      var endTimedMatch = block.match(/DTEND[^:]*:(\d{8}T\d{6})(Z?)/);
      if (endTimedMatch) {
        var rE   = endTimedMatch[1];
        var eUtc = endTimedMatch[2] === 'Z';
        var eD   = eUtc
          ? new Date(Date.UTC(+rE.slice(0,4), +rE.slice(4,6)-1, +rE.slice(6,8), +rE.slice(9,11), +rE.slice(11,13), 0))
          : new Date(+rE.slice(0,4), +rE.slice(4,6)-1, +rE.slice(6,8), +rE.slice(9,11), +rE.slice(11,13), 0);
        endTime = Utilities.formatDate(eD, tz, 'h:mm a');
        endStr  = Utilities.formatDate(eD, tz, 'yyyy-MM-dd'); // ← key fix: local date, not UTC date
      }

    } else {
      // ── All-day event: DTEND is exclusive, subtract 1 for inclusive ──
      var dtEndMatch = block.match(/DTEND[^:]*:(\d{4})(\d{2})(\d{2})/);
      if (dtEndMatch) {
        var endDate = new Date(+dtEndMatch[1], +dtEndMatch[2] - 1, +dtEndMatch[3]);
        endDate.setDate(endDate.getDate() - 1); // Google uses exclusive end
        endStr = Utilities.formatDate(endDate, tz, 'yyyy-MM-dd');
        if (endStr < dateStr) endStr = dateStr;
      }
    }

    events.push({ summary: summary, dateStr: dateStr, endStr: endStr,
                  startTime: startTime, endTime: endTime, isAllDay: isAllDay });
  }
  return events;
}

// ─────────────────────────────────────────────
//  HELPER: Get upcoming Saturday and Sunday dates as 'YYYY-MM-DD'
// ─────────────────────────────────────────────
function getWeekendDates() {
  var tz = Session.getScriptTimeZone();
  var today = new Date();
  var dow = today.getDay();
  var daysToSat = (6 - dow + 7) % 7;
  if (daysToSat === 0) daysToSat = 7;
  var sat = new Date(today);
  sat.setDate(today.getDate() + daysToSat);
  var sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return {
    saturday: Utilities.formatDate(sat, tz, 'yyyy-MM-dd'),
    sunday:   Utilities.formatDate(sun, tz, 'yyyy-MM-dd')
  };
}

// ─────────────────────────────────────────────
//  HELPER: read this-week sheet
// ─────────────────────────────────────────────
function readThisWeek(tabName) {
  var sheet = getSheet(tabName);
  if (!sheet) return { current: '', history: [] };
  var rows = sheet.getDataRange().getValues();
  var current = '';
  var history = [];
  for (var i = 0; i < rows.length; i++) {
    var text = String(rows[i][0] || '').trim();
    if (!text) continue;
    var dateVal = rows[i][1];
    var dateStr = '';
    if (dateVal) {
      var d = new Date(dateVal);
      dateStr = !isNaN(d.getTime())
        ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'M/d/yyyy')
        : String(dateVal);
    }
    if (i === 0) {
      current = text;
    } else {
      history.push({ text: text, date: dateStr });
    }
  }
  return { current: current, history: history };
}

// ─────────────────────────────────────────────
//  HELPER: set new goal, shift current into history (max 3 past)
// ─────────────────────────────────────────────
function setThisWeek(tabName, newValue, previous) {
  var sheet = getSheet(tabName);
  if (!sheet) return;
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy');
  if (!newValue) {
    sheet.getRange(1, 1, 1, 2).setValues([['', '']]);
    return;
  }
  var lastRow = sheet.getLastRow();
  var existing = lastRow > 0 ? sheet.getRange(1, 1, lastRow, 2).getValues() : [];
  var newRows = [[newValue, today]];
  var prevText = existing.length > 0 ? String(existing[0][0] || '').trim() : '';
  if (prevText && prevText !== newValue) {
    newRows.push([prevText, existing[0][1] || '']);
  }
  for (var i = 1; i < existing.length && newRows.length < 4; i++) {
    var t = String(existing[i][0] || '').trim();
    if (t) newRows.push([t, existing[i][1]]);
  }
  sheet.clearContents();
  sheet.getRange(1, 1, newRows.length, 2).setValues(newRows);
}

// ─────────────────────────────────────────────
//  GET
// ─────────────────────────────────────────────
function doGet(e) {
  if (!e || !e.parameter) return jsonOut({ error: 'No parameters' });
  var type = e.parameter.type || '';

  if (type === 'chores') {
    var sheet = getSheet('Chores');
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      var dueDateVal = r[3];
      var dueDateStr = '';
      if (dueDateVal) {
        var dd = new Date(dueDateVal);
        dueDateStr = !isNaN(dd.getTime())
          ? Utilities.formatDate(dd, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(dueDateVal);
      }
      result.push({ id: i + 1, name: r[0] || '', who: r[1] || '', frequency: r[2] || '',
                    dueDate: dueDateStr, done: r[4] === true || r[4] === 'TRUE' || r[4] === 1 });
    }
    return json(result);
  }

  if (type === 'reminders') {
    var sheet = getSheet('Reminders');
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      var dateVal = r[1];
      var dateStr = '';
      if (dateVal) {
        var d = new Date(dateVal);
        dateStr = !isNaN(d.getTime())
          ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(dateVal);
      }
      result.push({ id: i + 1, text: r[0] || '', date: dateStr });
    }
    return json(result);
  }

  if (type === 'tori_this_week') { return json(readThisWeek('tori_this_week')); }
  if (type === 'nova_this_week') { return json(readThisWeek('nova_this_week')); }

  if (type === 'movies') {
    var sheet = getSheet('Movies');
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      result.push({ id: i + 1, title: rows[i][0] || '', type: rows[i][1] || '', status: rows[i][2] || '' });
    }
    return json(result);
  }

  if (type === 'books') {
    var sheet = getSheet('Books');
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      result.push({ id: i + 1, title: rows[i][0] || '', author: rows[i][1] || '', category: rows[i][2] || '' });
    }
    return json(result);
  }

  if (type === 'mealideas') {
    var sheet = getSheet('MealIdeas');
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      result.push({ id: i + 1, name: rows[i][0] || '', category: rows[i][1] || '',
                    ingredient: rows[i][2] || '', link: rows[i][3] || '' });
    }
    return json(result);
  }

  if (type === 'bulletin') {
    var sheet = getSheet('Bulletin');
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i][0] && !rows[i][1]) continue;
      var dateVal = rows[i][2];
      var dateStr = '';
      if (dateVal) {
        var d = new Date(dateVal);
        dateStr = !isNaN(d.getTime())
          ? (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear()
          : String(dateVal);
      }
      result.push({ row: i + 1, text: rows[i][0] || '', who: rows[i][1] || '',
                    date: dateStr, color: rows[i][3] || 'amber' });
    }
    return json(result.reverse());
  }

  if (type === 'whereami') {
    var sheet = getSheet('WhereAmI');
    if (!sheet) return json({ error: 'WhereAmI tab not found' });
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      var dateVal = r[2];
      var dateStr = '';
      if (dateVal) {
        var d = new Date(dateVal);
        dateStr = !isNaN(d.getTime())
          ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM d')
          : String(dateVal);
      }
      result.push({ id: i + 1, name: r[0] || '', location: r[1] || '', date: dateStr, time: r[3] || '' });
    }
    return json(result);
  }

  if (type === 'family_reminders') {
    var sheet = getSheet('FamilyReminders');
    if (!sheet) return json({ error: 'FamilyReminders tab not found' });
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      var dateVal = r[1];
      var dateStr = '';
      if (dateVal) {
        var d = new Date(dateVal);
        dateStr = !isNaN(d.getTime())
          ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(dateVal);
      }
      result.push({ id: i + 1, text: r[0] || '', date: dateStr });
    }
    return json(result);
  }

  if (type === 'weekend') {
    try {
      var weekend = getWeekendDates();
      var response = UrlFetchApp.fetch(FAMILY_ICS_URL, { muteHttpExceptions: true });
      if (response.getResponseCode() !== 200) {
        return json({ error: 'ICS fetch failed: ' + response.getResponseCode() });
      }
      var allEvents = parseICSEvents(response.getContentText());
      var satEvents = allEvents
        .filter(function(ev) { return ev.dateStr <= weekend.saturday && ev.endStr >= weekend.saturday; })
        .map(function(ev) { return { summary: ev.summary }; });
      var sunEvents = allEvents
        .filter(function(ev) { return ev.dateStr <= weekend.sunday && ev.endStr >= weekend.sunday; })
        .map(function(ev) { return { summary: ev.summary }; });
      return json({
        saturday: { date: weekend.saturday, events: satEvents },
        sunday:   { date: weekend.sunday,   events: sunEvents }
      });
    } catch (err) {
      return json({ error: 'Weekend fetch error: ' + err.toString() });
    }
  }

  if (type === 'upcoming') {
    try {
      var tz      = Session.getScriptTimeZone();
      var numDays = parseInt(e.parameter.days || '31', 10); // ← honour ?days= param
      var today   = new Date();
      today.setHours(0, 0, 0, 0);
      var end     = new Date(today);
      end.setDate(end.getDate() + numDays);
      var todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
      var endStr   = Utilities.formatDate(end,   tz, 'yyyy-MM-dd');

      var response = UrlFetchApp.fetch(FAMILY_ICS_URL, { muteHttpExceptions: true });
      if (response.getResponseCode() !== 200) {
        return json({ error: 'ICS fetch failed: ' + response.getResponseCode() });
      }

      var allEvents = parseICSEvents(response.getContentText());
      var byDate = {};

      allEvents.forEach(function(ev) {
        // Walk from event start to event end (inclusive), adding to each date bucket
        var cursor = new Date(ev.dateStr + 'T00:00:00');
        var evEnd  = new Date(ev.endStr  + 'T00:00:00');
        while (cursor <= evEnd) {
          var ds = Utilities.formatDate(cursor, tz, 'yyyy-MM-dd');
          if (ds >= todayStr && ds < endStr) {
            if (!byDate[ds]) byDate[ds] = [];
            // Deduplicate within the same day (shouldn't be needed after the parse fix,
            // but kept as a safety net for any edge cases)
            var already = byDate[ds].some(function(x) { return x.summary === ev.summary; });
            if (!already) {
              byDate[ds].push({
                summary:   ev.summary,
                startTime: ev.startTime,
                endTime:   ev.endTime,
                isAllDay:  ev.isAllDay
              });
            }
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      });

      // Return one entry per day in the window (empty days included)
      var days = [];
      for (var i = 0; i < numDays; i++) {
        var d  = new Date(today);
        d.setDate(d.getDate() + i);
        var ds = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
        days.push({ date: ds, events: byDate[ds] || [] });
      }
      return json(days);
    } catch (err) {
      return json({ error: 'Upcoming fetch error: ' + err.toString() });
    }
  }

  return json({ error: 'unknown type: ' + type });
}

// ─────────────────────────────────────────────
//  POST
// ─────────────────────────────────────────────
function doPost(e) {
  if (!e || !e.parameter) return jsonOut({ error: 'No parameters' });
  var p = e.parameter;
  var type   = p.type   || '';
  var action = p.action || '';

  if (type === 'verify_token') {
    var token = p.token || '';
    if (!token) return jsonOut({ authorized: false, error: 'No token' });
    try {
      var res = UrlFetchApp.fetch(
        'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
        { muteHttpExceptions: true }
      );
      var info = JSON.parse(res.getContentText());
      if (info.error) return jsonOut({ authorized: false, error: info.error });
      var email = (info.email || '').toLowerCase();
      var authorized = info.email_verified === 'true' && ALLOWED_EMAILS.includes(email);
      return jsonOut({ authorized: authorized, email: email });
    } catch(err) {
      return jsonOut({ authorized: false, error: err.message });
    }
  }

  if (type === 'chores') {
    var sheet = getSheet('Chores');
    if (action === 'add') {
      sheet.appendRow([p.name || '', p.who || '', p.frequency || '', p.dueDate || '', false]);
      return json({ status: 'ok' });
    }
    if (action === 'update') {
      var row = parseInt(p.idx);
      if (row > 0) {
        sheet.getRange(row, 1).setValue(p.name      || '');
        sheet.getRange(row, 2).setValue(p.who       || '');
        sheet.getRange(row, 3).setValue(p.frequency || '');
        if (p.dueDate !== undefined) sheet.getRange(row, 4).setValue(p.dueDate || '');
      }
      return json({ status: 'ok' });
    }
    if (action === 'toggle') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.getRange(row, 5).setValue(p.done === 'true');
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  if (type === 'reminders') {
    var sheet = getSheet('Reminders');
    if (action === 'add') {
      sheet.appendRow([p.text || '', p.date || '']);
      return json({ status: 'ok' });
    }
    if (action === 'update') {
      var row = parseInt(p.idx);
      if (row > 0) {
        sheet.getRange(row, 1).setValue(p.text || '');
        sheet.getRange(row, 2).setValue(p.date || '');
      }
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  if (type === 'tori_this_week') {
    if (action === 'set') {
      setThisWeek('tori_this_week', p.value || '', p.previous || '');
      return json({ status: 'ok' });
    }
    if (action === 'delete_history') {
      var row = parseInt(p.row);
      if (row > 1) getSheet('tori_this_week').deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  if (type === 'nova_this_week') {
    if (action === 'set') {
      setThisWeek('nova_this_week', p.value || '', p.previous || '');
      return json({ status: 'ok' });
    }
    if (action === 'delete_history') {
      var row = parseInt(p.row);
      if (row > 1) getSheet('nova_this_week').deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  if (type === 'movies') {
    var sheet = getSheet('Movies');
    if (action === 'add') {
      sheet.appendRow([p.title || '', p.mediaType || 'Movie', '']);
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  if (type === 'books') {
    var sheet = getSheet('Books');
    if (action === 'add') {
      sheet.appendRow([p.title || '', p.author || '', '']);
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  if (type === 'mealideas') {
    var sheet = getSheet('MealIdeas');
    if (action === 'add') {
      sheet.appendRow([p.name || '', p.category || '', p.ingredient || '', p.link || '']);
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  if (type === 'whereami') {
    var sheet = getSheet('WhereAmI');
    if (!sheet) return json({ error: 'WhereAmI tab not found' });
    if (action === 'add') {
      sheet.appendRow([p.name || '', p.location || '', p.date || '', p.time || '']);
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  if (type === 'family_reminders') {
    var sheet = getSheet('FamilyReminders');
    if (!sheet) return json({ error: 'FamilyReminders tab not found' });
    if (action === 'add') {
      sheet.appendRow([p.text || '', p.date || '']);
      return json({ status: 'ok' });
    }
    if (action === 'update') {
      var row = parseInt(p.idx);
      if (row > 0) {
        sheet.getRange(row, 1).setValue(p.text || '');
        sheet.getRange(row, 2).setValue(p.date || '');
      }
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  if (type === 'bulletin') {
    var sheet = getSheet('Bulletin');
    if (action === 'add') {
      var dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy');
      sheet.appendRow([p.text || '', p.who || 'Someone', dateStr, p.color || 'amber']);
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.id || p.row);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  return json({ error: 'unhandled: ' + type + '/' + action });
}
