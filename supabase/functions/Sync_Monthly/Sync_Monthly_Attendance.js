// // Supabase Edge Function: sync-monthly-attendance
// // Aggregates daily logs from the `attendance_logs` table and upserts to `attendance_monthly`.
// //
// // Invoke via HTTP POST (or GET) with optional JSON body / query params:
// //   { "month": 7, "year": 2026, "device": "ALL" }
// //
// // Defaults:
// //   month / year  → current month / year in IST
// //   device        → "ALL" (aggregates stats for all registered devices)
// //
// // Required Supabase secrets:
// //   SUPABASE_URL
// //   SUPABASE_SERVICE_ROLE_KEY

// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// // ---------------------------------------------------------------------------
// // Device registry (matches DEVICES constant in AttendanceMonthly.jsx)
// // ---------------------------------------------------------------------------
// const DEVICES = [
//   { name: "BAWDHAN",   apiName: "BAVDHAN",   serial: "C26238441B1E342D" },
//   { name: "HINJEWADI", apiName: "HINJEWADI", serial: "AMDB25061400335"  },
//   { name: "WAGHOLI",   apiName: "WAGHOLI",   serial: "AMDB25061400343"  },
//   { name: "AKOLE",     apiName: "AKOLE",     serial: "C262CC13CF202038" },
//   { name: "MUMBAI",    apiName: "MUMBAI",    serial: "C2630450C32A2327" }
// ];

// const monthNames = [
//   "January", "February", "March", "April", "May", "June",
//   "July", "August", "September", "October", "November", "December"
// ];

// // Helper functions for month statistics
// const getDaysInMonth = (month: number, year: number) => {
//   return new Date(year, month, 0).getDate();
// };

// const getSundaysCount = (month: number, year: number) => {
//   let count = 0;
//   const days = new Date(year, month, 0).getDate();
//   for (let i = 1; i <= days; i++) {
//     if (new Date(year, month - 1, i).getDay() === 0) count++;
//   }
//   return count;
// };

// const parseTimeToSeconds = (timeStr: string | null | undefined): number => {
//   if (!timeStr || timeStr === "-") return 0;
//   const parts = timeStr.split(":").map(Number);
//   if (parts.length === 3) {
//     return parts[0] * 3600 + parts[1] * 60 + parts[2];
//   } else if (parts.length === 2) {
//     return parts[0] * 3600 + parts[1] * 60;
//   }
//   return 0;
// };

// const formatSecsToHrsMins = (totalSecs: number): string => {
//   if (!totalSecs) return "0h 0m";
//   const hrs = Math.floor(totalSecs / 3600);
//   const mins = Math.floor((totalSecs % 3600) / 60);
//   return `${hrs}h ${mins}m`;
// };

// // CORS configuration headers
// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
//   "Access-Control-Allow-Headers": "Authorization, Content-Type",
// };

// // ---------------------------------------------------------------------------
// // Edge Function entry point
// // ---------------------------------------------------------------------------
// Deno.serve(async (req: Request) => {
//   if (req.method === "OPTIONS") {
//     return new Response(null, {
//       status: 204,
//       headers: corsHeaders,
//     });
//   }

//   try {
//     // 1. Get current month/year in IST as defaults
//     const parts = new Intl.DateTimeFormat("en-CA", {
//       timeZone: "Asia/Kolkata",
//       year: "numeric",
//       month: "2-digit",
//       day: "2-digit",
//     }).formatToParts(new Date());
//     const getVal = (type: string) => parts.find((p) => p.type === type)!.value;
//     const currentYearIST = parseInt(getVal("year"), 10);
//     const currentMonthIST = parseInt(getVal("month"), 10);

//     // 2. Parse request input
//     let month: number | undefined;
//     let year: number | undefined;
//     let deviceFilter = "ALL";

//     if (req.method === "POST") {
//       try {
//         const body = await req.json();
//         month = body.month;
//         year = body.year;
//         deviceFilter = body.device ?? "ALL";
//       } catch {
//         // body could be empty or invalid
//       }
//     } else {
//       const url = new URL(req.url);
//       const m = url.searchParams.get("month");
//       const y = url.searchParams.get("year");
//       month = m ? parseInt(m, 10) : undefined;
//       year = y ? parseInt(y, 10) : undefined;
//       deviceFilter = url.searchParams.get("device") ?? "ALL";
//     }

//     month = month ?? currentMonthIST;
//     year = year ?? currentYearIST;

//     if (month < 1 || month > 12) {
//       return new Response(
//         JSON.stringify({ success: false, error: "Invalid month parameter. Must be 1-12." }),
//         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
//       );
//     }

//     console.log(`[sync-monthly-attendance] Running monthly aggregation for ${month}/${year} (Device: ${deviceFilter})`);

//     // 3. Initialize Supabase Client
//     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
//     const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
//     const supabaseClient = createClient(supabaseUrl, supabaseKey);

//     // Fetch verified employee IDs from the employees table
//     const { data: employeesList, error: empError } = await supabaseClient
//       .from("employees")
//       .select("id, employee_id, joining_place");

//     if (empError) {
//       console.error("[sync-monthly-attendance] Error fetching employees list:", empError);
//       throw empError;
//     }

//     const validEmployeeIds = new Set<string>();
//     const empStoreMap = new Map<string, string>();
//     if (employeesList) {
//       employeesList.forEach((emp: any) => {
//         const store = emp.joining_place || "";
//         if (emp.id) {
//           const idStr = emp.id.toString().trim().toLowerCase();
//           validEmployeeIds.add(idStr);
//           empStoreMap.set(idStr, store);
//         }
//         if (emp.employee_id) {
//           const idStr = emp.employee_id.toString().trim().toLowerCase();
//           validEmployeeIds.add(idStr);
//           empStoreMap.set(idStr, store);
//         }
//       });
//     }

//     // 4. Calculate Date Range for querying logs
//     const startDay = "01";
//     const endDay = getDaysInMonth(month, year);
//     const paddedMonth = month.toString().padStart(2, "0");
//     const fromDate = `${year}-${paddedMonth}-${startDay}`;
//     const toDate = `${year}-${paddedMonth}-${endDay}`;

//     // 5. Resolve devices
//     const devicesToQuery =
//       deviceFilter.toUpperCase() === "ALL"
//         ? DEVICES
//         : DEVICES.filter((d) => d.name.toUpperCase() === deviceFilter.toUpperCase() || d.serial === deviceFilter);

//     if (devicesToQuery.length === 0) {
//       return new Response(
//         JSON.stringify({ success: false, error: `No devices matched filter: ${deviceFilter}` }),
//         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
//       );
//     }

//     const serials = devicesToQuery.map((d) => d.serial);

//     // 6. Query daily attendance logs from Supabase
//     console.log(`[sync-monthly-attendance] Querying logs from ${fromDate} to ${toDate}`);
//     const { data: dbLogs, error: dbError } = await supabaseClient
//       .from("attendance_logs")
//       .select("*")
//       .gte("attendance_date", fromDate)
//       .lte("attendance_date", toDate);

//     if (dbError) {
//       console.error("[sync-monthly-attendance] Database error:", dbError);
//       throw dbError;
//     }

//     if (!dbLogs || dbLogs.length === 0) {
//       return new Response(
//         JSON.stringify({ success: true, message: "No daily attendance logs found for this period.", aggregated: 0 }),
//         { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
//       );
//     }

//     // 7. Aggregate daily logs into monthly stats
//     const monthlyAgg: Record<string, any> = {};
//     const totalSundays = getSundaysCount(month, year);

//     dbLogs.forEach((row: any) => {
//       const empId = row.employee_id;
//       let serial = row.serial_number;

//       // If serial is missing or invalid, resolve it on the fly!
//       if (!serial || serial === "" || serial === "-") {
//         const storeName = row.store_name || empStoreMap.get(empId?.toString().trim().toLowerCase()) || "";
//         const matchedDevice = DEVICES.find(
//           (d) => d.name.toUpperCase() === storeName.toUpperCase()
//         );
//         if (matchedDevice) {
//           serial = matchedDevice.serial;
//         }
//       }

//       if (!empId || !serial || serial === "" || serial === "-") return;

//       // Filter by the requested devices (if deviceFilter is not "ALL")
//       if (!serials.includes(serial)) return;

//       const aggKey = `${empId}_${serial}`;

//       if (!monthlyAgg[aggKey]) {
//         monthlyAgg[aggKey] = {
//           employee_code: empId,
//           employee_name: row.employee_name || "Unknown",
//           designation: row.designation || "-",
//           store_name: row.store_name || "-",
//           device_id: row.device_id || "-",
//           serial_no: serial,
//           presentDays: 0,
//           absentDays: 0,
//           punchMissDays: 0,
//           lateDays: 0,
//           totalWorkSecs: 0,
//           totalLunchSecs: 0,
//         };
//       }

//       const agg = monthlyAgg[aggKey];
//       const status = row.status;

//       // Accumulate present/absent counts
//       if (status === "Present" || status === "Late" || status === "Half Day") {
//         agg.presentDays += 1;
//       } else if (status === "Absent") {
//         agg.absentDays += 1;
//       }

//       // Late count
//       if (status === "Late" || (row.late_minute && row.late_minute > 0)) {
//         agg.lateDays += 1;
//       }

//       // Punch misses
//       if (row.punch_miss === "Yes" || row.punch_miss === true) {
//         agg.punchMissDays += 1;
//       }

//       // Total times
//       agg.totalWorkSecs += parseTimeToSeconds(row.working_hour);
//       agg.totalLunchSecs += parseTimeToSeconds(row.standard_lunch);
//     });

//     // 8. Map to the database row shape, filtering to only verified employees
//     const finalData = Object.values(monthlyAgg)
//       .filter((agg: any) => {
//         const code = agg.employee_code?.toString().trim().toLowerCase();
//         return code && validEmployeeIds.has(code);
//       })
//       .map((agg: any) => {
//         return {
//           year: year,
//           month: monthNames[month! - 1],
//           employee_code: agg.employee_code,
//           employee_name: agg.employee_name,
//           designation: agg.designation,
//           store_name: agg.store_name,
//           device_id: agg.device_id,
//           serial_no: agg.serial_no,
//           present_days: agg.presentDays,
//           absent_days: agg.absentDays,
//           punch_miss: agg.punchMissDays,
//           late_days: agg.lateDays,
//           total_work_hours: formatSecsToHrsMins(agg.totalWorkSecs),
//           total_work_secs: agg.totalWorkSecs,
//           total_lunch_time: formatSecsToHrsMins(agg.totalLunchSecs),
//           total_lunch_secs: agg.totalLunchSecs,
//           holidays: totalSundays,
//           last_synced_at: new Date().toISOString(),
//         };
//       });

//     console.log(`[sync-monthly-attendance] Aggregated ${finalData.length} monthly employee records.`);

//     // 9. Batch upsert to database table: `attendance_monthly`
//     let upsertedCount = 0;
//     if (finalData.length > 0) {
//       const batchSize = 50;
//       for (let i = 0; i < finalData.length; i += batchSize) {
//         const batch = finalData.slice(i, i + batchSize);
//         const { error } = await supabaseClient
//           .from("attendance_monthly")
//           .upsert(batch, { onConflict: "year,month,employee_code,serial_no" });

//         if (error) {
//           console.error("[sync-monthly-attendance] Error during upsert:", error);
//           throw new Error(`Supabase Upsert Error: ${error.message}`);
//         }
//         upsertedCount += batch.length;
//       }
//     }

//     return new Response(
//       JSON.stringify({
//         success: true,
//         month: monthNames[month - 1],
//         year,
//         aggregated: finalData.length,
//         upserted: upsertedCount,
//       }),
//       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
//     );

//   } catch (err) {
//     console.error("[sync-monthly-attendance] Fatal error:", err);
//     return new Response(
//       JSON.stringify({ success: false, error: (err as Error).message }),
//       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
//     );
//   }
// });