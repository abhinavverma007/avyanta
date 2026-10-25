require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { startDayCloseScheduler } = require('./utils/dailyReportEnforcement');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  // After midnight (IST), anyone who punched in but never submitted that day's daily report is marked absent.
  startDayCloseScheduler();
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
