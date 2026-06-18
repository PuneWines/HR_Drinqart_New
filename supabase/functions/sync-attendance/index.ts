// // Supabase Edge Function: sync-attendance
// // Mirrors the syncTodayLogs / syncLogsForRange logic from AttendanceDaily.jsx.
// //
// // Invoke via HTTP POST (or GET) with an optional JSON body:
// //   { "fromDate": "YYYY-MM-DD", "toDate": "YYYY-MM-DD", "device": "ALL" }
// //
// // Defaults:
// //   fromDate / toDate  → today in IST
// //   device             → "ALL"  (fetches every device in parallel)
// //
// // Required Supabase secrets (set via `supabase secrets set`):
// //   SUPABASE_URL            – your project URL
// //   SUPABASE_SERVICE_ROLE_KEY – service-role key (bypasses RLS for upsert)

// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// // ---------------------------------------------------------------------------
// // Device registry (mirrors the DEVICES constant in AttendanceDaily.jsx)
// // ---------------------------------------------------------------------------
// const DEVICES = [
//   { name: "BAWDHAN",   apiName: "BAVDHAN",   serial: "C26238441B1E342D" },
//   { name: "HINJEWADI", apiName: "HINJEWADI", serial: "AMDB25061400335"  },
//   { name: "WAGHOLI",   apiName: "WAGHOLI",   serial: "AMDB25061400343"  },
//   { name: "AKOLE",     apiName: "AKOLE",     serial: "C262CC13CF202038" },
//   { name: "MUMBAI",    apiName: "MUMBAI",    serial: "C2630450C32A2327" },
// ];

// const DEVICE_LOGS_BASE = "https://api.devicelogs.example.com"; // proxied internally
// const JOINING_API_URL =
//   "https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch";
// const MASTER_MAP_URL =
//   "https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch";

// // The real device-log API endpoint (same as the vite proxy target in server.js)
// // Real device-log API (same target + path rewrite as the Vite proxy in vite.config.js)
// const DEVICE_LOG_API_BASE = "http://103.195.203.77:15167/api/v2/WebAPI/GetDeviceLogs";

// // ---------------------------------------------------------------------------
// // Date / Time helpers  (ported from AttendanceDaily.jsx)
// // ---------------------------------------------------------------------------

// /** Strip timezone suffix and normalise to a bare ISO-8601 local string. */
// function formatToISTISOString(timeStr: string | null | undefined): string | null {
//   if (!timeStr || timeStr === "-") return null;

//   let formatted = timeStr.trim().replace(" ", "T");
//   if (formatted.includes("+")) formatted = formatted.split("+")[0];
//   else if (formatted.endsWith("Z")) formatted = formatted.slice(0, -1);

//   const timeParts = formatted.split("T")[1] || "";
//   if (timeParts.split(":").length === 2) formatted = formatted + ":00";
//   return formatted;
// }

// /**
//  * Parse a date-time string that represents an IST time and return a JS Date.
//  * Works by appending the "+05:30" offset before calling new Date().
//  */
// function parseISTToDate(dateStr: string | null | undefined): Date | null {
//   if (!dateStr || dateStr === "-") return null;
//   try {
//     let clean = dateStr;
//     if (clean.includes("+")) clean = clean.split("+")[0];
//     else if (clean.endsWith("Z")) clean = clean.slice(0, -1);

//     let formatted = clean.trim().replace(" ", "T");
//     const timeParts = formatted.split("T")[1] || "";
//     if (timeParts.split(":").length === 2) formatted = formatted + ":00";
//     formatted = formatted + "+05:30";

//     const d = new Date(formatted);
//     return isNaN(d.getTime()) ? null : d;
//   } catch {
//     return null;
//   }
// }

// /** Format a datetime string to IST time-only string, e.g. "9:05 AM". */
// function formatTimeIST(dateStr: string | null | undefined): string {
//   if (!dateStr || dateStr === "-") return "-";
//   try {
//     const d = parseISTToDate(dateStr);
//     if (!d) return dateStr;
//     return new Intl.DateTimeFormat("en-US", {
//       timeZone: "Asia/Kolkata",
//       hour: "numeric",
//       minute: "2-digit",
//       hour12: true,
//     }).format(d);
//   } catch {
//     return dateStr;
//   }
// }

// /** Get today's date string YYYY-MM-DD in IST. */
// function getTodayIST(): string {
//   const parts = new Intl.DateTimeFormat("en-CA", {
//     timeZone: "Asia/Kolkata",
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//   }).formatToParts(new Date());
//   const get = (type: string) => parts.find((p) => p.type === type)!.value;
//   return `${get("year")}-${get("month")}-${get("day")}`;
// }

// // ---------------------------------------------------------------------------
// // Attendance computation helpers (ported from AttendanceDaily.jsx)
// // ---------------------------------------------------------------------------

// function calculateHoursMins(diffMs: number): string {
//   if (!diffMs || isNaN(diffMs) || diffMs <= 0) return "00:00:00";
//   const totalSecs = Math.floor(diffMs / 1000);
//   const hrs = Math.floor(totalSecs / 3600);
//   const mins = Math.floor((totalSecs % 3600) / 60);
//   const secs = totalSecs % 60;
//   return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
// }

// function calculateWorkHours(inStr: string, outStr: string): string {
//   if (!inStr || !outStr || inStr === "-" || outStr === "-" || inStr === outStr)
//     return "00:00:00";
//   try {
//     const inDate = parseISTToDate(inStr);
//     const outDate = parseISTToDate(outStr);
//     if (!inDate || !outDate || outDate <= inDate) return "00:00:00";
//     return calculateHoursMins(outDate.getTime() - inDate.getTime());
//   } catch {
//     return "00:00:00";
//   }
// }

// function calculateLateMinutes(inStr: string): number {
//   if (!inStr || inStr === "-") return 0;
//   try {
//     const inDate = parseISTToDate(inStr);
//     if (!inDate) return 0;

//     const parts = new Intl.DateTimeFormat("en-US", {
//       timeZone: "Asia/Kolkata",
//       hour: "numeric",
//       minute: "numeric",
//       hour12: false,
//     }).formatToParts(inDate);

//     const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
//     const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
//     const totalMinutes = hour * 60 + minute;

//     const officialStart = 10 * 60;        // 10:00
//     const graceThreshold = 10 * 60 + 10; // 10:10

//     return totalMinutes >= graceThreshold ? totalMinutes - officialStart : 0;
//   } catch {
//     return 0;
//   }
// }

// // ---------------------------------------------------------------------------
// // Joining data helpers
// // ---------------------------------------------------------------------------
// interface JoiningEntry {
//   id: string;
//   name: string;
//   designation: string;
//   store: string;
// }

// async function fetchJoiningData(): Promise<JoiningEntry[]> {
//   const res = await fetch(JOINING_API_URL);
//   const result = await res.json();
//   if (!result.success) return [];

//   const rawRows: unknown[][] = result.data ?? result;
//   const headers: unknown[] = rawRows[5];
//   const dataRows: unknown[][] = rawRows.slice(6);

//   const getIdx = (name: string) =>
//     headers.findIndex(
//       (h) => h && h.toString().trim().toLowerCase() === name.toLowerCase()
//     );

//   const empIdIdx  = getIdx("Employee ID");
//   const nameIdx   = getIdx("Name As Per Aadhar");
//   const desIdx    = getIdx("Designation");
//   const storeIdx  = getIdx("Joining Place");

//   return dataRows
//     .map((r) => ({
//       id:          r[empIdIdx]?.toString().trim() ?? "",
//       name:        r[nameIdx]?.toString().trim()  ?? "",
//       designation: r[desIdx]?.toString().trim()   ?? "",
//       store:       r[storeIdx]?.toString().trim()  ?? "",
//     }))
//     .filter((h) => h.id);
// }

// // ---------------------------------------------------------------------------
// // Device mapping helpers
// // ---------------------------------------------------------------------------
// interface DeviceMapEntry {
//   userId:    string;
//   name:      string;
//   deviceId:  string;
//   serialNo:  string;
//   storeName: string;
// }

// async function fetchDeviceMapping(): Promise<DeviceMapEntry[]> {
//   const res = await fetch(MASTER_MAP_URL);
//   const result = await res.json();
//   if (!result.success) return [];

//   const rows: unknown[][] = result.data.slice(1);
//   return rows.map((r) => ({
//     userId:    r[5]?.toString().trim() ?? "",
//     name:      r[6]?.toString().trim() ?? "",
//     deviceId:  r[7]?.toString().trim() ?? "",
//     serialNo:  r[8]?.toString().trim() ?? "",
//     storeName: r[9]?.toString().trim() ?? "",
//   }));
// }

// // ---------------------------------------------------------------------------
// // Raw device log fetching
// // ---------------------------------------------------------------------------
// interface RawLog {
//   EmployeeCode: string;
//   LogDate:      string;
//   SerialNumber: string;
//   _DeviceName:  string;
// }

// async function fetchRawLogsForDevice(
//   device: { name: string; apiName: string; serial: string },
//   fromDate: string,
//   toDate: string
// ): Promise<RawLog[]> {
//   // URL mirrors the Vite proxy: /api/device-logs → /api/v2/WebAPI/GetDeviceLogs on 103.195.203.77:15167
//   const url =
//     `${DEVICE_LOG_API_BASE}` +
//     `?APIKey=211616032630` +
//     `&SerialNumber=${device.serial}` +
//     `&DeviceName=${device.apiName}` +
//     `&FromDate=${fromDate}` +
//     `&ToDate=${toDate}`;

//   const res = await fetch(url);
//   if (!res.ok) {
//     console.error(`[sync-attendance] Device ${device.name} returned HTTP ${res.status}`);
//     return [];
//   }
//   const logs = await res.json();
//   return Array.isArray(logs)
//     ? logs.map((l: RawLog) => ({ ...l, _DeviceName: device.name }))
//     : [];
// }

// // ---------------------------------------------------------------------------
// // Core aggregation logic  (mirrors syncLogsForRange in AttendanceDaily.jsx)
// // ---------------------------------------------------------------------------
// interface AggregatedRecord {
//   EmployeeID:    string;
//   EmployeeName:  string;
//   Date:          string;
//   Day:           string;
//   IsWorkingDay:  string;
//   InTime:        string;
//   OutTime:       string;
//   StandardLunch: string;
//   WasteTime:     string;
//   PunchLog:      string;
//   PunchLogStatus: string;
//   StoreName:     string;
//   DeviceID:      string;
//   Designation:   string;
//   SerialNumber:  string;
//   AssignedSerial: string;
//   Status:        string;
//   WorkingHour:   string;
//   Overtime:      string;
//   LateMinute:    number;
//   PunchMiss:     string;
//   PunchMissMsg:  string;
// }

// function aggregateLogs(
//   filteredLogs: RawLog[],
//   joiningData: JoiningEntry[],
//   deviceMapping: DeviceMapEntry[]
// ): AggregatedRecord[] {
//   // Sort ascending by LogDate
//   filteredLogs.sort((a, b) => new Date(a.LogDate).getTime() - new Date(b.LogDate).getTime());

//   // Group by (EmployeeCode, date)
//   const grouped: Record<
//     string,
//     { EmployeeCode: string; Date: string; SerialNumber: string; SourceDeviceName: string; logs: string[] }
//   > = {};

//   for (const log of filteredLogs) {
//     if (!log.EmployeeCode || !log.LogDate) continue;
//     const dateStr = log.LogDate.split(" ")[0];
//     const key = `${log.EmployeeCode}_${dateStr}`;

//     if (!grouped[key]) {
//       grouped[key] = {
//         EmployeeCode:     log.EmployeeCode.toString().trim(),
//         Date:             dateStr,
//         SerialNumber:     log.SerialNumber,
//         SourceDeviceName: log._DeviceName,
//         logs:             [],
//       };
//     }
//     grouped[key].logs.push(log.LogDate);
//   }

//   return Object.values(grouped).map((group) => {
//     const logs = group.logs;

//     let inTime     = "-";
//     let outTime    = "-";
//     let punchMiss  = "No";
//     let punchMissMsg = "";

//     if (logs.length === 1) {
//       const punchTime = logs[0];
//       const timePart  = punchTime.split(" ")[1] || "";
//       const hours     = parseInt(timePart.split(":")[0]) || 0;

//       punchMiss = "Yes";
//       if (hours >= 15) {
//         outTime      = punchTime;
//         punchMissMsg = "Morning Punch Miss";
//       } else {
//         inTime       = punchTime;
//         punchMissMsg = "Evening Punch Miss";
//       }
//     } else {
//       inTime  = logs[0];
//       outTime = logs[logs.length - 1];
//     }

//     const serial   = group.SerialNumber.toString().trim();
//     const code     = group.EmployeeCode.toString().trim();
//     const isNumeric = !isNaN(Number(code)) && code !== "";

//     // Look up joining metadata
//     const empMeta = joiningData.find(
//       (e) =>
//         (e.id   && e.id.toLowerCase()   === code.toLowerCase()) ||
//         (e.name && e.name.toLowerCase() === code.toLowerCase())
//     );

//     // Look up device mapping
//     let dMap = deviceMapping.find(
//       (m) => m.userId && m.userId.toString().toLowerCase() === code.toLowerCase()
//     );
//     if (!dMap) {
//       const entryName = (empMeta?.name ?? code).toString().trim().toLowerCase();
//       dMap = deviceMapping.find(
//         (m) => m.name && m.name.toString().toLowerCase() === entryName
//       );
//     }

//     const displayName          = dMap ? dMap.name          : (empMeta ? empMeta.name  : (isNumeric ? "Unknown" : code));
//     const displayCode          = dMap ? dMap.userId         : (empMeta ? empMeta.id    : (isNumeric ? code      : "Unknown"));
//     const displayStore         = dMap ? dMap.storeName      : (empMeta ? empMeta.store : group.SourceDeviceName);
//     const displayDeviceId      = dMap ? dMap.deviceId       : "-";
//     const displayAssignedSerial = dMap ? dMap.serialNo      : serial;

//     const lateMins = calculateLateMinutes(inTime);
//     const workHrs  = punchMiss === "Yes" ? "00:00:00" : calculateWorkHours(inTime, outTime);

//     // Lunch / waste time
//     let actualLunchMs = 0;
//     if (logs.length > 2) {
//       for (let i = 1; i < logs.length - 1; i += 2) {
//         const lOut = parseISTToDate(logs[i]);
//         const lIn  = parseISTToDate(logs[i + 1]);
//         if (lOut && lIn) actualLunchMs += Math.max(0, lIn.getTime() - lOut.getTime());
//       }
//     }

//     const standardLunchMs  = 2.5 * 3600 * 1000;
//     const wasteTimeMs      = Math.max(0, actualLunchMs - standardLunchMs);
//     const displayLunchMs   = Math.min(actualLunchMs, standardLunchMs);

//     // Day name
//     const dateObj = parseISTToDate(group.Date + "T00:00:00");
//     const dayName = dateObj
//       ? new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(dateObj)
//       : "";

//     const status = lateMins > 0 ? "Late" : "Present";

//     // Punch log string
//     const punchLogStr = logs.map((l) => formatTimeIST(l)).join(" | ");

//     // Punch log status (Andar / Bahar)
//     let punchLogStatus = "Bahar";
//     if (logs.length > 0) {
//       if (logs.length % 2 === 1) {
//         if (logs.length === 1) {
//           const timePart = logs[0].split(" ")[1] || "";
//           const hours    = parseInt(timePart.split(":")[0]) || 0;
//           punchLogStatus = hours >= 15 ? "Bahar" : "Andar";
//         } else {
//           punchLogStatus = "Andar";
//         }
//       } else {
//         punchLogStatus = "Bahar";
//       }
//     }

//     return {
//       EmployeeID:     displayCode,
//       EmployeeName:   displayName,
//       Date:           group.Date,
//       Day:            dayName,
//       IsWorkingDay:   "Yes",
//       InTime:         inTime,
//       OutTime:        outTime,
//       StandardLunch:  calculateHoursMins(displayLunchMs),
//       WasteTime:      calculateHoursMins(wasteTimeMs),
//       PunchLog:       punchLogStr,
//       PunchLogStatus: punchLogStatus,
//       StoreName:      displayStore,
//       DeviceID:       displayDeviceId,
//       Designation:    empMeta ? empMeta.designation : "-",
//       SerialNumber:   serial,
//       AssignedSerial: displayAssignedSerial,
//       Status:         status,
//       WorkingHour:    workHrs,
//       Overtime:       "0h 0m",
//       LateMinute:     lateMins,
//       PunchMiss:      punchMiss,
//       PunchMissMsg:   punchMissMsg,
//     };
//   });
// }

// // ---------------------------------------------------------------------------
// // Supabase upsert  (mirrors saveAttendanceToDB in AttendanceDaily.jsx)
// // ---------------------------------------------------------------------------
// async function saveAttendanceToDB(
//   supabase: ReturnType<typeof createClient>,
//   aggregatedData: AggregatedRecord[]
// ): Promise<unknown[]> {
//   if (!aggregatedData.length) return [];

//   const rows = aggregatedData.map((item) => ({
//     employee_id:    item.EmployeeID,
//     employee_name:  item.EmployeeName,
//     attendance_date: item.Date,
//     day:            item.Day,
//     designation:    item.Designation,
//     store_name:     item.StoreName,
//     device_id:      item.DeviceID,
//     serial_number:  item.AssignedSerial || item.SerialNumber,
//     in_time:        formatToISTISOString(item.InTime),
//     out_time:       formatToISTISOString(item.OutTime),
//     working_hour:   item.WorkingHour,
//     overtime:       item.Overtime,
//     late_minute:    item.LateMinute,
//     status:         item.Status,
//     standard_lunch: item.StandardLunch,
//     waste_time:     item.WasteTime,
//     punch_log:      item.PunchLog,
//     punch_log_status: item.PunchLogStatus,
//     punch_miss:     item.PunchMiss,
//     punch_miss_msg: item.PunchMissMsg,
//     updated_at:     new Date().toISOString(),
//   }));

//   const { data, error } = await supabase
//     .from("attendance_logs")
//     .upsert(rows, {
//       onConflict:       "employee_id,attendance_date",
//       ignoreDuplicates: false,
//     })
//     .select();

//   if (error) throw error;

//   console.log(`[sync-attendance] UPSERT complete: ${data?.length ?? 0} rows affected`);
//   return data ?? [];
// }

// // ---------------------------------------------------------------------------
// // Edge Function entry point
// // ---------------------------------------------------------------------------
// Deno.serve(async (req: Request) => {
//   // Allow CORS for browser invocations
//   if (req.method === "OPTIONS") {
//     return new Response(null, {
//       headers: {
//         "Access-Control-Allow-Origin":  "*",
//         "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
//         "Access-Control-Allow-Headers": "Authorization, Content-Type",
//       },
//     });
//   }

//   try {
//     // -----------------------------------------------------------------------
//     // 1. Parse request parameters
//     // -----------------------------------------------------------------------
//     let fromDate: string | undefined;
//     let toDate: string | undefined;
//     let deviceFilter: string = "ALL"; // "ALL" or one of the device names

//     if (req.method === "POST") {
//       try {
//         const body = await req.json();
//         fromDate     = body.fromDate;
//         toDate       = body.toDate;
//         deviceFilter = body.device ?? "ALL";
//       } catch {
//         // body may be empty – ignore
//       }
//     } else {
//       const url    = new URL(req.url);
//       fromDate     = url.searchParams.get("fromDate") ?? undefined;
//       toDate       = url.searchParams.get("toDate")   ?? undefined;
//       deviceFilter = url.searchParams.get("device")   ?? "ALL";
//     }

//     // Default to today in IST (mirrors syncTodayLogs)
//     const todayIST = getTodayIST();
//     fromDate = fromDate ?? todayIST;
//     toDate   = toDate   ?? todayIST;

//     console.log(`[sync-attendance] Syncing ${fromDate} → ${toDate} (device: ${deviceFilter})`);

//     // -----------------------------------------------------------------------
//     // 2. Initialise Supabase client with service-role key (bypasses RLS)
//     // -----------------------------------------------------------------------
//     const supabaseUrl     = Deno.env.get("SUPABASE_URL")!;
//     const supabaseKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
//     const supabaseClient  = createClient(supabaseUrl, supabaseKey);

//     // -----------------------------------------------------------------------
//     // 3. Fetch joining data and device mapping in parallel
//     // -----------------------------------------------------------------------
//     const [joiningData, deviceMapping] = await Promise.all([
//       fetchJoiningData(),
//       fetchDeviceMapping(),
//     ]);

//     console.log(`[sync-attendance] Joining records: ${joiningData.length}, Device map entries: ${deviceMapping.length}`);

//     // -----------------------------------------------------------------------
//     // 4. Fetch raw device logs (mirrors syncLogsForRange device fetching)
//     // -----------------------------------------------------------------------
//     const devicesToQuery =
//       deviceFilter.toUpperCase() === "ALL"
//         ? DEVICES
//         : DEVICES.filter(
//             (d) => d.name.toUpperCase() === deviceFilter.toUpperCase()
//           );

//     const rawLogResponses = await Promise.all(
//       devicesToQuery.map((device) =>
//         fetchRawLogsForDevice(device, fromDate!, toDate!).catch((e) => {
//           console.error(`[sync-attendance] Failed for ${device.name}:`, e);
//           return [] as RawLog[];
//         })
//       )
//     );

//     const rawLogsData: RawLog[] = rawLogResponses.flat();

//     if (rawLogsData.length === 0) {
//       return new Response(
//         JSON.stringify({ success: true, message: "No raw logs found for the given range.", inserted: 0 }),
//         { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
//       );
//     }

//     // -----------------------------------------------------------------------
//     // 5. Filter logs to the exact date range (mirrors filteredLogs step)
//     // -----------------------------------------------------------------------
//     const filteredLogs = rawLogsData.filter((log) => {
//       if (!log.LogDate) return false;
//       const logDateStr = log.LogDate.split(" ")[0];
//       return logDateStr >= fromDate! && logDateStr <= toDate!;
//     });

//     if (filteredLogs.length === 0) {
//       return new Response(
//         JSON.stringify({ success: true, message: "No logs in range after filtering.", inserted: 0 }),
//         { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
//       );
//     }

//     // -----------------------------------------------------------------------
//     // 6. Aggregate  (mirrors the grouped → aggregatedData block)
//     // -----------------------------------------------------------------------
//     const aggregatedData = aggregateLogs(filteredLogs, joiningData, deviceMapping);

//     // -----------------------------------------------------------------------
//     // 7. Upsert into Supabase  (mirrors saveAttendanceToDB)
//     // -----------------------------------------------------------------------
//     const upsertedRows = await saveAttendanceToDB(supabaseClient, aggregatedData);

//     // -----------------------------------------------------------------------
//     // 8. Return summary
//     // -----------------------------------------------------------------------
//     return new Response(
//       JSON.stringify({
//         success:       true,
//         fromDate,
//         toDate,
//         rawLogs:       rawLogsData.length,
//         filteredLogs:  filteredLogs.length,
//         aggregated:    aggregatedData.length,
//         inserted:      upsertedRows.length,
//       }),
//       {
//         status:  200,
//         headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
//       }
//     );
//   } catch (err) {
//     console.error("[sync-attendance] Fatal error:", err);
//     return new Response(
//       JSON.stringify({ success: false, error: (err as Error).message }),
//       {
//         status:  500,
//         headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
//       }
//     );
//   }
// });
