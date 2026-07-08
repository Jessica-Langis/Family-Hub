// ═══════════════════════════════════════════════════════════════
//  FAMILY HUB — SHARED (PARENTALS) GAS SCRIPT
//  Sheet ID:    1G00GtbuEKDFUc7uD5qbiotTjSnFQ_7KUsVJR7ZkjkLk
//  Calendar ID: family12041959028375865807@group.calendar.google.com
//
//  REQUIRED: enable the Calendar advanced service
//    Apps Script editor → Services → + → Google Calendar API → Add
//
//  Tab names (case-sensitive):
//    Chores           A=Name  B=Who  C=Frequency  D=DueDate  E=Done  F=Weight(1-3, blank=1)
//    Reminders        A=Name  B=Date
//    Movies           A=Title  B=Type(movie/show)  C=Status
//    Books            A=Title  B=Author  C=Category
//    MealIdeas        A=Name  B=Category  C=Main Ingredient  D=Link
//    Bulletin         A=Note  B=Who  C=Date  D=Color
//    FamilyReminders  A=Name  B=Date  (home tab reminders)
//    WhereAmI         A=Name  B=Location  C=Date(start)  D=Time(note)  E=EndDate  F=Phone
//    ToriWishlist     A=Item
//    NovaWishlist     A=Item
//
//  Calendar events (upcoming/weekend) are read via the Calendar advanced
//  service with singleEvents:true, so recurring events are expanded by
//  Google before they reach this script. No RRULE parsing required.
// ═══════════════════════════════════════════════════════════════

var SS_ID       = '1G00GtbuEKDFUc7uD5qbiotTjSnFQ_7KUsVJR7ZkjkLk';
var CALENDAR_ID = 'family12041959028375865807@group.calendar.google.com';

var ALLOWED_EMAILS = [
  'madison.02129@gmail.com',
  'n0v4.720@gmail.com',
  'jesse.black88@gmail.com',
  'jlynn198@gmail.com'
];

// ─────────────────────────────────────────────
//  Utility helpers
// ─────────────────────────────────────────────
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
//  HELPER: Upcoming Saturday and Sunday as 'YYYY-MM-DD'
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
//  GET
// ─────────────────────────────────────────────
function doGet(e) {
  if (!e || !e.parameter) return jsonOut({ error: 'No parameters' });
  var type = e.parameter.type || '';

  // ── CHORES ──
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
      var weightVal = parseInt(r[5], 10);
      if (!(weightVal >= 1 && weightVal <= 3)) weightVal = 1;
      result.push({
        id:        i + 1,
        name:      r[0] || '',
        who:       r[1] || '',
        frequency: r[2] || '',
        dueDate:   dueDateStr,
        done:      r[4] === true || r[4] === 'TRUE' || r[4] === 1,
        weight:    weightVal
      });
    }
    return json(result);
  }

  // ── REMINDERS ──
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

  // ── WISHLIST (TORI / NOVA) ──
  if (type === 'tori_wishlist' || type === 'nova_wishlist') {
    var sheetName = type === 'tori_wishlist' ? 'ToriWishlist' : 'NovaWishlist';
    var sheet = getSheet(sheetName);
    if (!sheet) return json({ error: sheetName + ' tab not found' });
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      result.push({ id: i + 1, text: rows[i][0] || '' });
    }
    return json(result);
  }

  // ── MOVIES ──
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

  // ── BOOKS ──
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

  // ── MEAL IDEAS ──
  if (type === 'mealideas') {
    var sheet = getSheet('MealIdeas');
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      result.push({
        id:         i + 1,
        name:       rows[i][0] || '',
        category:   rows[i][1] || '',
        ingredient: rows[i][2] || '',
        link:       rows[i][3] || ''
      });
    }
    return json(result);
  }

  // ── BULLETIN ──
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
      result.push({
        row:   i + 1,
        text:  rows[i][0] || '',
        who:   rows[i][1] || '',
        date:  dateStr,
        color: rows[i][3] || 'amber'
      });
    }
    return json(result.reverse());
  }

  // ── WHERE AM I ──
  if (type === 'whereami') {
    var sheet = getSheet('WhereAmI');
    if (!sheet) return json({ error: 'WhereAmI tab not found' });
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      // Location (col B) is the only required field — Name (col A) is
      // intentionally optional now, so don't skip rows just because it's blank.
      if (!r[1]) continue;
      var dateStr = '';
      if (r[2]) {
        var d = new Date(r[2]);
        dateStr = !isNaN(d.getTime())
          ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(r[2]);
      }
      var endDateStr = '';
      if (r[4]) {
        var ed = new Date(r[4]);
        endDateStr = !isNaN(ed.getTime())
          ? Utilities.formatDate(ed, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(r[4]);
      }
      result.push({
        id:       i + 1,
        name:     r[0] || '',
        location: r[1] || '',
        date:     dateStr,
        time:     r[3] || '',
        endDate:  endDateStr,
        phone:    r[5] || ''
      });
    }
    return json(result);
  }

  // ── FAMILY REMINDERS (Home tab) ──
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

  // ── WEEKEND (Sat + Sun lookups via Calendar API) ──
  if (type === 'weekend') {
    try {
      var tz       = Session.getScriptTimeZone();
      var weekend  = getWeekendDates();
      var satStart = new Date(weekend.saturday + 'T00:00:00');
      var sunEnd   = new Date(weekend.sunday   + 'T23:59:59');

      var resp = Calendar.Events.list(CALENDAR_ID, {
        timeMin:      satStart.toISOString(),
        timeMax:      sunEnd.toISOString(),
        singleEvents: true,
        orderBy:      'startTime',
        maxResults:   500
      });

      var satEvents = [];
      var sunEvents = [];
      (resp.items || []).forEach(function(ev) {
        var isAllDay = !ev.start.dateTime;
        var start, end;
        if (isAllDay) {
          start = ev.start.date;
          var ed = new Date(ev.end.date + 'T00:00:00');
          ed.setDate(ed.getDate() - 1); // Google all-day end is exclusive
          end = Utilities.formatDate(ed, tz, 'yyyy-MM-dd');
        } else {
          start = Utilities.formatDate(new Date(ev.start.dateTime), tz, 'yyyy-MM-dd');
          end   = Utilities.formatDate(new Date(ev.end.dateTime),   tz, 'yyyy-MM-dd');
        }
        if (start <= weekend.saturday && end >= weekend.saturday) satEvents.push({ summary: ev.summary || '' });
        if (start <= weekend.sunday   && end >= weekend.sunday)   sunEvents.push({ summary: ev.summary || '' });
      });

      return json({
        saturday: { date: weekend.saturday, events: satEvents },
        sunday:   { date: weekend.sunday,   events: sunEvents }
      });
    } catch (err) {
      return json({ error: 'Weekend fetch error: ' + err.toString() });
    }
  }

  // ── UPCOMING (N-day window via Calendar API) ──
  if (type === 'upcoming') {
    try {
      var tz       = Session.getScriptTimeZone();
      var numDays  = parseInt(e.parameter.days || '31', 10);
      var today    = new Date(); today.setHours(0, 0, 0, 0);
      var end      = new Date(today); end.setDate(end.getDate() + numDays);
      var todayStr = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
      var endStr   = Utilities.formatDate(end,   tz, 'yyyy-MM-dd');

      var resp = Calendar.Events.list(CALENDAR_ID, {
        timeMin:      today.toISOString(),
        timeMax:      end.toISOString(),
        singleEvents: true,
        orderBy:      'startTime',
        maxResults:   2500
      });

      var byDate = {};
      (resp.items || []).forEach(function(ev) {
        var isAllDay = !ev.start.dateTime;
        var startDate, endDate, startTime = null, endTime = null;

        if (isAllDay) {
          startDate = ev.start.date;
          var ed = new Date(ev.end.date + 'T00:00:00');
          ed.setDate(ed.getDate() - 1); // Google all-day end is exclusive
          endDate = Utilities.formatDate(ed, tz, 'yyyy-MM-dd');
        } else {
          var sd  = new Date(ev.start.dateTime);
          var edt = new Date(ev.end.dateTime);
          startDate = Utilities.formatDate(sd,  tz, 'yyyy-MM-dd');
          endDate   = Utilities.formatDate(edt, tz, 'yyyy-MM-dd');
          startTime = Utilities.formatDate(sd,  tz, 'h:mm a');
          endTime   = Utilities.formatDate(edt, tz, 'h:mm a');
        }

        var cursor = new Date(startDate + 'T00:00:00');
        var evEnd  = new Date(endDate   + 'T00:00:00');
        while (cursor <= evEnd) {
          var ds = Utilities.formatDate(cursor, tz, 'yyyy-MM-dd');
          if (ds >= todayStr && ds < endStr) {
            if (!byDate[ds]) byDate[ds] = [];
            byDate[ds].push({
              summary:   ev.summary || '',
              location:  ev.location || '',
              startTime: startTime,
              endTime:   endTime,
              isAllDay:  isAllDay
            });
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      });

      var days = [];
      for (var i = 0; i < numDays; i++) {
        var d = new Date(today); d.setDate(d.getDate() + i);
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

  // ── TOKEN VERIFICATION (auth flow) ──
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
    } catch (err) {
      return jsonOut({ authorized: false, error: err.message });
    }
  }

  // ── CHORES ──
  if (type === 'chores') {
    var sheet = getSheet('Chores');
    if (action === 'add') {
      var addWeight = parseInt(p.weight, 10);
      if (!(addWeight >= 1 && addWeight <= 3)) addWeight = 1;
      sheet.appendRow([p.name || '', p.who || '', p.frequency || '', p.dueDate || '', false, addWeight]);
      return json({ status: 'ok' });
    }
    if (action === 'update') {
      var row = parseInt(p.idx);
      if (row > 0) {
        sheet.getRange(row, 1).setValue(p.name      || '');
        sheet.getRange(row, 2).setValue(p.who       || '');
        sheet.getRange(row, 3).setValue(p.frequency || '');
        if (p.dueDate !== undefined) sheet.getRange(row, 4).setValue(p.dueDate || '');
        if (p.weight  !== undefined) {
          var updWeight = parseInt(p.weight, 10);
          if (!(updWeight >= 1 && updWeight <= 3)) updWeight = 1;
          sheet.getRange(row, 6).setValue(updWeight);
        }
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

  // ── REMINDERS ──
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

  // ── WISHLIST (TORI / NOVA) ──
  if (type === 'tori_wishlist' || type === 'nova_wishlist') {
    var sheetName = type === 'tori_wishlist' ? 'ToriWishlist' : 'NovaWishlist';
    var sheet = getSheet(sheetName);
    if (!sheet) return json({ error: sheetName + ' tab not found' });
    if (action === 'add') {
      sheet.appendRow([p.text || '']);
      return json({ status: 'ok' });
    }
    if (action === 'update') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.getRange(row, 1).setValue(p.text || '');
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  // ── MOVIES ──
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

  // ── BOOKS ──
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

  // ── MEAL IDEAS ──
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

  // ── WHERE AM I ──
  if (type === 'whereami') {
    var sheet = getSheet('WhereAmI');
    if (!sheet) return json({ error: 'WhereAmI tab not found' });
    if (action === 'add') {
      sheet.appendRow([p.name || '', p.location || '', p.date || '', p.time || '', p.endDate || '', p.phone || '']);
      return json({ status: 'ok' });
    }
    if (action === 'delete') {
      var row = parseInt(p.idx);
      if (row > 0) sheet.deleteRow(row);
      return json({ status: 'ok' });
    }
  }

  // ── FAMILY REMINDERS (Home tab) ──
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

  // ── BULLETIN ──
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
