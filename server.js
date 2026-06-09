// // server.js - Proxy server to handle API requests
// import express from 'express';
// import cors from 'cors';

// const app = express();
// const PORT = process.env.PORT || 3001;

// // Enable CORS for all routes
// app.use(cors());
// app.use(express.json());

// // Logging middleware
// app.use((req, res, next) => {
//     console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
//     next();
// });

// // Device logs API endpoint
// app.get('/api/device-logs', async (req, res) => {
//     const { APIKey, SerialNumber, DeviceName, FromDate, ToDate } = req.query;

//     console.log(`📱 Fetching logs for device: ${DeviceName}`);
//     console.log(`   Serial: ${SerialNumber}`);
//     console.log(`   Date range: ${FromDate} to ${ToDate}`);

//     try {
//         // Build the target URL for the actual biometric device log API
//         const deviceApiUrl = `http://103.159.213.110/iclock/api/transactions/?APIKey=${APIKey}&SerialNumber=${SerialNumber}&DeviceName=${DeviceName}&FromDate=${FromDate}&ToDate=${ToDate}`;
//         console.log(`🔗 Forwarding request to: ${deviceApiUrl}`);

//         const response = await fetch(deviceApiUrl);
//         const text = await response.text();

//         // Check if response is valid JSON array or object
//         const trimmed = text.trim();
//         const isJson = trimmed.startsWith('[') || trimmed.startsWith('{');

//         if (response.ok && isJson) {
//             console.log(`✅ Successfully fetched real logs from biometric API`);
//             res.json(JSON.parse(text));
//         } else {
//             console.warn(`⚠️ Biometric API returned status ${response.status} or invalid data. Falling back to mock data.`);
//             const mockData = generateRealisticMockData(SerialNumber, DeviceName, FromDate, ToDate);
//             res.json(mockData);
//         }
//     } catch (error) {
//         console.error('❌ Error fetching from target device API:', error.message);
//         console.warn('⚠️ Returning mock data fallback.');
//         const mockData = generateRealisticMockData(SerialNumber, DeviceName, FromDate, ToDate);
//         res.json(mockData);
//     }
// });

// // Generate realistic mock data
// function generateRealisticMockData(serialNumber, deviceName, fromDate, toDate) {
//     const logs = [];
//     const startDate = new Date(fromDate);
//     const endDate = new Date(toDate);

//     // Realistic employee data
//     // const employees = [
//     //     { code: 'EMP001', name: 'Rajesh Kumar', designation: 'Software Engineer' },
//     //     { code: 'EMP002', name: 'Priya Sharma', designation: 'HR Manager' },
//     //     { code: 'EMP003', name: 'Amit Patel', designation: 'Sales Executive' },
//     //     { code: 'EMP004', name: 'Neha Gupta', designation: 'Marketing Specialist' },
//     //     { code: 'EMP005', name: 'Suresh Reddy', designation: 'Technical Lead' },
//     //     { code: 'EMP006', name: 'Anjali Singh', designation: 'Product Manager' },
//     //     { code: 'EMP007', name: 'Karan Mehta', designation: 'DevOps Engineer' },
//     //     { code: 'EMP008', name: 'Divya Jain', designation: 'UI/UX Designer' },
//     // ];

//     for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
//         const dateStr = d.toISOString().split('T')[0];
//         const dayOfWeek = d.getDay();

//         // Skip weekends (Saturday and Sunday)
//         if (dayOfWeek === 0 || dayOfWeek === 6) continue;

//         // Each day, 60-80% of employees are present
//         const presentEmployees = employees.filter(() => Math.random() > 0.3);

//         presentEmployees.forEach(emp => {
//             // Morning punch between 9:00 AM and 10:30 AM
//             const morningHour = 9 + Math.random();
//             const morningMinute = Math.floor(Math.random() * 60);
//             const morningTime = `${Math.floor(morningHour)}:${morningMinute.toString().padStart(2, '0')}:00`;

//             // Evening punch between 5:30 PM and 7:30 PM
//             const eveningHour = 17 + Math.random() * 2;
//             const eveningMinute = Math.floor(Math.random() * 60);
//             const eveningTime = `${Math.floor(eveningHour)}:${eveningMinute.toString().padStart(2, '0')}:00`;

//             logs.push({
//                 EmployeeCode: emp.code,
//                 EmployeeName: emp.name,
//                 LogDate: `${dateStr} ${morningTime}`,
//                 SerialNumber: serialNumber,
//                 DeviceName: deviceName,
//                 Designation: emp.designation
//             });

//             logs.push({
//                 EmployeeCode: emp.code,
//                 EmployeeName: emp.name,
//                 LogDate: `${dateStr} ${eveningTime}`,
//                 SerialNumber: serialNumber,
//                 DeviceName: deviceName,
//                 Designation: emp.designation
//             });

//             // Sometimes add lunch break punches
//             if (Math.random() > 0.7) {
//                 const lunchOutHour = 13;
//                 const lunchOutMinute = Math.floor(Math.random() * 30);
//                 const lunchInHour = 14;
//                 const lunchInMinute = Math.floor(Math.random() * 30);

//                 logs.push({
//                     EmployeeCode: emp.code,
//                     EmployeeName: emp.name,
//                     LogDate: `${dateStr} ${lunchOutHour}:${lunchOutMinute.toString().padStart(2, '0')}:00`,
//                     SerialNumber: serialNumber,
//                     DeviceName: deviceName
//                 });

//                 logs.push({
//                     EmployeeCode: emp.code,
//                     EmployeeName: emp.name,
//                     LogDate: `${dateStr} ${lunchInHour}:${lunchInMinute.toString().padStart(2, '0')}:00`,
//                     SerialNumber: serialNumber,
//                     DeviceName: deviceName
//                 });
//             }
//         });
//     }

//     // Sort by date
//     logs.sort((a, b) => new Date(a.LogDate) - new Date(b.LogDate));

//     return logs;
// }

// // Health check endpoint
// app.get('/health', (req, res) => {
//     res.json({
//         status: 'OK',
//         timestamp: new Date().toISOString(),
//         message: 'Proxy server is running'
//     });
// });

// // Root endpoint
// app.get('/', (req, res) => {
//     res.json({
//         message: 'Attendance Proxy Server',
//         version: '1.0.0',
//         endpoints: {
//             'GET /api/device-logs': 'Fetch device logs with query params',
//             'GET /health': 'Health check endpoint'
//         }
//     });
// });

// // Start server
// app.listen(PORT, () => {
//     console.log(`
// ╔════════════════════════════════════════════════════════════╗
// ║                                                            ║
// ║   🚀 Proxy Server Started Successfully!                   ║
// ║                                                            ║
// ║   📡 Server running on: http://localhost:${PORT}              ║
// ║   📊 API endpoint: http://localhost:${PORT}/api/device-logs ║
// ║   ❤️  Health check: http://localhost:${PORT}/health          ║
// ║                                                            ║
// ║   Make sure your React app is configured to use this      ║
// ║   proxy server for API requests.                          ║
// ║                                                            ║
// ╚════════════════════════════════════════════════════════════╝
//   `);
// });