import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

// ---------------- CONFIG ----------------

const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_SERVICE_KEY = "YOUR_SERVICE_ROLE_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const API_KEY = "211616032630";

const DEVICES = [
    {
        name: "BAWDHAN",
        apiName: "BAVDHAN",
        serial: "C26238441B1E342D",
    },
    {
        name: "HINJEWADI",
        apiName: "HINJEWADI",
        serial: "AMDB25061400335",
    },
    {
        name: "WAGHOLI",
        apiName: "WAGHOLI",
        serial: "AMDB25061400343",
    },
    {
        name: "AKOLE",
        apiName: "AKOLE",
        serial: "C262CC13CF202038",
    },
    {
        name: "MUMBAI",
        apiName: "MUMBAI",
        serial: "C2630450C32A2327",
    },
];

// ---------------- DATE ----------------

const DATE = process.argv[2];

if (!DATE) {
    console.log("Usage:");
    console.log("node syncAttendance.js YYYY-MM-DD");
    process.exit();
}

console.log("Sync Date :", DATE);

// ---------------- FETCH LOGS ----------------

async function fetchLogs(device) {
    const url =
        `http://YOUR_SERVER/api/device-logs` +
        `?APIKey=${API_KEY}` +
        `&SerialNumber=${device.serial}` +
        `&DeviceName=${device.apiName}` +
        `&FromDate=${DATE}` +
        `&ToDate=${DATE}`;

    console.log("Fetching", device.name);

    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`${device.name} failed`);
    }

    return await res.json();
}

// ---------------- MAIN ----------------

async function main() {
    let allLogs = [];

    for (const device of DEVICES) {
        try {
            const logs = await fetchLogs(device);

            console.log(device.name, logs.length);

            allLogs.push(...logs);
        } catch (err) {
            console.log(err.message);
        }
    }

    console.log("Total Logs :", allLogs.length);

    const grouped = {};

    for (const log of allLogs) {
        const key = `${log.EmployeeCode}_${DATE}`;

        if (!grouped[key]) grouped[key] = [];

        grouped[key].push(log);
    }

    const rows = [];

    for (const key in grouped) {
        const logs = grouped[key];

        logs.sort((a, b) => new Date(a.LogDate) - new Date(b.LogDate));

        const first = logs[0];
        const last = logs[logs.length - 1];

        rows.push({
            employee_id: first.EmployeeCode,
            attendance_date: DATE,
            in_time: first.LogDate,
            out_time: last.LogDate,
            punch_log: logs.map((x) => x.LogDate).join(" | "),
            updated_at: new Date(),
        });
    }

    console.log("Saving", rows.length, "records...");

    const { error } = await supabase
        .from("attendance_logs")
        .upsert(rows, {
            onConflict: "employee_id,attendance_date",
        });

    if (error) {
        console.log(error);
        return;
    }

    console.log("Done.");
}

main();