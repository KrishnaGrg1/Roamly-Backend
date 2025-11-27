import express from 'express';
import mainRoutes from './routes/mainRoutes';
import env from './config/env';

const app = express();
const Port = env.PORT;
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});
app.use('/api/v1', mainRoutes);
app.listen(Port, () => {
  console.log(`Server is running on port ${Port}`);
});
