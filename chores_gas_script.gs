// ═══════════════════════════════════════════════════════════════
//  FAMILY HUB — SHARED (PARENTALS) GAS SCRIPT
//
//  SS_ID / CALENDAR_ID / ALLOWED_EMAILS are NOT hardcoded here on purpose —
//  this file lives in a public GitHub repo, so real values live in this
//  project's Script Properties instead. First-time setup (or after a fresh
//  copy/paste of this file into a new deployment):
//    1. Run setupProperties() once from this editor (function dropdown
//       near the top → select "setupProperties" → Run). It only needs to
//       run one time — it writes to Script Properties, not to this file.
//    2. Fill in the real values inside setupProperties() below FIRST,
//       then delete them from the function body again after running it
//       once, so they don't linger in source either.
//    (Alternative to steps 1-2: Project Settings (gear icon) → Script
//    Properties → Add property, and set SS_ID / CALENDAR_ID /
//    ALLOWED_EMAILS by hand — same effect, no code editing needed.)
//
//  REQUIRED: enable the Calendar advanced service
//    Apps Script editor → Services → + → Google Calendar API → Add
//
//  Tab names (case-sensitive):
//    Chores           A=Name  B=Who  C=Frequency  D=DueDate  E=Done  F=Weight(1-3, blank=1)  G=Notes  H=CompletedAt
//    Reminders        A=Name  B=Date
//    Movies           A=Title  B=Type(movie/show)  C=Status
//    Books            A=Title  B=Author  C=Category
//    MealIdeas        A=Name  B=Category  C=Main Ingredient  D=Link
//    Bulletin         A=Note  B=Who  C=Date  D=Color
//    FamilyReminders  A=Name  B=Date  (home tab reminders)
//    WhereAmI         A=Name  B=Location  C=Date(start)  D=Time(note)  E=EndDate  F=Phone
//    ToriWishlist     A=Item
//    NovaWishlist     A=Item
//    tori_this_week   A=GoalText  B=DateSaved  (row1=current, rows2-4=past)
//    nova_this_week   A=GoalText  B=DateSaved  (row1=current, rows2-4=past)
//    Sessions         A=Token  B=Email  C=IssuedAt  D=ExpiresAt  (create this
//                      tab manually — auth sessions live here, see below)
//
//  Calendar events (upcoming/weekend) are read via the Calendar advanced
//  service with singleEvents:true, so recurring events are expanded by
//  Google before they reach this script. No RRULE parsing required.
//
//  AUTH: every request (except verify_token itself) must include a valid
//  ?session=TOKEN param, checked against the Sessions tab. Tokens are
//  issued by verify_token after a real Google Sign-In is checked against
//  ALLOWED_EMAILS, and last SESSION_DAYS days so a kiosk screen doesn't
//  need to re-login constantly. To force a device to log out, delete its
//  row from the Sessions tab.
//
//  DAILY DIGEST EMAIL: sendDailyDigest() emails today's + tomorrow's
//  calendar events (styled like the At A Glance Today tile) to
//  DIGEST_RECIPIENTS. One-time setup:
//    1. Set the DIGEST_RECIPIENTS script property (comma-separated
//       emails) — same mechanism as SS_ID/CALENDAR_ID/ALLOWED_EMAILS
//       above. Deliberately separate from ALLOWED_EMAILS — who signs
//       into the kiosk and who gets a morning email aren't necessarily
//       the same list.
//    2. Run createDailyDigestTrigger() once from this editor (function
//       dropdown → select it → Run) to install the 6am-ish daily
//       trigger. Re-running it is safe — it clears any existing
//       sendDailyDigest trigger first, so it never double-installs.
//    3. Authorize the Gmail/MailApp scope when prompted (first run only).
// ═══════════════════════════════════════════════════════════════

var SESSION_DAYS = 30;

var _props      = PropertiesService.getScriptProperties();
var SS_ID       = _props.getProperty('SS_ID');
var CALENDAR_ID = _props.getProperty('CALENDAR_ID');
var ALLOWED_EMAILS = (_props.getProperty('ALLOWED_EMAILS') || '')
  .split(',')
  .map(function(s) { return s.trim().toLowerCase(); })
  .filter(Boolean);
// Recipients for sendDailyDigest() below — separate from ALLOWED_EMAILS
// on purpose: who's allowed to sign into the app isn't necessarily who
// wants a morning email (e.g. a grandparent who gets the digest but
// doesn't use the kiosk, or vice versa).
var DIGEST_RECIPIENTS = (_props.getProperty('DIGEST_RECIPIENTS') || '')
  .split(',')
  .map(function(s) { return s.trim(); })
  .filter(Boolean);

// Run this once from the editor (see header comment), then feel free to
// blank out the values below again — they're only needed for that one run.
function setupProperties() {
  PropertiesService.getScriptProperties().setProperties({
    SS_ID:             '',  // paste your Sheet ID here, run once, then clear
    CALENDAR_ID:       '',  // paste your family Calendar ID here, run once, then clear
    ALLOWED_EMAILS:    '',  // comma-separated emails, run once, then clear
    DIGEST_RECIPIENTS: ''   // comma-separated emails for the daily digest, run once, then clear
  });
  Logger.log('Script properties saved. You can blank this function out again now.');
}

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
    if (i === 0) current = text;
    else history.push({ text: text, date: dateStr });
  }
  return { current: current, history: history };
}

// ─────────────────────────────────────────────
//  HELPER: sessions (Google Sign-In gate)
// ─────────────────────────────────────────────
// Returns the verified email for a valid, unexpired session token, or null.
function checkSession(token) {
  if (!token) return null;
  var sheet = getSheet('Sessions');
  if (!sheet) return null; // Sessions tab not created yet — treat as no valid session
  var rows = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === token) {
      var expiresAt = new Date(rows[i][3]);
      if (!isNaN(expiresAt.getTime()) && expiresAt > now) return rows[i][1];
      return null; // expired (still counts as "found", so stop scanning)
    }
  }
  return null;
}

// Issues a new session for a verified email. Returns { token, expiresAt }.
function createSession(email) {
  var sheet = getSheet('Sessions');
  if (!sheet) return null;
  var token   = Utilities.getUuid();
  var tz      = Session.getScriptTimeZone();
  var now     = new Date();
  var expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  var fmt     = "yyyy-MM-dd'T'HH:mm:ssXXX";
  sheet.appendRow([token, email, Utilities.formatDate(now, tz, fmt), Utilities.formatDate(expires, tz, fmt)]);
  return { token: token, expiresAt: Utilities.formatDate(expires, tz, fmt) };
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

  // ── AUTH GATE ── every GET requires a valid, unexpired session token.
  if (!checkSession(e.parameter.session)) {
    return jsonOut({ error: 'unauthorized', authRequired: true });
  }

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
        weight:    weightVal,
        notes:     r[6] || '',
        completedAt: r[7] || ''
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

  // ── THIS WEEK (TORI / NOVA) ──
  if (type === 'tori_this_week') return json(readThisWeek('tori_this_week'));
  if (type === 'nova_this_week') return json(readThisWeek('nova_this_week'));

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
      var numDays = parseInt(e.parameter.days || '31', 10);
      return json(getUpcomingDays(numDays));
    } catch (err) {
      return json({ error: 'Upcoming fetch error: ' + err.toString() });
    }
  }

  return json({ error: 'unknown type: ' + type });
}

// Shared by doGet's 'upcoming' branch above and sendDailyDigest() below —
// both need "the next N days, bucketed by date" from the same calendar,
// so this is the one place that logic lives. Returns
// [{ date: 'yyyy-MM-dd', events: [{ summary, location, startTime,
// endTime, isAllDay }] }, ...], one entry per day starting today.
function getUpcomingDays(numDays) {
  var tz       = Session.getScriptTimeZone();
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
  return days;
}

// ─────────────────────────────────────────────
//  POST
// ─────────────────────────────────────────────
function doPost(e) {
  if (!e || !e.parameter) return jsonOut({ error: 'No parameters' });
  var p = e.parameter;
  var type   = p.type   || '';
  var action = p.action || '';

  // ── TOKEN VERIFICATION (auth flow) — the one action exempt from the
  //    session gate below, since this is how a session gets created. ──
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
      if (!authorized) return jsonOut({ authorized: false, email: email });
      var session = createSession(email);
      if (!session) return jsonOut({ authorized: false, error: 'Sessions tab not found — create it first (see header comment).' });
      return jsonOut({ authorized: true, email: email, session: session.token, expiresAt: session.expiresAt });
    } catch (err) {
      return jsonOut({ authorized: false, error: err.message });
    }
  }

  // ── AUTH GATE ── every other POST requires a valid, unexpired session.
  if (!checkSession(p.session)) {
    return jsonOut({ error: 'unauthorized', authRequired: true });
  }

  // ── CHORES ──
  if (type === 'chores') {
    var sheet = getSheet('Chores');
    if (action === 'add') {
      var addWeight = parseInt(p.weight, 10);
      if (!(addWeight >= 1 && addWeight <= 3)) addWeight = 1;
      sheet.appendRow([p.name || '', p.who || '', p.frequency || '', p.dueDate || '', false, addWeight, p.notes || '', '']);
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
        if (p.notes !== undefined) sheet.getRange(row, 7).setValue(p.notes || '');
      }
      return json({ status: 'ok' });
    }
    if (action === 'toggle') {
      var row = parseInt(p.idx);
      if (row > 0) {
        var isNowDone = p.done === 'true';
        sheet.getRange(row, 5).setValue(isNowDone);
        // Stamp CompletedAt when marked done, clear it if un-checked — powers
        // the "recently completed" feed (sorted by this column).
        // Include the zone offset (XXX) — without it, a browser in a
        // different timezone than the script would misread "recently
        // completed" times, same fix already applied to session ExpiresAt.
        sheet.getRange(row, 8).setValue(
          isNowDone ? Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX") : ''
        );
      }
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

  // ── THIS WEEK (TORI) ──
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

  // ── THIS WEEK (NOVA) ──
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

function listMyCalendars() {
  var cals = CalendarApp.getAllCalendars();
  cals.forEach(function(c) {
    Logger.log(c.getId() + ' | ' + c.getName());
  });
}

// ═══════════════════════════════════════════════════════════════
//  DAILY DIGEST EMAIL
//  See the header comment at the top of this file for one-time setup.
// ═══════════════════════════════════════════════════════════════

// Mirrors src/pages/Home/homeUtils.js on the frontend (KID_NAMES,
// SPORTS_KEYWORDS, parsePersonEvent, classifyEvent) so a "Tori - Dentist
// Appointment" event reads the same way in the email as it does on the
// At A Glance page — kid name pulled out as a badge, sport keyword
// flagged. Kept in sync by hand; there's no code sharing between an
// Apps Script project and the Vite frontend.
var DIGEST_KID_NAMES = ['Tori', 'Nova'];
var DIGEST_SPORTS_KEYWORDS = [
  'tournament', 'meet', 'match', 'practice', 'wrestling', 'game',
  'scrimmage', 'tryout', 'competition', 'qualifier', 'regional',
  'championship', 'dual'
];
var DIGEST_SPORTS_RE = new RegExp(
  '\\b(?:' + DIGEST_SPORTS_KEYWORDS.join('|') + ')(?:e?s)?\\b', 'i'
);

function digestHasSportsKeyword(text) {
  return DIGEST_SPORTS_RE.test(String(text || ''));
}

function digestParsePersonEvent(summary, name) {
  var re = new RegExp('^\\s*' + name + '\\s*[-:\u2013]\\s*(.+)$', 'i');
  var m = String(summary || '').match(re);
  return m ? m[1].trim() : null;
}

// Returns { isSports, person, title } — see homeUtils.js's classifyEvent.
function digestClassifyEvent(summary) {
  var raw = String(summary || '').trim();
  for (var i = 0; i < DIGEST_KID_NAMES.length; i++) {
    var person = DIGEST_KID_NAMES[i];
    var stripped = digestParsePersonEvent(raw, person);
    if (stripped) {
      return { isSports: digestHasSportsKeyword(stripped), person: person, title: stripped };
    }
  }
  return { isSports: digestHasSportsKeyword(raw), person: null, title: raw };
}

// Same accent hex values as src/styles/tokens.css, so the email's kid
// badges match the app's colors (Tori = pink, Nova = sky blue) instead
// of picking their own palette.
var DIGEST_PERSON_COLOR = { Tori: '#f5b8ce', Nova: '#87ceeb' };

// App's actual dark palette (src/styles/tokens.css) — kept in sync by
// hand since this GAS project can't import the frontend's CSS. This is
// what makes the digest read as a snip of the real app instead of a
// generic email template: same background/surface/border/accent/text
// colors the At A Glance page itself uses.
var DIGEST_COLORS = {
  bg:      '#0f1117',
  surface: '#181c27',
  border:  '#2a3045',
  accent:  '#e8b86d',
  accent6: '#88c9a8', // sports green — matches the Lookahead grid's sport pills
  text:    '#e8eaf0',
  muted:   '#8891a8'
};
var DIGEST_FONT = "-apple-system,'Segoe UI',Roboto,sans-serif";

function digestEscapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Chores + FamilyReminders for the digest ──────────────────────────
// Chores due today (including anything overdue and still not done, so
// nothing silently falls off the radar — per design call) or due
// tomorrow; FamilyReminders on the same two-day window, same overdue
// rule. Kept separate from the doGet 'chores' / 'family_reminders'
// handlers above since those are shaped for the live app's full list +
// CRUD, not a simple two-day digest slice. Personal per-kid Reminders
// (Tori/Nova) are deliberately excluded — this is a family-wide digest,
// not a place to surface a kid's personal reminder list in a parent's
// inbox.
function getDigestChores() {
  var sheet = getSheet('Chores');
  if (!sheet) return { today: [], tomorrow: [] };
  var tz = Session.getScriptTimeZone();
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  var tomorrowStr = Utilities.formatDate(tomorrowD, tz, 'yyyy-MM-dd');

  var rows = sheet.getDataRange().getValues();
  var today = [];
  var tomorrow = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var done = r[4] === true || r[4] === 'TRUE' || r[4] === 1;
    if (done) continue;
    var dueDateVal = r[3];
    if (!dueDateVal) continue;
    var dd = new Date(dueDateVal);
    if (isNaN(dd.getTime())) continue;
    var dueStr = Utilities.formatDate(dd, tz, 'yyyy-MM-dd');
    var weightVal = parseInt(r[5], 10);
    if (!(weightVal >= 1 && weightVal <= 3)) weightVal = 1;
    var item = { name: r[0] || '', who: r[1] || '', weight: weightVal };
    if (dueStr <= todayStr) today.push(item);            // overdue folds into today
    else if (dueStr === tomorrowStr) tomorrow.push(item);
  }
  return { today: today, tomorrow: tomorrow };
}

function getDigestFamilyReminders() {
  var sheet = getSheet('FamilyReminders');
  if (!sheet) return { today: [], tomorrow: [] };
  var tz = Session.getScriptTimeZone();
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  var tomorrowStr = Utilities.formatDate(tomorrowD, tz, 'yyyy-MM-dd');

  var rows = sheet.getDataRange().getValues();
  var today = [];
  var tomorrow = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var dateVal = r[1];
    if (!dateVal) continue;
    var d = new Date(dateVal);
    if (isNaN(d.getTime())) continue;
    var dStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    var item = { text: r[0] || '' };
    if (dStr <= todayStr) today.push(item);
    else if (dStr === tomorrowStr) tomorrow.push(item);
  }
  return { today: today, tomorrow: tomorrow };
}

// One <tr> per event — time, kid badge, sport medal (with the same
// green accent-edge treatment the Lookahead grid and Coming Up rows use
// for sports), title, location. The last row in a section drops its
// bottom border, matching .glance-today-row:last-child in the app.
function digestEventRowHtml(ev, i, arr) {
  var c = DIGEST_COLORS;
  var cls = digestClassifyEvent(ev.summary);
  var when = ev.isAllDay ? 'All day' : (ev.startTime || '');
  var isLast = i === arr.length - 1;
  var rowBorder = isLast ? '' : ('border-bottom:1px solid ' + c.border + ';');
  var badge = cls.person
    ? '<span style="display:inline-block;font-size:11px;font-weight:700;' +
      'text-transform:uppercase;letter-spacing:0.04em;color:' + DIGEST_PERSON_COLOR[cls.person] +
      ';margin-right:6px;">' + digestEscapeHtml(cls.person) + '</span>'
    : '';
  var medal = cls.isSports ? '🏅 ' : '';
  var location = ev.location
    ? '<div style="font-size:12px;color:' + c.muted + ';margin-top:2px;">' + digestEscapeHtml(ev.location) + '</div>'
    : '';
  var sportAccent = cls.isSports
    ? 'border-left:2px solid ' + c.accent6 + ';background:rgba(136,201,168,0.08);'
    : '';
  return '' +
    '<tr>' +
      '<td style="padding:10px 0;' + rowBorder + 'width:76px;' +
        'font-size:12px;color:' + c.muted + ';vertical-align:top;white-space:nowrap;">' +
        digestEscapeHtml(when) +
      '</td>' +
      '<td style="padding:10px 0 10px 12px;' + rowBorder + sportAccent +
        'font-size:14px;color:' + c.text + ';">' +
        badge + medal + digestEscapeHtml(cls.title) + location +
      '</td>' +
    '</tr>';
}

// One section of the calendar tile ("Today" / "Tomorrow") — small
// uppercase label (same treatment as .glance-card-label), date, then
// the event rows or an empty-state line matching the app's own
// "Nothing on the calendar" wording.
function digestDaySectionHtml(label, day) {
  var c = DIGEST_COLORS;
  var tz = Session.getScriptTimeZone();
  var dateLabel = Utilities.formatDate(new Date(day.date + 'T00:00:00'), tz, 'EEEE, MMMM d');
  var rows;
  if (!day.events || day.events.length === 0) {
    rows = '<tr><td style="padding:10px 0;color:' + c.muted + ';font-style:italic;font-size:13px;">' +
      'Nothing on the calendar</td></tr>';
  } else {
    rows = day.events.map(digestEventRowHtml).join('');
  }
  return '' +
    '<div style="padding:16px 18px;">' +
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;' +
        'color:' + c.muted + ';margin-bottom:2px;">' + label + '</div>' +
      '<div style="font-size:13px;color:' + c.muted + ';margin-bottom:6px;">' + dateLabel + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' +
        rows +
      '</table>' +
    '</div>';
}

// One row in the chores/reminders tile — checkbox glyph for a chore
// (with its kid badge, reusing the same DIGEST_PERSON_COLOR map as
// events, and a ★ weight indicator matching ChoresList's star display),
// pushpin glyph for a family reminder. Combined into one flat list per
// day (rather than two separately-bordered mini-lists) so the last-row
// border logic reads as one clean list, not two stacked with an odd gap
// between them.
function digestTaskRowHtml(item, i, arr) {
  var c = DIGEST_COLORS;
  var isLast = i === arr.length - 1;
  var rowBorder = isLast ? '' : ('border-bottom:1px solid ' + c.border + ';');
  if (item.kind === 'reminder') {
    return '' +
      '<tr>' +
        '<td style="padding:9px 0;' + rowBorder + 'width:22px;font-size:13px;vertical-align:top;">📌</td>' +
        '<td style="padding:9px 0 9px 6px;' + rowBorder + 'font-size:14px;color:' + c.text + ';">' +
          digestEscapeHtml(item.text) +
        '</td>' +
      '</tr>';
  }
  var whoColor = DIGEST_PERSON_COLOR[item.who] || c.muted;
  var badge = item.who
    ? '<span style="display:inline-block;font-size:11px;font-weight:700;' +
      'text-transform:uppercase;letter-spacing:0.04em;color:' + whoColor +
      ';margin-right:6px;">' + digestEscapeHtml(item.who) + '</span>'
    : '';
  var stars = new Array((item.weight || 1) + 1).join('★'); // GAS/ES5 — no String.prototype.repeat
  return '' +
    '<tr>' +
      '<td style="padding:9px 0;' + rowBorder + 'width:22px;font-size:13px;color:' + c.muted + ';vertical-align:top;">☐</td>' +
      '<td style="padding:9px 0 9px 6px;' + rowBorder + 'font-size:14px;color:' + c.text + ';">' +
        badge + digestEscapeHtml(item.name) +
        ' <span style="font-size:11px;color:' + c.muted + ';">' + stars + '</span>' +
      '</td>' +
    '</tr>';
}

// One section of the chores/reminders tile ("Today" / "Tomorrow") —
// chores and reminders merged into one list, sorted chores-first then
// reminders. Empty state reuses ChoresList's own "All done!" wording
// rather than the calendar tile's "Nothing on the calendar", so it
// reads as the same app, not a copy-pasted string.
function digestTasksSectionHtml(label, chores, reminders) {
  var c = DIGEST_COLORS;
  var items = [];
  chores.forEach(function(ch) {
    items.push({ kind: 'chore', name: ch.name, who: ch.who, weight: ch.weight });
  });
  reminders.forEach(function(r) {
    items.push({ kind: 'reminder', text: r.text });
  });

  var rows;
  if (items.length === 0) {
    rows = '<tr><td style="padding:10px 0;color:' + c.muted + ';font-style:italic;font-size:13px;">All done!</td></tr>';
  } else {
    rows = items.map(digestTaskRowHtml).join('');
  }
  return '' +
    '<div style="padding:16px 18px;">' +
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;' +
        'color:' + c.muted + ';margin-bottom:8px;">' + label + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' +
        rows +
      '</table>' +
    '</div>';
}

// Full email — a small header mirroring the app's branding, then two
// "tile" cards styled like the app's own panels: a calendar tile (Today
// above a divider above Tomorrow, the same stacked shape the real Today
// tile switches to under 640px — see Glance.css's MOBILE block), and a
// chores/reminders tile below it in the same visual language but kept
// as its own separate card — the app itself never mixes chores into the
// calendar tile (At A Glance is deliberately calendar-only, guest-
// visible), so the digest doesn't either. Colors come straight from
// DIGEST_COLORS above so this reads as a snip of the actual app, not a
// generic email template.
function buildDigestHtml(days, tasks) {
  var c = DIGEST_COLORS;
  var dividerRow = '<tr><td style="padding:0 18px;"><div style="height:1px;line-height:1px;font-size:0;' +
    'background:' + c.border + ';">&nbsp;</div></td></tr>';
  var cardOpen = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;' +
    'background:' + c.surface + ';border:1px solid ' + c.border + ';border-top:3px solid ' + c.accent + ';' +
    'border-radius:12px;font-family:' + DIGEST_FONT + ';">';
  return '' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + c.bg + ';">' +
      '<tr><td align="center" style="padding:28px 16px;">' +
        '<table role="presentation" width="420" cellpadding="0" cellspacing="0" style="width:420px;max-width:100%;">' +
          '<tr><td style="padding-bottom:18px;font-family:' + DIGEST_FONT + ';">' +
            '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;' +
              'color:' + c.accent + ';margin-bottom:6px;">🏠 Family Hub</div>' +
            '<div style="font-size:22px;font-weight:700;color:' + c.text + ';">🌄 Quick Look: Today &amp; Tomorrow</div>' +
          '</td></tr>' +
          '<tr><td>' +
            cardOpen +
              '<tr><td>' + digestDaySectionHtml('Today', days[0]) + '</td></tr>' +
              dividerRow +
              '<tr><td>' + digestDaySectionHtml('Tomorrow', days[1]) + '</td></tr>' +
            '</table>' +
          '</td></tr>' +
          '<tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>' +
          '<tr><td style="padding-bottom:8px;font-family:' + DIGEST_FONT + ';font-size:11px;font-weight:700;' +
            'text-transform:uppercase;letter-spacing:0.1em;color:' + c.accent + ';">✅ Chores &amp; Reminders</td></tr>' +
          '<tr><td>' +
            cardOpen +
              '<tr><td>' + digestTasksSectionHtml('Today', tasks.chores.today, tasks.reminders.today) + '</td></tr>' +
              dividerRow +
              '<tr><td>' + digestTasksSectionHtml('Tomorrow', tasks.chores.tomorrow, tasks.reminders.tomorrow) + '</td></tr>' +
            '</table>' +
          '</td></tr>' +
          '<tr><td style="padding-top:14px;font-family:' + DIGEST_FONT + ';font-size:11px;color:' + c.muted + ';">' +
            'Sent automatically each morning.' +
          '</td></tr>' +
        '</table>' +
      '</td></tr>' +
    '</table>';
}

// Plain-text fallback for clients that don't render HTML.
function buildDigestPlainText(days, tasks) {
  var tz = Session.getScriptTimeZone();
  var labels = ['Today', 'Tomorrow'];
  var out = 'FAMILY HUB — DAILY DIGEST\n';
  for (var i = 0; i < days.length; i++) {
    var day = days[i];
    var dateLabel = Utilities.formatDate(new Date(day.date + 'T00:00:00'), tz, 'EEEE, MMMM d');
    out += '\n' + labels[i].toUpperCase() + ' — ' + dateLabel + '\n';
    if (!day.events || day.events.length === 0) {
      out += '  Nothing on the calendar\n';
    } else {
      day.events.forEach(function(ev) {
        var c = digestClassifyEvent(ev.summary);
        var when = ev.isAllDay ? 'All day' : (ev.startTime || '');
        var who = c.person ? c.person + ' - ' : '';
        out += '  ' + when + '  ' + who + c.title + (ev.location ? ' (' + ev.location + ')' : '') + '\n';
      });
    }
  }

  out += '\nCHORES & REMINDERS\n';
  var choreDays    = [tasks.chores.today,    tasks.chores.tomorrow];
  var reminderDays = [tasks.reminders.today, tasks.reminders.tomorrow];
  for (var j = 0; j < 2; j++) {
    out += '\n' + labels[j].toUpperCase() + '\n';
    var lines = [];
    choreDays[j].forEach(function(ch) {
      lines.push('  [ ] ' + (ch.who ? ch.who + ' - ' : '') + ch.name);
    });
    reminderDays[j].forEach(function(r) {
      lines.push('  * ' + r.text);
    });
    out += lines.length ? (lines.join('\n') + '\n') : '  All done!\n';
  }
  return out;
}

// The function the daily trigger calls. Safe to run manually too (from
// the editor's function dropdown) to preview/test — it'll actually send.
function sendDailyDigest() {
  if (DIGEST_RECIPIENTS.length === 0) {
    Logger.log('sendDailyDigest: DIGEST_RECIPIENTS is empty, skipping send. ' +
      'Set the DIGEST_RECIPIENTS script property (see header comment) first.');
    return;
  }
  var days = getUpcomingDays(2); // [today, tomorrow]
  var tasks = {
    chores:    getDigestChores(),
    reminders: getDigestFamilyReminders()
  };
  var tz = Session.getScriptTimeZone();
  var subject = 'Family Hub Daily Digest — ' + Utilities.formatDate(new Date(), tz, 'EEEE, MMM d');
  MailApp.sendEmail({
    to:       DIGEST_RECIPIENTS.join(','),
    subject:  subject,
    body:     buildDigestPlainText(days, tasks),
    htmlBody: buildDigestHtml(days, tasks),
    name:     'Family Hub'
  });
}

// Run once from the editor (see header comment) to install the daily
// trigger. Safe to re-run — clears any existing sendDailyDigest
// trigger first, so it never ends up with two firing the same day.
function createDailyDigestTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendDailyDigest') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // atHour(6) fires sometime within the 6am hour (GAS time triggers
  // aren't to-the-minute) — script timezone, not the reader's.
  ScriptApp.newTrigger('sendDailyDigest')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();
  Logger.log('Daily digest trigger installed — fires ~6am, script timezone: ' + Session.getScriptTimeZone());
}
