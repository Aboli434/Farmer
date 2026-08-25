import morgan from 'morgan';
import { logger } from '../utils/logger';

// Create a custom Morgan format that includes the request ID
morgan.token('reqId', (req) => {
  return (req.headers['x-request-id'] as string) || '-';
});

const morganFormat = process.env.NODE_ENV === 'production'
  ? ':reqId :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms'
  : '[:reqId] :method :url :status :response-time ms - :res[content-length]';

export const requestLogger = morgan(morganFormat, {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
});
