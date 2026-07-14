import express from 'express';
import cors from 'cors';
import postsRouter from './routes/posts.routes';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/posts', postsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
