import express from 'express';
import mainRoutes from './routes/main.routes';
import env from './config/env';

const app = express();
const Port = env.PORT;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/api/v1', mainRoutes);

const server = app.listen(Port, () => {
  console.log(`🚀 Server is running on port ${Port}`);
  console.log(`📁 File uploads enabled (max 5MB)`);
});
