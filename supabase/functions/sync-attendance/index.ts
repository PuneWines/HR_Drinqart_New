// Supabase Edge Function: sync-attendance
// Mirrors the syncTodayLogs / syncLogsForRange logic from AttendanceDaily.jsx.
//
// Invoke via HTTP POST (or GET) with an optional JSON body:
//   { "fromDate": "YYYY-MM-DD", "toDate": "YYYY-MM-DD", "device": "ALL" }
//
// Defaults:
//   fromDate / toDate  → today in IST
//   device             → "ALL"  (fetches every device in parallel)
//
// Required Supabase secrets (set via `supabase secrets set`):
//   SUPABASE_URL            – your project URL
//   SUPABASE_SERVICE_ROLE_KEY – service-role key (bypasses RLS for upsert)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Device registry (mirrors the DEVICES constant in AttendanceDaily.jsx)
// ---------------------------------------------------------------------------
const DEVICES = [
  { name: "BAWDHAN",   apiName: "BAVDHAN",   serial: "C26238441B1E342D" },
  { name: "HINJEWADI", apiName: "HINJEWADI", serial: "AMDB25061400335"  },
  { name: "WAGHOLI",   apiName: "WAGHOLI",   serial: "AMDB25061400343"  },
  { name: "AKOLE",     apiName: "AKOLE",     serial: "C262CC13CF202038" },
  { name: "MUMBAI",    apiName: "MUMBAI",    serial: "C2630450C32A2327" },
];

const JOINING_API_URL =
  "https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch";
const MASTER_MAP_URL =
  "https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch";

// The real device-log API endpoint
const DEVICE_LOG_API_BASE = "http://103.195.203.77:15167/api/v2/WebAPI/GetDeviceLogs";

// ---------------------------------------------------------------------------
// Date / Time helpers  (ported from AttendanceDaily.jsx)
// ---------------------------------------------------------------------------

/** Strip timezone suffix and normalise to a bare ISO-8601 local string. */
function formatToISTISOString(timeStr: string | null | undefined): string | null {
  if (!timeStr || timeStr === "-") return null;

  let formatted = timeStr.trim().replace(" ", "T");
  if (formatted.includes("+")) formatted = formatted.split("+")[0];
  else if (formatted.endsWith("Z")) formatted = formatted.slice(0, -1);

  const timeParts = formatted.split("T")[1] || "";
  if (timeParts.split(":").length === 2) formatted = formatted + ":00";
  return formatted;
}

/**
 * Parse a date-time string that represents an IST time and return a JS Date.
 * Works by appending the "+05:30" offset before calling new Date().
 */
function parseISTToDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr === "-") return null;
  try {
    let clean = dateStr;
    if (clean.includes("+")) clean = clean.split("+")[0];
    else if (clean.endsWith("Z")) clean = clean.slice(0, -1);

    let formatted = clean.trim().replace(" ", "T");
    const timeParts = formatted.split("T")[1] || "";
    if (timeParts.split(":").length === 2) formatted = formatted + ":00";
    formatted = formatted + "+05:30";

    const d = new Date(formatted);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Format a datetime string to IST time-only string, e.g. "9:05 AM". */
function formatTimeIST(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "-") return "-";
  try {
    const d = parseISTToDate(dateStr);
    if (!d) return dateStr;
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return dateStr;
  }
}

/** Get today's date string YYYY-MM-DD in IST. */
function getTodayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// ---------------------------------------------------------------------------
// Attendance computation helpers (ported from AttendanceDaily.jsx)
// ---------------------------------------------------------------------------

function calculateHoursMins(diffMs: number): string {
  if (!diffMs || isNaN(diffMs) || diffMs <= 0) return "00:00:00";
  const totalSecs = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function calculateWorkHours(logs: string[]): string {
  if (!logs || logs.length < 2) return "00:00:00";

  let totalMs = 0;
  // Sum every IN → OUT pair
  for (let i = 0; i + 1 < logs.length; i += 2) {
    const inDate  = parseISTToDate(logs[i]);
    const outDate = parseISTToDate(logs[i + 1]);
    if (inDate && outDate && outDate.getTime() > inDate.getTime()) {
      totalMs += outDate.getTime() - inDate.getTime();
    }
  }
  return calculateHoursMins(totalMs);
}

/**
 * Calculate late minutes against a shift roster entry.
 * - If shift is provided: use shift.start_time with a 10-minute grace period.
 * - Default (no shift): official start 10:00, grace threshold 10:10.
 */
function calculateLateMinutes(inStr: string, shift?: ShiftRosterEntry | null): number {
  if (!inStr || inStr === "-") return 0;
  try {
    const inDate = parseISTToDate(inStr);
    if (!inDate) return 0;

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(inDate);

    const hour   = parseInt(parts.find((p) => p.type === "hour")!.value,   10);
    const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
    const totalMinutes = hour * 60 + minute;

    let officialStart   = 10 * 60;       // 10:00 default
    let graceThreshold  = 10 * 60 + 10;  // 10:10 default

    if (shift?.start_time) {
      const [shiftH, shiftM] = shift.start_time.split(":").map(Number);
      officialStart  = shiftH * 60 + shiftM;
      graceThreshold = officialStart + 10;
    }

    return totalMinutes >= graceThreshold ? totalMinutes - officialStart : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Shift Roster type
// ---------------------------------------------------------------------------
interface ShiftRosterEntry {
  id:          number;
  employee_id: string;
  date:        string;
  shift_type:  string;
  start_time:  string | null;  // e.g. "09:30:00"
  end_time:    string | null;  // e.g. "18:30:00"
  remark:      string | null;
}

// ---------------------------------------------------------------------------
// Joining data helpers
// ---------------------------------------------------------------------------
interface JoiningEntry {
  id:          string;
  name:        string;
  designation: string;
  store:       string;
}

async function fetchJoiningData(): Promise<JoiningEntry[]> {
  try {
    const res    = await fetch(JOINING_API_URL);
    const result = await res.json();
    if (!result.success) return [];

    const rawRows: unknown[][] = result.data ?? result;
    const headers: unknown[]   = rawRows[5];
    const dataRows: unknown[][] = rawRows.slice(6);

    const getIdx = (name: string) =>
      headers.findIndex((h) => h && h.toString().trim().toLowerCase() === name.toLowerCase());

    const empIdIdx  = getIdx("Employee ID");
    const nameIdx   = getIdx("Name As Per Aadhar");
    const desIdx    = getIdx("Designation");
    const storeIdx  = getIdx("Joining Place");

    return dataRows
      .map((r) => ({
        id:          r[empIdIdx]?.toString().trim() ?? "",
        name:        r[nameIdx]?.toString().trim()  ?? "",
        designation: r[desIdx]?.toString().trim()   ?? "",
        store:       r[storeIdx]?.toString().trim()  ?? "",
      }))
      .filter((h) => h.id);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Device mapping helpers
// ---------------------------------------------------------------------------
interface DeviceMapEntry {
  userId:    string;
  name:      string;
  deviceId:  string;
  serialNo:  string;
  storeName: string;
}

async function fetchDeviceMapping(): Promise<DeviceMapEntry[]> {
  try {
    const res    = await fetch(MASTER_MAP_URL);
    const result = await res.json();
    if (!result.success) return [];

    const rows: unknown[][] = result.data.slice(1);
    return rows.map((r) => ({
      userId:    r[5]?.toString().trim() ?? "",
      name:      r[6]?.toString().trim() ?? "",
      deviceId:  r[7]?.toString().trim() ?? "",
      serialNo:  r[8]?.toString().trim() ?? "",
      storeName: r[9]?.toString().trim() ?? "",
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Raw device log fetching
// ---------------------------------------------------------------------------
interface RawLog {
  EmployeeCode: string;
  LogDate:      string;
  SerialNumber: string;
  _DeviceName:  string;
}

async function fetchRawLogsForDevice(
  device: { name: string; apiName: string; serial: string },
  fromDate: string,
  toDate: string
): Promise<RawLog[]> {
  const url =
    `${DEVICE_LOG_API_BASE}` +
    `?APIKey=211616032630` +
    `&SerialNumber=${device.serial}` +
    `&DeviceName=${device.apiName}` +
    `&FromDate=${fromDate}` +
    `&ToDate=${toDate}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[sync-attendance] Device ${device.name} returned HTTP ${res.status}`);
    return [];
  }
  const logs = await res.json();
  return Array.isArray(logs)
    ? logs.map((l: RawLog) => ({ ...l, _DeviceName: device.name }))
    : [];
}

// ---------------------------------------------------------------------------
// Core aggregation logic  (mirrors syncLogsForRange in AttendanceDaily.jsx)
// With shift roster integration
// ---------------------------------------------------------------------------
interface AggregatedRecord {
  EmployeeID:     string;
  EmployeeName:   string;
  Date:           string;
  Day:            string;
  IsWorkingDay:   string;
  InTime:         string;
  OutTime:        string;
  StandardLunch:  string;
  WasteTime:      string;
  PunchLog:       string;
  PunchLogStatus: string;
  StoreName:      string;
  DeviceID:       string;
  Designation:    string;
  SerialNumber:   string;
  AssignedSerial: string;
  Status:         string;
  WorkingHour:    string;
  Overtime:       string;
  LateMinute:     number;
  PunchMiss:      string;
  PunchMissMsg:   string;
  RawLogs:        string[];
  ShiftType:      string | null;
}

function aggregateLogs(
  filteredLogs: RawLog[],
  joiningData: JoiningEntry[],
  deviceMapping: DeviceMapEntry[],
  rosterList: ShiftRosterEntry[],
  fromDate: string,
  toDate: string
): AggregatedRecord[] {
  // Sort ascending by LogDate
  filteredLogs.sort((a, b) => new Date(a.LogDate).getTime() - new Date(b.LogDate).getTime());

  // Group by (EmployeeCode, date)
  const grouped: Record<
    string,
    { EmployeeCode: string; Date: string; SerialNumber: string; SourceDeviceName: string; logs: string[] }
  > = {};

  for (const log of filteredLogs) {
    if (!log.EmployeeCode || !log.LogDate) continue;
    const dateStr = log.LogDate.split(" ")[0];
    const key     = `${log.EmployeeCode}_${dateStr}`;

    if (!grouped[key]) {
      grouped[key] = {
        EmployeeCode:     log.EmployeeCode.toString().trim(),
        Date:             dateStr,
        SerialNumber:     log.SerialNumber,
        SourceDeviceName: log._DeviceName,
        logs:             [],
      };
    }
    grouped[key].logs.push(log.LogDate);
  }

  // Inject absent records for rostered employees who didn't punch
  const start = new Date(fromDate + "T00:00:00+05:30");
  const end   = new Date(toDate   + "T00:00:00+05:30");
  const datesInRange: string[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    datesInRange.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }

  datesInRange.forEach((dateStr) => {
    const shiftsForDate = rosterList.filter((r) => r.date === dateStr);
    shiftsForDate.forEach((shift) => {
      const empId = shift.employee_id.toString().trim();
      const key   = `${empId}_${dateStr}`;
      if (!grouped[key]) {
        // No biometric punch – inject empty group so they get Absent status
        let dMap = deviceMapping.find(
          (m) => m.userId && m.userId.toString().toLowerCase() === empId.toLowerCase()
        );
        if (!dMap) {
          const empMeta = joiningData.find(
            (e) => (e.id && e.id.toLowerCase() === empId.toLowerCase()) ||
                   (e.name && e.name.toLowerCase() === empId.toLowerCase())
          );
          if (empMeta) {
            const entryName = empMeta.name.trim().toLowerCase();
            dMap = deviceMapping.find((m) => m.name?.toLowerCase() === entryName);
          }
        }
        grouped[key] = {
          EmployeeCode:     empId,
          Date:             dateStr,
          SerialNumber:     dMap ? dMap.serialNo : "-",
          SourceDeviceName: dMap ? dMap.storeName : "-",
          logs:             [],
        };
      }
    });
  });

  return Object.values(grouped).map((group) => {
    const logs  = group.logs;
    const code  = group.EmployeeCode.toString().trim();

    // Find shift for this employee on this date
    const shift = rosterList.find(
      (s) => s.employee_id.toString().trim() === code && s.date === group.Date
    ) ?? null;

    // Determine morning/evening punch threshold from shift (default: 15:00 = 3 PM)
    let morningPunchThreshold = 15;
    if (shift?.start_time && shift?.end_time) {
      const startHour = parseInt(shift.start_time.split(":")[0], 10);
      const endHour   = parseInt(shift.end_time.split(":")[0],   10);
      morningPunchThreshold = Math.floor((startHour + endHour) / 2);
    }

    let inTime      = "-";
    let outTime     = "-";
    let punchMiss   = "No";
    let punchMissMsg = "";

    if (logs.length === 1) {
      const punchTime = logs[0];
      const timePart  = punchTime.split(" ")[1] || "";
      const hours     = parseInt(timePart.split(":")[0]) || 0;
      punchMiss       = "Yes";
      if (hours >= morningPunchThreshold) {
        outTime      = punchTime;
        punchMissMsg = "Morning Punch Miss";
      } else {
        inTime       = punchTime;
        punchMissMsg = "Evening Punch Miss";
      }
    } else if (logs.length > 1) {
      inTime  = logs[0];
      outTime = logs[logs.length - 1];
    }

    const serial    = group.SerialNumber.toString().trim();
    const isNumeric = !isNaN(Number(code)) && code !== "";

    // Employee metadata lookup
    const empMeta = joiningData.find(
      (e) =>
        (e.id   && e.id.toLowerCase()   === code.toLowerCase()) ||
        (e.name && e.name.toLowerCase() === code.toLowerCase())
    );

    let dMap = deviceMapping.find(
      (m) => m.userId && m.userId.toString().toLowerCase() === code.toLowerCase()
    );
    if (!dMap) {
      const entryName = (empMeta?.name ?? code).toString().trim().toLowerCase();
      dMap = deviceMapping.find((m) => m.name && m.name.toString().toLowerCase() === entryName);
    }

    const displayName           = dMap ? dMap.name      : (empMeta ? empMeta.name  : (isNumeric ? "Unknown" : code));
    const displayCode           = dMap ? dMap.userId     : (empMeta ? empMeta.id    : (isNumeric ? code      : "Unknown"));
    const displayStore          = dMap ? dMap.storeName  : (empMeta ? empMeta.store : group.SourceDeviceName);
    const displayDeviceId       = dMap ? dMap.deviceId   : "-";
    const displayAssignedSerial = dMap ? dMap.serialNo   : serial;

    // Late calculation uses shift if assigned
    const lateMins = calculateLateMinutes(inTime, shift);
    const workHrs  = (punchMiss === "Yes" || logs.length === 0) ? "00:00:00" : calculateWorkHours(logs);

    // Lunch / waste time
    let actualLunchMs = 0;
    if (logs.length > 2) {
      for (let i = 1; i < logs.length - 1; i += 2) {
        const lOut = parseISTToDate(logs[i]);
        const lIn  = parseISTToDate(logs[i + 1]);
        if (lOut && lIn) actualLunchMs += Math.max(0, lIn.getTime() - lOut.getTime());
      }
    }

    const standardLunchMs = 2.5 * 3600 * 1000;
    const wasteTimeMs     = Math.max(0, actualLunchMs - standardLunchMs);
    const displayLunchMs  = Math.min(actualLunchMs, standardLunchMs);

    // Day name
    const dateObj = parseISTToDate(group.Date + "T00:00:00");
    const dayName = dateObj
      ? new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Kolkata" }).format(dateObj)
      : "";

    // Status: Absent when no punches; otherwise Present/Late based on shift
    let status = "Absent";
    if (logs.length > 0) {
      status = lateMins > 0 ? "Late" : "Present";
    }

    // Punch log string
    const punchLogStr = logs.map((l) => formatTimeIST(l)).join(" | ");

    // Punch log status (Andar / Bahar)
    let punchLogStatus = "Bahar";
    if (logs.length > 0) {
      if (logs.length % 2 === 1) {
        if (logs.length === 1) {
          const timePart = logs[0].split(" ")[1] || "";
          const hours    = parseInt(timePart.split(":")[0]) || 0;
          punchLogStatus = hours >= morningPunchThreshold ? "Bahar" : "Andar";
        } else {
          punchLogStatus = "Andar";
        }
      } else {
        punchLogStatus = "Bahar";
      }
    }

    return {
      EmployeeID:     displayCode,
      EmployeeName:   displayName,
      Date:           group.Date,
      Day:            dayName,
      IsWorkingDay:   "Yes",
      InTime:         inTime,
      OutTime:        outTime,
      StandardLunch:  calculateHoursMins(displayLunchMs),
      WasteTime:      calculateHoursMins(wasteTimeMs),
      PunchLog:       punchLogStr,
      PunchLogStatus: punchLogStatus,
      StoreName:      displayStore,
      DeviceID:       displayDeviceId,
      Designation:    empMeta ? empMeta.designation : "-",
      SerialNumber:   serial,
      AssignedSerial: displayAssignedSerial,
      Status:         status,
      WorkingHour:    workHrs,
      Overtime:       "0h 0m",
      LateMinute:     lateMins,
      PunchMiss:      punchMiss,
      PunchMissMsg:   punchMissMsg,
      RawLogs:        logs,
      ShiftType:      shift?.shift_type ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Supabase upsert – preserves manual punches, stores API punches separately
// ---------------------------------------------------------------------------
async function saveAttendanceToDB(
  supabase: ReturnType<typeof createClient>,
  aggregatedData: AggregatedRecord[]
): Promise<unknown[]> {
  if (!aggregatedData.length) return [];

  // Fetch existing records to preserve manual_punches.manual overrides
  const dates = [...new Set(aggregatedData.map((item) => item.Date))];
  let existingLogs: any[] = [];
  if (dates.length > 0) {
    const { data } = await supabase
      .from("attendance_logs")
      .select("*")
      .in("attendance_date", dates);
    existingLogs = data || [];
  }

  const rows = aggregatedData.map((item) => {
    const existing = existingLogs.find(
      (r) => r.employee_id === item.EmployeeID && r.attendance_date === item.Date
    );

    // Build API punches object from raw device logs (strictly in .api key)
    const apiPunches: Record<string, string> = {};
    item.RawLogs.forEach((logStr, idx) => {
      if (idx < 5) {
        try {
          const formatted = formatTimeIST(logStr);
          apiPunches[(idx + 1).toString()] = formatted !== "-" ? formatted : logStr.split(" ")[1]?.substring(0, 5) ?? "";
        } catch { /* ignore */ }
      }
    });

    // Preserve the existing manual section (user-entered punches)
    let manualSection: Record<string, any> = {};
    if (existing?.manual_punches) {
      const existingMP = existing.manual_punches;
      if (existingMP.manual && typeof existingMP.manual === "object") {
        // New nested format – preserve manual section as-is
        manualSection = { ...existingMP.manual };
      } else {
        // Old flat format – only migrate if it was actually a manual override
        const isOldManual =
          existingMP.is_manual === true ||
          existingMP.manual_override === true ||
          existingMP.absent === true;
        if (isOldManual) {
          ["1", "2", "3", "4", "5"].forEach((k) => {
            if (existingMP[k]) manualSection[k] = existingMP[k];
          });
          if (existingMP.absent)          manualSection.absent          = true;
          if (existingMP.is_manual)       manualSection.is_manual       = existingMP.is_manual;
          if (existingMP.manual_override) manualSection.manual_override = existingMP.manual_override;
        }
      }
    }

    // If existing record has a manual override, keep its computed attendance values
    const isManualOverride =
      manualSection.is_manual === true || manualSection.manual_override === true;

    // Build final manual_punches
    const manualPunches: Record<string, any> = {};
    if (Object.keys(manualSection).length > 0) manualPunches.manual = manualSection;
    if (Object.keys(apiPunches).length   > 0) manualPunches.api    = apiPunches;

    // Base row from aggregated data
    const baseRow: Record<string, any> = {
      employee_id:      item.EmployeeID,
      employee_name:    item.EmployeeName,
      attendance_date:  item.Date,
      day:              item.Day,
      designation:      item.Designation,
      store_name:       item.StoreName,
      device_id:        item.DeviceID,
      serial_number:    item.AssignedSerial || item.SerialNumber,
      in_time:          formatToISTISOString(item.InTime),
      out_time:         formatToISTISOString(item.OutTime),
      working_hour:     item.WorkingHour,
      overtime:         item.Overtime,
      late_minute:      item.LateMinute,
      status:           item.Status,
      standard_lunch:   item.StandardLunch,
      waste_time:       item.WasteTime,
      punch_log:        item.PunchLog,
      punch_log_status: item.PunchLogStatus,
      punch_miss:       item.PunchMiss,
      punch_miss_msg:   item.PunchMissMsg,
      manual_punches:   manualPunches,
      is_Late:          item.LateMinute > 0,
      updated_at:       new Date().toISOString(),
    };

    // If the record had a manual override, restore computed attendance fields
    // from the existing record so the sync doesn't overwrite user edits
    if (isManualOverride && existing) {
      baseRow.in_time       = existing.in_time;
      baseRow.out_time      = existing.out_time;
      baseRow.working_hour  = existing.working_hour;
      baseRow.late_minute   = existing.late_minute;
      baseRow.status        = existing.status;
      baseRow.standard_lunch= existing.standard_lunch;
      baseRow.waste_time    = existing.waste_time;
      baseRow.punch_miss    = existing.punch_miss;
      baseRow.punch_miss_msg= existing.punch_miss_msg;
      baseRow.is_Late       = existing.is_Late;
      // But always update the API punch log and punch_log fields
      baseRow.punch_log        = item.PunchLog;
      baseRow.punch_log_status = item.PunchLogStatus;
    }

    return baseRow;
  });

  const { data, error } = await supabase
    .from("attendance_logs")
    .upsert(rows, { onConflict: "employee_id,attendance_date", ignoreDuplicates: false })
    .select();

  if (error) throw error;

  console.log(`[sync-attendance] UPSERT complete: ${data?.length ?? 0} rows affected`);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  try {
    // 1. Parse request parameters
    let fromDate: string | undefined;
    let toDate:   string | undefined;
    let deviceFilter = "ALL";

    if (req.method === "POST") {
      try {
        const body   = await req.json();
        fromDate     = body.fromDate;
        toDate       = body.toDate;
        deviceFilter = body.device ?? "ALL";
      } catch { /* body may be empty */ }
    } else {
      const url    = new URL(req.url);
      fromDate     = url.searchParams.get("fromDate") ?? undefined;
      toDate       = url.searchParams.get("toDate")   ?? undefined;
      deviceFilter = url.searchParams.get("device")   ?? "ALL";
    }

    const todayIST = getTodayIST();
    fromDate = fromDate ?? todayIST;
    toDate   = toDate   ?? todayIST;

    console.log(`[sync-attendance] Syncing ${fromDate} → ${toDate} (device: ${deviceFilter})`);

    // 2. Initialise Supabase client
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // 3. Fetch joining data, device mapping, and shift roster in parallel
    const [joiningData, deviceMapping, rosterResult] = await Promise.all([
      fetchJoiningData(),
      fetchDeviceMapping(),
      supabaseClient
        .from("shift_roster")
        .select("*")
        .gte("date", fromDate!)
        .lte("date", toDate!),
    ]);

    const rosterList: ShiftRosterEntry[] = rosterResult.data || [];
    console.log(
      `[sync-attendance] Joining: ${joiningData.length}, DeviceMap: ${deviceMapping.length}, Roster: ${rosterList.length}`
    );

    // 4. Fetch raw device logs
    const devicesToQuery =
      deviceFilter.toUpperCase() === "ALL"
        ? DEVICES
        : DEVICES.filter((d) => d.name.toUpperCase() === deviceFilter.toUpperCase());

    const rawLogResponses = await Promise.all(
      devicesToQuery.map((device) =>
        fetchRawLogsForDevice(device, fromDate!, toDate!).catch((e) => {
          console.error(`[sync-attendance] Failed for ${device.name}:`, e);
          return [] as RawLog[];
        })
      )
    );

    const rawLogsData: RawLog[] = rawLogResponses.flat();
    console.log(`[sync-attendance] Raw logs fetched: ${rawLogsData.length}`);

    // 5. Filter logs to the exact date range
    const filteredLogs = rawLogsData.filter((log) => {
      if (!log.LogDate) return false;
      const logDateStr = log.LogDate.split(" ")[0];
      return logDateStr >= fromDate! && logDateStr <= toDate!;
    });

    // 6. Aggregate (even if no raw logs – roster absences are injected)
    const aggregatedData = aggregateLogs(
      filteredLogs, joiningData, deviceMapping, rosterList, fromDate!, toDate!
    );

    if (aggregatedData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No logs or roster assignments in range.", inserted: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // 7. Upsert into Supabase
    const upsertedRows = await saveAttendanceToDB(supabaseClient, aggregatedData);

    // 8. Return summary
    return new Response(
      JSON.stringify({
        success:      true,
        fromDate,
        toDate,
        rawLogs:      rawLogsData.length,
        filteredLogs: filteredLogs.length,
        aggregated:   aggregatedData.length,
        inserted:     upsertedRows.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err) {
    console.error("[sync-attendance] Fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
});
